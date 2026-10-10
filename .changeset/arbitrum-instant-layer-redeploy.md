---
"@symmio/trading-core": minor
---

**Arbitrum InstantLayer repointed to its redeployed production contract.** The built-in Arbitrum (42161) config now carries `instantLayerAddress: 0x54c27E4bf1125391aA76e1D6497B069d91e179f6`, replacing `0xCB8F789d6f7e59B3D266490e1Aa8e35cFb755132`.

Every InstantLayer read and write follows the registry value, so delegation state is read from the new contract: a wallet that granted a delegation on the old InstantLayer reads back as un-delegated (`getIsDelegationActive` / `useIsDelegationActive` return `false`, `getActiveDelegations` omits it) and must grant again before instant trading. EIP-712 signatures are bound to the new `verifyingContract`, and `getInstantLayerNonce` counts from the new deployment.

Integrators running gasless execution on Arbitrum must confirm their configured GaslessLayer verifies against the same address — `assertGaslessGatewayCoherence` throws `GASLESS_CONFIG_INCOHERENT` on a write when the gateway's `instantLayer()` getter disagrees. Anyone pinned to the previous deployment can keep it with a `createConfig` override on `symmioConfig[42161].addresses.instantLayerAddress`.
