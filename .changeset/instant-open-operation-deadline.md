---
"@symmio/trading-core": minor
"@symmio/trading-react": minor
---

Add optional `operationDeadline` to lowcap instant opens: the expiry for both signed operations, separate from the quote `deadline` and defaulting to it. Accepted by `prepareInstantOpenParams`, `instantOpenAuto`, and `instantOpen`. `instantOpen` also accepts `markPrice` (18-decimal wei) for the Muon placeholder, defaulting to `order.price`; preparation now supplies the resolved mark price. `prepareInstantOpenParams` accepts `estimatedOpenPriceTimestamp` for compatibility; core does not use it or expire estimates.

Enigma submission no longer reports a rejected or malformed response as accepted. A rejection body returned with HTTP 200 throws `INSTANT_OPEN_REJECTED`, and a missing or invalid temporary ID throws `INSTANT_OPEN_INVALID_RESPONSE`, both as `SymmApiError` with the solver response on `responseData`. Submission is not retried.

`usePrepareInstantOpenParams` returns `estimatedOpenPriceTimestamp`, and both it and `useInstantOpenFees` expose `refetchEstimatedPrice` so the frontend controls when the SDK-managed estimate refreshes.
