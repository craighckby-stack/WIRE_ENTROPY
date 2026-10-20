import Database from 'better-sqlite3';

const db = new Database(process.env.DB_PATH || 'wire_entropy.db');

// Enable WAL mode for high performance concurrent reads and writes
db.pragma('journal_mode = WAL');

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS siphon_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    event_type TEXT NOT NULL,
    payload TEXT NOT NULL,
    system_load REAL NOT NULL,
    execution_time_ms REAL DEFAULT 0,
    hash TEXT,
    entropy REAL DEFAULT 0,
    byte_size INTEGER DEFAULT 0
  );
`);

// Safe migration for pre-existing database tables
try {
  const columns = (db.prepare("PRAGMA table_info(siphon_events)").all() as Array<{ name: string }>).map(c => c.name);
  if (!columns.includes("execution_time_ms")) {
    db.exec("ALTER TABLE siphon_events ADD COLUMN execution_time_ms REAL DEFAULT 0");
  }
  if (!columns.includes("hash")) {
    db.exec("ALTER TABLE siphon_events ADD COLUMN hash TEXT");
  }
  if (!columns.includes("entropy")) {
    db.exec("ALTER TABLE siphon_events ADD COLUMN entropy REAL DEFAULT 0");
  }
  if (!columns.includes("byte_size")) {
    db.exec("ALTER TABLE siphon_events ADD COLUMN byte_size INTEGER DEFAULT 0");
  }
} catch (migErr) {
  console.warn("Migration warning:", migErr);
}

db.exec(`

  CREATE TABLE IF NOT EXISTS schema_registry (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    version TEXT NOT NULL,
    type TEXT NOT NULL,
    schema_def TEXT NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'ACTIVE'
  );

  CREATE TABLE IF NOT EXISTS system_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    level TEXT NOT NULL,
    module TEXT NOT NULL,
    message TEXT NOT NULL,
    details TEXT
  );

  CREATE TABLE IF NOT EXISTS telemetry_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    cpu_percent REAL NOT NULL,
    memory_used_mb REAL NOT NULL,
    memory_total_mb REAL NOT NULL,
    heap_used_mb REAL NOT NULL,
    load_avg_1m REAL NOT NULL,
    latency_ms REAL NOT NULL
  );
`);

export interface SiphonEvent {
  id?: number;
  timestamp?: string;
  event_type: string;
  payload: string;
  system_load: number;
  execution_time_ms?: number;
  hash?: string;
  entropy?: number;
  byte_size?: number;
}

export interface SchemaItem {
  id: string;
  name: string;
  version: string;
  type: string;
  schema_def: string;
  description: string;
  created_at?: string;
  status?: string;
}

export interface SystemLogItem {
  id?: number;
  timestamp?: string;
  level: 'INF' | 'WRN' | 'ERR' | 'SYS' | 'ACT';
  module: string;
  message: string;
  details?: string;
}

export interface TelemetryPoint {
  id?: number;
  timestamp?: string;
  cpu_percent: number;
  memory_used_mb: number;
  memory_total_mb: number;
  heap_used_mb: number;
  load_avg_1m: number;
  latency_ms: number;
}

// Seed default schemas and initial boot logs if empty
function seedIfEmpty() {
  const schemaCount = db.prepare('SELECT COUNT(*) as count FROM schema_registry').get() as { count: number };
  if (schemaCount.count === 0) {
    const insertSchema = db.prepare(`
      INSERT INTO schema_registry (id, name, version, type, schema_def, description)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    insertSchema.run(
      'sch_wire_pkt_v1',
      'Wire-Packet-Frame',
      '1.0.4',
      'binary-frame',
      JSON.stringify({
        magic: "0x5745",
        header: { version: "uint8", flags: "uint8", sequenceId: "uint32" },
        payloadLength: "uint16",
        checksum: "sha256"
      }, null, 2),
      'Core transport frame specification for node-to-node telemetry multiplexing.'
    );

    insertSchema.run(
      'sch_stream_buffer_v2',
      'Stream-Buffer-Contract',
      '2.1.0',
      'stream-contract',
      JSON.stringify({
        streamId: "uuid",
        channel: "wire://stream.flow/primary",
        bufferCapacityBytes: 65536,
        codec: "deflate+xor",
        entropyThreshold: 4.8
      }, null, 2),
      'High-throughput buffered ingestion pipeline contract with stream-entropy validation.'
    );

    insertSchema.run(
      'sch_node_state_v1',
      'Node-State-Contract',
      '1.0.1',
      'state-contract',
      JSON.stringify({
        nodeId: "string",
        kernelVersion: "string",
        cpuCores: "number",
        memoryLimitMb: "number",
        status: "enum:ACTIVE|DRAINING|OFFLINE"
      }, null, 2),
      'Host node hardware signature and operational state registration schema.'
    );
  }

  const logCount = db.prepare('SELECT COUNT(*) as count FROM system_logs').get() as { count: number };
  if (logCount.count === 0) {
    const insertLog = db.prepare(`
      INSERT INTO system_logs (level, module, message, details)
      VALUES (?, ?, ?, ?)
    `);

    insertLog.run('SYS', 'KERNEL', 'WireEntropy Host Engine v1.0.0 initialized on host hardware', 'Architecture online');
    insertLog.run('INF', 'REGISTRY', 'Schema Contract Registry synchronized with local SQLite persistent storage', 'Contracts active');
    insertLog.run('INF', 'PIPELINE', 'Multi-algorithm compression engine ready', 'Deflate, Gzip, and Brotli benchmarks enabled');
    insertLog.run('ACT', 'TELEMETRY', 'Telemetry collection cycle initiated at hardware tick interval', 'Active');
    insertLog.run('SYS', 'SECURITY', 'Cryptographic verification engine ready (SHA-256, Shannon entropy)', 'Zero mock fallbacks active');
  }
}

seedIfEmpty();

export const WireDB = {
  // Siphon / Binary events
  logEvent: (event: SiphonEvent) => {
    const stmt = db.prepare(`
      INSERT INTO siphon_events (event_type, payload, system_load, execution_time_ms, hash, entropy, byte_size)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    return stmt.run(
      event.event_type,
      event.payload,
      event.system_load,
      event.execution_time_ms || 0,
      event.hash || '',
      event.entropy || 0,
      event.byte_size || (event.payload ? Buffer.byteLength(event.payload, 'utf8') : 0)
    );
  },
  getRecentEvents: (limit = 20) => {
    const safeLimit = Math.max(1, Math.min(Number(limit) || 20, 500));
    const stmt = db.prepare('SELECT * FROM siphon_events ORDER BY id DESC LIMIT ?');
    return stmt.all(safeLimit) as SiphonEvent[];
  },
  getPayloadCount: (): number => {
    try {
      const row = db.prepare('SELECT COUNT(*) as count FROM siphon_events').get() as { count: number };
      return row?.count || 0;
    } catch {
      return 0;
    }
  },

  // System Logs
  logSystemLog: (level: SystemLogItem['level'], module: string, message: string, details = '') => {
    const stmt = db.prepare(`
      INSERT INTO system_logs (level, module, message, details)
      VALUES (?, ?, ?, ?)
    `);
    return stmt.run(level, module, message, details);
  },
  getSystemLogs: (limit = 50, level?: string, search?: string) => {
    const safeLimit = Math.max(1, Math.min(Number(limit) || 50, 500));
    let query = 'SELECT * FROM system_logs WHERE 1=1';
    const params: any[] = [];

    if (level && level !== 'ALL') {
      query += ' AND level = ?';
      params.push(level);
    }
    if (search && search.trim() !== '') {
      query += ' AND (message LIKE ? OR module LIKE ? OR details LIKE ?)';
      const term = `%${search.trim()}%`;
      params.push(term, term, term);
    }

    query += ' ORDER BY id DESC LIMIT ?';
    params.push(safeLimit);

    return db.prepare(query).all(...params) as SystemLogItem[];
  },

  // Telemetry History
  recordTelemetry: (data: Omit<TelemetryPoint, 'id' | 'timestamp'>) => {
    const stmt = db.prepare(`
      INSERT INTO telemetry_history (cpu_percent, memory_used_mb, memory_total_mb, heap_used_mb, load_avg_1m, latency_ms)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    return stmt.run(
      data.cpu_percent,
      data.memory_used_mb,
      data.memory_total_mb,
      data.heap_used_mb,
      data.load_avg_1m,
      data.latency_ms
    );
  },
  getTelemetryHistory: (limit = 50) => {
    const safeLimit = Math.max(1, Math.min(Number(limit) || 50, 500));
    const stmt = db.prepare('SELECT * FROM telemetry_history ORDER BY id DESC LIMIT ?');
    const rows = stmt.all(safeLimit) as TelemetryPoint[];
    return rows.reverse(); // chronological order
  },

  // Schema Registry
  getSchemas: () => {
    return db.prepare('SELECT * FROM schema_registry ORDER BY created_at DESC').all() as SchemaItem[];
  },
  getSchemaById: (id: string) => {
    return db.prepare('SELECT * FROM schema_registry WHERE id = ?').get(id) as SchemaItem | undefined;
  },
  createSchema: (schema: Omit<SchemaItem, 'created_at'>) => {
    const stmt = db.prepare(`
      INSERT INTO schema_registry (id, name, version, type, schema_def, description, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    return stmt.run(
      schema.id,
      schema.name,
      schema.version,
      schema.type,
      schema.schema_def,
      schema.description,
      schema.status || 'ACTIVE'
    );
  },
  deleteSchema: (id: string) => {
    return db.prepare('DELETE FROM schema_registry WHERE id = ?').run(id);
  }
};

export const AeorDB = WireDB;
