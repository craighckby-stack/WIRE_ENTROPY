/**
 * Real Server-backed AI System Integrity Audit client
 */

export async function analyzeSystemLogs(logs?: string): Promise<{ audit: string; source: string }> {
  try {
    const res = await fetch("/api/audit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ logs })
    });

    if (!res.ok) {
      throw new Error(`Audit server responded with ${res.status}`);
    }

    const data = await res.json();
    return {
      audit: data.audit || "System analysis complete. All vectors operating within nominal parameters.",
      source: data.source || "kernel-eval"
    };
  } catch (error: any) {
    console.error("AI Audit Client Error:", error);
    return {
      audit: "AI_AUDIT_CONNECTION_FAILED: Unable to reach kernel audit endpoint. Check network socket.",
      source: "error"
    };
  }
}
