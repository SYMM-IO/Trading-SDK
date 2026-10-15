---
"@symmio/trading-core": minor
"@symmio/trading-react": minor
---

Add symbol-ID Enigma market/funding reads, complete symbol and exact cap snapshots,
batched token enrichment, and exact-decimal public listing snapshots with matching
query factories and React hooks. Preserve single-symbol price frames, identity,
source timestamps, index prices and funding fields without changing existing APIs.

Allow daily-volume consumers to omit absent volume fields with `missingVolume: "omit"`,
preserving the existing zero fallback by default and keeping query caches separate.
