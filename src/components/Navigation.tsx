import { useState } from "react";
import { motion } from "motion/react";
import { Activity, Shield, Cpu, Layers, Database, Terminal as TerminalIcon, Settings, ChevronLeft, ChevronRight, Menu } from "lucide-react";

const navItems = [
  { id: "overview", label: "SYSTEM OVERVIEW", shortLabel: "OVR", icon: Activity },
  { id: "aeor", label: "HOST DIAGNOSTICS", shortLabel: "HOST", icon: Cpu },
  { id: "siphon", label: "BINARY PIPELINE", shortLabel: "WIRE", icon: Layers },
  { id: "tcrm", label: "LIVE TELEMETRY", shortLabel: "METR", icon: Database },
  { id: "ssvr", label: "DATA CONTRACTS", shortLabel: "SCHM", icon: Shield },
  { id: "logs", label: "AUDIT LOGS", shortLabel: "LOGS", icon: TerminalIcon },
];

export default function Navigation({
  activeTab,
  setActiveTab,
  onOpenConfig
}: {
  activeTab: string;
  setActiveTab: (id: string) => void;
  onOpenConfig: () => void;
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <nav
      className={`h-full border-r border-[#2D2D30] bg-[#0A0A0B] flex flex-col pt-4 sm:pt-6 transition-all duration-300 z-30 ${
        collapsed ? "w-16" : "w-48 sm:w-56"
      }`}
    >
      {/* Brand Header */}
      <div className="px-3 sm:px-4 mb-6 flex items-center justify-between">
        {!collapsed && (
          <div className="overflow-hidden">
            <div className="flex items-center gap-1.5 mb-1">
              <div className="w-2 h-2 rounded-full bg-[#00FF9C] status-glow animate-pulse" />
              <span className="font-mono text-[9px] tracking-widest text-[#00FF9C]">WIRE_ENTROPY</span>
            </div>
            <h1 className="font-mono text-base sm:text-lg font-bold tracking-tight text-white truncate">
              OPTIMIZER
            </h1>
          </div>
        )}
        {collapsed && (
          <div className="mx-auto w-2.5 h-2.5 rounded-full bg-[#00FF9C] status-glow animate-pulse" />
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1 hover:bg-[#161618] rounded-sm text-[#8E8E93] hover:text-[#00FF9C] transition-colors hidden sm:block"
          title={collapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 px-2 space-y-1">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-2.5 px-2.5 py-2 sm:py-2.5 rounded-sm font-mono text-[10px] tracking-wider transition-all relative overflow-hidden ${
                isActive
                  ? "text-[#00FF9C] bg-[#00FF9C]/5"
                  : "text-[#8E8E93] hover:text-[#E1E1E6] hover:bg-[#161618]"
              }`}
              title={item.label}
            >
              {isActive && (
                <motion.div
                  layoutId="nav-active"
                  className="absolute left-0 top-0 bottom-0 w-1 bg-[#00FF9C]"
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
              )}
              <item.icon size={16} className="shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </button>
          );
        })}
      </div>

      {/* Bottom Settings & Author Credit */}
      <div className="p-3 sm:p-4 border-t border-[#2D2D30] space-y-2">
        <button
          onClick={onOpenConfig}
          className="w-full flex items-center gap-2 text-[#8E8E93] hover:text-[#E1E1E6] font-mono text-[10px] tracking-widest transition-colors"
          title="System Settings"
        >
          <Settings size={14} className="shrink-0" />
          {!collapsed && <span className="truncate">SETTINGS</span>}
        </button>

        {!collapsed && (
          <div className="pt-2 border-t border-[#2D2D30]/60 font-mono text-[9px] text-[#6E6E73] leading-tight">
            <div className="text-[#8E8E93] font-semibold">Craig Huckaby</div>
            <div className="text-[8px] text-[#00FF9C]/80">MIT License • 2026</div>
          </div>
        )}
      </div>
    </nav>
  );
}
