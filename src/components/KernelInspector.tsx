import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { Cpu, Server, HardDrive, Network, RefreshCw, Zap, ShieldCheck, Activity, Terminal } from "lucide-react";

interface KernelData {
  kernel: {
    type: string;
    platform: string;
    release: string;
    architecture?: string;
    arch?: string;
    hostname: string;
    nodeVersion: string;
    pid: number;
    title: string;
    execPath: string;
  };
  cpu?: {
    model: string;
    cores: number;
    speedMhz: number;
    coreDetails: Array<{
      coreId: number;
      model: string;
      speed: number;
      times: { user: number; nice: number; sys: number; idle: number; irq: number };
    }>;
  };
  cpuSpecs: {
    model: string;
    cores: number;
    speedMhz: number;
    coreDetails: Array<{
      coreId: number;
      model: string;
      speed: number;
      times: { user: number; nice: number; sys: number; idle: number; irq: number };
    }>;
  };
  memory: {
    totalBytes: number;
    freeBytes: number;
    processUsage: {
      rss: number;
      heapTotal: number;
      heapUsed: number;
      external: number;
    };
  };
  network: Record<string, Array<{ address: string; family: string; mac: string; internal: boolean }>>;
  uptime: {
    systemSeconds: number;
    processSeconds: number;
    startedAt: string;
  };
}

export default function KernelInspector() {
  const [data, setData] = useState<KernelData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionOutput, setActionOutput] = useState<string | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);

  const fetchKernelInfo = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/system/kernel");
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error("Failed to fetch kernel details:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKernelInfo();
  }, []);

  const triggerProbe = async (type: "MEMORY_ALLOC" | "ENTROPY_SCAN" | "CRYPTO_BENCH" | "EVENT_LOOP") => {
    setIsExecuting(true);
    setActionOutput(`PROBE_INITIATED: Executing real ${type} on host hardware...`);
    try {
      const res = await fetch("/api/system/probe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ probeType: type, sizeMb: 32 })
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Probe failed");

      if (type === "MEMORY_ALLOC") {
        setActionOutput(`PROBE_SUCCESS [REAL MEMORY ALLOC]: Allocated ${result.allocatedMb}MB buffer in ${result.executionTimeMs}ms. Heap before: ${result.heapBeforeMb}MB → Peak: ${result.heapPeakMb}MB (Delta: +${result.heapDeltaMb}MB, RSS: ${result.rssMb}MB). Header SHA-256: ${result.headerChecksum.slice(0, 12)}...`);
      } else if (type === "ENTROPY_SCAN") {
        setActionOutput(`PROBE_SUCCESS [KERNEL ENTROPY SCAN]: Sampled 64KB from OS kernel RNG pool. Shannon Entropy: ${result.entropyScore}/8.000 bits/byte (${result.quality}) in ${result.executionTimeMs}ms.`);
      } else if (type === "CRYPTO_BENCH") {
        setActionOutput(`PROBE_SUCCESS [SHA-256 HARDWARE BENCH]: Processed ${result.totalDataMb}MB in ${result.executionTimeMs}ms. Real throughput: ${result.throughputMbSec} MB/s. Digest: ${result.sampleDigest.slice(0, 16)}...`);
      } else {
        setActionOutput(`PROBE_SUCCESS [EVENT LOOP MONITOR]: Mean Lag=${result.meanMs}ms, Max=${result.maxMs}ms, P99=${result.p99Ms}ms.`);
      }

      await fetchKernelInfo();
    } catch (e: any) {
      setActionOutput(`PROBE_FAILED: ${e.message}`);
    } finally {
      setIsExecuting(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 text-[#8E8E93] font-mono text-xs">
        <RefreshCw size={18} className="animate-spin text-[#00FF9C] mr-2" />
        INTERROGATING HOST HARDWARE & KERNEL BUS...
      </div>
    );
  }

  const mem = data?.memory;
  const totalMb = mem ? Math.round(mem.totalBytes / (1024 * 1024)) : 0;
  const freeMb = mem ? Math.round(mem.freeBytes / (1024 * 1024)) : 0;
  const usedMb = totalMb - freeMb;
  const memPercent = totalMb ? ((usedMb / totalMb) * 100).toFixed(1) : "0";

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-[#0A0A0B] text-[#E1E1E6] space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-[#2D2D30] pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Cpu size={20} className="text-[#00FF9C]" />
            <h2 className="font-mono text-xl sm:text-2xl font-bold tracking-tight">HOST KERNEL & HARDWARE INSPECTOR</h2>
          </div>
          <p className="font-mono text-xs text-[#8E8E93]">
            REAL HOST HARDWARE TOPOLOGY, MEMORY HEAP & INTERFACE DIAGNOSTICS
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchKernelInfo}
            disabled={loading}
            className="flex items-center gap-2 bg-[#161618] hover:bg-[#202024] border border-[#2D2D30] px-3 py-1.5 rounded-sm font-mono text-xs text-[#00FF9C] transition-colors"
          >
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
            REFRESH_SPECS
          </button>
        </div>
      </div>

      {/* Grid of Key Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-panel p-4 rounded-sm border border-[#2D2D30]">
          <div className="flex items-center gap-2 text-[#8E8E93] text-[10px] font-mono uppercase mb-2">
            <Server size={14} className="text-[#00FF9C]" />
            HOST_KERNEL
          </div>
          <div className="font-mono text-base font-bold text-white mb-1">
            {data?.kernel?.type} {data?.kernel?.architecture || data?.kernel?.arch || "x64"}
          </div>
          <div className="font-mono text-[10px] text-[#8E8E93] truncate">
            Release: {data?.kernel?.release}
          </div>
        </div>

        <div className="glass-panel p-4 rounded-sm border border-[#2D2D30]">
          <div className="flex items-center gap-2 text-[#8E8E93] text-[10px] font-mono uppercase mb-2">
            <Cpu size={14} className="text-[#00FF9C]" />
            CPU_TOPOLOGY
          </div>
          <div className="font-mono text-base font-bold text-[#00FF9C] mb-1">
            {data?.cpuSpecs?.cores ?? (data as any)?.cpu?.cores ?? 0} CORES
          </div>
          <div className="font-mono text-[10px] text-[#8E8E93] truncate">
            {data?.cpuSpecs?.model ?? (data as any)?.cpu?.model ?? "Host Processor"}
          </div>
        </div>

        <div className="glass-panel p-4 rounded-sm border border-[#2D2D30]">
          <div className="flex items-center gap-2 text-[#8E8E93] text-[10px] font-mono uppercase mb-2">
            <HardDrive size={14} className="text-[#00FF9C]" />
            PHYSICAL_RAM
          </div>
          <div className="font-mono text-base font-bold text-white mb-1">
            {usedMb} / {totalMb} MB
          </div>
          <div className="font-mono text-[10px] text-[#00FF9C]">
            {memPercent}% Utilized ({freeMb} MB Available)
          </div>
        </div>

        <div className="glass-panel p-4 rounded-sm border border-[#2D2D30]">
          <div className="flex items-center gap-2 text-[#8E8E93] text-[10px] font-mono uppercase mb-2">
            <Activity size={14} className="text-[#00FF9C]" />
            NODE_RUNTIME
          </div>
          <div className="font-mono text-base font-bold text-white mb-1">
            {data?.kernel?.nodeVersion}
          </div>
          <div className="font-mono text-[10px] text-[#8E8E93]">
            PID: {data?.kernel?.pid} (Up: {Math.floor((data?.uptime?.processSeconds || 0) / 60)}m {(data?.uptime?.processSeconds || 0) % 60}s)
          </div>
        </div>
      </div>

      {/* Main Two Column */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Core Cores Breakdown */}
        <div className="lg:col-span-8 glass-panel p-5 rounded-sm border border-[#2D2D30] space-y-4">
          <div className="flex items-center justify-between border-b border-[#2D2D30] pb-3">
            <div className="flex items-center gap-2">
              <Cpu size={16} className="text-[#00FF9C]" />
              <span className="font-mono text-xs uppercase font-semibold">Active CPU Execution Units ({data?.cpuSpecs?.cores ?? (data as any)?.cpu?.cores ?? 0})</span>
            </div>
            <span className="font-mono text-[10px] text-[#8E8E93]">NOMINAL_CLOCK: {data?.cpuSpecs?.speedMhz ?? (data as any)?.cpu?.speedMhz ?? 0} MHz</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[320px] overflow-y-auto pr-1">
            {(data?.cpuSpecs?.coreDetails ?? (data as any)?.cpu?.coreDetails ?? []).map((core: any) => {
              const totalTicks = core.times.user + core.times.nice + core.times.sys + core.times.idle + core.times.irq;
              const activeTicks = totalTicks - core.times.idle;
              const activePercent = totalTicks > 0 ? ((activeTicks / totalTicks) * 100).toFixed(1) : "0";

              return (
                <div key={core.coreId} className="bg-[#121214] p-3 rounded-sm border border-[#202024] font-mono">
                  <div className="flex justify-between items-center text-xs mb-1">
                    <span className="text-[#8E8E93]">CORE_{core.coreId.toString().padStart(2, "0")}</span>
                    <span className="text-[#00FF9C]">{activePercent}% Busy</span>
                  </div>
                  <div className="h-1.5 bg-[#1B1B1E] rounded-full overflow-hidden mb-2">
                    <motion.div
                      className="h-full bg-[#00FF9C]"
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, Math.max(5, parseFloat(activePercent)))}%` }}
                      transition={{ duration: 0.5 }}
                    />
                  </div>
                  <div className="flex justify-between text-[9px] text-[#636366]">
                    <span>usr: {Math.round(core.times.user / 1000)}k</span>
                    <span>sys: {Math.round(core.times.sys / 1000)}k</span>
                    <span>idle: {Math.round(core.times.idle / 1000)}k</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* V8 Process Memory Breakdown */}
          <div className="mt-4 pt-4 border-t border-[#2D2D30]">
            <span className="font-mono text-xs uppercase text-[#8E8E93] mb-3 block">Process V8 Memory Heap Allocation</span>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-[#121214] p-3 rounded-sm border border-[#202024] text-center font-mono">
                <p className="text-[10px] text-[#8E8E93]">HEAP_USED</p>
                <p className="text-sm font-bold text-white mt-1">
                  {data?.memory.processUsage ? Math.round(data.memory.processUsage.heapUsed / (1024 * 1024)) : 0} MB
                </p>
              </div>
              <div className="bg-[#121214] p-3 rounded-sm border border-[#202024] text-center font-mono">
                <p className="text-[10px] text-[#8E8E93]">HEAP_TOTAL</p>
                <p className="text-sm font-bold text-white mt-1">
                  {data?.memory.processUsage ? Math.round(data.memory.processUsage.heapTotal / (1024 * 1024)) : 0} MB
                </p>
              </div>
              <div className="bg-[#121214] p-3 rounded-sm border border-[#202024] text-center font-mono">
                <p className="text-[10px] text-[#8E8E93]">RESIDENT_SET (RSS)</p>
                <p className="text-sm font-bold text-[#00FF9C] mt-1">
                  {data?.memory.processUsage ? Math.round(data.memory.processUsage.rss / (1024 * 1024)) : 0} MB
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Diagnostic Actions & Network Interfaces */}
        <div className="lg:col-span-4 space-y-4">
          <div className="glass-panel p-5 rounded-sm border border-[#2D2D30] space-y-4">
            <div className="flex items-center gap-2">
              <Zap size={16} className="text-[#00FF9C]" />
              <span className="font-mono text-xs uppercase font-semibold">Diagnostic Execution Bus</span>
            </div>

            <div className="space-y-2">
              <button
                onClick={() => triggerProbe("MEMORY_ALLOC")}
                disabled={isExecuting}
                className="w-full flex items-center justify-between p-2.5 bg-[#161618] hover:bg-[#202024] border border-[#2D2D30] rounded-sm font-mono text-xs text-left transition-colors"
              >
                <span>Trigger Real Memory Allocation Probe (32MB)</span>
                <span className="text-[10px] text-[#00FF9C]">EXEC</span>
              </button>

              <button
                onClick={() => triggerProbe("ENTROPY_SCAN")}
                disabled={isExecuting}
                className="w-full flex items-center justify-between p-2.5 bg-[#161618] hover:bg-[#202024] border border-[#2D2D30] rounded-sm font-mono text-xs text-left transition-colors"
              >
                <span>Sample OS Kernel RNG Entropy Pool</span>
                <span className="text-[10px] text-[#00FF9C]">EXEC</span>
              </button>

              <button
                onClick={() => triggerProbe("CRYPTO_BENCH")}
                disabled={isExecuting}
                className="w-full flex items-center justify-between p-2.5 bg-[#161618] hover:bg-[#202024] border border-[#2D2D30] rounded-sm font-mono text-xs text-left transition-colors"
              >
                <span>Benchmark SHA-256 Hardware Throughput</span>
                <span className="text-[10px] text-[#00FF9C]">EXEC</span>
              </button>

              <button
                onClick={() => triggerProbe("EVENT_LOOP")}
                disabled={isExecuting}
                className="w-full flex items-center justify-between p-2.5 bg-[#161618] hover:bg-[#202024] border border-[#2D2D30] rounded-sm font-mono text-xs text-left transition-colors"
              >
                <span>Inspect Event-Loop Latency Histogram</span>
                <span className="text-[10px] text-[#00FF9C]">EXEC</span>
              </button>
            </div>

            {actionOutput && (
              <div className="p-3 bg-black/60 border border-[#00FF9C]/30 rounded-sm font-mono text-[10px] text-[#00FF9C] break-all">
                {actionOutput}
              </div>
            )}
          </div>

          {/* Network adapters */}
          <div className="glass-panel p-5 rounded-sm border border-[#2D2D30] space-y-3">
            <div className="flex items-center gap-2">
              <Network size={16} className="text-[#00FF9C]" />
              <span className="font-mono text-xs uppercase font-semibold">Network Adapter Map</span>
            </div>

            <div className="max-h-[220px] overflow-y-auto space-y-2 pr-1">
              {data?.network &&
                Object.entries(data.network).map(([ifName, addrs]) => (
                  <div key={ifName} className="p-2.5 bg-[#121214] rounded-sm border border-[#202024] font-mono text-[10px]">
                    <div className="text-white font-semibold mb-1 flex justify-between">
                      <span>{ifName}</span>
                      <span className="text-[#8E8E93]">{addrs?.[0]?.internal ? "INTERNAL" : "EXTERNAL"}</span>
                    </div>
                    {addrs?.map((addr, idx) => (
                      <div key={idx} className="text-[#8E8E93] flex justify-between">
                        <span>{addr.family}: {addr.address}</span>
                        <span className="text-[#636366]">{addr.mac}</span>
                      </div>
                    ))}
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
