---
"@symmio/trading-core": minor
---

**`encodeSubAccountHookMetadata`.** Builds the `metadata` blob a new subaccount hands its affiliate's `onAccountCreation` hook: `abi.encode((string rflCode, uint256 referrerTokenId, address partyBToBind))`, or `0x` when there is no PartyB to bind. Pass it to `createSubAccounts` or `settleGaslessDepositNewAccount`. The JSDoc and docs that told callers to pass `0x` are corrected: a hooked affiliate rejects the empty blob with `HookFailed`.
