/**
 * WireEntropy — Binary Protocol Optimizer & Host Telemetry Engine
 * @license MIT
 * Copyright (c) 2026 Craig Huckaby
 */

import { useState, useEffect } from "react";
import Navigation from "./components/Navigation";
import Dashboard from "./components/Dashboard";
import KernelInspector from "./components/KernelInspector";
import SiphonFlow from "./components/SiphonFlow";
import TelemetryView from "./components/TelemetryView";
import SchemaRegistry from "./components/SchemaRegistry";
import SystemLogs from "./components/SystemLogs";
import ConfigPanel from "./components/ConfigPanel";
import ErrorBoundary from "./components/ErrorBoundary";
import { motion, AnimatePresence } from "motion/react";
import { Menu, Activity, ShieldCheck, X } from "lucide-react";

export default function App() {
  const [activeTab, setActiveTab] = useState("overview");
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [nodeHostname, setNodeHostname] = useState<string>("HOST-NODE");

  const [settings, setSettings] = useState(() => {
    try {
      const saved = localStorage.getItem("wire_settings") || localStorage.getItem("aeor_settings");
      if (saved) return JSON.parse(saved);
    } catch (e) {
      // ignore
    }
    return {
      scanlines: true,
      grid: true,
      refreshRate: 2000
    };
  });

  const [timeStr, setTimeStr] = useState(new Date().toISOString().slice(11, 19));

  useEffect(() => {
    fetch("/api/system/kernel")
      .then(res => res.json())
      .then(data => {
        if (data?.kernel?.hostname) {
          setNodeHostname(data.kernel.hostname.toUpperCase());
        }
      })
      .catch(() => {});

    const timer = setInterval(() => {
      setTimeStr(new Date().toISOString().slice(11, 19));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const updateSetting = (key: string, value: any) => {
    setSettings((prev: any) => {
      const next = { ...prev, [key]: value };
      try {
        localStorage.setItem("aeor_settings", JSON.stringify(next));
      } catch (e) {
        // ignore
      }
      return next;
    });
  };

  return (
    <div className={`flex h-screen w-screen overflow-hidden ${settings.grid ? 'nexus-grid' : ''} bg-[#0A0A0B] text-[#E1E1E6]`}>
      {/* Desktop / Collapsible Sidebar */}
      <div className="hidden md:flex h-full">
        <Navigation 
          activeTab={activeTab} 
          setActiveTab={setActiveTab} 
          onOpenConfig={() => setIsConfigOpen(true)}
        />
      </div>

      {/* Mobile Drawer Navigation */}
      <AnimatePresence>
        {mobileNavOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileNavOpen(false)}
              className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 md:hidden"
            />
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 250 }}
              className="fixed inset-y-0 left-0 w-64 z-50 bg-[#0A0A0B] border-r border-[#2D2D30] md:hidden shadow-2xl flex flex-col"
            >
              <div className="flex justify-between items-center p-4 border-b border-[#2D2D30]">
                <span className="font-mono text-xs text-[#00FF9C] font-bold">NAVIGATION</span>
                <button
                  onClick={() => setMobileNavOpen(false)}
                  className="text-[#8E8E93] hover:text-white"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                <Navigation 
                  activeTab={activeTab} 
                  setActiveTab={(tab) => {
                    setActiveTab(tab);
                    setMobileNavOpen(false);
                  }} 
                  onOpenConfig={() => {
                    setIsConfigOpen(true);
                    setMobileNavOpen(false);
                  }}
                />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
      
      {/* Main View Area */}
      <main className="flex-1 flex flex-col relative overflow-hidden min-w-0">
        {settings.scanlines && <div className="scanline" />}

        {/* Top Header */}
        <header className="h-12 border-b border-[#2D2D30] flex items-center justify-between px-3 sm:px-6 bg-[#0A0A0B]/90 backdrop-blur-sm z-30 shrink-0">
          <div className="flex items-center gap-2 sm:gap-4 overflow-hidden">
            <button
              onClick={() => setMobileNavOpen(true)}
              className="p-1.5 rounded-sm bg-[#161618] border border-[#2D2D30] text-[#00FF9C] md:hidden"
              title="Open Navigation"
            >
              <Menu size={16} />
            </button>

            <div className="flex items-center gap-1.5 whitespace-nowrap">
              <span className="font-mono text-[9px] sm:text-[10px] text-[#8E8E93]">NODE:</span>
              <span className="font-mono text-[9px] sm:text-[10px] text-[#00FF9C] font-bold">{nodeHostname}</span>
            </div>

            <div className="hidden xs:flex items-center gap-1.5 whitespace-nowrap">
              <span className="font-mono text-[9px] sm:text-[10px] text-[#8E8E93]">HOST:</span>
              <span className="font-mono text-[9px] sm:text-[10px] text-white">HARDWARE_NATIVE</span>
            </div>

            <div className="hidden sm:flex items-center gap-1.5 whitespace-nowrap">
              <span className="font-mono text-[9px] sm:text-[10px] text-[#8E8E93]">STORAGE:</span>
              <span className="font-mono text-[9px] sm:text-[10px] text-[#00FF9C]">SQLITE_WAL</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="font-mono text-[9px] sm:text-[10px] text-[#8E8E93] hidden md:block">
              REFRESH: {settings.refreshRate}MS
            </div>
            <div className="font-mono text-[9px] sm:text-[10px] text-[#00FF9C] whitespace-nowrap flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00FF9C] animate-pulse" />
              {timeStr} UTC
            </div>
          </div>
        </header>

        {/* Dynamic Panels */}
        <div className="flex-1 flex flex-col overflow-hidden min-h-0 relative">
          <ErrorBoundary fallbackTitle="View Rendering Fault Intercepted">
            <AnimatePresence mode="wait">
              {activeTab === "overview" && (
                <motion.div
                  key="overview"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="flex-1 flex flex-col overflow-hidden min-h-0"
                >
                  <Dashboard refreshRate={settings.refreshRate} onNavigate={setActiveTab} />
                </motion.div>
              )}

              {activeTab === "aeor" && (
                <motion.div
                  key="aeor"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="flex-1 flex flex-col overflow-hidden min-h-0"
                >
                  <KernelInspector />
                </motion.div>
              )}

              {activeTab === "siphon" && (
                <motion.div
                  key="siphon"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="flex-1 flex flex-col overflow-hidden min-h-0"
                >
                  <SiphonFlow />
                </motion.div>
              )}

              {activeTab === "tcrm" && (
                <motion.div
                  key="tcrm"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="flex-1 flex flex-col overflow-hidden min-h-0"
                >
                  <TelemetryView />
                </motion.div>
              )}

              {activeTab === "ssvr" && (
                <motion.div
                  key="ssvr"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="flex-1 flex flex-col overflow-hidden min-h-0"
                >
                  <SchemaRegistry />
                </motion.div>
              )}

              {activeTab === "logs" && (
                <motion.div
                  key="logs"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="flex-1 flex flex-col overflow-hidden min-h-0"
                >
                  <SystemLogs />
                </motion.div>
              )}
            </AnimatePresence>
          </ErrorBoundary>
        </div>
        {/* Status / Author Footer */}
        <footer className="h-7 border-t border-[#2D2D30] bg-[#0A0A0B]/95 px-3 sm:px-6 flex items-center justify-between text-[10px] font-mono text-[#8E8E93] shrink-0 z-20">
          <div className="flex items-center gap-2 truncate">
            <span className="text-[#00FF9C] font-semibold">WireEntropy v1.0</span>
            <span className="hidden sm:inline">• Binary Wire Protocol Optimizer & Diagnostics</span>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className="hidden md:inline">Author: <span className="text-white">Craig Huckaby</span></span>
            <span className="px-1.5 py-0.5 rounded bg-[#161618] border border-[#2D2D30] text-[#00FF9C] text-[9px]">MIT License</span>
          </div>
        </footer>
      </main>

      {/* Settings Modal */}
      <AnimatePresence>
        {isConfigOpen && (
          <ConfigPanel 
            isOpen={isConfigOpen} 
            onClose={() => setIsConfigOpen(false)} 
            settings={settings}
            updateSetting={updateSetting}
          />
        )}
      </AnimatePresence>

      {/* Backdrop for config panel */}
      <AnimatePresence>
        {isConfigOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsConfigOpen(false)}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
          />
        )}
      </AnimatePresence>

      {/* Decorative corner accents */}
      <div className="fixed top-0 left-0 w-8 h-8 border-t border-l border-[#00FF9C]/20 pointer-events-none z-50" />
      <div className="fixed top-0 right-0 w-8 h-8 border-t border-r border-[#00FF9C]/20 pointer-events-none z-50" />
      <div className="fixed bottom-0 left-0 w-8 h-8 border-b border-l border-[#00FF9C]/20 pointer-events-none z-50" />
      <div className="fixed bottom-0 right-0 w-8 h-8 border-b border-r border-[#00FF9C]/20 pointer-events-none z-50" />
    </div>
  );
}
