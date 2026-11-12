---
"@symmio/trading-core": patch
---

Recognize solver info responses with `timelock_enabled: false` and `timelock_approval: null` as disabled timelocks. Preserve solver fees and the plain-margin instant-open path while continuing to reject malformed or wrong-deployment metadata.
