import { useState, useEffect, useRef } from "react";
import { Terminal, Search, Filter, Download, Plus, Sparkles, RefreshCw, AlertTriangle, ShieldCheck } from "lucide-react";
import { analyzeSystemLogs } from "../services/geminiService";

interface LogEntry {
  id: number;
  timestamp: string;
  level: "INF" | "WRN" | "ERR" | "SYS" | "ACT";
  module: string;
  message: string;
  details?: string;
}

export default function SystemLogs() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [levelFilter, setLevelFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [aiAudit, setAiAudit] = useState<{ audit: string; source: string } | null>(null);
  const [isAuditing, setIsAuditing] = useState(false);

  // New log emitter form
  const [newLevel, setNewLevel] = useState<"INF" | "WRN" | "ERR" | "SYS" | "ACT">("INF");
  const [newModule, setNewModule] = useState("USER");
  const [newMessage, setNewMessage] = useState("");
  const [isEmitting, setIsEmitting] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set("limit", "100");
      if (levelFilter !== "ALL") params.set("level", levelFilter);
      if (searchQuery.trim()) params.set("search", searchQuery.trim());

      const res = await fetch(`/api/logs?${params.toString()}`);
      const data = await res.json();
      setLogs(data);
    } catch (e) {
      console.error("Failed to load logs:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [levelFilter, searchQuery]);

  const handleEmitLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    setIsEmitting(true);
    try {
      await fetch("/api/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          level: newLevel,
          module: newModule.toUpperCase(),
          message: newMessage.trim(),
          details: `Manual trace emitted from AUDIT_LOGS console @ ${new Date().toISOString()}`
        })
      });
      setNewMessage("");
      await fetchLogs();
    } catch (e) {
      console.error(e);
    } finally {
      setIsEmitting(false);
    }
  };

  const handleRunAudit = async () => {
    setIsAuditing(true);
    try {
      const result = await analyzeSystemLogs();
      setAiAudit(result);
      await fetchLogs();
    } catch (e) {
      console.error(e);
    } finally {
      setIsAuditing(false);
    }
  };

  const exportLogs = () => {
    const text = logs.map(l => `[${l.timestamp}] [${l.level}] [${l.module}] ${l.message} ${l.details ? `(${l.details})` : ""}`).join("\n");
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `wire_entropy_logs_${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-[#0A0A0B] text-[#E1E1E6] space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-[#2D2D30] pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Terminal size={20} className="text-[#00FF9C]" />
            <h2 className="font-mono text-xl sm:text-2xl font-bold tracking-tight">SYSTEM AUDIT JOURNAL & EVENT LOGS</h2>
          </div>
          <p className="font-mono text-xs text-[#8E8E93]">
            PERSISTENT SYSTEM ACTIVITY JOURNAL & HOST DIAGNOSTIC EVALUATION
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleRunAudit}
            disabled={isAuditing}
            className="flex items-center gap-2 bg-[#00FF9C]/10 hover:bg-[#00FF9C]/20 border border-[#00FF9C]/40 text-[#00FF9C] px-3 py-1.5 rounded-sm font-mono text-xs font-semibold transition-colors"
          >
            <Sparkles size={14} className={isAuditing ? "animate-spin" : ""} />
            {isAuditing ? "AUDITING..." : "EXECUTE_AI_AUDIT"}
          </button>

          <button
            onClick={exportLogs}
            className="flex items-center gap-1.5 bg-[#161618] hover:bg-[#202024] border border-[#2D2D30] px-3 py-1.5 rounded-sm font-mono text-xs text-white transition-colors"
          >
            <Download size={12} />
            EXPORT
          </button>

          <button
            onClick={fetchLogs}
            className="flex items-center gap-1.5 bg-[#161618] hover:bg-[#202024] border border-[#2D2D30] px-3 py-1.5 rounded-sm font-mono text-xs text-[#00FF9C] transition-colors"
          >
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
            REFRESH
          </button>
        </div>
      </div>

      {/* AI Audit Result Box */}
      {aiAudit && (
        <div className="glass-panel p-5 rounded-sm border border-[#00FF9C]/40 space-y-2">
          <div className="flex justify-between items-center text-xs font-mono">
            <span className="text-[#00FF9C] flex items-center gap-1.5 font-bold">
              <ShieldCheck size={14} />
              SYSTEM INTEGRITY AUDIT REPORT ({aiAudit.source})
            </span>
            <button onClick={() => setAiAudit(null)} className="text-[#8E8E93] hover:text-white">✕</button>
          </div>
          <p className="font-mono text-xs text-[#E1E1E6] leading-relaxed bg-[#050506] p-3 rounded-sm border border-[#1a1a1a]">
            {aiAudit.audit}
          </p>
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-[10px] text-[#8E8E93]">LEVEL:</span>
          {["ALL", "SYS", "INF", "WRN", "ERR", "ACT"].map((lvl) => (
            <button
              key={lvl}
              onClick={() => setLevelFilter(lvl)}
              className={`px-2.5 py-1 rounded-sm font-mono text-[10px] transition-colors ${
                levelFilter === lvl
                  ? "bg-[#00FF9C] text-black font-bold"
                  : "bg-[#161618] text-[#8E8E93] hover:text-white border border-[#2D2D30]"
              }`}
            >
              {lvl}
            </button>
          ))}
        </div>

        <div className="relative min-w-[240px]">
          <Search size={14} className="absolute left-3 top-2.5 text-[#8E8E93]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search journal records..."
            className="w-full bg-[#121214] border border-[#2D2D30] rounded-sm pl-8 pr-3 py-1.5 font-mono text-xs text-white focus:outline-none focus:border-[#00FF9C]"
          />
        </div>
      </div>

      {/* Log Feed Console */}
      <div className="glass-panel rounded-sm border border-[#2D2D30] overflow-hidden">
        <div className="p-3 bg-[#0d0d0f] border-b border-[#2D2D30] flex justify-between items-center text-[10px] font-mono text-[#8E8E93]">
          <span>JOURNAL FEED ({logs.length} RECORDS LOADED)</span>
          <span>STORAGE: `aeor.db` (SQLITE)</span>
        </div>

        <div
          ref={containerRef}
          className="p-4 bg-[#050506] max-h-[420px] overflow-y-auto font-mono text-xs space-y-2 scrollbar-thin scrollbar-thumb-[#2D2D30]"
        >
          {logs.length === 0 ? (
            <div className="py-12 text-center text-[#636366]">No log records match current query.</div>
          ) : (
            logs.map((log) => {
              const levelColor =
                log.level === "ERR"
                  ? "text-red-400 bg-red-400/10 border-red-400/20"
                  : log.level === "WRN"
                  ? "text-amber-400 bg-amber-400/10 border-amber-400/20"
                  : log.level === "SYS"
                  ? "text-[#00FF9C] bg-[#00FF9C]/10 border-[#00FF9C]/20"
                  : log.level === "ACT"
                  ? "text-[#38BDF8] bg-[#38BDF8]/10 border-[#38BDF8]/20"
                  : "text-[#8E8E93] bg-[#8E8E93]/10 border-[#8E8E93]/20";

              return (
                <div
                  key={log.id}
                  className="p-2.5 rounded-sm bg-[#0c0c0e] hover:bg-[#121214] border border-[#1a1a1c] transition-colors flex flex-col sm:flex-row gap-2 justify-between items-start"
                >
                  <div className="flex items-start gap-2.5 flex-1">
                    <span className={`px-1.5 py-0.5 rounded-[2px] text-[9px] font-bold border ${levelColor}`}>
                      {log.level}
                    </span>
                    <span className="text-[10px] text-[#636366] whitespace-nowrap">
                      [{log.module}]
                    </span>
                    <span className="text-[#E1E1E6] leading-relaxed break-all">
                      {log.message}
                    </span>
                  </div>
                  <div className="text-[9px] text-[#636366] whitespace-nowrap self-end sm:self-auto">
                    {log.timestamp}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Manual Event Injection */}
      <div className="glass-panel p-4 rounded-sm border border-[#2D2D30]">
        <div className="text-[10px] font-mono text-[#8E8E93] uppercase mb-2">
          Emit Real System Journal Trace
        </div>
        <form onSubmit={handleEmitLog} className="flex flex-col sm:flex-row gap-2">
          <select
            value={newLevel}
            onChange={(e: any) => setNewLevel(e.target.value)}
            className="bg-[#121214] border border-[#2D2D30] text-xs font-mono text-white p-2 rounded-sm"
          >
            <option value="INF">INF</option>
            <option value="SYS">SYS</option>
            <option value="ACT">ACT</option>
            <option value="WRN">WRN</option>
            <option value="ERR">ERR</option>
          </select>
          <input
            type="text"
            value={newModule}
            onChange={(e) => setNewModule(e.target.value)}
            placeholder="MODULE"
            className="w-24 bg-[#121214] border border-[#2D2D30] text-xs font-mono text-white p-2 rounded-sm uppercase"
          />
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Enter event message to write to SQLite journal..."
            className="flex-1 bg-[#121214] border border-[#2D2D30] text-xs font-mono text-white p-2 rounded-sm focus:outline-none focus:border-[#00FF9C]"
          />
          <button
            type="submit"
            disabled={isEmitting}
            className="bg-[#00FF9C] hover:bg-[#00e58c] text-black font-mono font-bold text-xs px-4 py-2 rounded-sm flex items-center justify-center gap-1.5 transition-colors"
          >
            <Plus size={14} />
            EMIT_LOG
          </button>
        </form>
      </div>
    </div>
  );
}
