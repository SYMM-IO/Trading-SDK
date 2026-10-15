---
"@symmio/trading-core": minor
"@symmio/trading-react": minor
---

**Instant trades check the signer's delegation before signing.** `instantOpen`, `instantClose` and `instantCloseBulk` — and every flow built on them (`instantOpenAuto`, `limitOpenAuto`, `instantCloseAuto`, `limitCloseAuto`, `instantCloseBulkAuto`, the React instant hooks and `useCloseQuoteGroup`) — now confirm that the signing key holds an active InstantLayer delegation for every operation it is about to sign. A key without one fails with `INSTANT_SIGNER_NOT_DELEGATED` (`kind: "validation"`) before anything is signed or sent to the solver, instead of the trade reverting on-chain after the solver accepted it.

- The check reuses the gasless relay's delegation pre-flight, so relayed writes and instant trades judge a session key the same way. A close signed under a virtual account is checked on the VA's parent sub-account, where the InstantLayer enforces delegations, and a bulk close is checked once per sub-account before any order is signed.
- The sub-account's owner needs no delegation: an owner-signed trade reads the owner once per config and skips the delegation reads. A session-key trade adds one RPC round trip.
- Pass `preflightDelegation: false` (new `InstantDelegationPreflightParameter`) to skip the check when your UI already gates the trade on delegation. The prepare functions, the auto, limit and bulk flows, the React instant hooks and `useCloseQuoteGroup` all forward it.
- A failed read during the check fails the trade instead of letting it through unchecked.
- Relay-vs-wallet routing and the grant-delegation flow are unchanged.
