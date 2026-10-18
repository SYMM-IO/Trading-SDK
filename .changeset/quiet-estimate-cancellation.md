---
"@symmio/trading-core": minor
"@symmio/trading-react": patch
---

Allow imperative estimated-price reads to cancel their HTTP request with an optional AbortSignal. Forward TanStack Query cancellation through estimate queries and the React hook without including signals in cache identity or imposing a default timeout.
