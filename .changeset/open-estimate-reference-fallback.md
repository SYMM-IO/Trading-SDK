---
"@symmio/trading-core": minor
"@symmio/trading-react": minor
---

Expose instant-open estimate status and preserve reference-price fallback for technical estimate failures, including catalogued temporary errors and a confirmed missing estimate route. Recognize solver refusals in HTTP 200 responses. Retain explicit slippage and reserve settlement at the signed price bound when no estimate is available. React previews propagate terminal estimate errors and discard retained estimates after a failed refetch. Open estimates wait by default. An expired caller-supplied deadline reports unavailability, while explicit cancellation stops the request.
