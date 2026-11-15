---
"@symmio/trading-core": minor
"@symmio/trading-react": minor
---

Expose instant-open estimate status and preserve reference-price fallback for technical estimate failures. Retain explicit slippage, reject solver refusals and cancellation, and reserve settlement at the signed price bound when no estimate is available. React previews propagate terminal estimate errors and discard retained estimates after a failed refetch. Estimate requests continue waiting without an added timeout.
