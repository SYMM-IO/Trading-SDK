---
"@symmio/trading-core": patch
---

**Arbitrum notification search uses the reachable endpoint.** The built-in Arbitrum `notifications.searchUrl` now points at the service's host root, `https://notification.rasa.capital`. Cloudflare answers the previous `/notification` prefix with a 403 block page, so `searchNotifications` / `useSearchNotifications` failed on Arbitrum unless the caller passed `baseUrl`.

**Retired Muon gateway removed.** `muon-oracle4.rasa.capital` no longer resolves, so it is gone from the Base and Arbitrum Muon lists. Oracles 1–3 remain and are still tried in order.
