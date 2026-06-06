/**
 * ABI fragment for the SYMMIO `InstantLayer` contract at version **0.8.5**.
 *
 * @remarks
 * This fragment contains the delegation methods currently wrapped by the SDK.
 *
 * @see Source of truth — the SYMMIO `perps-core` repo, pinned to the matching
 * version tag: {@link https://github.com/SYMM-IO/perps-core/tree/version_0.8.5/docs/v0.8.5}.
 */
export const instantLayerAbi = [
  {
    inputs: [
      {
        internalType: "address",
        name: "",
        type: "address",
      },
      {
        internalType: "address",
        name: "",
        type: "address",
      },
      {
        internalType: "bytes4",
        name: "",
        type: "bytes4",
      },
    ],
    name: "delegations",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "delegator",
        type: "address",
      },
      {
        internalType: "address",
        name: "delegate",
        type: "address",
      },
      {
        internalType: "bytes4",
        name: "selector",
        type: "bytes4",
      },
    ],
    name: "isDelegationActive",
    outputs: [
      {
        internalType: "bool",
        name: "",
        type: "bool",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        components: [
          {
            components: [
              {
                internalType: "address",
                name: "addr",
                type: "address",
              },
              {
                internalType: "bool",
                name: "isPartyB",
                type: "bool",
              },
            ],
            internalType: "struct InstantLayer.Account",
            name: "account",
            type: "tuple",
          },
          {
            internalType: "address",
            name: "delegatedSigner",
            type: "address",
          },
          {
            internalType: "bytes4[]",
            name: "selectors",
            type: "bytes4[]",
          },
          {
            internalType: "uint256",
            name: "expiryTimestamp",
            type: "uint256",
          },
        ],
        internalType: "struct InstantLayer.DelegationInfo",
        name: "info",
        type: "tuple",
      },
    ],
    name: "grantDelegation",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;
