---
"@symmio/trading-core": minor
"@symmio/trading-react": minor
---

Expose the solver's optional no-shadow estimated price as diagnostic data while retaining the shadow-inclusive execution price for all trading calculations. Older solvers keep the secondary price absent. Open preparation exposes matching, settled diagnostics through its existing shared estimate query without additional requests or pairing cached data with caller-supplied estimates.
