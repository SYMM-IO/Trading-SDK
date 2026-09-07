---
"@symmio/trading-core": minor
---

Align the Arbitrum chain registry with the deployed staging environment, and ship its gasless block.

- **`addresses.instantLayerAddress` corrected** to `0x2C9e944cB71329fC659Da50A10a79a508Dd49ba5`. The previous value (`0xDBc6DAe3…`) was replaced in the perps-core migration. It is still deployed and answers reads, so the failure was silent: every InstantLayer EIP-712 domain bound to the wrong `verifyingContract` and signatures were rejected downstream rather than locally. Anyone pinning the old address must update.
- **Arbitrum now ships a built-in `gasless` block** (staging GaslessQ: `gaslessq-staging.symmio.foundation`, instance `arbitrum-42161-vibe-stage`, GaslessLayer `0x386EF97D913acf02B3C9452da4Cd4aaEc82eFBca`). Two behavior changes follow: `supportsGaslessService(config, { chainId: 42161 })` now returns `true` without an override, and a `gasless` override on Arbitrum is now a **partial merge onto that base** — an override that previously threw `GASLESS_OVERRIDE_INCOMPLETE` now silently inherits the missing fields. State the whole block when targeting a different deployment, and change `addresses.instantLayerAddress` with it.
- **`solvers.enigma.tpsl` replaced.** It was a verbatim copy of HyperEVM's production block, so Arbitrum conditional orders were signed against HyperEVM's COH wallet. Now Arbitrum's own handler (`tpsl-stage.enigma.bz`, app `ARB_COH_Low-Cap_Stage`, COH wallet `0x5Cf3fC3722e1780220Ca94C04a6dc7Dfd7615661`).
- **`solvers.enigma.notifications.searchUrl` corrected** to the staging host root `https://notification-stage.rasa.capital`. The previous value carried a `/notification` path segment that the client appends to (`/api/v1/search`) and named the production host.
- **`priceService` repointed** to the staging Enigma service (`lowcap-price-staging.enigma.bz`). Against the production host a large share of the staging solver's markets have no mark price at all.

`listing` and `inventory` still carry inherited HyperEVM URLs that are unconfirmed for Arbitrum.
