# Neural Engine Post-Mortems

## Auto-Generated Lessons & Negative Constraints




### ❌ [2026-10-20] server.ts `source: mutation-cycle`
**Symptom:** AST / TypeScript Compiler Validation Rejected
**EVIDENCE (Machine-Copied Fact):**
```
Line 1, Col 1: [LINT REJECT: NO_UNGROUNDED_QUANTITATIVE_CLAIMS] Detected 1 specific numeric claim(s) with no traceable computation, call, or fetched value nearby: "100%" (percentage). Output must not assert precise statistics (percentages, cycle counts, benchmark scores, confidence scores) unless derived from an actual computation or data source in the same diff.
```
**DIAGNOSIS:** Model asserted specific numeric findings (percentages, cycle counts, benchmark scores) in server.ts without a corresponding computation, external call, or data source in the generated diff.
**CONSTRAINT (Model Generalization):** When generating analysis/evaluation output in server.ts, do not state precise statistics unless the value is assigned from an actual computed expression, function call, or fetched result in the same output. Stub or placeholder implementations must say so explicitly (e.g. "not yet computed") rather than inventing plausible-sounding numbers.
**FINGERPRINT:** `server.ts::Line _, Col _: [LINT REJECT: NO_UNGROUNDED_QUANTITATIVE_CLAIMS] Detected 1 specific numeric claim(s) with no traceable computation, call, or fetched value nearby: "100%" (percentage). Output must not assert precise statistics (percentages, cycle counts, benchmark scores, confidence scores) unless derived from an actual computation or data source in the same diff.` (Occurrences: 3)
**STATUS:** ⚠️ ESCALATED (Threshold of 3 recurrences reached. Structural chunking / diff required)
