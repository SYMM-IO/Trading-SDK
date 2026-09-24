---
"@symmio/trading-core": minor
"@symmio/trading-react": minor
---

Select a GaslessWallet by id in every wallet-scoped read, and read the wallet creation fee.

On the multi-wallet GaslessLayer a gasless wallet is identified by `(owner, walletId)`. The SDK's reads hard-coded wallet `0`, and nothing read the one-time fee the GaslessLayer charges when it deploys a wallet. The gasless slice has not been released yet, so the breaking changes below ship as a minor bump. Each one is listed.

**`@symmio/trading-core`**

- `getGaslessWalletAddress`, `getGaslessWalletNonce` and `getGaslessDepositPolicy` take an optional `walletId: bigint`, defaulting to `0n`, the original wallet. A wallet id outside `0n` through `2^256 - 1`, or a JavaScript `number`, throws `GASLESS_WALLET_ID_INVALID` before any RPC call. `getGaslessWalletNonce` reads `walletOperationNonces(owner, walletId, signerAccount)`: wallet `0` keeps its original counter, and each positive id counts separately. The `GASLESS_WALLET_UNAVAILABLE` message now names the wallet id.
- New `getGaslessWalletCreationFee(config, { owner, walletId? })`, plus `getGaslessWalletCreationFeeQueryKey` / `getGaslessWalletCreationFeeQueryOptions` and their `GetGaslessWalletCreationFee*` types. It reads `getWalletCreationFee(owner, walletId)` and returns the fee in collateral token units. The value is the configured fee while the wallet has no code, for every wallet id including `0`, and `0n` once the wallet is deployed. A deposit settlement deducts it from the swept balance; a relayed wallet operation charges it to the payer's SYMMIO balance.
- `GetGaslessDepositPolicyReturnType` gains `walletId`, `walletCreationFee` and `collateralDecimals` (the collateral token's ERC-20 `decimals()`). The policy therefore makes two more reads: the creation fee, and `decimals()` on the collateral token.
- **Breaking: `settlementMinimum` includes the creation fee.** It is now `max(minimumDeposit, depositFee + walletCreationFee + 1n)`, because the GaslessLayer rejects a settlement unless the swept balance exceeds the deposit fee plus the creation fee. With no creation fee the value is unchanged.
- **Breaking: the query keys of the wallet address, wallet nonce and deposit policy reads now always carry `walletId`.** The key factories key an omitted id as `0n`, so `{ owner }` and `{ owner, walletId: 0n }` share one cache entry. A key assembled by hand, without the factory, must now include `walletId` to match a stored one.
- The query factories forward every parameter to their action instead of a hand-listed subset, so `walletId` reaches the read.

**`@symmio/trading-react`**

- New `useGaslessWalletCreationFee` and `useGaslessWalletNonce`, exported from the package root and `@symmio/trading-react/gasless`. `useGaslessWalletAddress` and `useGaslessDepositPolicy` accept `walletId` through the core options.
- **`useGaslessWalletExecute` invalidates the right nonce.** It used to invalidate the wallet-operation nonce keyed by the owner, so an operation signed for a sub-account left that account's nonce query stale. It now matches the signer account (`signerAccount`, or the owner when omitted).
- `useGaslessWalletExecute`, `useSettleGaslessDepositNewAccount` and `useSettleGaslessDepositExistingAccount` also invalidate the owner's deposit policies and wallet creation fees, because the first operation or settlement on a wallet deploys it and zeroes its creation fee. The invalidation covers every wallet id of the owner until the write itself names one (see the multi-wallet writes changeset), after which it narrows to that id.
- **Behavior change: `predicateMatch` compares only the fields its partial sets.** A default a key factory fills in for an omitted field is no longer compared, so `predicateMatch(getGaslessDepositPolicyQueryKey, { owner })` matches every wallet id of the owner instead of only wallet `0`. Key factories without such defaults match exactly as before.
