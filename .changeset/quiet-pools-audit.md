---
"@symmio/trading-core": patch
"@symmio/trading-react": patch
---

Keep portfolio deposit projections consistent with catalog-only fallback amounts, and treat failed profit refreshes as unknown even when cached snapshots exist. Stop queued core portfolio reads after authentication failure. Preserve zero marks and unknown quote direction in pool open-position calculations.
