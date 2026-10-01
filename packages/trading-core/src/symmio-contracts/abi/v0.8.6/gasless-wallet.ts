/**
 * Complete ABI for the GasLessQ **GaslessWallet** — the per-`(owner, walletId)`
 * `CREATE2` wallet the GaslessLayer deploys lazily and executes calls from.
 *
 * @remarks
 * Complete, unabridged copy of the source artifact — every constructor, error,
 * function, and the `receive` entry. It holds no gateway settlement events;
 * decode those with `gaslessLayerAbi`.
 *
 * Pinned to perps-core commit `b63ee55e` (fetched 2026-09-17), the same commit
 * as `gaslessLayerAbi`, so the two stay one generation.
 *
 * @see Source of truth — the SYMMIO `perps-core` repo, pinned to the verified
 * commit: {@link https://github.com/SYMM-IO/perps-core/blob/b63ee55e4cfbbc6a9757d23212102d5572e5d829/abis/gaslessLayerWallet.json}.
 */
export const gaslessWalletAbi = [
  {
    inputs: [],
    stateMutability: "nonpayable",
    type: "constructor",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "caller",
        type: "address",
      },
    ],
    name: "CallerNotGateway",
    type: "error",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "recipient",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "amount",
        type: "uint256",
      },
    ],
    name: "NativeTransferFailed",
    type: "error",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "token",
        type: "address",
      },
    ],
    name: "SafeERC20FailedOperation",
    type: "error",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "index",
        type: "uint256",
      },
      {
        internalType: "bytes",
        name: "reason",
        type: "bytes",
      },
    ],
    name: "WalletCallFailed",
    type: "error",
  },
  {
    inputs: [
      {
        components: [
          {
            internalType: "address",
            name: "target",
            type: "address",
          },
          {
            internalType: "uint256",
            name: "value",
            type: "uint256",
          },
          {
            internalType: "bytes",
            name: "data",
            type: "bytes",
          },
        ],
        internalType: "struct GaslessWallet.Call[]",
        name: "calls",
        type: "tuple[]",
      },
    ],
    name: "execute",
    outputs: [
      {
        internalType: "bytes[]",
        name: "results",
        type: "bytes[]",
      },
    ],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [],
    name: "gateway",
    outputs: [
      {
        internalType: "address",
        name: "",
        type: "address",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "token",
        type: "address",
      },
      {
        internalType: "address",
        name: "recipient",
        type: "address",
      },
    ],
    name: "sweepTokenBalance",
    outputs: [
      {
        internalType: "uint256",
        name: "amount",
        type: "uint256",
      },
    ],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "token",
        type: "address",
      },
      {
        internalType: "address",
        name: "recipient",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "amount",
        type: "uint256",
      },
    ],
    name: "transfer",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    stateMutability: "payable",
    type: "receive",
  },
] as const;
