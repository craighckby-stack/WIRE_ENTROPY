import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Terminal as TerminalIcon, Cpu, Zap, Activity, HardDrive, ShieldCheck, Sparkles, Database, Layers, ArrowUpRight } from "lucide-react";
import { analyzeSystemLogs } from "../services/geminiService";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface TelemetryData {
  cpu: number;
  memory: number;
  memoryTotalMb: number;
  memoryFreeMb: number;
  memoryUsedMb: number;
  heapUsedMb: number;
  heapTotalMb: number;
  rssMb: number;
  packets: number;
  bytesIngested: number;
  latency: number;
  uptimeSeconds: number;
  systemUptimeSeconds?: number;
  httpRequests?: number;
}

export default function Dashboard({ refreshRate = 2000, onNavigate }: { refreshRate?: number; onNavigate?: (tab: string) => void }) {
  const [telemetry, setTelemetry] = useState<TelemetryData>({
    cpu: 0,
    memory: 0,
    memoryTotalMb: 0,
    memoryFreeMb: 0,
    memoryUsedMb: 0,
    heapUsedMb: 0,
    heapTotalMb: 0,
    rssMb: 0,
    packets: 0,
    bytesIngested: 0,
    latency: 0,
    uptimeSeconds: 0,
    systemUptimeSeconds: 0
  });

  const [cpuHistory, setCpuHistory] = useState<number[]>([]);
  const [logs, setLogs] = useState<Array<{ id: number; level: string; module: string; message: string; timestamp: string }>>([]);
  const [aiAudit, setAiAudit] = useState<{ audit: string; source: string } | null>(null);
  const [isAuditing, setIsAuditing] = useState(false);
  const [siphonStatus, setSiphonStatus] = useState<string | null>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);

  // Fetch initial historical telemetry from SQLite to populate chart with genuine historical readings
  const loadInitialHistory = async () => {
    try {
      const res = await fetch("/api/telemetry/history?limit=40");
      if (res.ok) {
        const rows = await res.json();
        if (Array.isArray(rows) && rows.length > 0) {
          const points = rows.map((r: any) => Number(r.cpu_percent) || 0);
          setCpuHistory(points);
          return;
        }
      }
    } catch (e) {
      console.warn("Could not load prior telemetry history:", e);
    }
  };

  // Fetch real host telemetry
  const fetchTelemetry = async () => {
    try {
      const res = await fetch("/api/telemetry");
      if (!res.ok) return;
      const data: TelemetryData = await res.json();
      setTelemetry(data);
      setCpuHistory(prev => {
        if (prev.length === 0) {
          return [data.cpu];
        }
        return [...prev.slice(prev.length >= 40 ? 1 : 0), data.cpu];
      });
    } catch (e) {
      console.error("Telemetry fetch error:", e);
    }
  };

  // Fetch real system logs from SQLite
  const fetchLogs = async () => {
    try {
      const res = await fetch("/api/logs?limit=25");
      if (!res.ok) return;
      const data = await res.json();
      setLogs(data);
    } catch (e) {
      console.error("Logs fetch error:", e);
    }
  };

  useEffect(() => {
    loadInitialHistory();
    fetchTelemetry();
    fetchLogs();

    const telemetryInterval = setInterval(fetchTelemetry, refreshRate);
    const logsInterval = setInterval(fetchLogs, 4000);

    return () => {
      clearInterval(telemetryInterval);
      clearInterval(logsInterval);
    };
  }, [refreshRate]);

  // Auto-scroll logs
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  // Real Siphon Pipeline Trigger
  const handleTriggerSiphon = async () => {
    setSiphonStatus("PROCESSING...");
    try {
      const res = await fetch("/api/siphon/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventType: "DASHBOARD_PULSE",
          payload: `Real-time manual siphon pulse from dashboard at timestamp ${Date.now()}`
        })
      });
      const data = await res.json();
      setSiphonStatus(`COMPLETED (${data.metrics.executionTimeMs}ms)`);
      setTimeout(() => setSiphonStatus(null), 3000);
      await fetchLogs();
      await fetchTelemetry();
    } catch (e: any) {
      setSiphonStatus(`ERR: ${e.message}`);
    }
  };

  // Run real server-side AI Audit
  const runAiAudit = async () => {
    setIsAuditing(true);
    const result = await analyzeSystemLogs();
    setAiAudit(result);
    setIsAuditing(false);
    await fetchLogs();
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-8 relative bg-[#0A0A0B] text-[#E1E1E6]">
      <div className="scanline" />

      {/* Header Section */}
      <div className="flex flex-col lg:flex-row justify-between items-start gap-6 mb-8">
        <div className="max-w-full">
          <div className="flex items-center gap-2 mb-2">
            <ShieldCheck size={20} className="text-[#00FF9C]" />
            <h2 className="font-mono text-2xl sm:text-3xl font-bold tracking-tighter uppercase">
              WIRE_ENTROPY_CORE
            </h2>
          </div>
          <p className="font-mono text-[10px] sm:text-xs text-[#8E8E93] tracking-widest uppercase">
            LIVE HOST TELEMETRY & WIRE PROTOCOL OPTIMIZER :: REAL HARDWARE RUNTIME
          </p>
        </div>

        <div className="flex flex-wrap gap-3 sm:gap-4 w-full lg:w-auto">
          <StatBox
            label="HOST_CPU_LOAD"
            value={`${telemetry.cpu.toFixed(1)}%`}
            subValue={telemetry.cpu > 80 ? "HIGH" : "NOMINAL"}
            color="#00FF9C"
          />
          <StatBox
            label="PHYSICAL_RAM"
            value={`${telemetry.memory.toFixed(1)}%`}
            subValue={`${telemetry.memoryUsedMb}MB / ${telemetry.memoryTotalMb}MB`}
            color="#38BDF8"
          />
          <StatBox
            label="PAYLOADS_OPTIMIZED"
            value={telemetry.packets.toLocaleString()}
            subValue={`${telemetry.bytesIngested > 1024 ? (telemetry.bytesIngested / 1024).toFixed(1) + " KB" : telemetry.bytesIngested + " B"} Ingested`}
            color="#00FF9C"
          />
          <StatBox
            label="EVENT_LOOP_LAG"
            value={`${telemetry.latency} ms`}
            subValue={`HTTP: ${telemetry.httpRequests || 0} reqs`}
            color="#A78BFA"
          />
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Visualizer Panel (Real Core CPU Load Graph) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="col-span-1 lg:col-span-8 glass-panel p-4 sm:p-6 rounded-sm relative overflow-hidden border border-[#2D2D30]"
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Cpu size={16} className="text-[#00FF9C]" />
              <span className="font-mono text-[10px] sm:text-xs tracking-widest uppercase font-semibold">
                REAL_TIME_HOST_CPU_LOAD (LAST 40 SAMPLING INTERVALS)
              </span>
            </div>
            <div className="flex items-center gap-4">
              <div className="h-1.5 w-24 bg-[#161618] rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-[#00FF9C]"
                  animate={{ width: `${Math.min(100, Math.max(5, telemetry.cpu))}%` }}
                />
              </div>
              <span className="font-mono text-[9px] text-[#8E8E93] hidden sm:inline">
                INTERVAL: {refreshRate}MS
              </span>
            </div>
          </div>

          <div className="h-44 sm:h-56 flex items-end gap-1 px-1 bg-[#050506] p-2 rounded-sm border border-[#18181a]">
            {cpuHistory.map((val, i) => (
              <div
                key={i}
                style={{ height: `${Math.min(100, Math.max(4, val))}%` }}
                className={cn(
                  "flex-1 transition-all duration-300 rounded-t-[1px]",
                  val > 75 ? "bg-red-500 opacity-80" : val > 40 ? "bg-amber-400 opacity-70" : "bg-[#00FF9C] opacity-60"
                )}
                title={`${val.toFixed(1)}%`}
              />
            ))}
          </div>

          <div className="mt-5 flex justify-between border-t border-[#2D2D30] pt-4 font-mono">
            <div className="space-y-1">
              <p className="text-[10px] text-[#8E8E93]">V8_PROCESS_HEAP</p>
              <p className="text-xs sm:text-sm text-[#00FF9C]">
                {telemetry.heapUsedMb} MB / {telemetry.heapTotalMb} MB (RSS: {telemetry.rssMb} MB)
              </p>
            </div>
            <div className="flex gap-4 sm:gap-6">
              <div className="space-y-1 text-right">
                <p className="text-[10px] text-[#8E8E93]">PROCESS_UPTIME</p>
                <p className="text-xs sm:text-sm text-white font-mono">
                  {Math.floor(telemetry.uptimeSeconds / 60)}m {telemetry.uptimeSeconds % 60}s
                </p>
              </div>
              <div className="space-y-1 text-right">
                <p className="text-[10px] text-[#8E8E93]">HOST_OS_UPTIME</p>
                <p className="text-xs sm:text-sm text-[#00FF9C] font-mono">
                  {Math.floor((telemetry.systemUptimeSeconds || 0) / 3600)}h {Math.floor(((telemetry.systemUptimeSeconds || 0) % 3600) / 60)}m
                </p>
              </div>
              <div className="space-y-1 text-right hidden sm:block">
                <p className="text-[10px] text-[#8E8E93]">SQLITE_JOURNAL</p>
                <p className="text-xs sm:text-sm text-[#00FF9C] font-mono">WAL_ACTIVE</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Action Panel */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="col-span-1 lg:col-span-4 space-y-4"
        >
          {/* Action Card: Trigger Binary Optimization */}
          <div className="glass-panel p-4 rounded-sm border border-[#2D2D30] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-[#00FF9C]/10 text-[#00FF9C] rounded-sm">
                  <Zap size={16} />
                </div>
                <div>
                  <p className="font-mono text-[10px] text-[#8E8E93] uppercase">BINARY_PIPELINE</p>
                  <p className="font-mono text-xs font-bold text-white">WIRE_TRANSFORM_BENCHMARK</p>
                </div>
              </div>
              <button
                onClick={handleTriggerSiphon}
                className="bg-[#00FF9C] hover:bg-[#00e58c] text-black font-mono font-bold text-[10px] px-2.5 py-1 rounded-sm uppercase transition-colors"
              >
                EXEC_TRANSFORM
              </button>
            </div>
            {siphonStatus && (
              <div className="text-[10px] font-mono text-[#00FF9C] bg-[#00FF9C]/10 p-2 rounded-sm border border-[#00FF9C]/20">
                {siphonStatus}
              </div>
            )}
            {onNavigate && (
              <button
                onClick={() => onNavigate("siphon")}
                className="w-full flex items-center justify-between text-[10px] font-mono text-[#8E8E93] hover:text-[#00FF9C] pt-2 border-t border-[#1a1a1c] transition-colors"
              >
                <span>Open Binary Protocol & Entropy Studio</span>
                <ArrowUpRight size={12} />
              </button>
            )}
          </div>

          {/* AI Analysis Module */}
          <div className="glass-panel p-5 rounded-sm border border-[#2D2D30] space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] text-[#8E8E93] tracking-widest uppercase">
                AI_DIAGNOSTIC_EVALUATION
              </span>
              <button
                onClick={runAiAudit}
                disabled={isAuditing}
                className="flex items-center gap-1.5 bg-[#00FF9C]/10 hover:bg-[#00FF9C]/20 text-[#00FF9C] font-mono text-[10px] px-2.5 py-1 rounded-sm border border-[#00FF9C]/30 transition-colors disabled:opacity-50"
              >
                <Sparkles size={12} className={isAuditing ? "animate-spin" : ""} />
                {isAuditing ? "EVALUATING..." : "RUN_EVAL"}
              </button>
            </div>
            <div className="min-h-[90px] bg-[#050506] p-3 font-mono text-[11px] leading-relaxed relative border border-[#1a1a1a] rounded-sm">
              {aiAudit ? (
                <div>
                  <span className="text-[9px] text-[#8E8E93] block mb-1 uppercase font-semibold">
                    Engine: {aiAudit.source}
                  </span>
                  <p className="text-[#00FF9C]">{aiAudit.audit}</p>
                </div>
              ) : (
                <p className="text-[#444]">
                  SYSTEM_STATE: READY. Click 'RUN_EVAL' to perform an AI hardware & log integrity assessment.
                </p>
              )}
            </div>
          </div>

          {/* Quick Sub-system Links */}
          {onNavigate && (
            <div className="grid grid-cols-2 gap-2 font-mono text-[10px]">
              <button
                onClick={() => onNavigate("aeor")}
                className="p-2.5 bg-[#121214] hover:bg-[#1a1a1e] border border-[#2D2D30] hover:border-[#00FF9C]/40 rounded-sm text-left transition-colors flex items-center justify-between"
              >
                <span>HOST_DIAGNOSTICS</span>
                <ArrowUpRight size={12} className="text-[#00FF9C]" />
              </button>
              <button
                onClick={() => onNavigate("tcrm")}
                className="p-2.5 bg-[#121214] hover:bg-[#1a1a1e] border border-[#2D2D30] hover:border-[#00FF9C]/40 rounded-sm text-left transition-colors flex items-center justify-between"
              >
                <span>LIVE_TELEMETRY</span>
                <ArrowUpRight size={12} className="text-[#00FF9C]" />
              </button>
              <button
                onClick={() => onNavigate("ssvr")}
                className="p-2.5 bg-[#121214] hover:bg-[#1a1a1e] border border-[#2D2D30] hover:border-[#00FF9C]/40 rounded-sm text-left transition-colors flex items-center justify-between"
              >
                <span>DATA_CONTRACTS</span>
                <ArrowUpRight size={12} className="text-[#00FF9C]" />
              </button>
              <button
                onClick={() => onNavigate("logs")}
                className="p-2.5 bg-[#121214] hover:bg-[#1a1a1e] border border-[#2D2D30] hover:border-[#00FF9C]/40 rounded-sm text-left transition-colors flex items-center justify-between"
              >
                <span>AUDIT_LOGS</span>
                <ArrowUpRight size={12} className="text-[#00FF9C]" />
              </button>
            </div>
          )}
        </motion.div>

        {/* Real Kernel Logs Feed */}
        <div className="col-span-1 lg:col-span-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-panel p-4 sm:p-6 rounded-sm border border-[#2D2D30]"
          >
            <div className="flex items-center justify-between mb-4 border-b border-[#2D2D30] pb-2">
              <div className="flex items-center gap-2">
                <TerminalIcon size={14} className="text-[#00FF9C]" />
                <span className="font-mono text-xs tracking-widest uppercase font-semibold">
                  LIVE PERSISTENT JOURNAL (SQLITE WAL LOG)
                </span>
              </div>
              <span className="font-mono text-[10px] text-[#8E8E93]">
                {logs.length} ENTRIES
              </span>
            </div>

            <div
              ref={logContainerRef}
              className="font-mono text-[11px] space-y-1.5 text-[#8E8E93] max-h-[180px] overflow-y-auto scrollbar-thin scrollbar-thumb-[#2D2D30] bg-[#050506] p-3 rounded-sm border border-[#18181a]"
            >
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center gap-2"
                >
                  <span className="text-[#555] text-[10px]">[{log.timestamp?.slice(11, 19)}]</span>
                  <span
                    className={cn(
                      "text-[10px] font-bold px-1 rounded-[2px]",
                      log.level === "ERR" && "text-red-400 bg-red-400/10",
                      log.level === "WRN" && "text-amber-400 bg-amber-400/10",
                      log.level === "SYS" && "text-[#00FF9C] bg-[#00FF9C]/10",
                      log.level === "ACT" && "text-[#38BDF8] bg-[#38BDF8]/10",
                      log.level === "INF" && "text-[#8E8E93]"
                    )}
                  >
                    {log.level}
                  </span>
                  <span className="text-[#636366]">[{log.module}]</span>
                  <span className="text-[#E1E1E6] truncate">{log.message}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

function StatBox({ label, value, subValue, color }: { label: string; value: string; subValue: string; color: string }) {
  return (
    <div className="glass-panel p-4 rounded-sm flex-1 min-w-[124px] border border-[#2D2D30] relative group hover:border-[#00FF9C]/30 transition-colors">
      <div className="absolute top-0 left-0 w-[2px] h-full" style={{ backgroundColor: color }} />
      <p className="font-mono text-[9px] text-[#8E8E93] mb-1 uppercase tracking-widest">{label}</p>
      <p className="font-mono text-xl font-bold tracking-tight text-white mb-1">{value}</p>
      <div className="flex items-center gap-1.5">
        <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: color }} />
        <span className="font-mono text-[9px] tracking-wide uppercase text-[#8E8E93] truncate">{subValue}</span>
      </div>
    </div>
  );
}
