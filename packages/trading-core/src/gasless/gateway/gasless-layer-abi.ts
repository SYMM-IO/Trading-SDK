/**
 * Hand-written ABI fragments for the **GaslessLayer** contract (the GaslessQ
 * gateway proxy) and the per-owner **GaslessWallet**.
 *
 * TODO(gasless-abi): no canonical ABI artifact exists for these contracts —
 * they are not part of perps-core and the vendor ships no JSON. Every entry
 * below is production-verified: the view surface was confirmed by direct
 * `eth_call` against the deployed Arbitrum gateways on 2026-09-04, and the
 * tuple shapes mirror the on-chain structs the InstantLayer signs. Replace
 * with the vendor artifact when one ships.
 */

/**
 * GaslessLayer read surface. `instantLayer()` names the InstantLayer this
 * gateway verifies relayed operations against — the SDK asserts config
 * coherence with it before relaying.
 */
export const gaslessLayerAbi = [
  {
    inputs: [],
    name: "collateralToken",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "depositFee",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "minimumDeposit",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "owner", type: "address" }],
    name: "getGaslessWalletAddress",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "account", type: "address" }],
    name: "walletOperationNonces",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "instantLayer",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "accountLayer",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "account", type: "address" },
      {
        components: [
          { internalType: "address", name: "signer", type: "address" },
          { internalType: "address", name: "target", type: "address" },
          { internalType: "bytes", name: "callData", type: "bytes" },
          {
            components: [
              { internalType: "address", name: "addr", type: "address" },
              { internalType: "bool", name: "isPartyB", type: "bool" },
            ],
            internalType: "struct InstantLayer.Account",
            name: "signerAccount",
            type: "tuple",
          },
          {
            components: [
              { internalType: "uint256", name: "offset", type: "uint256" },
              { internalType: "uint256", name: "length", type: "uint256" },
              { internalType: "address", name: "authorizedFlexFiller", type: "address" },
            ],
            internalType: "struct InstantLayer.FlexField[]",
            name: "flexFields",
            type: "tuple[]",
          },
          { internalType: "uint256", name: "maxUses", type: "uint256" },
          {
            components: [
              { internalType: "uint256", name: "nonce", type: "uint256" },
              { internalType: "uint256", name: "deadline", type: "uint256" },
              { internalType: "bytes32", name: "salt", type: "bytes32" },
            ],
            internalType: "struct InstantLayer.ReplayAttackHeader",
            name: "replayAttackHeader",
            type: "tuple",
          },
        ],
        internalType: "struct InstantLayer.SignedOperation[]",
        name: "signedOps",
        type: "tuple[]",
      },
    ],
    name: "getAccountOperationalFee",
    outputs: [
      { internalType: "uint256", name: "amountDue", type: "uint256" },
      { internalType: "uint256", name: "freeOpsApplied", type: "uint256" },
      { internalType: "bool", name: "wouldBlockOnQuota", type: "bool" },
    ],
    stateMutability: "view",
    type: "function",
  },
] as const;

/** GaslessWallet: the per-owner CREATE2 wallet's `execute(Call[])`. */
export const gaslessWalletAbi = [
  {
    inputs: [
      {
        components: [
          { internalType: "address", name: "target", type: "address" },
          { internalType: "uint256", name: "value", type: "uint256" },
          { internalType: "bytes", name: "data", type: "bytes" },
        ],
        internalType: "struct GaslessQWallet.Call[]",
        name: "calls",
        type: "tuple[]",
      },
    ],
    name: "execute",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

/**
 * 4-byte selector of `GaslessQWallet.execute((address,uint256,bytes)[])` — the
 * only selector a relayed wallet operation's `callData` may start with.
 */
export const GASLESS_WALLET_EXECUTE_SELECTOR = "0x3f707e6b" as const;

/**
 * Sentinel selector (`bytes4(keccak256("GASLESSQ_WALLET_EXECUTION"))`) a
 * session key must hold an InstantLayer delegation for before it may sign
 * **delegated** GaslessWallet executions — alongside every inner call selector.
 * Owner-signed wallet operations do not use it.
 */
export const GASLESS_WALLET_EXECUTION_SENTINEL_SELECTOR = "0x1dccecab" as const;
