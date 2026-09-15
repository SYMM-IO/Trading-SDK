---
"@symmio/trading-core": minor
"@symmio/trading-react": minor
---

Remove the rasa-only `addSolverWhitelist` action and `useAddSolverWhitelist` hook. The `/add-sub-address-in-whitelist` endpoint has no backing logic on the rasa solver, so the SDK no longer wraps it. Drop any calls to `addSolverWhitelist`, `addSolverWhitelistMutationOptions`, or `useAddSolverWhitelist` — there is no replacement.
