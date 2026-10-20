import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { Activity, Radio, Download, Cpu, HardDrive, RefreshCw, Zap } from "lucide-react";

interface TelemetryPoint {
  id?: number;
  timestamp: string;
  cpu_percent: number;
  memory_used_mb: number;
  memory_total_mb: number;
  heap_used_mb: number;
  load_avg_1m: number;
  latency_ms: number;
}

export default function TelemetryView() {
  const [history, setHistory] = useState<TelemetryPoint[]>([]);
  const [current, setCurrent] = useState<{
    cpu: number;
    memory: number;
    heapUsedMb: number;
    rssMb: number;
    packets: number;
    bytesIngested: number;
    latency: number;
  }>({
    cpu: 0,
    memory: 0,
    heapUsedMb: 0,
    rssMb: 0,
    packets: 0,
    bytesIngested: 0,
    latency: 0
  });

  const [streamingMode, setStreamingMode] = useState<"SSE" | "POLL">("SSE");
  const [status, setStatus] = useState<"CONNECTED" | "RECONNECTING">("CONNECTED");

  // Fetch initial history from SQLite
  const loadHistory = async () => {
    try {
      const res = await fetch("/api/telemetry/history?limit=40");
      const data = await res.json();
      setHistory(data);
    } catch (e) {
      console.error("Failed to load telemetry history:", e);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  // Real live stream connection
  useEffect(() => {
    if (streamingMode === "SSE") {
      const eventSource = new EventSource("/api/telemetry/stream");
      eventSource.onopen = () => {
        setStatus("CONNECTED");
      };
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setCurrent(prev => ({
            ...prev,
            cpu: data.cpu,
            memory: data.memory,
            heapUsedMb: data.heapUsedMb,
            rssMb: data.rssMb,
            packets: data.packets,
            bytesIngested: data.bytesIngested || 0
          }));

          setHistory(prev => {
            const nextPoint: TelemetryPoint = {
              timestamp: new Date().toLocaleTimeString(),
              cpu_percent: data.cpu,
              memory_used_mb: data.memoryUsedMb ?? data.memory,
              memory_total_mb: data.memoryTotalMb ?? 1024,
              heap_used_mb: data.heapUsedMb,
              load_avg_1m: data.loadAvg ?? 0,
              latency_ms: data.latencyMs ?? 0.5
            };
            return [...prev.slice(-39), nextPoint];
          });
        } catch (e) {
          console.error("SSE parse error", e);
        }
      };
      eventSource.onerror = () => {
        setStatus("RECONNECTING");
      };

      return () => {
        eventSource.close();
      };
    } else {
      // Polling fallback
      const interval = setInterval(async () => {
        try {
          const res = await fetch("/api/telemetry");
          const data = await res.json();
          setCurrent({
            cpu: data.cpu,
            memory: data.memory,
            heapUsedMb: data.heapUsedMb,
            rssMb: data.rssMb,
            packets: data.packets,
            bytesIngested: data.bytesIngested,
            latency: data.latency
          });
          setHistory(prev => [
            ...prev.slice(-39),
            {
              timestamp: new Date().toLocaleTimeString(),
              cpu_percent: data.cpu,
              memory_used_mb: data.memoryUsedMb,
              memory_total_mb: data.memoryTotalMb,
              heap_used_mb: data.heapUsedMb,
              load_avg_1m: data.loadAvg?.[0] || 0,
              latency_ms: data.latency
            }
          ]);
        } catch (e) {
          console.error(e);
        }
      }, 2000);

      return () => clearInterval(interval);
    }
  }, [streamingMode]);

  const exportCSV = async () => {
    try {
      const res = await fetch("/api/telemetry/history?limit=500");
      const dataset: TelemetryPoint[] = res.ok ? await res.json() : history;
      const exportData = dataset.length > 0 ? dataset : history;
      if (exportData.length === 0) return;
      const headers = "id,timestamp,cpu_percent,memory_used_mb,memory_total_mb,heap_used_mb,load_avg_1m,latency_ms\n";
      const rows = exportData
        .map(h => `${h.id || ""},${h.timestamp},${h.cpu_percent},${h.memory_used_mb},${h.memory_total_mb || ""},${h.heap_used_mb},${h.load_avg_1m || ""},${h.latency_ms}`)
        .join("\n");
      const blob = new Blob([headers + rows], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `wire_entropy_full_telemetry_${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("CSV export error:", e);
    }
  };

  const exportJSON = async () => {
    try {
      const res = await fetch("/api/telemetry/history?limit=500");
      const dataset = res.ok ? await res.json() : history;
      const exportData = dataset.length > 0 ? dataset : history;
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `wire_entropy_full_telemetry_${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("JSON export error:", e);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-[#0A0A0B] text-[#E1E1E6] space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-[#2D2D30] pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Activity size={20} className="text-[#00FF9C]" />
            <h2 className="font-mono text-xl sm:text-2xl font-bold tracking-tight">HOST TELEMETRY & WIRE METRICS STREAM</h2>
          </div>
          <p className="font-mono text-xs text-[#8E8E93]">
            HIGH-PRECISION REAL-TIME HARDWARE & PROCESS RUNTIME TRACING
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-[#161618] px-3 py-1.5 rounded-sm border border-[#2D2D30] font-mono text-[10px]">
            <Radio size={12} className={status === "CONNECTED" ? "text-[#00FF9C] animate-pulse" : "text-amber-500"} />
            <span className="text-[#8E8E93]">TRANSPORT:</span>
            <button
              onClick={() => setStreamingMode(streamingMode === "SSE" ? "POLL" : "SSE")}
              className="text-[#00FF9C] hover:underline uppercase font-bold"
            >
              {streamingMode} ({status})
            </button>
          </div>

          <button
            onClick={exportCSV}
            className="flex items-center gap-1.5 bg-[#161618] hover:bg-[#202024] border border-[#2D2D30] px-3 py-1.5 rounded-sm font-mono text-xs text-white transition-colors"
          >
            <Download size={12} />
            CSV
          </button>
          <button
            onClick={exportJSON}
            className="flex items-center gap-1.5 bg-[#161618] hover:bg-[#202024] border border-[#2D2D30] px-3 py-1.5 rounded-sm font-mono text-xs text-[#00FF9C] transition-colors"
          >
            <Download size={12} />
            JSON
          </button>
        </div>
      </div>

      {/* Real Live Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-panel p-4 rounded-sm border border-[#2D2D30]">
          <div className="flex items-center justify-between text-[10px] font-mono text-[#8E8E93] mb-1">
            <span className="flex items-center gap-1.5"><Cpu size={12} className="text-[#00FF9C]" /> CPU LOAD</span>
            <span className="text-[#00FF9C]">LIVE</span>
          </div>
          <div className="font-mono text-2xl font-bold text-white">{current.cpu.toFixed(1)}%</div>
          <div className="font-mono text-[9px] text-[#8E8E93] mt-1">Host core aggregate</div>
        </div>

        <div className="glass-panel p-4 rounded-sm border border-[#2D2D30]">
          <div className="flex items-center justify-between text-[10px] font-mono text-[#8E8E93] mb-1">
            <span className="flex items-center gap-1.5"><HardDrive size={12} className="text-[#00FF9C]" /> V8 HEAP</span>
            <span className="text-[#00FF9C]">LIVE</span>
          </div>
          <div className="font-mono text-2xl font-bold text-[#00FF9C]">{current.heapUsedMb.toFixed(1)} MB</div>
          <div className="font-mono text-[9px] text-[#8E8E93] mt-1">Process RSS: {current.rssMb.toFixed(0)} MB</div>
        </div>

        <div className="glass-panel p-4 rounded-sm border border-[#2D2D30]">
          <div className="flex items-center justify-between text-[10px] font-mono text-[#8E8E93] mb-1">
            <span className="flex items-center gap-1.5"><Zap size={12} className="text-[#00FF9C]" /> PACKETS SERVED</span>
            <span className="text-[#00FF9C]">LIVE</span>
          </div>
          <div className="font-mono text-2xl font-bold text-white">{current.packets.toLocaleString()}</div>
          <div className="font-mono text-[9px] text-[#8E8E93] mt-1">Throughput count</div>
        </div>

        <div className="glass-panel p-4 rounded-sm border border-[#2D2D30]">
          <div className="flex items-center justify-between text-[10px] font-mono text-[#8E8E93] mb-1">
            <span className="flex items-center gap-1.5"><Activity size={12} className="text-[#00FF9C]" /> INGESTED BYTES</span>
            <span className="text-[#00FF9C]">LIVE</span>
          </div>
          <div className="font-mono text-2xl font-bold text-white">
            {current.bytesIngested > 1024 * 1024
              ? `${(current.bytesIngested / (1024 * 1024)).toFixed(2)} MB`
              : `${(current.bytesIngested / 1024).toFixed(1)} KB`}
          </div>
          <div className="font-mono text-[9px] text-[#8E8E93] mt-1">Raw ingress volume</div>
        </div>
      </div>

      {/* Dynamic Graph 1: Host CPU Usage Over Time */}
      <div className="glass-panel p-5 rounded-sm border border-[#2D2D30] space-y-3">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Cpu size={16} className="text-[#00FF9C]" />
            <span className="font-mono text-xs uppercase font-semibold">Real CPU Load History (Last {history.length} Ticks)</span>
          </div>
          <span className="font-mono text-[10px] text-[#8E8E93]">SCALE: 0% - 100%</span>
        </div>

        <div className="h-44 flex items-end gap-1.5 bg-[#050506] p-3 rounded-sm border border-[#1a1a1a]">
          {history.map((pt, idx) => {
            const h = Math.min(100, Math.max(4, pt.cpu_percent));
            const isSpike = pt.cpu_percent > 70;
            return (
              <div
                key={idx}
                className="flex-1 flex flex-col justify-end items-center h-full group relative"
              >
                <div
                  style={{ height: `${h}%` }}
                  className={`w-full rounded-t-[1px] transition-all duration-300 ${
                    isSpike ? "bg-amber-500" : "bg-[#00FF9C]"
                  } opacity-75 group-hover:opacity-100`}
                />
                <div className="opacity-0 group-hover:opacity-100 pointer-events-none absolute bottom-full mb-1 z-20 bg-black border border-[#2D2D30] text-[9px] font-mono p-1 rounded-sm whitespace-nowrap text-white">
                  {pt.cpu_percent.toFixed(1)}% @ {pt.timestamp}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Dynamic Graph 2: Process V8 Heap Footprint */}
      <div className="glass-panel p-5 rounded-sm border border-[#2D2D30] space-y-3">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <HardDrive size={16} className="text-[#00FF9C]" />
            <span className="font-mono text-xs uppercase font-semibold">Process V8 Memory Heap Profile (MB)</span>
          </div>
          <span className="font-mono text-[10px] text-[#8E8E93]">AUTO-SCALED</span>
        </div>

        <div className="h-40 flex items-end gap-1.5 bg-[#050506] p-3 rounded-sm border border-[#1a1a1a]">
          {history.map((pt, idx) => {
            const maxHeap = Math.max(...history.map(h => h.heap_used_mb), 50);
            const heightPercent = Math.min(100, Math.max(5, (pt.heap_used_mb / maxHeap) * 100));
            return (
              <div
                key={idx}
                className="flex-1 flex flex-col justify-end items-center h-full group relative"
              >
                <div
                  style={{ height: `${heightPercent}%` }}
                  className="w-full rounded-t-[1px] transition-all duration-300 bg-[#38BDF8] opacity-70 group-hover:opacity-100"
                />
                <div className="opacity-0 group-hover:opacity-100 pointer-events-none absolute bottom-full mb-1 z-20 bg-black border border-[#2D2D30] text-[9px] font-mono p-1 rounded-sm whitespace-nowrap text-white">
                  {pt.heap_used_mb.toFixed(1)} MB @ {pt.timestamp}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
