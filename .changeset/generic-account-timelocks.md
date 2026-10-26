---
"@symmio/trading-core": minor
"@symmio/trading-react": minor
---

Add generic AccountLayer timelock policy, approval, schedule, cancellation, and execution APIs with React hooks and transparent gasless support. Expose the canonical 22-selector instant-open policy, validate provider approval responses, surface ambiguous POST outcomes without automatic retries, and support delayed on-chain fallback status.

Allow Enigma instant opens without additional margin to submit only `sendQuote`, while retaining the timelock wrapper for margin-bearing opens.

Expose deployment timelock metadata through solver info, complete root-aware policy reports, confirmed setup with an injectable indexing observer, and one-attempt early withdrawal actions/hooks. Preserve issued approvals and transaction hashes on recovery errors. Add typed solver errors, immutable prepared instant-open submission, independent embedded approval deadlines and post-signing deadline checks. Existing non-timelock solver flows remain unchanged.
