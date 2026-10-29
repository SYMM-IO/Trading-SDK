---
"@symmio/trading-core": minor
---

**`encodeSubAccountHookMetadata`.** Builds the `metadata` blob a new subaccount hands its affiliate's `onAccountCreation` hook: `abi.encode((string rflCode, uint256 referrerTokenId, address partyBToBind))`, the format the chains' default affiliate hook decodes. A missing PartyB encodes as the zero address, so a referral code or referrer is never dropped; only an all-empty input returns `0x`. Pass it to `createSubAccounts` or `settleGaslessDepositNewAccount`; an affiliate with its own hook needs its own encoding.
