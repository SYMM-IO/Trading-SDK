---
"@symmio/trading-core": patch
---

Omit malformed daily-volume rows by default instead of creating zero-volume observations. Valid zero and decimal-string volume rows remain unchanged. No new option or query-key policy is introduced.

Validation stays private to `getTradeVolume`. The exported `toSolverDailyVolume` mapper keeps its non-optional return type and existing missing-field defaults for compatibility.
