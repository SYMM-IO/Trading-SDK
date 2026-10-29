---
"@symmio/trading-core": patch
"@symmio/trading-react": patch
---

Preserve portfolio totals when refunded or non-listed pools are present. Skip profit/detail reads for known non-listed and unfunded pools while retaining deposit history, and recognize only profit HTTP 404/code 22 as a zero LP position. Keep other failures unknown, retry failed per-pool reads once except authentication errors, and limit combined profit/detail concurrency to five in core and React, including React manual refreshes.
