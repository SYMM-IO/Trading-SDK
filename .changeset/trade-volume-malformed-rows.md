---
"@symmio/trading-core": patch
---

Omit malformed daily-volume rows by default instead of creating zero-volume observations. Valid zero and decimal-string volume rows remain unchanged. No new option or query-key policy is introduced.
