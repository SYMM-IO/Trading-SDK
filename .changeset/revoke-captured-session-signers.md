---
"@symmio/session-key": minor
---

Keep captured viem accounts bound to the manager lifecycle and local expiry, checking all signing methods before and after asynchronous signing. Add SessionKeyExpiredError, restore-only load(owner), and absolute-expiry imports for transferred sessions.

Validate stored key identity and timestamps before publication, including competing-writer reconciliation. Reject invalid import inputs before changing the existing signer or persisted record. Encryption, password locks, deployment scoping, and cross-context storage coordination remain application responsibilities.
