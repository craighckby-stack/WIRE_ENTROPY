import "dotenv/config";
import express, { Request, Response } from "express";
import path from "path";
import os from "os";
import crypto from "crypto";
import zlib from "zlib";
import { monitorEventLoopDelay } from "perf_hooks";
import { createServer as createViteServer } from "vite";
import { WireDB, SiphonEvent, SystemLogItem } from "./src/services/dbService";
import { GoogleGenAI } from "@google/genai";

// Real event loop delay monitor (nanosecond resolution)
const loopDelay = monitorEventLoopDelay({ resolution: 20 });
loopDelay.enable();

function getRealEventLoopLagMs(): number {
  const lagNs = loopDelay.mean;
  if (!lagNs || isNaN(lagNs)) return 0.5;
  return parseFloat((lagNs / 1_000_000).toFixed(2));
}

// Dedicated 1-second background CPU sampler (prevents multi-client baseline mutation)
let sampledCpuUsage = 0;
let prevCpusSnapshot = os.cpus();

setInterval(() => {
  try {
    const currentCpus = os.cpus();
    let idleDiff = 0;
    let totalDiff = 0;

    for (let i = 0; i < currentCpus.length; i++) {
      const prev = prevCpusSnapshot[i]?.times;
      const curr = currentCpus[i]?.times;
      if (!prev || !curr) continue;

      const prevIdle = prev.idle;
      const currIdle = curr.idle;
      const prevTotal = prev.user + prev.nice + prev.sys + prev.idle + prev.irq;
      const currTotal = curr.user + curr.nice + curr.sys + curr.idle + curr.irq;

      idleDiff += (currIdle - prevIdle);
      totalDiff += (currTotal - prevTotal);
    }

    prevCpusSnapshot = currentCpus;

    if (totalDiff > 0) {
      const usage = 100 - (100 * idleDiff / totalDiff);
      sampledCpuUsage = Math.max(0, Math.min(100, parseFloat(usage.toFixed(1))));
    } else {
      const load = os.loadavg()[0];
      const cpusCount = os.cpus().length || 1;
      sampledCpuUsage = Math.min(100, Math.max(0.1, parseFloat(((load / cpusCount) * 100).toFixed(1))));
    }
  } catch (err) {
    console.error("CPU sampler error:", err);
  }
}, 1000);

function getRealCpuUsage(): number {
  return sampledCpuUsage;
}

// Calculate true Shannon entropy (bits per byte, 0.0 to 8.0)
function calculateShannonEntropy(buffer: Buffer): number {
  if (buffer.length === 0) return 0;
  const freq = new Map<number, number>();
  for (const byte of buffer) {
    freq.set(byte, (freq.get(byte) || 0) + 1);
  }
  let entropy = 0;
  for (const count of freq.values()) {
    const p = count / buffer.length;
    entropy -= p * Math.log2(p);
  }
  return parseFloat(entropy.toFixed(3));
}

// Traffic accounting
let totalHttpRequests = 0;
let totalBytesTransferred = 0;
const serverStartTime = Date.now();

// Background telemetry recorder into SQLite (every 5 seconds)
setInterval(() => {
  try {
    const cpu = getRealCpuUsage();
    const memUsage = process.memoryUsage();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMemMb = (totalMem - freeMem) / (1024 * 1024);
    const totalMemMb = totalMem / (1024 * 1024);
    const heapUsedMb = memUsage.heapUsed / (1024 * 1024);
    const loadAvg = os.loadavg()[0];
    const realLatency = getRealEventLoopLagMs();

    WireDB.recordTelemetry({
      cpu_percent: cpu,
      memory_used_mb: parseFloat(usedMemMb.toFixed(1)),
      memory_total_mb: parseFloat(totalMemMb.toFixed(1)),
      heap_used_mb: parseFloat(heapUsedMb.toFixed(1)),
      load_avg_1m: parseFloat(loadAvg.toFixed(2)),
      latency_ms: realLatency
    });
  } catch (err) {
    console.error("Telemetry recording error:", err);
  }
}, 5000);

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  app.use(express.json({ limit: "10mb" }));

  // Middleware to count real incoming HTTP requests and byte volume
  app.use((req, res, next) => {
    totalHttpRequests++;
    if (req.headers["content-length"]) {
      totalBytesTransferred += parseInt(req.headers["content-length"], 10) || 0;
    }
    next();
  });

  // --- REAL HOST TELEMETRY & KERNEL APIS ---

  app.get("/api/telemetry", (req: Request, res: Response) => {
    const cpu = getRealCpuUsage();
    const memUsage = process.memoryUsage();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memoryPercent = (usedMem / totalMem) * 100;
    const latency = getRealEventLoopLagMs();

    res.json({
      cpu,
      memory: parseFloat(memoryPercent.toFixed(1)),
      memoryTotalMb: parseFloat((totalMem / (1024 * 1024)).toFixed(0)),
      memoryFreeMb: parseFloat((freeMem / (1024 * 1024)).toFixed(0)),
      memoryUsedMb: parseFloat((usedMem / (1024 * 1024)).toFixed(0)),
      heapUsedMb: parseFloat((memUsage.heapUsed / (1024 * 1024)).toFixed(1)),
      heapTotalMb: parseFloat((memUsage.heapTotal / (1024 * 1024)).toFixed(1)),
      rssMb: parseFloat((memUsage.rss / (1024 * 1024)).toFixed(1)),
      loadAvg: os.loadavg(),
      uptimeSeconds: Math.floor(process.uptime()),
      systemUptimeSeconds: Math.floor(os.uptime()),
      packets: WireDB.getPayloadCount(),
      httpRequests: totalHttpRequests,
      bytesIngested: totalBytesTransferred,
      latency,
      hostname: os.hostname(),
      timestamp: new Date().toISOString()
    });
  });

  // Server-Sent Events (SSE) telemetry stream with 100% real host values
  app.get("/api/telemetry/stream", (req: Request, res: Response) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    const interval = setInterval(() => {
      const cpu = getRealCpuUsage();
      const memUsage = process.memoryUsage();
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const usedMem = totalMem - freeMem;
      const memoryPercent = (usedMem / totalMem) * 100;

      const payload = {
        cpu,
        memory: parseFloat(memoryPercent.toFixed(1)),
        memoryUsedMb: parseFloat((usedMem / (1024 * 1024)).toFixed(1)),
        memoryTotalMb: parseFloat((totalMem / (1024 * 1024)).toFixed(1)),
        heapUsedMb: parseFloat((memUsage.heapUsed / (1024 * 1024)).toFixed(1)),
        rssMb: parseFloat((memUsage.rss / (1024 * 1024)).toFixed(1)),
        loadAvg: parseFloat(os.loadavg()[0].toFixed(2)),
        latencyMs: getRealEventLoopLagMs(),
        packets: WireDB.getPayloadCount(),
        httpRequests: totalHttpRequests,
        bytesIngested: totalBytesTransferred,
        timestamp: new Date().toISOString()
      };

      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    }, 1500);

    req.on("close", () => {
      clearInterval(interval);
    });
  });

  // Telemetry historical points from SQLite
  app.get("/api/telemetry/history", (req: Request, res: Response) => {
    const rawLimit = req.query.limit as string;
    const limit = Math.max(1, Math.min(parseInt(rawLimit, 10) || 50, 500));
    const history = WireDB.getTelemetryHistory(limit);
    res.json(history);
  });

  // Hardware & Kernel details
  app.get("/api/system/kernel", (req: Request, res: Response) => {
    const cpus = os.cpus();
    const networkInterfaces = os.networkInterfaces();

    const cpuInfo = {
      model: cpus[0]?.model || "Generic CPU",
      cores: cpus.length,
      speedMhz: cpus[0]?.speed || 0,
      coreDetails: cpus.map((c, i) => ({
        coreId: i,
        model: c.model,
        speed: c.speed,
        times: c.times
      }))
    };

    res.json({
      kernel: {
        type: os.type(),
        platform: os.platform(),
        arch: os.arch(),
        architecture: os.arch(),
        release: os.release(),
        hostname: os.hostname(),
        nodeVersion: process.version,
        pid: process.pid,
        execPath: process.execPath,
        title: process.title || "node"
      },
      cpu: cpuInfo,
      cpuSpecs: cpuInfo,
      memory: {
        totalBytes: os.totalmem(),
        freeBytes: os.freemem(),
        processUsage: process.memoryUsage()
      },
      network: networkInterfaces,
      uptime: {
        systemSeconds: Math.floor(os.uptime()),
        processSeconds: Math.floor(process.uptime()),
        startedAt: new Date(serverStartTime).toISOString()
      }
    });
  });

  // Real Diagnostic Probes endpoint
  app.post("/api/system/probe", (req: Request, res: Response) => {
    const { probeType = "MEMORY_ALLOC", sizeMb = 32 } = req.body;

    try {
      if (probeType === "MEMORY_ALLOC") {
        const memBefore = process.memoryUsage();
        const allocBytes = Math.min(64, Math.max(4, Number(sizeMb) || 32)) * 1024 * 1024;
        
        const startTime = process.hrtime.bigint();
        // Allocate physical buffer and fill with test bit pattern
        const testBuffer = Buffer.alloc(allocBytes, 0x5A);
        const memPeak = process.memoryUsage();
        const endTime = process.hrtime.bigint();

        // Check buffer integrity
        const checksum = crypto.createHash("sha256").update(testBuffer.subarray(0, 1024)).digest("hex");
        const elapsedMs = parseFloat((Number(endTime - startTime) / 1_000_000).toFixed(2));
        const deltaMb = parseFloat(((memPeak.heapUsed - memBefore.heapUsed) / (1024 * 1024)).toFixed(2));

        WireDB.logSystemLog("ACT", "PROBE", `Memory allocation probe executed: ${sizeMb}MB buffer allocated in ${elapsedMs}ms`, `Checksum: ${checksum.slice(0, 12)}`);

        res.json({
          probeType,
          success: true,
          allocatedBytes: allocBytes,
          allocatedMb: sizeMb,
          heapBeforeMb: parseFloat((memBefore.heapUsed / (1024 * 1024)).toFixed(2)),
          heapPeakMb: parseFloat((memPeak.heapUsed / (1024 * 1024)).toFixed(2)),
          heapDeltaMb: deltaMb,
          rssMb: parseFloat((memPeak.rss / (1024 * 1024)).toFixed(2)),
          executionTimeMs: elapsedMs,
          headerChecksum: checksum
        });
      } else if (probeType === "ENTROPY_SCAN") {
        const startTime = process.hrtime.bigint();
        // Pull 64KB true cryptographic randomness from kernel
        const kernelBytes = crypto.randomBytes(65536);
        const entropy = calculateShannonEntropy(kernelBytes);
        const endTime = process.hrtime.bigint();
        const elapsedMs = parseFloat((Number(endTime - startTime) / 1_000_000).toFixed(2));

        WireDB.logSystemLog("ACT", "PROBE", `Entropy scan of kernel RNG pool: ${entropy}/8.000 bits`, `${elapsedMs}ms`);

        res.json({
          probeType,
          success: true,
          sampledBytes: 65536,
          entropyScore: entropy,
          quality: entropy > 7.9 ? "HIGH_ENTROPY_CRYPTOGRAPHIC" : "DEGRADED",
          executionTimeMs: elapsedMs
        });
      } else if (probeType === "CRYPTO_BENCH") {
        const testPayload = crypto.randomBytes(1024 * 1024); // 1 MB
        const iterations = 25;
        const startTime = process.hrtime.bigint();
        
        let lastHash = "";
        for (let i = 0; i < iterations; i++) {
          lastHash = crypto.createHash("sha256").update(testPayload).digest("hex");
        }
        const endTime = process.hrtime.bigint();
        const totalMs = parseFloat((Number(endTime - startTime) / 1_000_000).toFixed(2));
        const throughputMbSec = parseFloat(((iterations / (totalMs / 1000))).toFixed(1));

        WireDB.logSystemLog("ACT", "PROBE", `SHA-256 hardware benchmark: ${throughputMbSec} MB/s across ${iterations}MB`, `Hash: ${lastHash.slice(0, 12)}`);

        res.json({
          probeType,
          success: true,
          iterations,
          totalDataMb: iterations,
          executionTimeMs: totalMs,
          throughputMbSec,
          sampleDigest: lastHash
        });
      } else {
        res.json({
          probeType: "EVENT_LOOP",
          success: true,
          eventLoopLagMs: getRealEventLoopLagMs(),
          minMs: parseFloat((loopDelay.min / 1e6).toFixed(3)),
          maxMs: parseFloat((loopDelay.max / 1e6).toFixed(3)),
          meanMs: parseFloat((loopDelay.mean / 1e6).toFixed(3)),
          p99Ms: parseFloat((loopDelay.percentile(99) / 1e6).toFixed(3))
        });
      }
    } catch (err: any) {
      res.status(500).json({ error: "Probe failed", message: err.message });
    }
  });

  // Telemetry History
  app.get("/api/telemetry/history", (req: Request, res: Response) => {
    const rawLimit = req.query.limit as string;
    const limit = Math.max(1, Math.min(parseInt(rawLimit, 10) || 50, 500));
    const history = WireDB.getTelemetryHistory(limit);
    res.json(history);
  });

  // --- MULTI-ALGORITHM PROTOCOL OPTIMIZER & PIPELINE ---

  app.post("/api/siphon/process", (req: Request, res: Response) => {
    const totalStart = process.hrtime.bigint();
    const { payload, eventType = "DATA_CHUNK", xorKey = 0xAA, applyCompression = true } = req.body;

    if (payload === undefined || payload === null) {
      res.status(400).json({ error: "Missing payload to process" });
      return;
    }

    try {
      const buffer = Buffer.from(typeof payload === "string" ? payload : JSON.stringify(payload), "utf8");
      const byteSize = buffer.length;

      // 1. Cryptographic Hashing
      const sha256 = crypto.createHash("sha256").update(buffer).digest("hex");
      const md5 = crypto.createHash("md5").update(buffer).digest("hex");

      // 2. Shannon Entropy
      const entropy = calculateShannonEntropy(buffer);

      // 3. Bitwise XOR Transformation (accurately handles 0x00)
      let parsedKey = 0xAA;
      if (typeof xorKey === "number" && !isNaN(xorKey)) {
        parsedKey = xorKey & 0xFF;
      } else if (typeof xorKey === "string") {
        const clean = xorKey.trim().replace(/^0x/i, "");
        const p = parseInt(clean, 16);
        if (!isNaN(p)) parsedKey = p & 0xFF;
      }

      const invertedBuffer = Buffer.alloc(buffer.length);
      const xorBuffer = Buffer.alloc(buffer.length);
      for (let i = 0; i < buffer.length; i++) {
        invertedBuffer[i] = ~buffer[i] & 0xFF;
        xorBuffer[i] = buffer[i] ^ parsedKey;
      }

      // 4. Multi-Algorithm Benchmarking: Deflate, Gzip, and Brotli
      const benchmarks: Record<string, { size: number; ratio: number; savingsPercent: number; executionTimeUs: number; hexPreview: string }> = {};

      if (applyCompression && buffer.length > 0) {
        // Benchmark Deflate
        const dStart = process.hrtime.bigint();
        const defBuf = zlib.deflateSync(buffer);
        const dEnd = process.hrtime.bigint();
        benchmarks.deflate = {
          size: defBuf.length,
          ratio: parseFloat((defBuf.length / (byteSize || 1)).toFixed(3)),
          savingsPercent: parseFloat(((1 - defBuf.length / byteSize) * 100).toFixed(1)),
          executionTimeUs: Math.round(Number(dEnd - dStart) / 1000),
          hexPreview: defBuf.subarray(0, 16).toString("hex")
        };

        // Benchmark Gzip
        const gStart = process.hrtime.bigint();
        const gzBuf = zlib.gzipSync(buffer);
        const gEnd = process.hrtime.bigint();
        benchmarks.gzip = {
          size: gzBuf.length,
          ratio: parseFloat((gzBuf.length / (byteSize || 1)).toFixed(3)),
          savingsPercent: parseFloat(((1 - gzBuf.length / byteSize) * 100).toFixed(1)),
          executionTimeUs: Math.round(Number(gEnd - gStart) / 1000),
          hexPreview: gzBuf.subarray(0, 16).toString("hex")
        };

        // Benchmark Brotli (using quality 4 standard for real-time wire transmission)
        const bStart = process.hrtime.bigint();
        const brBuf = zlib.brotliCompressSync(buffer, {
          params: {
            [zlib.constants.BROTLI_PARAM_QUALITY]: 4
          }
        });
        const bEnd = process.hrtime.bigint();
        benchmarks.brotli = {
          size: brBuf.length,
          ratio: parseFloat((brBuf.length / (byteSize || 1)).toFixed(3)),
          savingsPercent: parseFloat(((1 - brBuf.length / byteSize) * 100).toFixed(1)),
          executionTimeUs: Math.round(Number(bEnd - bStart) / 1000),
          hexPreview: brBuf.subarray(0, 16).toString("hex")
        };
      } else {
        benchmarks.deflate = { size: byteSize, ratio: 1.0, savingsPercent: 0, executionTimeUs: 0, hexPreview: "" };
        benchmarks.gzip = { size: byteSize, ratio: 1.0, savingsPercent: 0, executionTimeUs: 0, hexPreview: "" };
        benchmarks.brotli = { size: byteSize, ratio: 1.0, savingsPercent: 0, executionTimeUs: 0, hexPreview: "" };
      }

      // 5. Hex preview
      const hexDump = buffer.subarray(0, 64).toString("hex").match(/.{1,2}/g)?.join(" ") || "";
      const base64Preview = buffer.subarray(0, 48).toString("base64");
      const xorHexDump = xorBuffer.subarray(0, 32).toString("hex").match(/.{1,2}/g)?.join(" ") || "";
      const invertedHexDump = invertedBuffer.subarray(0, 32).toString("hex").match(/.{1,2}/g)?.join(" ") || "";

      const totalEnd = process.hrtime.bigint();
      const executionTimeMs = parseFloat((Number(totalEnd - totalStart) / 1_000_000).toFixed(3));
      const cpu = getRealCpuUsage();

      // Log into persistent SQLite
      const dbResult = WireDB.logEvent({
        event_type: eventType,
        payload: typeof payload === "string" ? payload.slice(0, 500) : JSON.stringify(payload).slice(0, 500),
        system_load: cpu,
        execution_time_ms: executionTimeMs,
        hash: sha256,
        entropy,
        byte_size: byteSize
      });

      // Best algorithm selection
      let bestAlgo = "deflate";
      let smallestSize = benchmarks.deflate.size;
      for (const [algo, data] of Object.entries(benchmarks)) {
        if (data.size < smallestSize) {
          smallestSize = data.size;
          bestAlgo = algo;
        }
      }

      res.json({
        success: true,
        recordId: dbResult.lastInsertRowid,
        metrics: {
          entropy,
          byteSize,
          compressedSize: benchmarks.deflate.size,
          compressionRatio: benchmarks.deflate.ratio,
          compressionSavingsPercent: benchmarks.deflate.savingsPercent,
          executionTimeMs,
          systemLoadAtExecution: cpu,
          xorKeyApplied: `0x${parsedKey.toString(16).toUpperCase().padStart(2, '0')}`,
          bestAlgorithm: bestAlgo
        },
        benchmarks,
        hashes: {
          sha256,
          md5
        },
        previews: {
          hexDump,
          base64: base64Preview,
          xorHexDump
        },
        mutations: {
          hexDump,
          base64: base64Preview,
          invertedHexPreview: invertedHexDump,
          xorHexPreview: xorHexDump,
          compressedHex: benchmarks.deflate.hexPreview
        }
      });
    } catch (e: any) {
      console.error("Pipeline process error:", e);
      res.status(500).json({ error: "Failed to process payload", message: e.message });
    }
  });

  // Events list
  app.get("/api/events", (req: Request, res: Response) => {
    const rawLimit = req.query.limit as string;
    const limit = Math.max(1, Math.min(parseInt(rawLimit, 10) || 20, 500));
    const events = WireDB.getRecentEvents(limit);
    res.json(events);
  });

  // --- DATA CONTRACT REGISTRY & TYPE-CHECKING VALIDATOR ---

  app.get("/api/schemas", (req: Request, res: Response) => {
    const schemas = WireDB.getSchemas();
    res.json(schemas);
  });

  app.post("/api/schemas", (req: Request, res: Response) => {
    const { name, version, type, schema_def, description } = req.body;
    if (!name || !version || !schema_def) {
      res.status(400).json({ error: "Missing required schema fields (name, version, schema_def)" });
      return;
    }

    try {
      const id = `sch_${name.toLowerCase().replace(/[^a-z0-9]/g, "_")}_v${version.replace(/\./g, "_")}`;
      WireDB.createSchema({
        id,
        name,
        version,
        type: type || "custom-contract",
        schema_def: typeof schema_def === "string" ? schema_def : JSON.stringify(schema_def, null, 2),
        description: description || "User-defined data contract definition"
      });

      WireDB.logSystemLog("INF", "REGISTRY", `Registered data contract: ${name} (v${version})`, id);
      res.json({ success: true, id });
    } catch (e: any) {
      res.status(500).json({ error: "Failed to create schema", message: e.message });
    }
  });

  app.delete("/api/schemas/:id", (req: Request, res: Response) => {
    try {
      WireDB.deleteSchema(req.params.id);
      WireDB.logSystemLog("WRN", "REGISTRY", `Decommissioned schema: ${req.params.id}`);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: "Failed to delete schema", message: e.message });
    }
  });

  // Real type-enforcing schema validator
  app.post("/api/schemas/validate", (req: Request, res: Response) => {
    const { schemaId, testPayload } = req.body;
    const schema = WireDB.getSchemaById(schemaId);
    if (!schema) {
      res.status(404).json({ error: "Schema not found" });
      return;
    }

    try {
      const schemaDef = JSON.parse(schema.schema_def);
      const payloadObj = typeof testPayload === "string" ? JSON.parse(testPayload) : testPayload;

      if (!payloadObj || typeof payloadObj !== "object" || Array.isArray(payloadObj)) {
        res.json({
          valid: false,
          errors: ["Payload root must be a valid JSON object"],
          validatedAgainst: `${schema.name} v${schema.version}`
        });
        return;
      }

      const errors: string[] = [];

      for (const [key, rule] of Object.entries(schemaDef)) {
        const val = payloadObj[key];

        // 1. Required field check
        if (!(key in payloadObj) || val === undefined) {
          errors.push(`Missing required field: '${key}'`);
          continue;
        }

        // 2. Type enforcement
        if (typeof rule === "string") {
          if (rule === "string" && typeof val !== "string") {
            errors.push(`Field '${key}' must be a string, received ${typeof val}`);
          } else if (rule === "number" && (typeof val !== "number" || isNaN(val))) {
            errors.push(`Field '${key}' must be a valid number, received ${typeof val}`);
          } else if (rule === "integer" && (!Number.isInteger(val))) {
            errors.push(`Field '${key}' must be an integer, received ${val}`);
          } else if (rule === "boolean" && typeof val !== "boolean") {
            errors.push(`Field '${key}' must be a boolean, received ${typeof val}`);
          } else if (rule === "array" && !Array.isArray(val)) {
            errors.push(`Field '${key}' must be an array, received ${typeof val}`);
          } else if (rule === "object" && (typeof val !== "object" || val === null || Array.isArray(val))) {
            errors.push(`Field '${key}' must be an object, received ${typeof val}`);
          } else if (rule.startsWith("enum:")) {
            const allowed = rule.replace("enum:", "").split("|");
            if (!allowed.includes(String(val))) {
              errors.push(`Field '${key}' value '${val}' is not in allowed enum [${allowed.join(", ")}]`);
            }
          }
        } else if (typeof rule === "object" && rule !== null) {
          const typedRule = rule as any;
          if (typedRule.type === "number" && (typeof val !== "number" || isNaN(val))) {
            errors.push(`Field '${key}' must be a valid number`);
          } else if (typedRule.type === "string" && typeof val !== "string") {
            errors.push(`Field '${key}' must be a string`);
          }

          if (typeof val === "number") {
            if (typedRule.min !== undefined && val < typedRule.min) {
              errors.push(`Field '${key}' value ${val} is below minimum allowed ${typedRule.min}`);
            }
            if (typedRule.max !== undefined && val > typedRule.max) {
              errors.push(`Field '${key}' value ${val} exceeds maximum allowed ${typedRule.max}`);
            }
          }
        }
      }

      res.json({
        valid: errors.length === 0,
        errors,
        validatedAgainst: `${schema.name} v${schema.version}`
      });
    } catch (e: any) {
      res.json({
        valid: false,
        errors: [`JSON syntax or schema parsing failure: ${e.message}`]
      });
    }
  });

  // --- SYSTEM LOGS & AUDITING ---

  app.get("/api/logs", (req: Request, res: Response) => {
    const rawLimit = req.query.limit as string;
    const limit = Math.max(1, Math.min(parseInt(rawLimit, 10) || 50, 500));
    const level = req.query.level as string | undefined;
    const search = req.query.search as string | undefined;
    const logs = WireDB.getSystemLogs(limit, level, search);
    res.json(logs);
  });

  app.post("/api/logs", (req: Request, res: Response) => {
    const { level = "INF", module = "SYS", message, details } = req.body;
    if (!message) {
      res.status(400).json({ error: "Missing log message" });
      return;
    }
    const cleanLevel = ["INF", "WRN", "ERR", "SYS", "ACT"].includes(level) ? level : "INF";
    const result = WireDB.logSystemLog(cleanLevel, String(module).slice(0, 20), String(message).slice(0, 500), details ? String(details).slice(0, 500) : "");
    res.json({ success: true, id: result.lastInsertRowid });
  });

  // Server-Side AI System Integrity Audit
  app.post("/api/audit", async (req: Request, res: Response) => {
    try {
      const recentLogs = WireDB.getSystemLogs(15);
      const cpu = getRealCpuUsage();
      const memUsage = process.memoryUsage();
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const load = os.loadavg();
      const lag = getRealEventLoopLagMs();

      // Count actual log levels
      const errCount = recentLogs.filter(l => l.level === "ERR").length;
      const wrnCount = recentLogs.filter(l => l.level === "WRN").length;

      const logText = recentLogs.map(l => `[${l.timestamp}] [${l.level}] [${l.module}] ${l.message}`).join("\n");

      const apiKey = process.env.GEMINI_API_KEY;
      if (apiKey) {
        try {
          const ai = new GoogleGenAI({ apiKey });
          const prompt = `
You are the WireEntropy Autonomous Host Systems & Telemetry Auditor.
Analyze the following real host hardware telemetry and system logs:

HARDWARE & HOST TELEMETRY:
- Host OS: ${os.type()} ${os.release()} (${os.arch()})
- Host CPU Cores: ${os.cpus().length} Cores @ ${os.cpus()[0]?.speed || 0}MHz
- Host CPU Load: ${cpu}%
- 1/5/15-min Load Average: ${load.map(l => l.toFixed(2)).join(", ")}
- Event Loop Lag: ${lag}ms
- Host Memory: Total ${Math.round(totalMem / (1024*1024))}MB, Used ${Math.round((totalMem - freeMem) / (1024*1024))}MB (${((totalMem - freeMem) / totalMem * 100).toFixed(1)}%)
- Process Heap: ${Math.round(memUsage.heapUsed / (1024*1024))}MB / ${Math.round(memUsage.heapTotal / (1024*1024))}MB, RSS: ${Math.round(memUsage.rss / (1024*1024))}MB
- Total Payloads Transformed: ${WireDB.getPayloadCount()}
- Total HTTP Requests: ${totalHttpRequests}

RECENT LOG ENTRIES:
${logText || "No recorded events in SQLite journal."}

Provide a concise, high-fidelity technical report (3-4 sentences max):
1. Operational status (e.g. STABLE / NOMINAL / UNDER_LOAD).
2. Resource health evaluation (CPU tick distribution, memory, and event-loop responsiveness).
3. Recommended action or verification check.
Keep it strictly technical and grounded in these real figures.
`;
          const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
          });

          const auditText = response.text || "AUDIT COMPLETED: All host vectors nominal.";
          WireDB.logSystemLog("SYS", "AUDIT", `AI System Audit executed: ${auditText.slice(0, 100)}...`);
          res.json({ audit: auditText, source: "gemini-2.5-flash" });
          return;
        } catch (genAiError: any) {
          console.warn("Gemini API call failed, using deterministic analyzer:", genAiError.message);
        }
      }

      // Real deterministic local analyzer computed from actual metrics and logs
      const memPercent = ((totalMem - freeMem) / totalMem) * 100;
      let status = "NOMINAL";
      if (cpu > 80 || lag > 50) status = "HIGH_LOAD";
      else if (memPercent > 85) status = "MEMORY_PRESSURE";
      else if (errCount > 0) status = "ANOMALY_DETECTED";

      const logSummary = errCount > 0 
        ? `Observed ${errCount} ERR and ${wrnCount} WRN entries in the recent 15 journal events.`
        : `Verified ${recentLogs.length} recent journal events with 0 errors across active modules.`;

      const localAudit = `[HEURISTIC_HOST_EVAL] Status: ${status}. Host ${os.type()} (${os.arch()}) with ${os.cpus().length} cores is operating at ${cpu}% CPU load with ${lag}ms event-loop delay. Physical RAM is ${memPercent.toFixed(1)}% allocated (${Math.round((totalMem - freeMem)/(1024*1024))}MB / ${Math.round(totalMem/(1024*1024))}MB), and V8 heap is stable at ${Math.round(memUsage.heapUsed / (1024*1024))}MB. ${logSummary}`;
      
      WireDB.logSystemLog("SYS", "AUDIT", `Deterministic Host Audit executed: ${status}`);
      res.json({ audit: localAudit, source: "local-host-analyzer" });
    } catch (err: any) {
      console.error("Audit error:", err);
      res.status(500).json({ error: "Audit evaluation failed", message: err.message });
    }
  });

  // Health check
  app.get("/api/health", (req: Request, res: Response) => {
    res.json({
      status: "WIRE_ENGINE_ONLINE",
      version: "1.0.0",
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`WireEntropy Protocol & Telemetry Engine running on http://localhost:${PORT}`);
  });
}

startServer();
