/**
 * v0.8.5 fragments for the withdraw-request read views.
 *
 * The `WithdrawRequest` output struct **grew** in perps-core v0.8.6 (a trailing
 * `advancedAmount` field), so a v0.8.5 chain's response does not decode against
 * the shipped v0.8.6 ABI. The withdraw read actions pick the fragment matching
 * the chain's `contractsVersion` and return the v0.8.5 decode as-is — the
 * version-grown `advancedAmount` field is optional on `WithdrawRequest` and
 * stays `undefined` on chains whose contracts predate withdraw advances.
 *
 * Pinned from the `version_0.8.5` tag of `SYMM-IO/perps-core`
 * ({@link https://github.com/SYMM-IO/perps-core/blob/version_0.8.5/abis/symmio.json}).
 *
 * @internal
 */
export const getWithdrawRequestsAbiV085 = [
  {
    inputs: [
      {
        internalType: "address",
        name: "user",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "requestId",
        type: "uint256",
      },
    ],
    name: "getWithdrawRequests",
    outputs: [
      {
        components: [
          {
            internalType: "uint256",
            name: "id",
            type: "uint256",
          },
          {
            internalType: "address",
            name: "user",
            type: "address",
          },
          {
            components: [
              {
                internalType: "uint256",
                name: "id",
                type: "uint256",
              },
              {
                internalType: "uint256",
                name: "amount",
                type: "uint256",
              },
              {
                internalType: "int256",
                name: "chainId",
                type: "int256",
              },
              {
                internalType: "bytes",
                name: "receiver",
                type: "bytes",
              },
              {
                internalType: "address",
                name: "virtualProvider",
                type: "address",
              },
              {
                internalType: "address",
                name: "expressProvider",
                type: "address",
              },
            ],
            internalType: "struct WithdrawReceiverPart[]",
            name: "parts",
            type: "tuple[]",
          },
          {
            internalType: "uint256",
            name: "timestamp",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "cooldownEndTime",
            type: "uint256",
          },
          {
            internalType: "enum WithdrawStatus",
            name: "status",
            type: "uint8",
          },
          {
            internalType: "bool",
            name: "speedUp",
            type: "bool",
          },
          {
            internalType: "bool",
            name: "isCooldownModified",
            type: "bool",
          },
          {
            internalType: "address",
            name: "provider",
            type: "address",
          },
          {
            internalType: "bool",
            name: "isPureVirtual",
            type: "bool",
          },
          {
            internalType: "bytes",
            name: "providerData",
            type: "bytes",
          },
          {
            internalType: "uint256",
            name: "totalAmount",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "totalVirtualAmount",
            type: "uint256",
          },
        ],
        internalType: "struct WithdrawRequest",
        name: "",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
] as const;

export const getPendingWithdrawRequestsAbiV085 = [
  {
    inputs: [
      {
        internalType: "address",
        name: "user",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "start",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "size",
        type: "uint256",
      },
    ],
    name: "getPendingWithdrawRequests",
    outputs: [
      {
        components: [
          {
            internalType: "uint256",
            name: "id",
            type: "uint256",
          },
          {
            internalType: "address",
            name: "user",
            type: "address",
          },
          {
            components: [
              {
                internalType: "uint256",
                name: "id",
                type: "uint256",
              },
              {
                internalType: "uint256",
                name: "amount",
                type: "uint256",
              },
              {
                internalType: "int256",
                name: "chainId",
                type: "int256",
              },
              {
                internalType: "bytes",
                name: "receiver",
                type: "bytes",
              },
              {
                internalType: "address",
                name: "virtualProvider",
                type: "address",
              },
              {
                internalType: "address",
                name: "expressProvider",
                type: "address",
              },
            ],
            internalType: "struct WithdrawReceiverPart[]",
            name: "parts",
            type: "tuple[]",
          },
          {
            internalType: "uint256",
            name: "timestamp",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "cooldownEndTime",
            type: "uint256",
          },
          {
            internalType: "enum WithdrawStatus",
            name: "status",
            type: "uint8",
          },
          {
            internalType: "bool",
            name: "speedUp",
            type: "bool",
          },
          {
            internalType: "bool",
            name: "isCooldownModified",
            type: "bool",
          },
          {
            internalType: "address",
            name: "provider",
            type: "address",
          },
          {
            internalType: "bool",
            name: "isPureVirtual",
            type: "bool",
          },
          {
            internalType: "bytes",
            name: "providerData",
            type: "bytes",
          },
          {
            internalType: "uint256",
            name: "totalAmount",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "totalVirtualAmount",
            type: "uint256",
          },
        ],
        internalType: "struct WithdrawRequest[]",
        name: "",
        type: "tuple[]",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
] as const;
