---
"@symmio/trading-react": patch
---

Reset Enigma price-hook state when its SDK configuration or chain changes, and ignore callbacks from disposed subscriptions. Preserve last prices during reconnects and stop/start on the same target.
