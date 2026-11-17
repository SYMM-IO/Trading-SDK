---
"@symmio/trading-core": minor
---

Expose each listing deposit chain's optional USD quote-token address and native decimals through `ListingDepositChain.usdToken`. Preserve address casing and native precision, and retain compatibility with older listing backends that omit the metadata.
