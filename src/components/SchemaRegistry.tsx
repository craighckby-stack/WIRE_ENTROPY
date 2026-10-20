import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { Shield, Plus, CheckCircle2, AlertCircle, Trash2, RefreshCw, FileJson, Check } from "lucide-react";

interface SchemaItem {
  id: string;
  name: string;
  version: string;
  type: string;
  schema_def: string;
  description: string;
  created_at?: string;
}

export default function SchemaRegistry() {
  const [schemas, setSchemas] = useState<SchemaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSchema, setSelectedSchema] = useState<SchemaItem | null>(null);

  // New schema form
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newVersion, setNewVersion] = useState("1.0.0");
  const [newType, setNewType] = useState("binary-contract");
  const [newDescription, setNewDescription] = useState("");
  const [newSchemaDef, setNewSchemaDef] = useState(
    JSON.stringify({
      nodeId: "string",
      sequence: "number",
      action: "enum:INIT|SYNC|DRAIN",
      checksum: "sha256"
    }, null, 2)
  );

  // Validation tester
  const [testPayload, setTestPayload] = useState(
    JSON.stringify({
      nodeId: "node-gamma-09",
      sequence: 1042,
      action: "SYNC",
      checksum: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    }, null, 2)
  );
  const [validationResult, setValidationResult] = useState<{
    valid: boolean;
    errors: string[];
    validatedAgainst?: string;
  } | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [decommissionTarget, setDecommissionTarget] = useState<string | null>(null);

  const fetchSchemas = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/schemas");
      const data = await res.json();
      setSchemas(data);
      if (data.length > 0 && !selectedSchema) {
        setSelectedSchema(data[0]);
      }
    } catch (e) {
      console.error("Failed to load schemas:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchemas();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorBanner(null);
    try {
      // Validate JSON syntax first
      JSON.parse(newSchemaDef);

      const res = await fetch("/api/schemas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName,
          version: newVersion,
          type: newType,
          description: newDescription,
          schema_def: newSchemaDef
        })
      });

      if (!res.ok) throw new Error("Creation failed");

      setIsCreating(false);
      setNewName("");
      setNewDescription("");
      await fetchSchemas();
    } catch (err: any) {
      setErrorBanner(`Invalid JSON definition or submission error: ${err.message}`);
    }
  };

  const confirmDecommission = async () => {
    if (!decommissionTarget) return;
    const id = decommissionTarget;
    setDecommissionTarget(null);
    try {
      await fetch(`/api/schemas/${id}`, { method: "DELETE" });
      if (selectedSchema?.id === id) {
        setSelectedSchema(null);
      }
      await fetchSchemas();
    } catch (e: any) {
      setErrorBanner(`Failed to decommission schema: ${e.message}`);
    }
  };

  const handleValidate = async () => {
    if (!selectedSchema) return;
    setIsValidating(true);
    try {
      const res = await fetch("/api/schemas/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schemaId: selectedSchema.id,
          testPayload
        })
      });
      const data = await res.json();
      setValidationResult(data);
    } catch (e: any) {
      setValidationResult({
        valid: false,
        errors: [e.message]
      });
    } finally {
      setIsValidating(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-[#0A0A0B] text-[#E1E1E6] space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-[#2D2D30] pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Shield size={20} className="text-[#00FF9C]" />
            <h2 className="font-mono text-xl sm:text-2xl font-bold tracking-tight">WIRE PROTOCOL & DATA CONTRACT REGISTRY</h2>
          </div>
          <p className="font-mono text-xs text-[#8E8E93]">
            PERSISTENT DATA CONTRACT DEFINITIONS, VERSIONING & PAYLOAD VERIFICATION
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsCreating(!isCreating)}
            className="flex items-center gap-1.5 bg-[#00FF9C] hover:bg-[#00e58c] text-black font-mono font-bold text-xs px-3 py-1.5 rounded-sm transition-colors"
          >
            <Plus size={14} />
            REGISTER_CONTRACT
          </button>
          <button
            onClick={fetchSchemas}
            className="flex items-center gap-1.5 bg-[#161618] hover:bg-[#202024] border border-[#2D2D30] px-3 py-1.5 rounded-sm font-mono text-xs text-[#00FF9C] transition-colors"
          >
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
            REFRESH
          </button>
        </div>
      </div>

      {errorBanner && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-sm font-mono text-xs text-red-400 flex justify-between items-center">
          <span>{errorBanner}</span>
          <button onClick={() => setErrorBanner(null)} className="text-red-400 hover:text-white">✕</button>
        </div>
      )}

      {decommissionTarget && (
        <div className="p-4 bg-[#161618] border border-red-500/40 rounded-sm font-mono text-xs space-y-3">
          <div className="text-red-400 font-bold uppercase">Confirm Decommissioning</div>
          <p className="text-[#8E8E93]">Are you sure you want to decommission contract <span className="text-white">{decommissionTarget}</span> from the SQLite registry?</p>
          <div className="flex gap-2">
            <button onClick={confirmDecommission} className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/40 rounded-sm font-semibold">
              YES, DECOMMISSION
            </button>
            <button onClick={() => setDecommissionTarget(null)} className="px-3 py-1.5 bg-[#202024] hover:bg-[#28282c] text-[#8E8E93] rounded-sm">
              CANCEL
            </button>
          </div>
        </div>
      )}

      {/* New Schema Form */}
      {isCreating && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="glass-panel p-5 rounded-sm border border-[#00FF9C]/40 space-y-4"
        >
          <div className="flex justify-between items-center text-xs font-mono font-bold text-[#00FF9C] uppercase">
            <span>Register New Protocol Data Contract</span>
            <button onClick={() => setIsCreating(false)} className="text-[#8E8E93] hover:text-white">✕</button>
          </div>
          <form onSubmit={handleCreate} className="space-y-4 font-mono text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] text-[#8E8E93] mb-1">CONTRACT NAME</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Siphon-Node-Pulse"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full bg-[#121214] border border-[#2D2D30] p-2 rounded-sm text-white"
                />
              </div>
              <div>
                <label className="block text-[10px] text-[#8E8E93] mb-1">SEMVER</label>
                <input
                  type="text"
                  required
                  value={newVersion}
                  onChange={(e) => setNewVersion(e.target.value)}
                  className="w-full bg-[#121214] border border-[#2D2D30] p-2 rounded-sm text-white"
                />
              </div>
              <div>
                <label className="block text-[10px] text-[#8E8E93] mb-1">CONTRACT TYPE</label>
                <input
                  type="text"
                  value={newType}
                  onChange={(e) => setNewType(e.target.value)}
                  className="w-full bg-[#121214] border border-[#2D2D30] p-2 rounded-sm text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] text-[#8E8E93] mb-1">DESCRIPTION</label>
              <input
                type="text"
                placeholder="Brief purpose of this contract"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                className="w-full bg-[#121214] border border-[#2D2D30] p-2 rounded-sm text-white"
              />
            </div>

            <div>
              <label className="block text-[10px] text-[#8E8E93] mb-1">SCHEMA SPECIFICATION (JSON)</label>
              <textarea
                rows={5}
                required
                value={newSchemaDef}
                onChange={(e) => setNewSchemaDef(e.target.value)}
                className="w-full bg-[#050506] border border-[#2D2D30] p-2 rounded-sm text-[#00FF9C]"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="px-4 py-2 bg-[#161618] border border-[#2D2D30] rounded-sm text-[#8E8E93]"
              >
                CANCEL
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-[#00FF9C] text-black font-bold rounded-sm"
              >
                SAVE CONTRACT TO SQLITE
              </button>
            </div>
          </form>
        </motion.div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Schemas List Column */}
        <div className="lg:col-span-5 space-y-3">
          <div className="text-xs font-mono text-[#8E8E93] uppercase flex justify-between">
            <span>REGISTERED CONTRACTS ({schemas.length})</span>
            <span>SQLITE SYNC</span>
          </div>

          <div className="space-y-2">
            {schemas.map((s) => (
              <button
                key={s.id}
                onClick={() => {
                  setSelectedSchema(s);
                  setValidationResult(null);
                }}
                className={`w-full p-3.5 rounded-sm border text-left font-mono transition-all block ${
                  selectedSchema?.id === s.id
                    ? "bg-[#121214] border-[#00FF9C] shadow-[0_0_10px_rgba(0,255,156,0.1)]"
                    : "bg-[#0d0d0e] border-[#2D2D30] hover:border-[#3D3D40]"
                }`}
              >
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-bold text-white">{s.name}</span>
                  <span className="text-[10px] text-[#00FF9C] bg-[#00FF9C]/10 px-1.5 py-0.5 rounded-sm">
                    v{s.version}
                  </span>
                </div>
                <div className="text-[10px] text-[#8E8E93] line-clamp-2 mb-2">
                  {s.description || "No description provided."}
                </div>
                <div className="flex justify-between items-center text-[9px] text-[#636366] border-t border-[#1a1a1c] pt-2">
                  <span>Type: {s.type}</span>
                  <span>ID: {s.id}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Selected Schema Details & Verification Tester */}
        <div className="lg:col-span-7 space-y-4">
          {selectedSchema ? (
            <div className="space-y-4">
              <div className="glass-panel p-5 rounded-sm border border-[#2D2D30] space-y-4">
                <div className="flex justify-between items-start border-b border-[#2D2D30] pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <FileJson size={16} className="text-[#00FF9C]" />
                      <h3 className="font-mono text-sm font-bold text-white uppercase">
                        {selectedSchema.name}
                      </h3>
                      <span className="text-[10px] font-mono text-[#00FF9C]">v{selectedSchema.version}</span>
                    </div>
                    <p className="font-mono text-[10px] text-[#8E8E93] mt-1">{selectedSchema.description}</p>
                  </div>
                  <button
                    onClick={() => setDecommissionTarget(selectedSchema.id)}
                    className="text-[#8E8E93] hover:text-red-400 p-1.5 transition-colors"
                    title="Decommission Schema"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                <div>
                  <div className="text-[10px] font-mono text-[#8E8E93] uppercase mb-1">Contract Definition</div>
                  <pre className="p-3 bg-[#050506] border border-[#1a1a1a] rounded-sm font-mono text-xs text-[#00FF9C] overflow-x-auto max-h-[180px]">
                    {selectedSchema.schema_def}
                  </pre>
                </div>
              </div>

              {/* Real Verification Tester */}
              <div className="glass-panel p-5 rounded-sm border border-[#2D2D30] space-y-4">
                <div className="flex justify-between items-center">
                  <span className="font-mono text-xs uppercase font-semibold flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-[#00FF9C]" />
                    Real Contract Verification Probe
                  </span>
                  <span className="font-mono text-[10px] text-[#8E8E93]">TEST PAYLOAD VALIDATOR</span>
                </div>

                <textarea
                  rows={4}
                  value={testPayload}
                  onChange={(e) => setTestPayload(e.target.value)}
                  className="w-full bg-[#050506] border border-[#2D2D30] p-2.5 rounded-sm font-mono text-xs text-white focus:outline-none focus:border-[#00FF9C]"
                  placeholder="Paste JSON payload to test against schema contract..."
                />

                <button
                  onClick={handleValidate}
                  disabled={isValidating}
                  className="w-full py-2.5 bg-[#161618] hover:bg-[#202024] border border-[#00FF9C]/40 text-[#00FF9C] font-mono text-xs font-semibold uppercase tracking-wider rounded-sm transition-colors flex items-center justify-center gap-2"
                >
                  <Check size={14} />
                  {isValidating ? "VALIDATING AGAINST KERNEL..." : "VALIDATE PAYLOAD AGAINST CONTRACT"}
                </button>

                {validationResult && (
                  <div
                    className={`p-3 rounded-sm border font-mono text-xs ${
                      validationResult.valid
                        ? "bg-[#00FF9C]/5 border-[#00FF9C]/30 text-[#00FF9C]"
                        : "bg-red-500/10 border-red-500/30 text-red-400"
                    }`}
                  >
                    <div className="flex items-center gap-2 font-bold mb-1">
                      {validationResult.valid ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                      {validationResult.valid
                        ? `CONTRACT COMPLIANT (Validated against ${validationResult.validatedAgainst})`
                        : "CONTRACT VIOLATION DETECTED"}
                    </div>
                    {validationResult.errors.length > 0 && (
                      <ul className="list-disc list-inside text-[11px] space-y-0.5 text-red-300">
                        {validationResult.errors.map((err, i) => (
                          <li key={i}>{err}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="glass-panel p-12 text-center font-mono text-xs text-[#8E8E93]">
              Select a schema from the left to inspect or validate payloads.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
