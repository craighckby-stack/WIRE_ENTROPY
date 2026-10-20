import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { Layers, Play, CheckCircle2, Hash, Binary, Gauge, FileCode, RefreshCw, Database } from "lucide-react";

interface AlgorithmBenchmark {
  size: number;
  ratio: number;
  savingsPercent: number;
  executionTimeUs: number;
  hexPreview: string;
}

interface ProcessResult {
  recordId: number;
  metrics: {
    byteSize: number;
    compressedSize: number;
    compressionRatio: number;
    compressionSavingsPercent: number;
    entropy: number;
    executionTimeMs: number;
    systemLoadAtExecution: number;
    xorKeyApplied?: string;
    bestAlgorithm?: string;
  };
  benchmarks?: {
    deflate: AlgorithmBenchmark;
    gzip: AlgorithmBenchmark;
    brotli: AlgorithmBenchmark;
  };
  hashes: {
    sha256: string;
    md5: string;
  };
  previews?: {
    hexDump: string;
    base64: string;
    xorHexDump: string;
  };
  mutations?: {
    hexDump: string;
    base64: string;
    invertedHexPreview: string;
    xorHexPreview: string;
    compressedHex: string;
  };
}

interface SiphonEventRow {
  id: number;
  timestamp: string;
  event_type: string;
  payload: string;
  system_load: number;
  execution_time_ms: number;
  hash: string;
  entropy: number;
  byte_size: number;
}

export default function SiphonFlow() {
  const [inputPayload, setInputPayload] = useState(
    JSON.stringify({
      protocol: "WIRE_ENTROPY_FRAME",
      nodeId: "WIRE-SRV-01",
      sequenceId: 10428,
      flags: ["CRC_OK", "COMPRESSED", "XOR_MASKED"],
      status: "NOMINAL",
      timestamp: Date.now()
    }, null, 2)
  );
  const [eventType, setEventType] = useState("FRAME_OPTIMIZE");
  const [xorKey, setXorKey] = useState("0xAA");
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<ProcessResult | null>(null);
  const [recentEvents, setRecentEvents] = useState<SiphonEventRow[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  const fetchHistory = async () => {
    try {
      setLoadingHistory(true);
      const res = await fetch("/api/events?limit=15");
      const data = await res.json();
      setRecentEvents(data);
    } catch (e) {
      console.error("Failed to load events:", e);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleProcess = async () => {
    setIsProcessing(true);
    setErrorBanner(null);
    try {
      const clean = xorKey.trim().replace(/^0x/i, "");
      const val = parseInt(clean, 16);
      const parsedXor = !isNaN(val) ? val : 0xAA;
      const res = await fetch("/api/siphon/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payload: inputPayload,
          eventType,
          xorKey: parsedXor,
          applyCompression: true
        })
      });

      if (!res.ok) {
        throw new Error(`Server returned ${res.status}`);
      }

      const data = await res.json();
      setResult(data);
      await fetchHistory();
    } catch (e: any) {
      setErrorBanner(`Pipeline error: ${e.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const samplePresets = [
    {
      label: "NETWORK_FRAME_PACKET",
      type: "FRAME_OPTIMIZE",
      content: JSON.stringify({
        packetId: "PKT-99201",
        flags: ["CRC_OK", "COMPRESSED", "MASKED"],
        metrics: [42.1, 88.5, 12.0, 99.4],
        salt: "0xFE77A"
      }, null, 2)
    },
    {
      label: "STRUCTURED_IOT_TELEMETRY",
      type: "STREAM_TRANSFORM",
      content: JSON.stringify({
        sensorId: "TEMP_SENSOR_44B",
        temperatureC: 24.3,
        humidityPercent: 58.2,
        vibrationHz: 120.4,
        batteryVolts: 3.28,
        status: "ACTIVE"
      }, null, 2)
    },
    {
      label: "HIGH_ENTROPY_URANDOM_HEX",
      type: "ENTROPY_SAMPLE",
      content: "f4a8b1c90d2e5f8a3c7b2e9d0a1f4b8c6e2a7d9f1c3b5e8a0d2f4b6a8c0e2a4d7f9b1c3e5a7d"
    }
  ];

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-[#0A0A0B] text-[#E1E1E6] space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-[#2D2D30] pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Layers size={20} className="text-[#00FF9C]" />
            <h2 className="font-mono text-xl sm:text-2xl font-bold tracking-tight">BINARY PROTOCOL & ENTROPY OPTIMIZER</h2>
          </div>
          <p className="font-mono text-xs text-[#8E8E93]">
            HIGH-THROUGHPUT BITWISE CIPHERING, SHANNON ENTROPY & MULTI-ALGORITHM COMPRESSION
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchHistory}
            className="flex items-center gap-1.5 bg-[#161618] hover:bg-[#202024] border border-[#2D2D30] px-3 py-1.5 rounded-sm font-mono text-xs text-[#00FF9C] transition-colors"
          >
            <RefreshCw size={12} className={loadingHistory ? "animate-spin" : ""} />
            REFRESH_LOGS
          </button>
        </div>
      </div>

      {errorBanner && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-sm font-mono text-xs text-red-400 flex justify-between items-center">
          <span>{errorBanner}</span>
          <button onClick={() => setErrorBanner(null)} className="text-red-400 hover:text-white">✕</button>
        </div>
      )}

      {/* Preset Selector */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-mono text-[10px] text-[#8E8E93] mr-2">LOAD PRESET:</span>
        {samplePresets.map((p, idx) => (
          <button
            key={idx}
            onClick={() => {
              setInputPayload(p.content);
              setEventType(p.type);
            }}
            className="px-2.5 py-1 bg-[#161618] hover:bg-[#222226] border border-[#2D2D30] hover:border-[#00FF9C]/40 text-[#E1E1E6] rounded-sm font-mono text-[10px] transition-colors"
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Main Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Input & Config Column */}
        <div className="lg:col-span-5 space-y-4">
          <div className="glass-panel p-5 rounded-sm border border-[#2D2D30] space-y-4">
            <div className="flex justify-between items-center">
              <span className="font-mono text-xs uppercase font-semibold text-white flex items-center gap-2">
                <FileCode size={14} className="text-[#00FF9C]" />
                Ingestion Buffer Payload
              </span>
              <span className="font-mono text-[10px] text-[#8E8E93]">
                {new Blob([inputPayload]).size} BYTES
              </span>
            </div>

            <textarea
              value={inputPayload}
              onChange={(e) => setInputPayload(e.target.value)}
              rows={8}
              className="w-full bg-[#050506] border border-[#2D2D30] focus:border-[#00FF9C] p-3 rounded-sm font-mono text-xs text-[#00FF9C] focus:outline-none resize-y"
              placeholder="Enter payload string, hex data, or JSON..."
            />

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-mono text-[10px] text-[#8E8E93] mb-1">EVENT_TAG</label>
                <input
                  type="text"
                  value={eventType}
                  onChange={(e) => setEventType(e.target.value)}
                  className="w-full bg-[#121214] border border-[#2D2D30] p-2 rounded-sm font-mono text-xs text-white"
                />
              </div>
              <div>
                <label className="block font-mono text-[10px] text-[#8E8E93] mb-1">XOR_STREAM_KEY</label>
                <input
                  type="text"
                  value={xorKey}
                  onChange={(e) => setXorKey(e.target.value)}
                  className="w-full bg-[#121214] border border-[#2D2D30] p-2 rounded-sm font-mono text-xs text-[#00FF9C]"
                />
              </div>
            </div>

            <button
              onClick={handleProcess}
              disabled={isProcessing}
              className="w-full py-3 bg-[#00FF9C] hover:bg-[#00e58c] text-black font-mono font-bold text-xs uppercase tracking-wider rounded-sm flex items-center justify-center gap-2 transition-all shadow-[0_0_15px_rgba(0,255,156,0.2)] disabled:opacity-50"
            >
              <Play size={14} />
              {isProcessing ? "PROCESSING STREAM..." : "BENCHMARK PROTOCOL OPTIMIZATION"}
            </button>
          </div>
        </div>

        {/* Real Computation Result Column */}
        <div className="lg:col-span-7 space-y-4">
          {result ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-panel p-5 rounded-sm border border-[#00FF9C]/30 space-y-5"
            >
              <div className="flex justify-between items-center border-b border-[#2D2D30] pb-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-[#00FF9C]" />
                  <span className="font-mono text-xs uppercase font-semibold text-white">
                    Protocol Transformation & Benchmark Complete
                  </span>
                </div>
                <span className="font-mono text-[10px] text-[#00FF9C] bg-[#00FF9C]/10 px-2 py-0.5 rounded-sm">
                  SQLITE_ROW_ID: #{result.recordId}
                </span>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-[#121214] p-3 rounded-sm border border-[#202024] font-mono">
                  <div className="flex items-center gap-1 text-[9px] text-[#8E8E93]">
                    <Gauge size={10} className="text-[#00FF9C]" />
                    ENTROPY
                  </div>
                  <div className="text-base font-bold text-[#00FF9C] mt-1">
                    {result.metrics.entropy} <span className="text-[9px] font-normal text-[#8E8E93]">/ 8.0</span>
                  </div>
                  <div className="text-[8px] text-[#8E8E93]">
                    {result.metrics.entropy > 6.5 ? "High Randomness" : result.metrics.entropy > 3.5 ? "Balanced Data" : "High Redundancy"}
                  </div>
                </div>

                <div className="bg-[#121214] p-3 rounded-sm border border-[#202024] font-mono">
                  <div className="flex items-center gap-1 text-[9px] text-[#8E8E93]">
                    <Binary size={10} className="text-[#00FF9C]" />
                    PAYLOAD_SIZE
                  </div>
                  <div className="text-base font-bold text-white mt-1">
                    {result.metrics.byteSize} <span className="text-[9px] font-normal text-[#8E8E93]">B</span>
                  </div>
                  <div className="text-[8px] text-[#8E8E93]">
                    Deflate: {result.metrics.compressedSize} B
                  </div>
                </div>

                <div className="bg-[#121214] p-3 rounded-sm border border-[#202024] font-mono">
                  <div className="flex items-center gap-1 text-[9px] text-[#8E8E93]">
                    <Layers size={10} className="text-[#00FF9C]" />
                    COMPRESSION
                  </div>
                  <div className="text-base font-bold text-[#00FF9C] mt-1">
                    {result.metrics.compressionSavingsPercent}%
                  </div>
                  <div className="text-[8px] text-[#8E8E93]">
                    Ratio: {result.metrics.compressionRatio}x
                  </div>
                </div>

                <div className="bg-[#121214] p-3 rounded-sm border border-[#202024] font-mono">
                  <div className="flex items-center gap-1 text-[9px] text-[#8E8E93]">
                    <Play size={10} className="text-[#00FF9C]" />
                    EXECUTION
                  </div>
                  <div className="text-base font-bold text-white mt-1">
                    {result.metrics.executionTimeMs} <span className="text-[9px] font-normal text-[#8E8E93]">ms</span>
                  </div>
                  <div className="text-[8px] text-[#8E8E93]">
                    CPU: {result.metrics.systemLoadAtExecution}%
                  </div>
                </div>
              </div>

              {/* Multi-Algorithm Compression Benchmark Table (Deflate vs. Gzip vs. Brotli) */}
              {result.benchmarks && (
                <div className="bg-[#121214] p-3 rounded-sm border border-[#202024] font-mono text-xs space-y-2">
                  <div className="flex items-center justify-between text-[10px] text-[#8E8E93] border-b border-[#202024] pb-1.5">
                    <span className="font-semibold text-white uppercase flex items-center gap-1.5">
                      <Layers size={12} className="text-[#00FF9C]" />
                      Multi-Algorithm Compression Benchmark (Side-by-Side)
                    </span>
                    <span className="text-[#00FF9C] text-[9px]">
                      OPTIMAL: {result.metrics.bestAlgorithm?.toUpperCase()}
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-[11px]">
                      <thead>
                        <tr className="text-[#8E8E93] text-[9px] uppercase border-b border-[#202024]">
                          <th className="py-1">Algorithm</th>
                          <th className="py-1 text-right">Size</th>
                          <th className="py-1 text-right">Ratio</th>
                          <th className="py-1 text-right">Savings</th>
                          <th className="py-1 text-right">Speed (µs)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#18181c]">
                        {(["deflate", "gzip", "brotli"] as const).map(algo => {
                          const bench = result.benchmarks?.[algo];
                          if (!bench) return null;
                          const isBest = result.metrics.bestAlgorithm === algo;
                          return (
                            <tr key={algo} className={isBest ? "text-[#00FF9C] bg-[#00FF9C]/5" : "text-[#E1E1E6]"}>
                              <td className="py-1.5 uppercase font-bold flex items-center gap-1">
                                {algo}
                                {isBest && <span className="text-[8px] bg-[#00FF9C] text-black px-1 rounded-xs font-semibold">BEST</span>}
                              </td>
                              <td className="py-1.5 text-right font-mono">{bench.size} B</td>
                              <td className="py-1.5 text-right font-mono">{bench.ratio}x</td>
                              <td className="py-1.5 text-right font-mono">
                                <span className={bench.savingsPercent > 0 ? "text-[#00FF9C]" : "text-amber-400"}>
                                  {bench.savingsPercent}%
                                </span>
                              </td>
                              <td className="py-1.5 text-right font-mono text-[#8E8E93]">{bench.executionTimeUs} µs</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Cryptographic Signatures */}
              <div className="space-y-2 font-mono text-xs">
                <div className="p-2.5 bg-[#121214] rounded-sm border border-[#202024]">
                  <div className="flex items-center gap-1.5 text-[10px] text-[#8E8E93] mb-1">
                    <Hash size={12} className="text-[#00FF9C]" />
                    SHA-256 INTEGRITY DIGEST
                  </div>
                  <div className="text-[#00FF9C] break-all select-all font-mono text-[11px]">
                    {result.hashes.sha256}
                  </div>
                </div>

                <div className="p-2.5 bg-[#121214] rounded-sm border border-[#202024]">
                  <div className="flex items-center gap-1.5 text-[10px] text-[#8E8E93] mb-1">
                    <Hash size={12} className="text-[#8E8E93]" />
                    MD5 DIGEST
                  </div>
                  <div className="text-[#E1E1E6] break-all select-all font-mono text-[11px]">
                    {result.hashes.md5}
                  </div>
                </div>
              </div>

              {/* Binary Mutation Previews */}
              <div className="space-y-2 font-mono text-xs">
                <div className="text-[10px] text-[#8E8E93] uppercase">MUTATION TRANSFORMS & HEX DUMP</div>
                <div className="bg-[#050506] p-3 rounded-sm border border-[#202024] text-[10px] text-[#8E8E93] space-y-1">
                  <div><span className="text-[#00FF9C]">HEX_DUMP:</span> {result.mutations?.hexDump || result.previews?.hexDump || "-"}</div>
                  <div><span className="text-[#38BDF8]">XOR_{xorKey}:</span> {result.mutations?.xorHexPreview || result.previews?.xorHexDump || "-"}</div>
                  <div><span className="text-[#F27D26]">INVERTED:</span> {result.mutations?.invertedHexPreview || "-"}</div>
                  <div><span className="text-white">BASE64:</span> {result.mutations?.base64 || result.previews?.base64 || "-"}</div>
                </div>
              </div>
            </motion.div>
          ) : (
            <div className="glass-panel p-12 rounded-sm border border-[#2D2D30] text-center font-mono">
              <Binary size={36} className="text-[#2D2D30] mx-auto mb-4" />
              <p className="text-xs text-[#8E8E93] mb-2">PIPELINE IDLE :: AWAITING INGESTION</p>
              <p className="text-[10px] text-[#636366]">
                Execute the pipeline to calculate real cryptographic hashes, byte compression ratios, and Shannon entropy.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Historical Siphon Events from SQLite */}
      <div className="glass-panel p-5 rounded-sm border border-[#2D2D30] space-y-4">
        <div className="flex justify-between items-center border-b border-[#2D2D30] pb-3">
          <div className="flex items-center gap-2">
            <Database size={16} className="text-[#00FF9C]" />
            <span className="font-mono text-xs uppercase font-semibold">
              Persistent Transformation Event Journal (SQLite)
            </span>
          </div>
          <span className="font-mono text-[10px] text-[#8E8E93]">
            SHOWING RECENT {recentEvents.length} RECORDS
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-[11px]">
            <thead>
              <tr className="border-b border-[#202024] text-[#8E8E93] text-[10px]">
                <th className="py-2 px-3">ID</th>
                <th className="py-2 px-3">TIMESTAMP</th>
                <th className="py-2 px-3">TYPE</th>
                <th className="py-2 px-3">SIZE</th>
                <th className="py-2 px-3">ENTROPY</th>
                <th className="py-2 px-3">TIME</th>
                <th className="py-2 px-3">SHA-256</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1B1B1E]">
              {recentEvents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-4 text-center text-[#636366]">
                    No siphon records in SQLite database yet. Execute a pipeline transformation above.
                  </td>
                </tr>
              ) : (
                recentEvents.map((evt) => (
                  <tr key={evt.id} className="hover:bg-[#121214] transition-colors">
                    <td className="py-2.5 px-3 text-[#00FF9C]">#{evt.id}</td>
                    <td className="py-2.5 px-3 text-[#8E8E93] whitespace-nowrap">{evt.timestamp}</td>
                    <td className="py-2.5 px-3 text-white font-medium">{evt.event_type}</td>
                    <td className="py-2.5 px-3 text-[#8E8E93]">{evt.byte_size || 0} B</td>
                    <td className="py-2.5 px-3 text-[#00FF9C]">{evt.entropy?.toFixed(2) || "0.00"}</td>
                    <td className="py-2.5 px-3 text-[#8E8E93]">{evt.execution_time_ms ? `${evt.execution_time_ms}ms` : "-"}</td>
                    <td className="py-2.5 px-3 text-[#8E8E93] font-mono text-[10px] truncate max-w-[160px]">
                      {evt.hash || "-"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
