---
"@symmio/trading-core": minor
"@symmio/trading-react": minor
---

Add optional `availableBalance` to instant-open preparation and fee previews. Lowcap typed-margin orders reject inputs above the supplied balance; inputs within the balance automatically use existing full-balance sizing when required funding exceeds it, and results expose `fundingMode`. React previews forward the balance and expose preparation readiness so consumers can wait for current sizing before submitting.

Expose synchronous balance validation so React can reject invalid funding before requesting estimates. Forward the balance through the fee query to keep its sizing and validation aligned with preparation.

Share cached input loading between React preparation and fee previews, including solver info. Return synchronous `validationError` separately from query errors, and expose `isReady` on both hooks. Consumers should display `validationError ?? error` and gate current-order usage on `isReady`. Accept `estimatedOpenPrice: null` in core and React to represent an unavailable estimate without fetching again; preparation returns this value for forwarding to fee preview and submission.
