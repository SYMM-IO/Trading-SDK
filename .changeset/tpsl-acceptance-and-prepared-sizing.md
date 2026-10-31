---
"@symmio/trading-core": patch
"@symmio/trading-react": minor
---

Validate TP/SL acceptance responses, reject unsafe numeric wire IDs, and reject malformed search pages instead of treating them as empty. Preserve valid negative temporary IDs. Share acknowledgment validation and explicitly disable inherited automatic retries in standalone TP/SL mutation factories and React hooks, preventing ambiguous outcomes from replaying signed writes.

Add opt-in prepared quantity and external TP/SL state ownership to instant-open attachment. Return resolved attachment parameters for attachment-only recovery, preserving accepted opens on attachment failure. Existing defaults remain unchanged.
