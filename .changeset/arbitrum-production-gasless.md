---
"@symmio/trading-core": minor
---

**Arbitrum ships the production GaslessQ deployment.** The built-in Arbitrum chain config now carries a `gasless` block: gateway origin `https://gaslessq.symmio.foundation`, the production protocol instance, GaslessLayer `0x8347953D80037b8d82827246f37EC7442AD188B4`, and `statusStream: { enabled: true }`. The production GaslessLayer now runs the multi-wallet interface this release targets, so it is no longer unsupported.

- **Gasless is available on Arbitrum without an override.** `supportsGaslessService(config, { chainId: 42161 })` and `useSupportsGaslessService` now return `true`, so gasless reads and UI gates switch on by default.
- **Write routing is unchanged.** The block declares no `execution`, so relayable writes still go through the connected wallet until a call passes `gasless` or the config sets `execution.mode: "gasless"`.
- **An Arbitrum `gasless` override now merges onto this block** field by field. An override that used to throw `GASLESS_OVERRIDE_INCOMPLETE` now inherits the production values instead. To target another deployment (staging shares chain id 42161), state `url`, `protocolInstance` and `gaslessLayerAddress` together, with the matching `addresses.instantLayerAddress`; a relayed write rejects a mismatched pair with `GASLESS_CONFIG_INCOHERENT` before any signature prompt.
- **Status follows the stream, with HTTP polling as the fallback.** While the production gateway does not yet accept the status WebSocket, a status wait stops dialing after a few failed handshakes and polls over HTTP; streaming starts with no SDK change once it does.
