---
"@symmio/trading-core": minor
---

Add optional per-configuration gasless HTTP headers for authenticated application proxies. Resolve fresh headers for every read, submission attempt and exact replay without persisting credentials or exposing callback errors. Preserve uncertainty when authentication fails after an earlier ambiguous submission. `DeepPartial` keeps function types intact, so callbacks such as `gasless.getRequestHeaders` stay typed in a partial chain configuration.
