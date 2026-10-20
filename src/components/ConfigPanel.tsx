import { motion } from "motion/react";
import { X, Sliders, Monitor, Shield, Database, Zap } from "lucide-react";

interface ConfigProps {
  isOpen: boolean;
  onClose: () => void;
  settings: any;
  updateSetting: (key: string, value: any) => void;
}

export default function ConfigPanel({ isOpen, onClose, settings, updateSetting }: ConfigProps) {
  if (!isOpen) return null;

  return (
    <motion.div 
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ type: "spring", damping: 25, stiffness: 200 }}
      className="fixed inset-y-0 right-0 w-80 glass-panel border-l border-[#2D2D30] z-50 p-6 shadow-2xl"
    >
      <div className="flex items-center justify-between mb-8 border-b border-[#2D2D30] pb-4">
        <div className="flex items-center gap-2">
          <Sliders size={16} className="text-[#00FF9C]" />
          <h2 className="font-mono text-sm font-bold tracking-widest">SYSTEM_SETTINGS</h2>
        </div>
        <button onClick={onClose} className="text-[#8E8E93] hover:text-white transition-colors">
          <X size={20} />
        </button>
      </div>

      <div className="space-y-8">
        {/* UI Settings */}
        <section>
          <div className="flex items-center gap-2 mb-4 text-[#8E8E93]">
            <Monitor size={14} />
            <span className="font-mono text-[10px] tracking-widest">DISPLAY_OPTIONS</span>
          </div>
          <div className="space-y-4">
            <Toggle 
              label="SCANLINES" 
              active={settings.scanlines} 
              onToggle={() => updateSetting("scanlines", !settings.scanlines)} 
            />
            <Toggle 
              label="BACKGROUND_GRID" 
              active={settings.grid} 
              onToggle={() => updateSetting("grid", !settings.grid)} 
            />
          </div>
        </section>

        {/* Kernel Settings */}
        <section>
          <div className="flex items-center gap-2 mb-4 text-[#8E8E93]">
            <Zap size={14} />
            <span className="font-mono text-[10px] tracking-widest">HOST_METRICS_ENGINE</span>
          </div>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="font-mono text-[9px] text-[#8E8E93] block">TELEMETRY_SAMPLE_RATE</label>
              <input 
                type="range" 
                min="500" 
                max="5000" 
                step="500"
                value={settings.refreshRate}
                onChange={(e) => updateSetting("refreshRate", parseInt(e.target.value))}
                className="w-full accent-[#00FF9C] bg-[#161618] h-1 rounded-full appearance-none cursor-pointer"
              />
              <div className="flex justify-between font-mono text-[8px] text-[#8E8E93]">
                <span>FAST</span>
                <span>{settings.refreshRate}MS</span>
                <span>SLOW</span>
              </div>
            </div>
          </div>
        </section>

        {/* Security Settings */}
        <section>
          <div className="flex items-center gap-2 mb-4 text-[#8E8E93]">
            <Shield size={14} />
            <span className="font-mono text-[10px] tracking-widest">CONTRACT_VALIDATION</span>
          </div>
          <div className="p-3 bg-[#161618] border border-[#2D2D30] rounded-sm">
            <p className="font-mono text-[9px] text-[#8E8E93]">Data Contract Integrity</p>
            <p className="font-mono text-[10px] text-[#00FF9C] mt-1">STRICT_VALIDATION_ACTIVE</p>
          </div>
        </section>
      </div>

      <div className="absolute bottom-6 left-6 right-6">
        <button 
          onClick={onClose}
          className="w-full py-3 bg-[#00FF9C]/10 border border-[#00FF9C]/30 text-[#00FF9C] font-mono text-[10px] tracking-widest hover:bg-[#00FF9C]/20 transition-all uppercase"
        >
          Commit Changes
        </button>
      </div>
    </motion.div>
  );
}

function Toggle({ label, active, onToggle }: { label: string, active: boolean, onToggle: () => void }) {
  return (
    <div className="flex items-center justify-between">
      <span className="font-mono text-[10px] text-[#E1E1E6]">{label}</span>
      <button 
        onClick={onToggle}
        className={`w-8 h-4 rounded-full relative transition-colors ${active ? "bg-[#00FF9C]" : "bg-[#2D2D30]"}`}
      >
        <motion.div 
          animate={{ x: active ? 16 : 2 }}
          className="absolute top-1 left-0 w-2 h-2 bg-white rounded-full"
        />
      </button>
    </div>
  );
}
