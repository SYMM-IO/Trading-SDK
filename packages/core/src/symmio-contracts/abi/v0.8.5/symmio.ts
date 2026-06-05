/**
 * Complete ABI for the SYMMIO core (diamond) contract at version **0.8.5**.
 *
 * @remarks
 * This is the **full** ABI — every error, event, and function as deployed on
 * chain. It is intentionally not trimmed to just the fragments wrapped by the
 * current SDK surface. Keeping the complete ABI lets viem:
 *
 * - decode unrelated errors and events that a consumer's client may encounter
 *   (e.g. `ContractFunctionExecutionError` formatting a revert reason),
 * - support new wrapper helpers without having to amend this file each time.
 *
 * @see Source of truth — the SYMMIO `perps-core` repo, pinned to the matching
 * version tag: {@link https://github.com/SYMM-IO/perps-core/blob/version_0.8.5/abis/symmio.json}.
 * for a new version, add a sibling folder (e.g. `v0.9.0/`) and copy from the
 * matching `version_0.9.0` tag rather than editing this file in place.
 */
export const symmioAbi = [
  {
    inputs: [
      {
        internalType: "address",
        name: "partyA",
        type: "address",
      },
      {
        internalType: "address",
        name: "partyB",
        type: "address",
      },
    ],
    name: "getPartyAActiveSymbolsCountPerPartyB",
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
        name: "partyA",
        type: "address",
      },
      {
        internalType: "address",
        name: "partyB",
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
    name: "getPartyAActiveSymbolsPerPartyB",
    outputs: [
      {
        internalType: "uint256[]",
        name: "",
        type: "uint256[]",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "partyA",
        type: "address",
      },
      {
        internalType: "address",
        name: "partyB",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "symbolId",
        type: "uint256",
      },
      {
        internalType: "enum PositionType",
        name: "positionType",
        type: "uint8",
      },
    ],
    name: "getPartyAAggregateFundingDebt",
    outputs: [
      {
        internalType: "int256",
        name: "fundingDebt",
        type: "int256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "partyA",
        type: "address",
      },
      {
        internalType: "address",
        name: "partyB",
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
    name: "getPartyAAggregateFundingDebtByActiveSymbols",
    outputs: [
      {
        components: [
          {
            internalType: "uint256",
            name: "symbolId",
            type: "uint256",
          },
          {
            internalType: "enum PositionType",
            name: "positionType",
            type: "uint8",
          },
          {
            internalType: "int256",
            name: "fundingDebt",
            type: "int256",
          },
        ],
        internalType: "struct IViewFacetAggregate.AggregatedFundingDebtBySymbol[]",
        name: "",
        type: "tuple[]",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "partyA",
        type: "address",
      },
      {
        internalType: "address",
        name: "partyB",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "symbolId",
        type: "uint256",
      },
      {
        internalType: "enum PositionType",
        name: "positionType",
        type: "uint8",
      },
    ],
    name: "getPartyAAggregatedFundingPerPartyB",
    outputs: [
      {
        internalType: "int256",
        name: "weightedPaidFunding",
        type: "int256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "partyA",
        type: "address",
      },
      {
        internalType: "address",
        name: "partyB",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "symbolId",
        type: "uint256",
      },
    ],
    name: "getPartyAAggregatedPositionBySymbolPerPartyB",
    outputs: [
      {
        components: [
          {
            internalType: "enum PositionType",
            name: "positionType",
            type: "uint8",
          },
          {
            internalType: "uint256",
            name: "aggregatedOpenAmount",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "avgOpenPrice",
            type: "uint256",
          },
        ],
        internalType: "struct IViewFacetAggregate.AggregatedPositionAmount",
        name: "longPosition",
        type: "tuple",
      },
      {
        components: [
          {
            internalType: "enum PositionType",
            name: "positionType",
            type: "uint8",
          },
          {
            internalType: "uint256",
            name: "aggregatedOpenAmount",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "avgOpenPrice",
            type: "uint256",
          },
        ],
        internalType: "struct IViewFacetAggregate.AggregatedPositionAmount",
        name: "shortPosition",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "partyA",
        type: "address",
      },
      {
        internalType: "address",
        name: "partyB",
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
    name: "getPartyAAggregatedPositionsByActiveSymbolsPerPartyB",
    outputs: [
      {
        components: [
          {
            internalType: "uint256",
            name: "symbolId",
            type: "uint256",
          },
          {
            internalType: "enum PositionType",
            name: "positionType",
            type: "uint8",
          },
          {
            internalType: "uint256",
            name: "aggregatedOpenAmount",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "avgOpenPrice",
            type: "uint256",
          },
        ],
        internalType: "struct IViewFacetAggregate.AggregatedPositionBySymbol[]",
        name: "",
        type: "tuple[]",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "partyA",
        type: "address",
      },
      {
        internalType: "address",
        name: "partyB",
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
    name: "getPartyAUpnlData",
    outputs: [
      {
        components: [
          {
            internalType: "uint256",
            name: "symbolId",
            type: "uint256",
          },
          {
            internalType: "enum PositionType",
            name: "positionType",
            type: "uint8",
          },
          {
            internalType: "uint256",
            name: "aggregatedAmount",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "avgOpenPrice",
            type: "uint256",
          },
          {
            internalType: "int256",
            name: "fundingDebt",
            type: "int256",
          },
        ],
        internalType: "struct IViewFacetAggregate.UpnlData[]",
        name: "",
        type: "tuple[]",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "partyB",
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
    name: "getPartyBActiveSymbols",
    outputs: [
      {
        internalType: "uint256[]",
        name: "",
        type: "uint256[]",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "partyB",
        type: "address",
      },
    ],
    name: "getPartyBActiveSymbolsCount",
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
        name: "partyB",
        type: "address",
      },
      {
        internalType: "address",
        name: "partyA",
        type: "address",
      },
    ],
    name: "getPartyBActiveSymbolsCountPerPartyA",
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
        name: "partyB",
        type: "address",
      },
      {
        internalType: "address",
        name: "partyA",
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
    name: "getPartyBActiveSymbolsPerPartyA",
    outputs: [
      {
        internalType: "uint256[]",
        name: "",
        type: "uint256[]",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "partyB",
        type: "address",
      },
      {
        internalType: "address",
        name: "partyA",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "symbolId",
        type: "uint256",
      },
      {
        internalType: "enum PositionType",
        name: "positionType",
        type: "uint8",
      },
    ],
    name: "getPartyBAggregateFundingDebt",
    outputs: [
      {
        internalType: "int256",
        name: "fundingDebt",
        type: "int256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "partyB",
        type: "address",
      },
      {
        internalType: "address",
        name: "partyA",
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
    name: "getPartyBAggregateFundingDebtByActiveSymbols",
    outputs: [
      {
        components: [
          {
            internalType: "uint256",
            name: "symbolId",
            type: "uint256",
          },
          {
            internalType: "enum PositionType",
            name: "positionType",
            type: "uint8",
          },
          {
            internalType: "int256",
            name: "fundingDebt",
            type: "int256",
          },
        ],
        internalType: "struct IViewFacetAggregate.AggregatedFundingDebtBySymbol[]",
        name: "",
        type: "tuple[]",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "partyB",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "symbolId",
        type: "uint256",
      },
      {
        internalType: "enum PositionType",
        name: "positionType",
        type: "uint8",
      },
    ],
    name: "getPartyBAggregatedFunding",
    outputs: [
      {
        internalType: "int256",
        name: "weightedPaidFunding",
        type: "int256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "partyB",
        type: "address",
      },
      {
        internalType: "address",
        name: "partyA",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "symbolId",
        type: "uint256",
      },
      {
        internalType: "enum PositionType",
        name: "positionType",
        type: "uint8",
      },
    ],
    name: "getPartyBAggregatedFundingPerPartyA",
    outputs: [
      {
        internalType: "int256",
        name: "weightedPaidFunding",
        type: "int256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "partyB",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "symbolId",
        type: "uint256",
      },
    ],
    name: "getPartyBAggregatedPositionBySymbol",
    outputs: [
      {
        components: [
          {
            internalType: "enum PositionType",
            name: "positionType",
            type: "uint8",
          },
          {
            internalType: "uint256",
            name: "aggregatedOpenAmount",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "avgOpenPrice",
            type: "uint256",
          },
        ],
        internalType: "struct IViewFacetAggregate.AggregatedPositionAmount",
        name: "longPosition",
        type: "tuple",
      },
      {
        components: [
          {
            internalType: "enum PositionType",
            name: "positionType",
            type: "uint8",
          },
          {
            internalType: "uint256",
            name: "aggregatedOpenAmount",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "avgOpenPrice",
            type: "uint256",
          },
        ],
        internalType: "struct IViewFacetAggregate.AggregatedPositionAmount",
        name: "shortPosition",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "partyB",
        type: "address",
      },
      {
        internalType: "address",
        name: "partyA",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "symbolId",
        type: "uint256",
      },
    ],
    name: "getPartyBAggregatedPositionBySymbolPerPartyA",
    outputs: [
      {
        components: [
          {
            internalType: "enum PositionType",
            name: "positionType",
            type: "uint8",
          },
          {
            internalType: "uint256",
            name: "aggregatedOpenAmount",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "avgOpenPrice",
            type: "uint256",
          },
        ],
        internalType: "struct IViewFacetAggregate.AggregatedPositionAmount",
        name: "longPosition",
        type: "tuple",
      },
      {
        components: [
          {
            internalType: "enum PositionType",
            name: "positionType",
            type: "uint8",
          },
          {
            internalType: "uint256",
            name: "aggregatedOpenAmount",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "avgOpenPrice",
            type: "uint256",
          },
        ],
        internalType: "struct IViewFacetAggregate.AggregatedPositionAmount",
        name: "shortPosition",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "partyB",
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
    name: "getPartyBAggregatedPositionsByActiveSymbols",
    outputs: [
      {
        components: [
          {
            internalType: "uint256",
            name: "symbolId",
            type: "uint256",
          },
          {
            internalType: "enum PositionType",
            name: "positionType",
            type: "uint8",
          },
          {
            internalType: "uint256",
            name: "aggregatedOpenAmount",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "avgOpenPrice",
            type: "uint256",
          },
        ],
        internalType: "struct IViewFacetAggregate.AggregatedPositionBySymbol[]",
        name: "",
        type: "tuple[]",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "partyB",
        type: "address",
      },
      {
        internalType: "address",
        name: "partyA",
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
    name: "getPartyBAggregatedPositionsByActiveSymbolsPerPartyA",
    outputs: [
      {
        components: [
          {
            internalType: "uint256",
            name: "symbolId",
            type: "uint256",
          },
          {
            internalType: "enum PositionType",
            name: "positionType",
            type: "uint8",
          },
          {
            internalType: "uint256",
            name: "aggregatedOpenAmount",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "avgOpenPrice",
            type: "uint256",
          },
        ],
        internalType: "struct IViewFacetAggregate.AggregatedPositionBySymbol[]",
        name: "",
        type: "tuple[]",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "partyB",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "symbolId",
        type: "uint256",
      },
      {
        internalType: "enum PositionType",
        name: "positionType",
        type: "uint8",
      },
    ],
    name: "getPartyBGlobalAggregateFundingDebt",
    outputs: [
      {
        internalType: "int256",
        name: "fundingDebt",
        type: "int256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "partyB",
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
    name: "getPartyBGlobalAggregateFundingDebtByActiveSymbols",
    outputs: [
      {
        components: [
          {
            internalType: "uint256",
            name: "symbolId",
            type: "uint256",
          },
          {
            internalType: "enum PositionType",
            name: "positionType",
            type: "uint8",
          },
          {
            internalType: "int256",
            name: "fundingDebt",
            type: "int256",
          },
        ],
        internalType: "struct IViewFacetAggregate.AggregatedFundingDebtBySymbol[]",
        name: "",
        type: "tuple[]",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "partyB",
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
    name: "getPartyBGlobalUpnlData",
    outputs: [
      {
        components: [
          {
            internalType: "uint256",
            name: "symbolId",
            type: "uint256",
          },
          {
            internalType: "enum PositionType",
            name: "positionType",
            type: "uint8",
          },
          {
            internalType: "uint256",
            name: "aggregatedAmount",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "avgOpenPrice",
            type: "uint256",
          },
          {
            internalType: "int256",
            name: "fundingDebt",
            type: "int256",
          },
        ],
        internalType: "struct IViewFacetAggregate.UpnlData[]",
        name: "",
        type: "tuple[]",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "partyB",
        type: "address",
      },
      {
        internalType: "address",
        name: "partyA",
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
    name: "getPartyBUpnlData",
    outputs: [
      {
        components: [
          {
            internalType: "uint256",
            name: "symbolId",
            type: "uint256",
          },
          {
            internalType: "enum PositionType",
            name: "positionType",
            type: "uint8",
          },
          {
            internalType: "uint256",
            name: "aggregatedAmount",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "avgOpenPrice",
            type: "uint256",
          },
          {
            internalType: "int256",
            name: "fundingDebt",
            type: "int256",
          },
        ],
        internalType: "struct IViewFacetAggregate.UpnlData[]",
        name: "",
        type: "tuple[]",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "uint256",
        name: "quoteId",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "enum QuoteStatus",
        name: "quoteStatus",
        type: "uint8",
      },
    ],
    name: "AcceptCancelRequest",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "uint256",
        name: "quoteId",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "address",
        name: "partyA",
        type: "address",
      },
      {
        indexed: false,
        internalType: "address",
        name: "partyB",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "filledAmount",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "openedPrice",
        type: "uint256",
      },
    ],
    name: "OpenPosition",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "uint256",
        name: "quoteId",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "address",
        name: "partyA",
        type: "address",
      },
      {
        indexed: false,
        internalType: "address",
        name: "partyB",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "filledAmount",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "openedPrice",
        type: "uint256",
      },
      {
        components: [
          {
            internalType: "uint256",
            name: "cva",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "lf",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "partyAmm",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "partyBmm",
            type: "uint256",
          },
        ],
        indexed: false,
        internalType: "struct LockedValues",
        name: "lockedValues",
        type: "tuple",
      },
    ],
    name: "OpenPosition",
    type: "event",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "hook",
        type: "address",
      },
      {
        internalType: "bytes4",
        name: "selector",
        type: "bytes4",
      },
      {
        internalType: "uint256",
        name: "quoteId",
        type: "uint256",
      },
      {
        internalType: "bytes",
        name: "reason",
        type: "bytes",
      },
    ],
    name: "HookReverted",
    type: "error",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "uint256",
        name: "quoteId",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "enum QuoteStatus",
        name: "quoteStatus",
        type: "uint8",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "closeId",
        type: "uint256",
      },
    ],
    name: "AcceptCancelCloseRequest",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "enum QuoteStatus",
        name: "quoteStatus",
        type: "uint8",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "quoteId",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "closeId",
        type: "uint256",
      },
    ],
    name: "ExpireQuoteClose",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "enum QuoteStatus",
        name: "quoteStatus",
        type: "uint8",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "quoteId",
        type: "uint256",
      },
    ],
    name: "ExpireQuoteOpen",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "uint256",
        name: "quoteId",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "address",
        name: "partyA",
        type: "address",
      },
      {
        indexed: false,
        internalType: "address",
        name: "partyB",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "filledAmount",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "closedPrice",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "enum QuoteStatus",
        name: "quoteStatus",
        type: "uint8",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "closeId",
        type: "uint256",
      },
    ],
    name: "FillCloseRequest",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "uint256",
        name: "quoteId",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "address",
        name: "partyA",
        type: "address",
      },
      {
        indexed: false,
        internalType: "address",
        name: "partyB",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "filledAmount",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "closedPrice",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "enum QuoteStatus",
        name: "quoteStatus",
        type: "uint8",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "closeId",
        type: "uint256",
      },
      {
        components: [
          {
            internalType: "uint256",
            name: "cva",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "lf",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "partyAmm",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "partyBmm",
            type: "uint256",
          },
        ],
        indexed: false,
        internalType: "struct LockedValues",
        name: "lockedValues",
        type: "tuple",
      },
    ],
    name: "FillCloseRequest",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "address",
        name: "liquidator",
        type: "address",
      },
      {
        indexed: false,
        internalType: "address",
        name: "partyB",
        type: "address",
      },
      {
        indexed: false,
        internalType: "address",
        name: "partyA",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "partyBAllocatedBalance",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "int256",
        name: "upnl",
        type: "int256",
      },
    ],
    name: "LiquidatePartyB",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "address",
        name: "partyA",
        type: "address",
      },
      {
        indexed: false,
        internalType: "address",
        name: "partyB",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "quoteId",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "enum QuoteStatus",
        name: "quoteStatus",
        type: "uint8",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "closeId",
        type: "uint256",
      },
    ],
    name: "RequestToCancelCloseRequest",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "address",
        name: "partyA",
        type: "address",
      },
      {
        indexed: false,
        internalType: "address",
        name: "partyB",
        type: "address",
      },
      {
        indexed: false,
        internalType: "enum QuoteStatus",
        name: "quoteStatus",
        type: "uint8",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "quoteId",
        type: "uint256",
      },
    ],
    name: "RequestToCancelQuote",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "address",
        name: "partyA",
        type: "address",
      },
      {
        indexed: false,
        internalType: "address",
        name: "partyB",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "quoteId",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "closePrice",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "quantityToClose",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "enum OrderType",
        name: "orderType",
        type: "uint8",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "deadline",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "enum QuoteStatus",
        name: "quoteStatus",
        type: "uint8",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "closeId",
        type: "uint256",
      },
    ],
    name: "RequestToClosePosition",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "address",
        name: "partyA",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "quoteId",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "address[]",
        name: "partyBsWhiteList",
        type: "address[]",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "symbolId",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "enum PositionType",
        name: "positionType",
        type: "uint8",
      },
      {
        indexed: false,
        internalType: "enum OrderType",
        name: "orderType",
        type: "uint8",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "price",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "marketPrice",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "quantity",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "cva",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "lf",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "partyAmm",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "partyBmm",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "tradingFee",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "deadline",
        type: "uint256",
      },
    ],
    name: "SendQuote",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "address",
        name: "partyA",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "quoteId",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "address[]",
        name: "partyBsWhiteList",
        type: "address[]",
      },
      {
        indexed: false,
        internalType: "address",
        name: "affiliate",
        type: "address",
      },
      {
        indexed: false,
        internalType: "bytes",
        name: "paramsData",
        type: "bytes",
      },
      {
        indexed: false,
        internalType: "bytes",
        name: "data",
        type: "bytes",
      },
    ],
    name: "SendQuote",
    type: "event",
  },
  {
    inputs: [
      {
        internalType: "uint256[]",
        name: "quoteIds",
        type: "uint256[]",
      },
      {
        internalType: "uint256[]",
        name: "filledAmounts",
        type: "uint256[]",
      },
      {
        internalType: "uint256[]",
        name: "closedPrices",
        type: "uint256[]",
      },
      {
        components: [
          {
            internalType: "bytes",
            name: "reqId",
            type: "bytes",
          },
          {
            internalType: "uint256",
            name: "timestamp",
            type: "uint256",
          },
          {
            internalType: "int256",
            name: "upnlPartyA",
            type: "int256",
          },
          {
            internalType: "int256",
            name: "upnlPartyB",
            type: "int256",
          },
          {
            internalType: "uint256[]",
            name: "symbolIds",
            type: "uint256[]",
          },
          {
            internalType: "uint256[]",
            name: "prices",
            type: "uint256[]",
          },
          {
            internalType: "bytes",
            name: "gatewaySignature",
            type: "bytes",
          },
          {
            components: [
              {
                internalType: "uint256",
                name: "signature",
                type: "uint256",
              },
              {
                internalType: "address",
                name: "owner",
                type: "address",
              },
              {
                internalType: "address",
                name: "nonce",
                type: "address",
              },
            ],
            internalType: "struct IMuonSignatureVerifier.SchnorrSign",
            name: "sigs",
            type: "tuple",
          },
        ],
        internalType: "struct PairUpnlAndPricesSig",
        name: "upnlSig",
        type: "tuple",
      },
    ],
    name: "fillCloseRequests",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256[]",
        name: "quoteIds",
        type: "uint256[]",
      },
      {
        internalType: "uint256[]",
        name: "filledAmounts",
        type: "uint256[]",
      },
      {
        internalType: "uint256[]",
        name: "openedPrices",
        type: "uint256[]",
      },
      {
        components: [
          {
            internalType: "bytes",
            name: "reqId",
            type: "bytes",
          },
          {
            internalType: "uint256",
            name: "timestamp",
            type: "uint256",
          },
          {
            internalType: "int256",
            name: "upnlPartyA",
            type: "int256",
          },
          {
            internalType: "int256",
            name: "upnlPartyB",
            type: "int256",
          },
          {
            internalType: "uint256[]",
            name: "symbolIds",
            type: "uint256[]",
          },
          {
            internalType: "uint256[]",
            name: "prices",
            type: "uint256[]",
          },
          {
            internalType: "bytes",
            name: "gatewaySignature",
            type: "bytes",
          },
          {
            components: [
              {
                internalType: "uint256",
                name: "signature",
                type: "uint256",
              },
              {
                internalType: "address",
                name: "owner",
                type: "address",
              },
              {
                internalType: "address",
                name: "nonce",
                type: "address",
              },
            ],
            internalType: "struct IMuonSignatureVerifier.SchnorrSign",
            name: "sigs",
            type: "tuple",
          },
        ],
        internalType: "struct PairUpnlAndPricesSig",
        name: "upnlSig",
        type: "tuple",
      },
    ],
    name: "openPositions",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "uint256",
        name: "quoteId",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "enum QuoteStatus",
        name: "quoteStatus",
        type: "uint8",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "closeId",
        type: "uint256",
      },
    ],
    name: "ForceCancelCloseRequest",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "uint256",
        name: "quoteId",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "enum QuoteStatus",
        name: "quoteStatus",
        type: "uint8",
      },
    ],
    name: "ForceCancelQuote",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "initiator",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "partyB",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "quoteId",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "bytes",
        name: "highLowPriceSigId",
        type: "bytes",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "closePrice",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "timestamp",
        type: "uint256",
      },
    ],
    name: "ForceCloseInitialized",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "uint256",
        name: "quoteId",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "address",
        name: "partyA",
        type: "address",
      },
      {
        indexed: false,
        internalType: "address",
        name: "partyB",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "closedPrice",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "currentPrice",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "int256",
        name: "upnlPartyB",
        type: "int256",
      },
      {
        indexed: false,
        internalType: "int256",
        name: "partyBAvailableAfterClose",
        type: "int256",
      },
    ],
    name: "ForceClosePartyBInsolvent",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "uint256",
        name: "quoteId",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "address",
        name: "partyA",
        type: "address",
      },
      {
        indexed: false,
        internalType: "address",
        name: "partyB",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "filledAmount",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "closedPrice",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "enum QuoteStatus",
        name: "quoteStatus",
        type: "uint8",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "closeId",
        type: "uint256",
      },
    ],
    name: "ForceClosePosition",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "address",
        name: "partyB",
        type: "address",
      },
      {
        indexed: false,
        internalType: "address[]",
        name: "partyAs",
        type: "address[]",
      },
      {
        indexed: false,
        internalType: "uint256[]",
        name: "FetchedAmount",
        type: "uint256[]",
      },
      {
        indexed: false,
        internalType: "uint256[]",
        name: "newPartyBsAllocatedBalances",
        type: "uint256[]",
      },
    ],
    name: "ForceFetchAllocated",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "liquidatedPartyA",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "partyB",
        type: "address",
      },
      {
        indexed: false,
        internalType: "bytes",
        name: "settlementId",
        type: "bytes",
      },
      {
        components: [
          {
            internalType: "uint256",
            name: "quoteId",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "currentPrice",
            type: "uint256",
          },
          {
            internalType: "uint8",
            name: "partyAIndex",
            type: "uint8",
          },
        ],
        indexed: false,
        internalType: "struct UnifiedQuoteSettlementData[]",
        name: "settlementData",
        type: "tuple[]",
      },
      {
        indexed: false,
        internalType: "uint256[]",
        name: "updatedPrices",
        type: "uint256[]",
      },
      {
        indexed: false,
        internalType: "address[]",
        name: "partyAs",
        type: "address[]",
      },
      {
        indexed: false,
        internalType: "uint256[]",
        name: "newPartyAsAllocatedBalances",
        type: "uint256[]",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "newPartyBAllocatedBalance",
        type: "uint256",
      },
    ],
    name: "SettlePartyBUpnlForLiquidation",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        components: [
          {
            internalType: "uint256",
            name: "quoteId",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "currentPrice",
            type: "uint256",
          },
          {
            internalType: "uint8",
            name: "partyBUpnlIndex",
            type: "uint8",
          },
        ],
        indexed: false,
        internalType: "struct QuoteSettlementData[]",
        name: "settlementData",
        type: "tuple[]",
      },
      {
        indexed: false,
        internalType: "uint256[]",
        name: "updatedPrices",
        type: "uint256[]",
      },
      {
        indexed: false,
        internalType: "address",
        name: "partyA",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "newPartyAAllocatedBalance",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256[]",
        name: "newPartyBsAllocatedBalances",
        type: "uint256[]",
      },
    ],
    name: "SettleUpnl",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "bytes",
        name: "settlementId",
        type: "bytes",
      },
      {
        components: [
          {
            internalType: "uint256",
            name: "quoteId",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "currentPrice",
            type: "uint256",
          },
          {
            internalType: "uint8",
            name: "partyAIndex",
            type: "uint8",
          },
        ],
        indexed: false,
        internalType: "struct UnifiedQuoteSettlementData[]",
        name: "settlementData",
        type: "tuple[]",
      },
      {
        indexed: false,
        internalType: "uint256[]",
        name: "updatedPrices",
        type: "uint256[]",
      },
      {
        indexed: false,
        internalType: "address",
        name: "partyB",
        type: "address",
      },
      {
        indexed: false,
        internalType: "address[]",
        name: "partyAs",
        type: "address[]",
      },
      {
        indexed: false,
        internalType: "uint256[]",
        name: "newPartyAsAllocatedBalances",
        type: "uint256[]",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "newPartyBAllocatedBalance",
        type: "uint256",
      },
    ],
    name: "SettleUpnlUnified",
    type: "event",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "quoteId",
        type: "uint256",
      },
      {
        components: [
          {
            internalType: "bytes",
            name: "reqId",
            type: "bytes",
          },
          {
            internalType: "uint256",
            name: "timestamp",
            type: "uint256",
          },
          {
            internalType: "int256",
            name: "upnlPartyA",
            type: "int256",
          },
          {
            internalType: "int256",
            name: "upnlPartyB",
            type: "int256",
          },
          {
            internalType: "uint256",
            name: "price",
            type: "uint256",
          },
          {
            internalType: "bytes",
            name: "gatewaySignature",
            type: "bytes",
          },
          {
            components: [
              {
                internalType: "uint256",
                name: "signature",
                type: "uint256",
              },
              {
                internalType: "address",
                name: "owner",
                type: "address",
              },
              {
                internalType: "address",
                name: "nonce",
                type: "address",
              },
            ],
            internalType: "struct IMuonSignatureVerifier.SchnorrSign",
            name: "sigs",
            type: "tuple",
          },
        ],
        internalType: "struct PairUpnlAndPriceSig",
        name: "sig",
        type: "tuple",
      },
    ],
    name: "finalizeForceClose",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "quoteId",
        type: "uint256",
      },
      {
        components: [
          {
            internalType: "bytes",
            name: "reqId",
            type: "bytes",
          },
          {
            internalType: "uint256",
            name: "timestamp",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "symbolId",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "highest",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "lowest",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "averagePrice",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "startTime",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "endTime",
            type: "uint256",
          },
          {
            internalType: "int256",
            name: "upnlPartyB",
            type: "int256",
          },
          {
            internalType: "int256",
            name: "upnlPartyA",
            type: "int256",
          },
          {
            internalType: "uint256",
            name: "currentPrice",
            type: "uint256",
          },
          {
            internalType: "bytes",
            name: "gatewaySignature",
            type: "bytes",
          },
          {
            components: [
              {
                internalType: "uint256",
                name: "signature",
                type: "uint256",
              },
              {
                internalType: "address",
                name: "owner",
                type: "address",
              },
              {
                internalType: "address",
                name: "nonce",
                type: "address",
              },
            ],
            internalType: "struct IMuonSignatureVerifier.SchnorrSign",
            name: "sigs",
            type: "tuple",
          },
        ],
        internalType: "struct HighLowPriceSig",
        name: "sig",
        type: "tuple",
      },
      {
        components: [
          {
            internalType: "bytes",
            name: "reqId",
            type: "bytes",
          },
          {
            internalType: "uint256",
            name: "timestamp",
            type: "uint256",
          },
          {
            components: [
              {
                internalType: "uint256",
                name: "quoteId",
                type: "uint256",
              },
              {
                internalType: "uint256",
                name: "currentPrice",
                type: "uint256",
              },
              {
                internalType: "uint8",
                name: "partyAIndex",
                type: "uint8",
              },
            ],
            internalType: "struct UnifiedQuoteSettlementData[]",
            name: "quotesSettlementsData",
            type: "tuple[]",
          },
          {
            internalType: "address",
            name: "partyB",
            type: "address",
          },
          {
            internalType: "int256",
            name: "upnlPartyB",
            type: "int256",
          },
          {
            internalType: "int256[]",
            name: "upnlPartyBPerPartyA",
            type: "int256[]",
          },
          {
            internalType: "address[]",
            name: "partyAs",
            type: "address[]",
          },
          {
            internalType: "int256[]",
            name: "upnlPartyAs",
            type: "int256[]",
          },
          {
            internalType: "bytes",
            name: "gatewaySignature",
            type: "bytes",
          },
          {
            components: [
              {
                internalType: "uint256",
                name: "signature",
                type: "uint256",
              },
              {
                internalType: "address",
                name: "owner",
                type: "address",
              },
              {
                internalType: "address",
                name: "nonce",
                type: "address",
              },
            ],
            internalType: "struct IMuonSignatureVerifier.SchnorrSign",
            name: "sigs",
            type: "tuple",
          },
        ],
        internalType: "struct UnifiedSettlementSig",
        name: "settlementSig",
        type: "tuple",
      },
      {
        internalType: "uint256[]",
        name: "updatedPrices",
        type: "uint256[]",
      },
    ],
    name: "forceCloseAndSettlePositionsUnified",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "quoteId",
        type: "uint256",
      },
      {
        components: [
          {
            internalType: "bytes",
            name: "reqId",
            type: "bytes",
          },
          {
            internalType: "uint256",
            name: "timestamp",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "symbolId",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "highest",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "lowest",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "averagePrice",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "startTime",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "endTime",
            type: "uint256",
          },
          {
            internalType: "int256",
            name: "upnlPartyB",
            type: "int256",
          },
          {
            internalType: "int256",
            name: "upnlPartyA",
            type: "int256",
          },
          {
            internalType: "uint256",
            name: "currentPrice",
            type: "uint256",
          },
          {
            internalType: "bytes",
            name: "gatewaySignature",
            type: "bytes",
          },
          {
            components: [
              {
                internalType: "uint256",
                name: "signature",
                type: "uint256",
              },
              {
                internalType: "address",
                name: "owner",
                type: "address",
              },
              {
                internalType: "address",
                name: "nonce",
                type: "address",
              },
            ],
            internalType: "struct IMuonSignatureVerifier.SchnorrSign",
            name: "sigs",
            type: "tuple",
          },
        ],
        internalType: "struct HighLowPriceSig",
        name: "sig",
        type: "tuple",
      },
    ],
    name: "initializeForceClose",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "quoteId",
        type: "uint256",
      },
      {
        components: [
          {
            internalType: "bytes",
            name: "reqId",
            type: "bytes",
          },
          {
            internalType: "uint256",
            name: "timestamp",
            type: "uint256",
          },
          {
            components: [
              {
                internalType: "uint256",
                name: "quoteId",
                type: "uint256",
              },
              {
                internalType: "uint256",
                name: "currentPrice",
                type: "uint256",
              },
              {
                internalType: "uint8",
                name: "partyAIndex",
                type: "uint8",
              },
            ],
            internalType: "struct UnifiedQuoteSettlementData[]",
            name: "quotesSettlementsData",
            type: "tuple[]",
          },
          {
            internalType: "address",
            name: "partyB",
            type: "address",
          },
          {
            internalType: "int256",
            name: "upnlPartyB",
            type: "int256",
          },
          {
            internalType: "int256[]",
            name: "upnlPartyBPerPartyA",
            type: "int256[]",
          },
          {
            internalType: "address[]",
            name: "partyAs",
            type: "address[]",
          },
          {
            internalType: "int256[]",
            name: "upnlPartyAs",
            type: "int256[]",
          },
          {
            internalType: "bytes",
            name: "gatewaySignature",
            type: "bytes",
          },
          {
            components: [
              {
                internalType: "uint256",
                name: "signature",
                type: "uint256",
              },
              {
                internalType: "address",
                name: "owner",
                type: "address",
              },
              {
                internalType: "address",
                name: "nonce",
                type: "address",
              },
            ],
            internalType: "struct IMuonSignatureVerifier.SchnorrSign",
            name: "sigs",
            type: "tuple",
          },
        ],
        internalType: "struct UnifiedSettlementSig",
        name: "settlementSig",
        type: "tuple",
      },
      {
        internalType: "uint256[]",
        name: "updatedPrices",
        type: "uint256[]",
      },
    ],
    name: "settleUpnlForForceClose",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    anonymous: false,
    inputs: [],
    name: "AccumulatedFundingActivated",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [],
    name: "ActiveEmergencyMode",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "address",
        name: "bridge",
        type: "address",
      },
    ],
    name: "AddBridge",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "address",
        name: "target",
        type: "address",
      },
      {
        indexed: false,
        internalType: "address",
        name: "relayer",
        type: "address",
      },
    ],
    name: "AddRelayerForExternalTransferTarget",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "uint256",
        name: "symbolId",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "string",
        name: "name",
        type: "string",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "minAcceptableQuoteValue",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "minAcceptablePortionLF",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "tradingFee",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "maxLeverage",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "fundingRateEpochDuration",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "fundingRateWindowTime",
        type: "uint256",
      },
    ],
    name: "AddSymbol",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "partyB",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256[]",
        name: "symbolId",
        type: "uint256[]",
      },
    ],
    name: "BlacklistSymbols",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [],
    name: "DeactiveEmergencyMode",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "address",
        name: "affiliate",
        type: "address",
      },
    ],
    name: "DeregisterAffiliate",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "address",
        name: "partyB",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "index",
        type: "uint256",
      },
    ],
    name: "DeregisterPartyB",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [],
    name: "LegacyFundingDeprecated",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [],
    name: "LegacyWithdrawalDeprecated",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [],
    name: "PauseAccounting",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [],
    name: "PauseExternalTransfer",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [],
    name: "PauseGlobal",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [],
    name: "PauseInstantLayer",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [],
    name: "PauseInternalTransfer",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [],
    name: "PauseLiquidation",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [],
    name: "PausePartyAActions",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [],
    name: "PausePartyBActions",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [],
    name: "PausePartyBOpenPositions",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "address",
        name: "affiliate",
        type: "address",
      },
    ],
    name: "RegisterAffiliate",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "address",
        name: "provider",
        type: "address",
      },
    ],
    name: "RegisterExpressProvider",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "address",
        name: "affiliate",
        type: "address",
      },
      {
        indexed: false,
        internalType: "address",
        name: "hook",
        type: "address",
      },
    ],
    name: "RegisterHook",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "address",
        name: "partyB",
        type: "address",
      },
    ],
    name: "RegisterPartyB",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "address",
        name: "provider",
        type: "address",
      },
    ],
    name: "RegisterVirtualProvider",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "address",
        name: "bridge",
        type: "address",
      },
    ],
    name: "RemoveBridge",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "address",
        name: "target",
        type: "address",
      },
    ],
    name: "RemoveRelayerForExternalTransferTarget",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "address",
        name: "partyB",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "symbolType",
        type: "uint256",
      },
    ],
    name: "RemoveSymbolTypeFromWhitelist",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "partyB",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256[]",
        name: "symbolId",
        type: "uint256[]",
      },
    ],
    name: "RemoveSymbolsFromBlacklist",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "address",
        name: "partyB",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256[]",
        name: "symbolIds",
        type: "uint256[]",
      },
    ],
    name: "RemoveSymbolsFromWhitelist",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "bytes32",
        name: "role",
        type: "bytes32",
      },
      {
        indexed: false,
        internalType: "address",
        name: "admin",
        type: "address",
      },
    ],
    name: "RoleAdminAdded",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "bytes32",
        name: "role",
        type: "bytes32",
      },
      {
        indexed: false,
        internalType: "address",
        name: "admin",
        type: "address",
      },
    ],
    name: "RoleAdminRemoved",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "bytes32",
        name: "role",
        type: "bytes32",
      },
      {
        indexed: false,
        internalType: "address",
        name: "user",
        type: "address",
      },
    ],
    name: "RoleGranted",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "bytes32",
        name: "role",
        type: "bytes32",
      },
      {
        indexed: false,
        internalType: "address",
        name: "user",
        type: "address",
      },
    ],
    name: "RoleRevoked",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "address",
        name: "partyB",
        type: "address",
      },
      {
        indexed: false,
        internalType: "bool",
        name: "enabled",
        type: "bool",
      },
    ],
    name: "SetADLEnabled",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "address",
        name: "affiliate",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "symbolId",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "oldOpenFee",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "newOpenFee",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "oldCloseFee",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "newCloseFee",
        type: "uint256",
      },
    ],
    name: "SetAffiliateFee",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "address",
        name: "affiliate",
        type: "address",
      },
      {
        indexed: false,
        internalType: "address",
        name: "user",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "symbolId",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "oldOpenFee",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "newOpenFee",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "oldCloseFee",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "newCloseFee",
        type: "uint256",
      },
    ],
    name: "SetAffiliateFeeForUser",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "uint256",
        name: "balanceLimitPerUser",
        type: "uint256",
      },
    ],
    name: "SetBalanceLimitPerUser",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "address",
        name: "collateral",
        type: "address",
      },
    ],
    name: "SetCollateral",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "partyB",
        type: "address",
      },
      {
        indexed: false,
        internalType: "bool",
        name: "enabled",
        type: "bool",
      },
    ],
    name: "SetCrossPartyB",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "bool",
        name: "oldValue",
        type: "bool",
      },
      {
        indexed: false,
        internalType: "bool",
        name: "newValue",
        type: "bool",
      },
    ],
    name: "SetCrossPartyBModeActivated",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "uint256",
        name: "oldCooldown",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "newCooldown",
        type: "uint256",
      },
    ],
    name: "SetDeactiveInstantActionModeCooldown",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "uint256",
        name: "oldDeallocateCooldown",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "newDeallocateCooldown",
        type: "uint256",
      },
    ],
    name: "SetDeallocateCooldown",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "uint256",
        name: "oldDeallocateDebounceTime",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "newDeallocateDebounceTime",
        type: "uint256",
      },
    ],
    name: "SetDeallocateDebounceTime",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "address",
        name: "oldDefaultFeeCollector",
        type: "address",
      },
      {
        indexed: false,
        internalType: "address",
        name: "newDefaultFeeCollector",
        type: "address",
      },
    ],
    name: "SetDefaultFeeCollector",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "address",
        name: "entity",
        type: "address",
      },
      {
        components: [
          {
            internalType: "string",
            name: "name",
            type: "string",
          },
          {
            internalType: "string",
            name: "brandColor",
            type: "string",
          },
          {
            internalType: "string",
            name: "metadata",
            type: "string",
          },
        ],
        indexed: false,
        internalType: "struct EntityMetadata",
        name: "metadata",
        type: "tuple",
      },
    ],
    name: "SetEntityMetadata",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "address",
        name: "affiliate",
        type: "address",
      },
      {
        indexed: false,
        internalType: "address",
        name: "oldFeeCollector",
        type: "address",
      },
      {
        indexed: false,
        internalType: "address",
        name: "newFeeCollector",
        type: "address",
      },
    ],
    name: "SetFeeCollector",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "uint256",
        name: "oldForceCancelCloseCooldown",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "newForceCancelCloseCooldown",
        type: "uint256",
      },
    ],
    name: "SetForceCancelCloseCooldown",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "uint256",
        name: "oldForceCancelCooldown",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "newForceCancelCooldown",
        type: "uint256",
      },
    ],
    name: "SetForceCancelCooldown",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "uint256",
        name: "oldForceCloseFirstCooldown",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "newForceCloseFirstCooldown",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "oldForceCloseSecondCooldown",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "newForceCloseSecondCooldown",
        type: "uint256",
      },
    ],
    name: "SetForceCloseCooldowns",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "uint256",
        name: "symbolId",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "oldForceCloseGapRatio",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "newForceCloseGapRatio",
        type: "uint256",
      },
    ],
    name: "SetForceCloseGapRatio",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "uint256",
        name: "oldCloseMinSigPeriod",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "newCloseMinSigPeriod",
        type: "uint256",
      },
    ],
    name: "SetForceCloseMinSigPeriod",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "uint256",
        name: "oldPricePenalty",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "newPricePenalty",
        type: "uint256",
      },
    ],
    name: "SetForceClosePricePenalty",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "address",
        name: "oldInvalidBridgedAmountsPool",
        type: "address",
      },
      {
        indexed: false,
        internalType: "address",
        name: "newInvalidBridgedAmountsPool",
        type: "address",
      },
    ],
    name: "SetInvalidBridgedAmountsPool",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "bool",
        name: "oldValue",
        type: "bool",
      },
      {
        indexed: false,
        internalType: "bool",
        name: "newValue",
        type: "bool",
      },
    ],
    name: "SetLegacyDeallocateDeprecated",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "address",
        name: "insuranceVault",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "maxLiquidationProfit",
        type: "uint256",
      },
    ],
    name: "SetLiquidationInsuranceVaultParams",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "uint256",
        name: "oldLiquidationTimeout",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "newLiquidationTimeout",
        type: "uint256",
      },
    ],
    name: "SetLiquidationTimeout",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "uint256",
        name: "oldLiquidatorShare",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "newLiquidatorShare",
        type: "uint256",
      },
    ],
    name: "SetLiquidatorShare",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "uint256",
        name: "maxLimit",
        type: "uint256",
      },
    ],
    name: "SetMaxPartyAConnectionLimit",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "uint256",
        name: "maxWithdrawParts",
        type: "uint256",
      },
    ],
    name: "SetMaxWithdrawParts",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "uint256",
        name: "oldMinAffiliateFee",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "newMinAffiliateFee",
        type: "uint256",
      },
    ],
    name: "SetMinAffiliateFee",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "uint256",
        name: "lastMinWithdrawCooldown",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "newMinWithdrawCooldown",
        type: "uint256",
      },
    ],
    name: "SetMinWithdrawCooldown",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "uint256",
        name: "upnlValidTime",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "priceValidTime",
        type: "uint256",
      },
    ],
    name: "SetMuonConfig",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "uint256",
        name: "muonAppId",
        type: "uint256",
      },
    ],
    name: "SetMuonIds",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "address",
        name: "partyB",
        type: "address",
      },
      {
        indexed: false,
        internalType: "bool",
        name: "bindable",
        type: "bool",
      },
    ],
    name: "SetPartyBBindable",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "address",
        name: "partyB",
        type: "address",
      },
      {
        indexed: false,
        internalType: "bool",
        name: "status",
        type: "bool",
      },
    ],
    name: "SetPartyBEmergencyStatus",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "partyB",
        type: "address",
      },
      {
        indexed: false,
        internalType: "bool",
        name: "status",
        type: "bool",
      },
    ],
    name: "SetPartyBOpenPositionsPausedForPartyB",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "uint256",
        name: "oldPendingQuotesValidLength",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "newPendingQuotesValidLength",
        type: "uint256",
      },
    ],
    name: "SetPendingQuotesValidLength",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "uint256",
        name: "oldBlackout",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "newBlackout",
        type: "uint256",
      },
    ],
    name: "SetPureVirtualCancelBlackout",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "uint256",
        name: "oldSettlementCooldown",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "newSettlementCooldown",
        type: "uint256",
      },
    ],
    name: "SetSettlementCooldown",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "address",
        name: "SignatureVerifier",
        type: "address",
      },
    ],
    name: "SetSignatureVerifierAddress",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "address",
        name: "softLiquidationPenaltyCollector",
        type: "address",
      },
    ],
    name: "SetSoftLiquidationPenaltyCollector",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "address",
        name: "user",
        type: "address",
      },
      {
        indexed: false,
        internalType: "bool",
        name: "speedUp",
        type: "bool",
      },
    ],
    name: "SetSpeedUpUser",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "address",
        name: "user",
        type: "address",
      },
      {
        indexed: false,
        internalType: "bool",
        name: "isSuspended",
        type: "bool",
      },
    ],
    name: "SetSuspendedAddress",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "uint256",
        name: "symbolId",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "oldMinAcceptableQuoteValue",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "oldMinAcceptablePortionLF",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "minAcceptableQuoteValue",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "minAcceptablePortionLF",
        type: "uint256",
      },
    ],
    name: "SetSymbolAcceptableValues",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "uint256",
        name: "symbolId",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "fundingRateEpochDuration",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "fundingRateWindowTime",
        type: "uint256",
      },
    ],
    name: "SetSymbolFundingState",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "uint256",
        name: "symbolId",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "oldMaxLeverage",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "maxLeverage",
        type: "uint256",
      },
    ],
    name: "SetSymbolMaxLeverage",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "uint256",
        name: "symbolId",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "oldTradingFee",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "tradingFee",
        type: "uint256",
      },
    ],
    name: "SetSymbolTradingFee",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "uint256",
        name: "symbolIds",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "symbolTypes",
        type: "uint256",
      },
    ],
    name: "SetSymbolType",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "uint256",
        name: "symbolId",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "bool",
        name: "oldState",
        type: "bool",
      },
      {
        indexed: false,
        internalType: "bool",
        name: "isValid",
        type: "bool",
      },
    ],
    name: "SetSymbolValidationState",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "uint256",
        name: "oldUnbindCooldown",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "newUnbindCooldown",
        type: "uint256",
      },
    ],
    name: "SetUnbindCooldown",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "uint256",
        name: "oldWithdrawCooldownPeriod",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "newWithdrawCooldownPeriod",
        type: "uint256",
      },
    ],
    name: "SetWithdrawCooldownPeriod",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "address",
        name: "signer",
        type: "address",
      },
    ],
    name: "SignerSet",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [],
    name: "UnpauseAccounting",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [],
    name: "UnpauseExternalTransfer",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [],
    name: "UnpauseGlobal",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [],
    name: "UnpauseInstantLayer",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [],
    name: "UnpauseInternalTransfer",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [],
    name: "UnpauseLiquidation",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [],
    name: "UnpausePartyAActions",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [],
    name: "UnpausePartyBActions",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [],
    name: "UnpausePartyBOpenPositions",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "address",
        name: "provider",
        type: "address",
      },
    ],
    name: "UnregisterExpressProvider",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "address",
        name: "provider",
        type: "address",
      },
    ],
    name: "UnregisterVirtualProvider",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "address",
        name: "partyB",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "symbolType",
        type: "uint256",
      },
    ],
    name: "WhitelistSymbolType",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "address",
        name: "partyB",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256[]",
        name: "symbolIds",
        type: "uint256[]",
      },
    ],
    name: "WhitelistSymbols",
    type: "event",
  },
  {
    inputs: [
      {
        internalType: "string",
        name: "name",
        type: "string",
      },
      {
        internalType: "uint256",
        name: "minAcceptableQuoteValue",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "minAcceptablePortionLF",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "tradingFee",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "maxLeverage",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "fundingRateEpochDuration",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "fundingRateWindowTime",
        type: "uint256",
      },
    ],
    name: "addSymbol",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        components: [
          {
            internalType: "uint256",
            name: "symbolId",
            type: "uint256",
          },
          {
            internalType: "string",
            name: "name",
            type: "string",
          },
          {
            internalType: "bool",
            name: "isValid",
            type: "bool",
          },
          {
            internalType: "uint256",
            name: "minAcceptableQuoteValue",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "minAcceptablePortionLF",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "tradingFee",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "maxLeverage",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "fundingRateEpochDuration",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "fundingRateWindowTime",
            type: "uint256",
          },
        ],
        internalType: "struct Symbol[]",
        name: "symbols",
        type: "tuple[]",
      },
    ],
    name: "addSymbols",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        components: [
          {
            internalType: "uint256",
            name: "symbolId",
            type: "uint256",
          },
          {
            internalType: "string",
            name: "name",
            type: "string",
          },
          {
            internalType: "bool",
            name: "isValid",
            type: "bool",
          },
          {
            internalType: "uint256",
            name: "minAcceptableQuoteValue",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "minAcceptablePortionLF",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "tradingFee",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "maxLeverage",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "fundingRateEpochDuration",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "fundingRateWindowTime",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "symbolType",
            type: "uint256",
          },
        ],
        internalType: "struct SymbolWithType[]",
        name: "symbolsWithType",
        type: "tuple[]",
      },
    ],
    name: "addSymbolsWithType",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "partyB",
        type: "address",
      },
      {
        internalType: "uint256[]",
        name: "symbolIds",
        type: "uint256[]",
      },
    ],
    name: "blacklistSymbols",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "partyB",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "symbolType",
        type: "uint256",
      },
    ],
    name: "removeSymbolTypeFromWhitelist",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "partyB",
        type: "address",
      },
      {
        internalType: "uint256[]",
        name: "symbolIds",
        type: "uint256[]",
      },
    ],
    name: "removeSymbolsFromBlacklist",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "partyB",
        type: "address",
      },
      {
        internalType: "uint256[]",
        name: "symbolIds",
        type: "uint256[]",
      },
    ],
    name: "removeSymbolsFromWhitelist",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "symbolId",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "minAcceptableQuoteValue",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "minAcceptablePortionLF",
        type: "uint256",
      },
    ],
    name: "setSymbolAcceptableValues",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "symbolId",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "fundingRateEpochDuration",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "fundingRateWindowTime",
        type: "uint256",
      },
    ],
    name: "setSymbolFundingState",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "symbolId",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "maxLeverage",
        type: "uint256",
      },
    ],
    name: "setSymbolMaxLeverage",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "symbolId",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "tradingFee",
        type: "uint256",
      },
    ],
    name: "setSymbolTradingFee",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256[]",
        name: "symbolIds",
        type: "uint256[]",
      },
      {
        internalType: "uint256[]",
        name: "symbolTypes",
        type: "uint256[]",
      },
    ],
    name: "setSymbolTypes",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "symbolId",
        type: "uint256",
      },
      {
        internalType: "bool",
        name: "isValid",
        type: "bool",
      },
    ],
    name: "setSymbolValidationState",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "partyB",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "symbolType",
        type: "uint256",
      },
    ],
    name: "whitelistSymbolType",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "partyB",
        type: "address",
      },
      {
        internalType: "uint256[]",
        name: "symbolIds",
        type: "uint256[]",
      },
    ],
    name: "whitelistSymbols",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "liquidatedPartyA",
        type: "address",
      },
      {
        components: [
          {
            internalType: "bytes",
            name: "reqId",
            type: "bytes",
          },
          {
            internalType: "uint256",
            name: "timestamp",
            type: "uint256",
          },
          {
            components: [
              {
                internalType: "uint256",
                name: "quoteId",
                type: "uint256",
              },
              {
                internalType: "uint256",
                name: "currentPrice",
                type: "uint256",
              },
              {
                internalType: "uint8",
                name: "partyAIndex",
                type: "uint8",
              },
            ],
            internalType: "struct UnifiedQuoteSettlementData[]",
            name: "quotesSettlementsData",
            type: "tuple[]",
          },
          {
            internalType: "address",
            name: "partyB",
            type: "address",
          },
          {
            internalType: "int256",
            name: "upnlPartyB",
            type: "int256",
          },
          {
            internalType: "int256[]",
            name: "upnlPartyBPerPartyA",
            type: "int256[]",
          },
          {
            internalType: "address[]",
            name: "partyAs",
            type: "address[]",
          },
          {
            internalType: "int256[]",
            name: "upnlPartyAs",
            type: "int256[]",
          },
          {
            internalType: "bytes",
            name: "gatewaySignature",
            type: "bytes",
          },
          {
            components: [
              {
                internalType: "uint256",
                name: "signature",
                type: "uint256",
              },
              {
                internalType: "address",
                name: "owner",
                type: "address",
              },
              {
                internalType: "address",
                name: "nonce",
                type: "address",
              },
            ],
            internalType: "struct IMuonSignatureVerifier.SchnorrSign",
            name: "sigs",
            type: "tuple",
          },
        ],
        internalType: "struct UnifiedSettlementSig",
        name: "sig",
        type: "tuple",
      },
      {
        internalType: "uint256[]",
        name: "updatedPrices",
        type: "uint256[]",
      },
    ],
    name: "settlePartyBUpnlForLiquidation",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        components: [
          {
            internalType: "bytes",
            name: "reqId",
            type: "bytes",
          },
          {
            internalType: "uint256",
            name: "timestamp",
            type: "uint256",
          },
          {
            components: [
              {
                internalType: "uint256",
                name: "quoteId",
                type: "uint256",
              },
              {
                internalType: "uint256",
                name: "currentPrice",
                type: "uint256",
              },
              {
                internalType: "uint8",
                name: "partyBUpnlIndex",
                type: "uint8",
              },
            ],
            internalType: "struct QuoteSettlementData[]",
            name: "quotesSettlementsData",
            type: "tuple[]",
          },
          {
            internalType: "int256[]",
            name: "upnlPartyBs",
            type: "int256[]",
          },
          {
            internalType: "int256",
            name: "upnlPartyA",
            type: "int256",
          },
          {
            internalType: "bytes",
            name: "gatewaySignature",
            type: "bytes",
          },
          {
            components: [
              {
                internalType: "uint256",
                name: "signature",
                type: "uint256",
              },
              {
                internalType: "address",
                name: "owner",
                type: "address",
              },
              {
                internalType: "address",
                name: "nonce",
                type: "address",
              },
            ],
            internalType: "struct IMuonSignatureVerifier.SchnorrSign",
            name: "sigs",
            type: "tuple",
          },
        ],
        internalType: "struct SettlementSig",
        name: "settleSig",
        type: "tuple",
      },
      {
        internalType: "uint256[]",
        name: "updatedPrices",
        type: "uint256[]",
      },
      {
        internalType: "address",
        name: "partyA",
        type: "address",
      },
    ],
    name: "settleUpnl",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        components: [
          {
            internalType: "bytes",
            name: "reqId",
            type: "bytes",
          },
          {
            internalType: "uint256",
            name: "timestamp",
            type: "uint256",
          },
          {
            components: [
              {
                internalType: "uint256",
                name: "quoteId",
                type: "uint256",
              },
              {
                internalType: "uint256",
                name: "currentPrice",
                type: "uint256",
              },
              {
                internalType: "uint8",
                name: "partyAIndex",
                type: "uint8",
              },
            ],
            internalType: "struct UnifiedQuoteSettlementData[]",
            name: "quotesSettlementsData",
            type: "tuple[]",
          },
          {
            internalType: "address",
            name: "partyB",
            type: "address",
          },
          {
            internalType: "int256",
            name: "upnlPartyB",
            type: "int256",
          },
          {
            internalType: "int256[]",
            name: "upnlPartyBPerPartyA",
            type: "int256[]",
          },
          {
            internalType: "address[]",
            name: "partyAs",
            type: "address[]",
          },
          {
            internalType: "int256[]",
            name: "upnlPartyAs",
            type: "int256[]",
          },
          {
            internalType: "bytes",
            name: "gatewaySignature",
            type: "bytes",
          },
          {
            components: [
              {
                internalType: "uint256",
                name: "signature",
                type: "uint256",
              },
              {
                internalType: "address",
                name: "owner",
                type: "address",
              },
              {
                internalType: "address",
                name: "nonce",
                type: "address",
              },
            ],
            internalType: "struct IMuonSignatureVerifier.SchnorrSign",
            name: "sigs",
            type: "tuple",
          },
        ],
        internalType: "struct UnifiedSettlementSig",
        name: "sig",
        type: "tuple",
      },
      {
        internalType: "uint256[]",
        name: "updatedPrices",
        type: "uint256[]",
      },
    ],
    name: "settleUpnlUnified",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "address",
        name: "user",
        type: "address",
      },
    ],
    name: "ActivateCrossPartyB",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "address",
        name: "partyB",
        type: "address",
      },
      {
        indexed: false,
        internalType: "address",
        name: "partyA",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "amount",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "newAllocatedBalance",
        type: "uint256",
      },
    ],
    name: "AllocateForPartyB",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "address",
        name: "partyB",
        type: "address",
      },
      {
        indexed: false,
        internalType: "address",
        name: "partyA",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "amount",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "newAllocatedBalance",
        type: "uint256",
      },
    ],
    name: "DeallocateForPartyB",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "address",
        name: "sender",
        type: "address",
      },
      {
        indexed: false,
        internalType: "address",
        name: "partyB",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "amount",
        type: "uint256",
      },
    ],
    name: "DepositToReserveVault",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "uint256",
        name: "amount",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "address",
        name: "origin",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "originNewAllocatedBalance",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "address",
        name: "recipient",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "recipientNewAllocatedBalance",
        type: "uint256",
      },
    ],
    name: "TransferAllocation",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "address",
        name: "partyB",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "amount",
        type: "uint256",
      },
    ],
    name: "WithdrawFromReserveVault",
    type: "event",
  },
  {
    inputs: [],
    name: "activateCrossPartyB",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "amount",
        type: "uint256",
      },
      {
        internalType: "address",
        name: "partyA",
        type: "address",
      },
    ],
    name: "allocateForPartyB",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "amount",
        type: "uint256",
      },
      {
        internalType: "address",
        name: "partyA",
        type: "address",
      },
      {
        components: [
          {
            internalType: "bytes",
            name: "reqId",
            type: "bytes",
          },
          {
            internalType: "uint256",
            name: "timestamp",
            type: "uint256",
          },
          {
            internalType: "int256",
            name: "upnl",
            type: "int256",
          },
          {
            internalType: "bytes",
            name: "gatewaySignature",
            type: "bytes",
          },
          {
            components: [
              {
                internalType: "uint256",
                name: "signature",
                type: "uint256",
              },
              {
                internalType: "address",
                name: "owner",
                type: "address",
              },
              {
                internalType: "address",
                name: "nonce",
                type: "address",
              },
            ],
            internalType: "struct IMuonSignatureVerifier.SchnorrSign",
            name: "sigs",
            type: "tuple",
          },
        ],
        internalType: "struct SingleUpnlSig",
        name: "upnlSig",
        type: "tuple",
      },
    ],
    name: "deallocateForPartyB",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "amount",
        type: "uint256",
      },
      {
        internalType: "address",
        name: "partyB",
        type: "address",
      },
    ],
    name: "depositToReserveVault",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "amount",
        type: "uint256",
      },
      {
        internalType: "address",
        name: "origin",
        type: "address",
      },
      {
        internalType: "address",
        name: "recipient",
        type: "address",
      },
      {
        components: [
          {
            internalType: "bytes",
            name: "reqId",
            type: "bytes",
          },
          {
            internalType: "uint256",
            name: "timestamp",
            type: "uint256",
          },
          {
            internalType: "int256",
            name: "upnl",
            type: "int256",
          },
          {
            internalType: "bytes",
            name: "gatewaySignature",
            type: "bytes",
          },
          {
            components: [
              {
                internalType: "uint256",
                name: "signature",
                type: "uint256",
              },
              {
                internalType: "address",
                name: "owner",
                type: "address",
              },
              {
                internalType: "address",
                name: "nonce",
                type: "address",
              },
            ],
            internalType: "struct IMuonSignatureVerifier.SchnorrSign",
            name: "sigs",
            type: "tuple",
          },
        ],
        internalType: "struct SingleUpnlSig",
        name: "upnlSig",
        type: "tuple",
      },
    ],
    name: "transferAllocation",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "amount",
        type: "uint256",
      },
    ],
    name: "withdrawFromReserveVault",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "symbolId",
        type: "uint256",
      },
    ],
    name: "forceCloseGapRatio",
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
        name: "partyA",
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
    name: "getAllowedSymbolsForPartyA",
    outputs: [
      {
        components: [
          {
            internalType: "uint256",
            name: "symbolId",
            type: "uint256",
          },
          {
            internalType: "string",
            name: "name",
            type: "string",
          },
          {
            internalType: "bool",
            name: "isValid",
            type: "bool",
          },
          {
            internalType: "uint256",
            name: "minAcceptableQuoteValue",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "minAcceptablePortionLF",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "tradingFee",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "maxLeverage",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "fundingRateEpochDuration",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "fundingRateWindowTime",
            type: "uint256",
          },
        ],
        internalType: "struct Symbol[]",
        name: "",
        type: "tuple[]",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "partyA",
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
    name: "getAllowedSymbolsWithTypeForPartyA",
    outputs: [
      {
        components: [
          {
            internalType: "uint256",
            name: "symbolId",
            type: "uint256",
          },
          {
            internalType: "string",
            name: "name",
            type: "string",
          },
          {
            internalType: "bool",
            name: "isValid",
            type: "bool",
          },
          {
            internalType: "uint256",
            name: "minAcceptableQuoteValue",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "minAcceptablePortionLF",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "tradingFee",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "maxLeverage",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "fundingRateEpochDuration",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "fundingRateWindowTime",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "symbolType",
            type: "uint256",
          },
        ],
        internalType: "struct SymbolWithType[]",
        name: "",
        type: "tuple[]",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "partyA",
        type: "address",
      },
    ],
    name: "getConnectedPartyBs",
    outputs: [
      {
        internalType: "address[]",
        name: "",
        type: "address[]",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "partyA",
        type: "address",
      },
    ],
    name: "getConnectedPartyBsWithSymbolCounts",
    outputs: [
      {
        components: [
          {
            internalType: "address",
            name: "partyB",
            type: "address",
          },
          {
            internalType: "uint256",
            name: "symbolCount",
            type: "uint256",
          },
        ],
        internalType: "struct PartyBSymbolCount[]",
        name: "",
        type: "tuple[]",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "symbolId",
        type: "uint256",
      },
      {
        internalType: "address",
        name: "partyB",
        type: "address",
      },
    ],
    name: "getFundingFeesOfPartyB",
    outputs: [
      {
        components: [
          {
            internalType: "int256",
            name: "currentLongRate",
            type: "int256",
          },
          {
            internalType: "int256",
            name: "currentShortRate",
            type: "int256",
          },
          {
            internalType: "int256",
            name: "accumulatedLongRate",
            type: "int256",
          },
          {
            internalType: "int256",
            name: "accumulatedShortRate",
            type: "int256",
          },
          {
            internalType: "uint256",
            name: "lastUpdatedEpoch",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "lastUpdatedTimeStamp",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "startEpochTimeStamp",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "startEpoch",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "epochDuration",
            type: "uint256",
          },
          {
            internalType: "int256",
            name: "snapshotLongFee",
            type: "int256",
          },
          {
            internalType: "int256",
            name: "snapshotShortFee",
            type: "int256",
          },
        ],
        internalType: "struct FundingFee",
        name: "",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "symbolId",
        type: "uint256",
      },
    ],
    name: "getSymbol",
    outputs: [
      {
        components: [
          {
            internalType: "uint256",
            name: "symbolId",
            type: "uint256",
          },
          {
            internalType: "string",
            name: "name",
            type: "string",
          },
          {
            internalType: "bool",
            name: "isValid",
            type: "bool",
          },
          {
            internalType: "uint256",
            name: "minAcceptableQuoteValue",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "minAcceptablePortionLF",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "tradingFee",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "maxLeverage",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "fundingRateEpochDuration",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "fundingRateWindowTime",
            type: "uint256",
          },
        ],
        internalType: "struct Symbol",
        name: "",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "symbolId",
        type: "uint256",
      },
    ],
    name: "getSymbolWithType",
    outputs: [
      {
        components: [
          {
            internalType: "uint256",
            name: "symbolId",
            type: "uint256",
          },
          {
            internalType: "string",
            name: "name",
            type: "string",
          },
          {
            internalType: "bool",
            name: "isValid",
            type: "bool",
          },
          {
            internalType: "uint256",
            name: "minAcceptableQuoteValue",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "minAcceptablePortionLF",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "tradingFee",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "maxLeverage",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "fundingRateEpochDuration",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "fundingRateWindowTime",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "symbolType",
            type: "uint256",
          },
        ],
        internalType: "struct SymbolWithType",
        name: "",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
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
    name: "getSymbols",
    outputs: [
      {
        components: [
          {
            internalType: "uint256",
            name: "symbolId",
            type: "uint256",
          },
          {
            internalType: "string",
            name: "name",
            type: "string",
          },
          {
            internalType: "bool",
            name: "isValid",
            type: "bool",
          },
          {
            internalType: "uint256",
            name: "minAcceptableQuoteValue",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "minAcceptablePortionLF",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "tradingFee",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "maxLeverage",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "fundingRateEpochDuration",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "fundingRateWindowTime",
            type: "uint256",
          },
        ],
        internalType: "struct Symbol[]",
        name: "",
        type: "tuple[]",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
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
    name: "getSymbolsWithType",
    outputs: [
      {
        components: [
          {
            internalType: "uint256",
            name: "symbolId",
            type: "uint256",
          },
          {
            internalType: "string",
            name: "name",
            type: "string",
          },
          {
            internalType: "bool",
            name: "isValid",
            type: "bool",
          },
          {
            internalType: "uint256",
            name: "minAcceptableQuoteValue",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "minAcceptablePortionLF",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "tradingFee",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "maxLeverage",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "fundingRateEpochDuration",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "fundingRateWindowTime",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "symbolType",
            type: "uint256",
          },
        ],
        internalType: "struct SymbolWithType[]",
        name: "",
        type: "tuple[]",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "partyA",
        type: "address",
      },
      {
        internalType: "address",
        name: "partyB",
        type: "address",
      },
    ],
    name: "isConnectedPartyB",
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
        internalType: "address",
        name: "partyB",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "symbolType",
        type: "uint256",
      },
    ],
    name: "isWhitelistedSymbolType",
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
        internalType: "uint256[]",
        name: "symbolIds",
        type: "uint256[]",
      },
    ],
    name: "symbolNameById",
    outputs: [
      {
        internalType: "string[]",
        name: "",
        type: "string[]",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256[]",
        name: "quoteIds",
        type: "uint256[]",
      },
    ],
    name: "symbolNameByQuoteId",
    outputs: [
      {
        internalType: "string[]",
        name: "",
        type: "string[]",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256[]",
        name: "quoteIds",
        type: "uint256[]",
      },
    ],
    name: "symbolsByQuoteId",
    outputs: [
      {
        components: [
          {
            internalType: "uint256",
            name: "symbolId",
            type: "uint256",
          },
          {
            internalType: "string",
            name: "name",
            type: "string",
          },
          {
            internalType: "bool",
            name: "isValid",
            type: "bool",
          },
          {
            internalType: "uint256",
            name: "minAcceptableQuoteValue",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "minAcceptablePortionLF",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "tradingFee",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "maxLeverage",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "fundingRateEpochDuration",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "fundingRateWindowTime",
            type: "uint256",
          },
        ],
        internalType: "struct Symbol[]",
        name: "",
        type: "tuple[]",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "uint256",
        name: "transactionId",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "validAmount",
        type: "uint256",
      },
    ],
    name: "RestoreBridgeTransaction",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "uint256",
        name: "transactionId",
        type: "uint256",
      },
    ],
    name: "SuspendBridgeTransaction",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "address",
        name: "user",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "amount",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "address",
        name: "bridgeAddress",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "transactionId",
        type: "uint256",
      },
    ],
    name: "TransferToBridge",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "uint256",
        name: "transactionId",
        type: "uint256",
      },
    ],
    name: "WithdrawReceivedBridgeValue",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "uint256[]",
        name: "transactionIds",
        type: "uint256[]",
      },
    ],
    name: "WithdrawReceivedBridgeValues",
    type: "event",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "transactionId",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "validAmount",
        type: "uint256",
      },
    ],
    name: "restoreBridgeTransaction",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "transactionId",
        type: "uint256",
      },
    ],
    name: "suspendBridgeTransaction",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "amount",
        type: "uint256",
      },
      {
        internalType: "address",
        name: "bridgeAddress",
        type: "address",
      },
    ],
    name: "transferToBridge",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "transactionId",
        type: "uint256",
      },
    ],
    name: "withdrawReceivedBridgeValue",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256[]",
        name: "transactionIds",
        type: "uint256[]",
      },
    ],
    name: "withdrawReceivedBridgeValues",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "activateAccumulatedFunding",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "activeEmergencyMode",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "deactiveEmergencyMode",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "deprecateLegacyFunding",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "deprecateLegacyWithdrawal",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "pauseAccounting",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "pauseExternalTransfer",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "pauseGlobal",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "pauseInstantLayer",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "pauseInternalTransfer",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "pauseLiquidation",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "pausePartyAActions",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "pausePartyBActions",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "pausePartyBOpenPositions",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address[]",
        name: "partyBs",
        type: "address[]",
      },
      {
        internalType: "bool",
        name: "status",
        type: "bool",
      },
    ],
    name: "setPartyBEmergencyStatus",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "partyB",
        type: "address",
      },
      {
        internalType: "bool",
        name: "status",
        type: "bool",
      },
    ],
    name: "setPartyBOpenPositionsPaused",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "user",
        type: "address",
      },
    ],
    name: "suspendedAddress",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "unpauseAccounting",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "unpauseExternalTransfer",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "unpauseGlobal",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "unpauseInstantLayer",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "unpauseInternalTransfer",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "unpauseLiquidation",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "unpausePartyAActions",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "unpausePartyBActions",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "unpausePartyBOpenPositions",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "user",
        type: "address",
      },
    ],
    name: "unsuspendedAddress",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "partyA",
        type: "address",
      },
    ],
    name: "allocatedBalanceOfPartyA",
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
        name: "partyA",
        type: "address",
      },
      {
        internalType: "address[]",
        name: "partyBs",
        type: "address[]",
      },
    ],
    name: "allocatedBalanceOfPartyBs",
    outputs: [
      {
        internalType: "uint256[]",
        name: "",
        type: "uint256[]",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "partyA",
        type: "address",
      },
    ],
    name: "balanceInfoOfPartyA",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
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
        name: "partyB",
        type: "address",
      },
      {
        internalType: "address",
        name: "partyA",
        type: "address",
      },
    ],
    name: "balanceInfoOfPartyB",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
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
        name: "user",
        type: "address",
      },
    ],
    name: "balanceOf",
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
        name: "partyB",
        type: "address",
      },
    ],
    name: "balanceOfReserveVault",
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
    inputs: [],
    name: "coolDownsOfMA",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
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
    inputs: [],
    name: "deactiveInstantActionModeCooldown",
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
    inputs: [],
    name: "deallocateCooldown",
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
    inputs: [],
    name: "forceCloseCooldowns",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
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
    inputs: [],
    name: "forceCloseMinSigPeriod",
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
    inputs: [],
    name: "forceClosePricePenalty",
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
        name: "affiliate",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "symbolId",
        type: "uint256",
      },
    ],
    name: "getAffiliateFee",
    outputs: [
      {
        components: [
          {
            internalType: "uint256",
            name: "openFee",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "closeFee",
            type: "uint256",
          },
          {
            internalType: "bool",
            name: "isSet",
            type: "bool",
          },
        ],
        internalType: "struct Fee",
        name: "",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "affiliate",
        type: "address",
      },
      {
        internalType: "address",
        name: "user",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "symbolId",
        type: "uint256",
      },
    ],
    name: "getAffiliateFeeForUser",
    outputs: [
      {
        components: [
          {
            internalType: "uint256",
            name: "openFee",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "closeFee",
            type: "uint256",
          },
          {
            internalType: "bool",
            name: "isSet",
            type: "bool",
          },
        ],
        internalType: "struct Fee",
        name: "",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "affiliate",
        type: "address",
      },
    ],
    name: "getAffiliateHook",
    outputs: [
      {
        internalType: "address",
        name: "hook",
        type: "address",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "getBalanceLimitPerUser",
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
        name: "user",
        type: "address",
      },
    ],
    name: "getBindState",
    outputs: [
      {
        components: [
          {
            internalType: "enum BindStatus",
            name: "status",
            type: "uint8",
          },
          {
            internalType: "address",
            name: "partyB",
            type: "address",
          },
          {
            internalType: "uint256",
            name: "modifyTimestamp",
            type: "uint256",
          },
        ],
        internalType: "struct BindState",
        name: "",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "transactionId",
        type: "uint256",
      },
    ],
    name: "getBridgeTransaction",
    outputs: [
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
            internalType: "address",
            name: "user",
            type: "address",
          },
          {
            internalType: "address",
            name: "bridge",
            type: "address",
          },
          {
            internalType: "uint256",
            name: "timestamp",
            type: "uint256",
          },
          {
            internalType: "enum BridgeTransactionStatus",
            name: "status",
            type: "uint8",
          },
        ],
        internalType: "struct BridgeTransaction",
        name: "",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "bridge",
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
    name: "getBridgeTransactions",
    outputs: [
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
            internalType: "address",
            name: "user",
            type: "address",
          },
          {
            internalType: "address",
            name: "bridge",
            type: "address",
          },
          {
            internalType: "uint256",
            name: "timestamp",
            type: "uint256",
          },
          {
            internalType: "enum BridgeTransactionStatus",
            name: "status",
            type: "uint8",
          },
        ],
        internalType: "struct BridgeTransaction[]",
        name: "",
        type: "tuple[]",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "getCollateral",
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
        name: "partyB",
        type: "address",
      },
    ],
    name: "getCrossLiquidationDetails",
    outputs: [
      {
        components: [
          {
            internalType: "bytes",
            name: "liquidationId",
            type: "bytes",
          },
          {
            internalType: "int256",
            name: "upnl",
            type: "int256",
          },
          {
            internalType: "uint256",
            name: "timestamp",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "deallocatedPool",
            type: "uint256",
          },
          {
            internalType: "bool",
            name: "inProgress",
            type: "bool",
          },
        ],
        internalType: "struct CrossLiquidationDetail",
        name: "",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "getDeallocateDebounceTime",
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
    inputs: [],
    name: "getDefaultFeeCollector",
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
        name: "entity",
        type: "address",
      },
    ],
    name: "getEntityMetadata",
    outputs: [
      {
        components: [
          {
            internalType: "string",
            name: "name",
            type: "string",
          },
          {
            internalType: "string",
            name: "brandColor",
            type: "string",
          },
          {
            internalType: "string",
            name: "metadata",
            type: "string",
          },
        ],
        internalType: "struct EntityMetadata",
        name: "",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "affiliate",
        type: "address",
      },
    ],
    name: "getFeeCollector",
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
        name: "affiliate",
        type: "address",
      },
      {
        internalType: "address",
        name: "user",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "symbolId",
        type: "uint256",
      },
    ],
    name: "getFeeForUser",
    outputs: [
      {
        components: [
          {
            internalType: "uint256",
            name: "openFee",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "closeFee",
            type: "uint256",
          },
          {
            internalType: "bool",
            name: "isSet",
            type: "bool",
          },
        ],
        internalType: "struct Fee",
        name: "fee",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "getInvalidBridgedAmountsPool",
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
    inputs: [],
    name: "getLastExternalTransferId",
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
        name: "user",
        type: "address",
      },
    ],
    name: "getLastWithdrawRequestId",
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
        name: "partyA",
        type: "address",
      },
    ],
    name: "getLiquidatedStateOfPartyA",
    outputs: [
      {
        components: [
          {
            internalType: "bytes",
            name: "liquidationId",
            type: "bytes",
          },
          {
            internalType: "enum LiquidationType",
            name: "liquidationType",
            type: "uint8",
          },
          {
            internalType: "int256",
            name: "upnl",
            type: "int256",
          },
          {
            internalType: "int256",
            name: "totalUnrealizedLoss",
            type: "int256",
          },
          {
            internalType: "uint256",
            name: "deficit",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "liquidationFee",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "timestamp",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "involvedPartyBCounts",
            type: "uint256",
          },
          {
            internalType: "int256",
            name: "partyAAccumulatedUpnl",
            type: "int256",
          },
          {
            internalType: "bool",
            name: "disputed",
            type: "bool",
          },
          {
            internalType: "uint256",
            name: "liquidationTimestamp",
            type: "uint256",
          },
        ],
        internalType: "struct LiquidationDetail",
        name: "",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "partyA",
        type: "address",
      },
    ],
    name: "getLiquidationEscrow",
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
    inputs: [],
    name: "getLiquidationInsuranceVaultParams",
    outputs: [
      {
        internalType: "address",
        name: "",
        type: "address",
      },
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
        internalType: "uint256",
        name: "quoteId",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "closedPrice",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "marketPrice",
        type: "uint256",
      },
      {
        internalType: "int256",
        name: "upnlPartyA",
        type: "int256",
      },
    ],
    name: "getMaxCloseAmountToLiquidation",
    outputs: [
      {
        internalType: "uint256",
        name: "maxCloseAmount",
        type: "uint256",
      },
      {
        internalType: "bool",
        name: "canCloseAll",
        type: "bool",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "getMaxWithdrawParts",
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
    inputs: [],
    name: "getMinAffiliateFee",
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
    inputs: [],
    name: "getMinWithdrawCooldown",
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
        name: "user",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "requestId",
        type: "uint256",
      },
    ],
    name: "getModifiedCooldownEndTime",
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
    inputs: [],
    name: "getMuonConfig",
    outputs: [
      {
        internalType: "uint256",
        name: "upnlValidTime",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "priceValidTime",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "getMuonIds",
    outputs: [
      {
        internalType: "uint256",
        name: "muonAppId",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "getNextBridgeTransactionId",
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
        name: "partyA",
        type: "address",
      },
    ],
    name: "getPartyADeferredBalance",
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
        name: "partyA",
        type: "address",
      },
    ],
    name: "getPartyATakeoverDetails",
    outputs: [
      {
        components: [
          {
            internalType: "bytes",
            name: "liquidationId",
            type: "bytes",
          },
          {
            internalType: "uint256",
            name: "deallocatedPool",
            type: "uint256",
          },
          {
            internalType: "bool",
            name: "inProgress",
            type: "bool",
          },
        ],
        internalType: "struct PartyATakeoverDetail",
        name: "",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "partyB",
        type: "address",
      },
    ],
    name: "getPartyBCrossLiquidationStatus",
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
        internalType: "address",
        name: "partyB",
        type: "address",
      },
    ],
    name: "getPartyBEmergencyStatus",
    outputs: [
      {
        internalType: "bool",
        name: "isEmergency",
        type: "bool",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "partyB",
        type: "address",
      },
    ],
    name: "getPartyBLiquidationSettlementReserve",
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
  {
    inputs: [],
    name: "getPureVirtualCancelBlackout",
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
        internalType: "string",
        name: "str",
        type: "string",
      },
    ],
    name: "getRoleHash",
    outputs: [
      {
        internalType: "bytes32",
        name: "",
        type: "bytes32",
      },
    ],
    stateMutability: "pure",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "partyA",
        type: "address",
      },
      {
        internalType: "address[]",
        name: "partyBs",
        type: "address[]",
      },
    ],
    name: "getSettlementStates",
    outputs: [
      {
        components: [
          {
            internalType: "int256",
            name: "actualAmount",
            type: "int256",
          },
          {
            internalType: "int256",
            name: "expectedAmount",
            type: "int256",
          },
          {
            internalType: "uint256",
            name: "cva",
            type: "uint256",
          },
          {
            internalType: "bool",
            name: "pending",
            type: "bool",
          },
        ],
        internalType: "struct LiquidationSettlementState[]",
        name: "",
        type: "tuple[]",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "getSignatureVerifier",
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
    inputs: [],
    name: "getSigner",
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
    inputs: [],
    name: "getSoftLiquidationPenaltyCollector",
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
        internalType: "uint256",
        name: "id",
        type: "uint256",
      },
    ],
    name: "getVirtualExternalTransfer",
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
            name: "sender",
            type: "address",
          },
          {
            internalType: "address",
            name: "receiver",
            type: "address",
          },
          {
            internalType: "address",
            name: "source",
            type: "address",
          },
          {
            internalType: "address",
            name: "target",
            type: "address",
          },
          {
            internalType: "uint256",
            name: "amount",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "timestamp",
            type: "uint256",
          },
          {
            internalType: "address",
            name: "provider",
            type: "address",
          },
          {
            internalType: "enum VirtualExternalTransferStatus",
            name: "status",
            type: "uint8",
          },
        ],
        internalType: "struct VirtualExternalTransferRequest",
        name: "",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "getWithdrawLockedBalance",
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
    name: "getWithdrawRequestsBatch",
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
  {
    inputs: [
      {
        internalType: "address",
        name: "user",
        type: "address",
      },
    ],
    name: "getWithdrawableTime",
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
        name: "user",
        type: "address",
      },
      {
        internalType: "bytes32",
        name: "role",
        type: "bytes32",
      },
    ],
    name: "hasRole",
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
        internalType: "address",
        name: "partyB",
        type: "address",
      },
    ],
    name: "isADLEnabled",
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
    inputs: [],
    name: "isAccumulatedFundingActivated",
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
        internalType: "address",
        name: "affiliate",
        type: "address",
      },
    ],
    name: "isAffiliate",
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
        internalType: "address",
        name: "partyB",
        type: "address",
      },
    ],
    name: "isBindable",
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
    inputs: [],
    name: "isCallFromInstantLayer",
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
        internalType: "address",
        name: "partyB",
        type: "address",
      },
    ],
    name: "isCrossPartyB",
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
    inputs: [],
    name: "isCrossPartyBModeActivated",
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
        internalType: "address",
        name: "provider",
        type: "address",
      },
    ],
    name: "isExpressProviderRegistered",
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
    inputs: [],
    name: "isLegacyDeallocateDeprecated",
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
    inputs: [],
    name: "isLegacyFundingDeprecated",
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
        internalType: "address",
        name: "partyA",
        type: "address",
      },
    ],
    name: "isPartyALiquidated",
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
        internalType: "address",
        name: "partyA",
        type: "address",
      },
    ],
    name: "isPartyATakeoverInProgress",
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
        internalType: "address",
        name: "user",
        type: "address",
      },
    ],
    name: "isPartyB",
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
        internalType: "address",
        name: "partyB",
        type: "address",
      },
      {
        internalType: "address",
        name: "partyA",
        type: "address",
      },
    ],
    name: "isPartyBLiquidated",
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
        internalType: "address",
        name: "partyB",
        type: "address",
      },
    ],
    name: "isPartyBOpenPositionsPaused",
    outputs: [
      {
        internalType: "bool",
        name: "isPaused",
        type: "bool",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "account",
        type: "address",
      },
      {
        internalType: "bytes32",
        name: "role",
        type: "bytes32",
      },
    ],
    name: "isRoleAdmin",
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
        internalType: "address",
        name: "user",
        type: "address",
      },
    ],
    name: "isSpeedUpEligible",
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
        internalType: "address",
        name: "user",
        type: "address",
      },
    ],
    name: "isSuspended",
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
        internalType: "address",
        name: "provider",
        type: "address",
      },
    ],
    name: "isVirtualProviderRegistered",
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
        internalType: "address",
        name: "senderPartyB",
        type: "address",
      },
      {
        internalType: "address",
        name: "targetPartyB",
        type: "address",
      },
      {
        internalType: "address",
        name: "partyA",
        type: "address",
      },
    ],
    name: "lastUpnlSettlementTimestamp",
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
    inputs: [],
    name: "liquidationTimeout",
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
    inputs: [],
    name: "liquidatorShare",
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
    inputs: [],
    name: "maxConnectedCounterParty",
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
        name: "partyA",
        type: "address",
      },
    ],
    name: "nonceOfPartyA",
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
        name: "partyB",
        type: "address",
      },
      {
        internalType: "address",
        name: "partyA",
        type: "address",
      },
    ],
    name: "nonceOfPartyB",
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
    inputs: [],
    name: "owner",
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
        name: "partyA",
        type: "address",
      },
    ],
    name: "partyAReimbursement",
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
        name: "partyA",
        type: "address",
      },
    ],
    name: "partyAStats",
    outputs: [
      {
        internalType: "bool",
        name: "",
        type: "bool",
      },
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
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
        name: "partyB",
        type: "address",
      },
      {
        internalType: "address",
        name: "partyA",
        type: "address",
      },
    ],
    name: "partyBLiquidationTimestamp",
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
    inputs: [],
    name: "pauseState",
    outputs: [
      {
        internalType: "bool",
        name: "globalPaused",
        type: "bool",
      },
      {
        internalType: "bool",
        name: "liquidationPaused",
        type: "bool",
      },
      {
        internalType: "bool",
        name: "accountingPaused",
        type: "bool",
      },
      {
        internalType: "bool",
        name: "partyBActionsPaused",
        type: "bool",
      },
      {
        internalType: "bool",
        name: "partyAActionsPaused",
        type: "bool",
      },
      {
        internalType: "bool",
        name: "internalTransferPaused",
        type: "bool",
      },
      {
        internalType: "bool",
        name: "externalTransferPaused",
        type: "bool",
      },
      {
        internalType: "bool",
        name: "emergencyMode",
        type: "bool",
      },
      {
        internalType: "bool",
        name: "partyBOpenPositionsPaused",
        type: "bool",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "pendingOwner",
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
    inputs: [],
    name: "pendingQuotesValidLength",
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
    inputs: [],
    name: "settlementCooldown",
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
    inputs: [],
    name: "unbindCooldown",
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
        internalType: "bytes32",
        name: "hash",
        type: "bytes32",
      },
      {
        components: [
          {
            internalType: "uint256",
            name: "signature",
            type: "uint256",
          },
          {
            internalType: "address",
            name: "owner",
            type: "address",
          },
          {
            internalType: "address",
            name: "nonce",
            type: "address",
          },
        ],
        internalType: "struct IMuonSignatureVerifier.SchnorrSign",
        name: "sign",
        type: "tuple",
      },
      {
        internalType: "bytes",
        name: "gatewaySignature",
        type: "bytes",
      },
    ],
    name: "verifyMuonTSSAndGateway",
    outputs: [],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "user",
        type: "address",
      },
    ],
    name: "withdrawCooldownOf",
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
        name: "partyB",
        type: "address",
      },
      {
        internalType: "address",
        name: "partyA",
        type: "address",
      },
    ],
    name: "allocatedBalanceOfPartyB",
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
        name: "partyB",
        type: "address",
      },
    ],
    name: "balanceInfoOfCrossPartyB",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
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
        name: "partyB",
        type: "address",
      },
    ],
    name: "balanceOfCrossPartyB",
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
        internalType: "uint256",
        name: "forceCloseId",
        type: "uint256",
      },
    ],
    name: "forceCloseDetails",
    outputs: [
      {
        components: [
          {
            internalType: "bytes",
            name: "priceSigId",
            type: "bytes",
          },
          {
            internalType: "uint256",
            name: "quoteId",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "timestamp",
            type: "uint256",
          },
          {
            internalType: "int256",
            name: "partyBAvailableAfterClose",
            type: "int256",
          },
          {
            internalType: "uint256",
            name: "closePrice",
            type: "uint256",
          },
          {
            internalType: "int256",
            name: "upnlPartyB",
            type: "int256",
          },
          {
            internalType: "uint256",
            name: "currentPrice",
            type: "uint256",
          },
          {
            internalType: "enum PartyBForceCloseState",
            name: "partyBState",
            type: "uint8",
          },
          {
            internalType: "bool",
            name: "inProgress",
            type: "bool",
          },
        ],
        internalType: "struct ForceCloseDetail",
        name: "forceCloseStruct",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "address",
        name: "liquidator",
        type: "address",
      },
      {
        indexed: false,
        internalType: "address",
        name: "partyA",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "allocatedBalance",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "int256",
        name: "upnl",
        type: "int256",
      },
      {
        indexed: false,
        internalType: "int256",
        name: "totalUnrealizedLoss",
        type: "int256",
      },
      {
        indexed: false,
        internalType: "bytes",
        name: "liquidationId",
        type: "bytes",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "liquidationBlockNumber",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "liquidationTimestamp",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "liquidationAllocatedBalance",
        type: "uint256",
      },
    ],
    name: "DeferredLiquidatePartyA",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "address",
        name: "liquidator",
        type: "address",
      },
      {
        indexed: false,
        internalType: "address",
        name: "partyA",
        type: "address",
      },
      {
        indexed: false,
        internalType: "bytes",
        name: "liquidationId",
        type: "bytes",
      },
    ],
    name: "DisputeForLiquidation",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "address",
        name: "partyA",
        type: "address",
      },
      {
        indexed: false,
        internalType: "bytes",
        name: "liquidationId",
        type: "bytes",
      },
    ],
    name: "FullyLiquidatedPartyA",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "address",
        name: "liquidator",
        type: "address",
      },
      {
        indexed: false,
        internalType: "address",
        name: "partyA",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "allocatedBalance",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "int256",
        name: "upnl",
        type: "int256",
      },
      {
        indexed: false,
        internalType: "int256",
        name: "totalUnrealizedLoss",
        type: "int256",
      },
      {
        indexed: false,
        internalType: "bytes",
        name: "liquidationId",
        type: "bytes",
      },
    ],
    name: "LiquidatePartyA",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "address",
        name: "liquidator",
        type: "address",
      },
      {
        indexed: false,
        internalType: "address",
        name: "partyA",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256[]",
        name: "quoteIds",
        type: "uint256[]",
      },
      {
        indexed: false,
        internalType: "uint256[]",
        name: "liquidatedAmounts",
        type: "uint256[]",
      },
      {
        indexed: false,
        internalType: "bytes",
        name: "liquidationId",
        type: "bytes",
      },
    ],
    name: "LiquidatePendingPositionsPartyA",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "address",
        name: "liquidator",
        type: "address",
      },
      {
        indexed: false,
        internalType: "address",
        name: "partyA",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256[]",
        name: "quoteIds",
        type: "uint256[]",
      },
      {
        indexed: false,
        internalType: "uint256[]",
        name: "liquidatedAmounts",
        type: "uint256[]",
      },
      {
        indexed: false,
        internalType: "uint256[]",
        name: "closeIds",
        type: "uint256[]",
      },
      {
        indexed: false,
        internalType: "bytes",
        name: "liquidationId",
        type: "bytes",
      },
    ],
    name: "LiquidatePositionsPartyA",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "address",
        name: "liquidator",
        type: "address",
      },
      {
        indexed: false,
        internalType: "address",
        name: "partyA",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256[]",
        name: "quoteIds",
        type: "uint256[]",
      },
      {
        indexed: false,
        internalType: "uint256[]",
        name: "liquidatedAmounts",
        type: "uint256[]",
      },
      {
        indexed: false,
        internalType: "uint256[]",
        name: "closeIds",
        type: "uint256[]",
      },
      {
        indexed: false,
        internalType: "uint256[]",
        name: "averageClosedPrices",
        type: "uint256[]",
      },
      {
        indexed: false,
        internalType: "bytes",
        name: "liquidationId",
        type: "bytes",
      },
    ],
    name: "LiquidatePositionsPartyA",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "address",
        name: "partyA",
        type: "address",
      },
      {
        indexed: false,
        internalType: "bytes",
        name: "liquidationId",
        type: "bytes",
      },
    ],
    name: "LiquidationDisputed",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "partyA",
        type: "address",
      },
      {
        indexed: false,
        internalType: "bytes",
        name: "liquidationId",
        type: "bytes",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "amount",
        type: "uint256",
      },
    ],
    name: "LiquidationEscrowCreated",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "address",
        name: "partyA",
        type: "address",
      },
      {
        indexed: false,
        internalType: "address[]",
        name: "partyBs",
        type: "address[]",
      },
      {
        indexed: false,
        internalType: "int256[]",
        name: "amounts",
        type: "int256[]",
      },
      {
        indexed: false,
        internalType: "bool",
        name: "disputed",
        type: "bool",
      },
      {
        indexed: false,
        internalType: "bytes",
        name: "liquidationId",
        type: "bytes",
      },
    ],
    name: "ResolveLiquidationDispute",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "address",
        name: "liquidator",
        type: "address",
      },
      {
        indexed: false,
        internalType: "address",
        name: "partyA",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256[]",
        name: "symbolIds",
        type: "uint256[]",
      },
      {
        indexed: false,
        internalType: "uint256[]",
        name: "prices",
        type: "uint256[]",
      },
      {
        indexed: false,
        internalType: "bytes",
        name: "liquidationId",
        type: "bytes",
      },
    ],
    name: "SetSymbolsPrices",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "address",
        name: "partyA",
        type: "address",
      },
      {
        indexed: false,
        internalType: "address[]",
        name: "partyBs",
        type: "address[]",
      },
      {
        indexed: false,
        internalType: "int256[]",
        name: "amounts",
        type: "int256[]",
      },
      {
        indexed: false,
        internalType: "bytes",
        name: "liquidationId",
        type: "bytes",
      },
    ],
    name: "SettlePartyALiquidation",
    type: "event",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "partyA",
        type: "address",
      },
      {
        components: [
          {
            internalType: "bytes",
            name: "reqId",
            type: "bytes",
          },
          {
            internalType: "uint256",
            name: "timestamp",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "liquidationBlockNumber",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "liquidationTimestamp",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "liquidationAllocatedBalance",
            type: "uint256",
          },
          {
            internalType: "bytes",
            name: "liquidationId",
            type: "bytes",
          },
          {
            internalType: "int256",
            name: "upnl",
            type: "int256",
          },
          {
            internalType: "int256",
            name: "totalUnrealizedLoss",
            type: "int256",
          },
          {
            internalType: "uint256[]",
            name: "symbolIds",
            type: "uint256[]",
          },
          {
            internalType: "uint256[]",
            name: "prices",
            type: "uint256[]",
          },
          {
            internalType: "bytes",
            name: "gatewaySignature",
            type: "bytes",
          },
          {
            components: [
              {
                internalType: "uint256",
                name: "signature",
                type: "uint256",
              },
              {
                internalType: "address",
                name: "owner",
                type: "address",
              },
              {
                internalType: "address",
                name: "nonce",
                type: "address",
              },
            ],
            internalType: "struct IMuonSignatureVerifier.SchnorrSign",
            name: "sigs",
            type: "tuple",
          },
        ],
        internalType: "struct DeferredLiquidationSig",
        name: "liquidationSig",
        type: "tuple",
      },
    ],
    name: "deferredLiquidatePartyA",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "partyA",
        type: "address",
      },
      {
        components: [
          {
            internalType: "bytes",
            name: "reqId",
            type: "bytes",
          },
          {
            internalType: "uint256",
            name: "timestamp",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "liquidationBlockNumber",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "liquidationTimestamp",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "liquidationAllocatedBalance",
            type: "uint256",
          },
          {
            internalType: "bytes",
            name: "liquidationId",
            type: "bytes",
          },
          {
            internalType: "int256",
            name: "upnl",
            type: "int256",
          },
          {
            internalType: "int256",
            name: "totalUnrealizedLoss",
            type: "int256",
          },
          {
            internalType: "uint256[]",
            name: "symbolIds",
            type: "uint256[]",
          },
          {
            internalType: "uint256[]",
            name: "prices",
            type: "uint256[]",
          },
          {
            internalType: "bytes",
            name: "gatewaySignature",
            type: "bytes",
          },
          {
            components: [
              {
                internalType: "uint256",
                name: "signature",
                type: "uint256",
              },
              {
                internalType: "address",
                name: "owner",
                type: "address",
              },
              {
                internalType: "address",
                name: "nonce",
                type: "address",
              },
            ],
            internalType: "struct IMuonSignatureVerifier.SchnorrSign",
            name: "sigs",
            type: "tuple",
          },
        ],
        internalType: "struct DeferredLiquidationSig",
        name: "liquidationSig",
        type: "tuple",
      },
    ],
    name: "deferredSetSymbolsPrice",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "partyA",
        type: "address",
      },
      {
        components: [
          {
            internalType: "bytes",
            name: "reqId",
            type: "bytes",
          },
          {
            internalType: "uint256",
            name: "timestamp",
            type: "uint256",
          },
          {
            internalType: "bytes",
            name: "liquidationId",
            type: "bytes",
          },
          {
            internalType: "int256",
            name: "upnl",
            type: "int256",
          },
          {
            internalType: "int256",
            name: "totalUnrealizedLoss",
            type: "int256",
          },
          {
            internalType: "uint256[]",
            name: "symbolIds",
            type: "uint256[]",
          },
          {
            internalType: "uint256[]",
            name: "prices",
            type: "uint256[]",
          },
          {
            internalType: "bytes",
            name: "gatewaySignature",
            type: "bytes",
          },
          {
            components: [
              {
                internalType: "uint256",
                name: "signature",
                type: "uint256",
              },
              {
                internalType: "address",
                name: "owner",
                type: "address",
              },
              {
                internalType: "address",
                name: "nonce",
                type: "address",
              },
            ],
            internalType: "struct IMuonSignatureVerifier.SchnorrSign",
            name: "sigs",
            type: "tuple",
          },
        ],
        internalType: "struct LiquidationSig",
        name: "liquidationSig",
        type: "tuple",
      },
    ],
    name: "liquidatePartyA",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "partyA",
        type: "address",
      },
    ],
    name: "liquidatePendingPositionsPartyA",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "partyA",
        type: "address",
      },
      {
        internalType: "uint256[]",
        name: "quoteIds",
        type: "uint256[]",
      },
    ],
    name: "liquidatePositionsPartyA",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "partyA",
        type: "address",
      },
      {
        internalType: "address[]",
        name: "partyBs",
        type: "address[]",
      },
      {
        internalType: "int256[]",
        name: "amounts",
        type: "int256[]",
      },
      {
        internalType: "bool",
        name: "disputed",
        type: "bool",
      },
    ],
    name: "resolveLiquidationDispute",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "partyA",
        type: "address",
      },
      {
        components: [
          {
            internalType: "bytes",
            name: "reqId",
            type: "bytes",
          },
          {
            internalType: "uint256",
            name: "timestamp",
            type: "uint256",
          },
          {
            internalType: "bytes",
            name: "liquidationId",
            type: "bytes",
          },
          {
            internalType: "int256",
            name: "upnl",
            type: "int256",
          },
          {
            internalType: "int256",
            name: "totalUnrealizedLoss",
            type: "int256",
          },
          {
            internalType: "uint256[]",
            name: "symbolIds",
            type: "uint256[]",
          },
          {
            internalType: "uint256[]",
            name: "prices",
            type: "uint256[]",
          },
          {
            internalType: "bytes",
            name: "gatewaySignature",
            type: "bytes",
          },
          {
            components: [
              {
                internalType: "uint256",
                name: "signature",
                type: "uint256",
              },
              {
                internalType: "address",
                name: "owner",
                type: "address",
              },
              {
                internalType: "address",
                name: "nonce",
                type: "address",
              },
            ],
            internalType: "struct IMuonSignatureVerifier.SchnorrSign",
            name: "sigs",
            type: "tuple",
          },
        ],
        internalType: "struct LiquidationSig",
        name: "liquidationSig",
        type: "tuple",
      },
    ],
    name: "setSymbolsPrice",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "partyA",
        type: "address",
      },
      {
        internalType: "address[]",
        name: "partyBs",
        type: "address[]",
      },
    ],
    name: "settlePartyALiquidation",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "quoteId",
        type: "uint256",
      },
    ],
    name: "forceCancelCloseRequest",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "quoteId",
        type: "uint256",
      },
    ],
    name: "forceCancelQuote",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "quoteId",
        type: "uint256",
      },
      {
        components: [
          {
            internalType: "bytes",
            name: "reqId",
            type: "bytes",
          },
          {
            internalType: "uint256",
            name: "timestamp",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "symbolId",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "highest",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "lowest",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "averagePrice",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "startTime",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "endTime",
            type: "uint256",
          },
          {
            internalType: "int256",
            name: "upnlPartyB",
            type: "int256",
          },
          {
            internalType: "int256",
            name: "upnlPartyA",
            type: "int256",
          },
          {
            internalType: "uint256",
            name: "currentPrice",
            type: "uint256",
          },
          {
            internalType: "bytes",
            name: "gatewaySignature",
            type: "bytes",
          },
          {
            components: [
              {
                internalType: "uint256",
                name: "signature",
                type: "uint256",
              },
              {
                internalType: "address",
                name: "owner",
                type: "address",
              },
              {
                internalType: "address",
                name: "nonce",
                type: "address",
              },
            ],
            internalType: "struct IMuonSignatureVerifier.SchnorrSign",
            name: "sigs",
            type: "tuple",
          },
        ],
        internalType: "struct HighLowPriceSig",
        name: "sig",
        type: "tuple",
      },
    ],
    name: "forceClosePosition",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "quoteId",
        type: "uint256",
      },
      {
        components: [
          {
            internalType: "bytes",
            name: "reqId",
            type: "bytes",
          },
          {
            internalType: "uint256",
            name: "timestamp",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "symbolId",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "highest",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "lowest",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "averagePrice",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "startTime",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "endTime",
            type: "uint256",
          },
          {
            internalType: "int256",
            name: "upnlPartyB",
            type: "int256",
          },
          {
            internalType: "int256",
            name: "upnlPartyA",
            type: "int256",
          },
          {
            internalType: "uint256",
            name: "currentPrice",
            type: "uint256",
          },
          {
            internalType: "bytes",
            name: "gatewaySignature",
            type: "bytes",
          },
          {
            components: [
              {
                internalType: "uint256",
                name: "signature",
                type: "uint256",
              },
              {
                internalType: "address",
                name: "owner",
                type: "address",
              },
              {
                internalType: "address",
                name: "nonce",
                type: "address",
              },
            ],
            internalType: "struct IMuonSignatureVerifier.SchnorrSign",
            name: "sigs",
            type: "tuple",
          },
        ],
        internalType: "struct HighLowPriceSig",
        name: "sig",
        type: "tuple",
      },
      {
        components: [
          {
            internalType: "bytes",
            name: "reqId",
            type: "bytes",
          },
          {
            internalType: "uint256",
            name: "timestamp",
            type: "uint256",
          },
          {
            components: [
              {
                internalType: "uint256",
                name: "quoteId",
                type: "uint256",
              },
              {
                internalType: "uint256",
                name: "currentPrice",
                type: "uint256",
              },
              {
                internalType: "uint8",
                name: "partyBUpnlIndex",
                type: "uint8",
              },
            ],
            internalType: "struct QuoteSettlementData[]",
            name: "quotesSettlementsData",
            type: "tuple[]",
          },
          {
            internalType: "int256[]",
            name: "upnlPartyBs",
            type: "int256[]",
          },
          {
            internalType: "int256",
            name: "upnlPartyA",
            type: "int256",
          },
          {
            internalType: "bytes",
            name: "gatewaySignature",
            type: "bytes",
          },
          {
            components: [
              {
                internalType: "uint256",
                name: "signature",
                type: "uint256",
              },
              {
                internalType: "address",
                name: "owner",
                type: "address",
              },
              {
                internalType: "address",
                name: "nonce",
                type: "address",
              },
            ],
            internalType: "struct IMuonSignatureVerifier.SchnorrSign",
            name: "sigs",
            type: "tuple",
          },
        ],
        internalType: "struct SettlementSig",
        name: "settleSig",
        type: "tuple",
      },
      {
        internalType: "uint256[]",
        name: "updatedPrices",
        type: "uint256[]",
      },
    ],
    name: "settleAndForceClosePosition",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "user",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "token",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "amount",
        type: "uint256",
      },
    ],
    name: "PledgeCollateralDeposited",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "user",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "token",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "amount",
        type: "uint256",
      },
    ],
    name: "PledgeWithdrawApproved",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "user",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "token",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "amount",
        type: "uint256",
      },
    ],
    name: "PledgeWithdrawCancelled",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "user",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "token",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "amount",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "address",
        name: "recipient",
        type: "address",
      },
    ],
    name: "PledgeWithdrawRequested",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "user",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "token",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "amount",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "address",
        name: "recipient",
        type: "address",
      },
    ],
    name: "UserSlashed",
    type: "event",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "user",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "amount",
        type: "uint256",
      },
      {
        internalType: "address",
        name: "token",
        type: "address",
      },
    ],
    name: "acceptPledgeWithdraw",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "cancelPledgeWithdraw",
    outputs: [],
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
        internalType: "uint256",
        name: "amount",
        type: "uint256",
      },
    ],
    name: "depositPledge",
    outputs: [],
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
        internalType: "uint256",
        name: "amount",
        type: "uint256",
      },
      {
        internalType: "address",
        name: "recipient",
        type: "address",
      },
    ],
    name: "requestPledgeWithdraw",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "user",
        type: "address",
      },
      {
        internalType: "address",
        name: "token",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "amount",
        type: "uint256",
      },
      {
        internalType: "address",
        name: "recipient",
        type: "address",
      },
    ],
    name: "slashPledge",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "quoteId",
        type: "uint256",
      },
    ],
    name: "acceptCancelCloseRequest",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "quoteId",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "filledAmount",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "closedPrice",
        type: "uint256",
      },
      {
        components: [
          {
            internalType: "bytes",
            name: "reqId",
            type: "bytes",
          },
          {
            internalType: "uint256",
            name: "timestamp",
            type: "uint256",
          },
          {
            internalType: "int256",
            name: "upnlPartyA",
            type: "int256",
          },
          {
            internalType: "int256",
            name: "upnlPartyB",
            type: "int256",
          },
          {
            internalType: "uint256",
            name: "price",
            type: "uint256",
          },
          {
            internalType: "bytes",
            name: "gatewaySignature",
            type: "bytes",
          },
          {
            components: [
              {
                internalType: "uint256",
                name: "signature",
                type: "uint256",
              },
              {
                internalType: "address",
                name: "owner",
                type: "address",
              },
              {
                internalType: "address",
                name: "nonce",
                type: "address",
              },
            ],
            internalType: "struct IMuonSignatureVerifier.SchnorrSign",
            name: "sigs",
            type: "tuple",
          },
        ],
        internalType: "struct PairUpnlAndPriceSig",
        name: "upnlSig",
        type: "tuple",
      },
    ],
    name: "fillCloseRequest",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "quoteId",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "closedPrice",
        type: "uint256",
      },
      {
        components: [
          {
            internalType: "bytes",
            name: "reqId",
            type: "bytes",
          },
          {
            internalType: "uint256",
            name: "timestamp",
            type: "uint256",
          },
          {
            internalType: "int256",
            name: "upnlPartyA",
            type: "int256",
          },
          {
            internalType: "int256",
            name: "upnlPartyB",
            type: "int256",
          },
          {
            internalType: "uint256",
            name: "price",
            type: "uint256",
          },
          {
            internalType: "bytes",
            name: "gatewaySignature",
            type: "bytes",
          },
          {
            components: [
              {
                internalType: "uint256",
                name: "signature",
                type: "uint256",
              },
              {
                internalType: "address",
                name: "owner",
                type: "address",
              },
              {
                internalType: "address",
                name: "nonce",
                type: "address",
              },
            ],
            internalType: "struct IMuonSignatureVerifier.SchnorrSign",
            name: "sigs",
            type: "tuple",
          },
        ],
        internalType: "struct PairUpnlAndPriceSig",
        name: "upnlSig",
        type: "tuple",
      },
    ],
    name: "fillCloseRequestToLiquidation",
    outputs: [
      {
        internalType: "uint256",
        name: "filledAmount",
        type: "uint256",
      },
    ],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "quoteId",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "filledAmount",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "openedPrice",
        type: "uint256",
      },
      {
        components: [
          {
            internalType: "bytes",
            name: "reqId",
            type: "bytes",
          },
          {
            internalType: "uint256",
            name: "timestamp",
            type: "uint256",
          },
          {
            internalType: "int256",
            name: "upnlPartyA",
            type: "int256",
          },
          {
            internalType: "int256",
            name: "upnlPartyB",
            type: "int256",
          },
          {
            internalType: "uint256",
            name: "price",
            type: "uint256",
          },
          {
            internalType: "bytes",
            name: "gatewaySignature",
            type: "bytes",
          },
          {
            components: [
              {
                internalType: "uint256",
                name: "signature",
                type: "uint256",
              },
              {
                internalType: "address",
                name: "owner",
                type: "address",
              },
              {
                internalType: "address",
                name: "nonce",
                type: "address",
              },
            ],
            internalType: "struct IMuonSignatureVerifier.SchnorrSign",
            name: "sigs",
            type: "tuple",
          },
        ],
        internalType: "struct PairUpnlAndPriceSig",
        name: "upnlSig",
        type: "tuple",
      },
    ],
    name: "openPosition",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "address",
        name: "partyB",
        type: "address",
      },
      {
        indexed: false,
        internalType: "address",
        name: "partyA",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "amount",
        type: "uint256",
      },
    ],
    name: "AllocatePartyB",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "address",
        name: "partyB",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "quoteId",
        type: "uint256",
      },
    ],
    name: "LockQuote",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "address",
        name: "partyB",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "quoteId",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "enum QuoteStatus",
        name: "quoteStatus",
        type: "uint8",
      },
    ],
    name: "UnlockQuote",
    type: "event",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "quoteId",
        type: "uint256",
      },
    ],
    name: "acceptCancelRequest",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "quoteId",
        type: "uint256",
      },
      {
        components: [
          {
            internalType: "bytes",
            name: "reqId",
            type: "bytes",
          },
          {
            internalType: "uint256",
            name: "timestamp",
            type: "uint256",
          },
          {
            internalType: "int256",
            name: "upnl",
            type: "int256",
          },
          {
            internalType: "bytes",
            name: "gatewaySignature",
            type: "bytes",
          },
          {
            components: [
              {
                internalType: "uint256",
                name: "signature",
                type: "uint256",
              },
              {
                internalType: "address",
                name: "owner",
                type: "address",
              },
              {
                internalType: "address",
                name: "nonce",
                type: "address",
              },
            ],
            internalType: "struct IMuonSignatureVerifier.SchnorrSign",
            name: "sigs",
            type: "tuple",
          },
        ],
        internalType: "struct SingleUpnlSig",
        name: "upnlSig",
        type: "tuple",
      },
    ],
    name: "lockQuote",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "quoteId",
        type: "uint256",
      },
    ],
    name: "unlockQuote",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "uint256",
        name: "quoteId",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "address",
        name: "partyA",
        type: "address",
      },
      {
        indexed: false,
        internalType: "address",
        name: "partyB",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "filledAmount",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "closedPrice",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "enum QuoteStatus",
        name: "quoteStatus",
        type: "uint8",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "closeId",
        type: "uint256",
      },
    ],
    name: "EmergencyClosePosition",
    type: "event",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "quoteId",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "amount",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "price",
        type: "uint256",
      },
    ],
    name: "adlClose",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "quoteId",
        type: "uint256",
      },
      {
        components: [
          {
            internalType: "bytes",
            name: "reqId",
            type: "bytes",
          },
          {
            internalType: "uint256",
            name: "timestamp",
            type: "uint256",
          },
          {
            internalType: "int256",
            name: "upnlPartyA",
            type: "int256",
          },
          {
            internalType: "int256",
            name: "upnlPartyB",
            type: "int256",
          },
          {
            internalType: "uint256",
            name: "price",
            type: "uint256",
          },
          {
            internalType: "bytes",
            name: "gatewaySignature",
            type: "bytes",
          },
          {
            components: [
              {
                internalType: "uint256",
                name: "signature",
                type: "uint256",
              },
              {
                internalType: "address",
                name: "owner",
                type: "address",
              },
              {
                internalType: "address",
                name: "nonce",
                type: "address",
              },
            ],
            internalType: "struct IMuonSignatureVerifier.SchnorrSign",
            name: "sigs",
            type: "tuple",
          },
        ],
        internalType: "struct PairUpnlAndPriceSig",
        name: "upnlSig",
        type: "tuple",
      },
    ],
    name: "emergencyClosePosition",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256[]",
        name: "expiredQuoteIds",
        type: "uint256[]",
      },
    ],
    name: "expireQuote",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "quoteId",
        type: "uint256",
      },
    ],
    name: "requestToCancelCloseRequest",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "quoteId",
        type: "uint256",
      },
    ],
    name: "requestToCancelQuote",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "quoteId",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "closePrice",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "quantityToClose",
        type: "uint256",
      },
      {
        internalType: "enum OrderType",
        name: "orderType",
        type: "uint8",
      },
      {
        internalType: "uint256",
        name: "deadline",
        type: "uint256",
      },
    ],
    name: "requestToClosePosition",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address[]",
        name: "partyBsWhiteList",
        type: "address[]",
      },
      {
        internalType: "uint256",
        name: "symbolId",
        type: "uint256",
      },
      {
        internalType: "enum PositionType",
        name: "positionType",
        type: "uint8",
      },
      {
        internalType: "enum OrderType",
        name: "orderType",
        type: "uint8",
      },
      {
        internalType: "uint256",
        name: "price",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "quantity",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "cva",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "lf",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "partyAmm",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "partyBmm",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "maxFundingRate",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "deadline",
        type: "uint256",
      },
      {
        components: [
          {
            internalType: "bytes",
            name: "reqId",
            type: "bytes",
          },
          {
            internalType: "uint256",
            name: "timestamp",
            type: "uint256",
          },
          {
            internalType: "int256",
            name: "upnl",
            type: "int256",
          },
          {
            internalType: "uint256",
            name: "price",
            type: "uint256",
          },
          {
            internalType: "bytes",
            name: "gatewaySignature",
            type: "bytes",
          },
          {
            components: [
              {
                internalType: "uint256",
                name: "signature",
                type: "uint256",
              },
              {
                internalType: "address",
                name: "owner",
                type: "address",
              },
              {
                internalType: "address",
                name: "nonce",
                type: "address",
              },
            ],
            internalType: "struct IMuonSignatureVerifier.SchnorrSign",
            name: "sigs",
            type: "tuple",
          },
        ],
        internalType: "struct SingleUpnlAndPriceSig",
        name: "upnlSig",
        type: "tuple",
      },
    ],
    name: "sendQuote",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address[]",
        name: "partyBsWhiteList",
        type: "address[]",
      },
      {
        internalType: "uint256",
        name: "symbolId",
        type: "uint256",
      },
      {
        internalType: "enum PositionType",
        name: "positionType",
        type: "uint8",
      },
      {
        internalType: "enum OrderType",
        name: "orderType",
        type: "uint8",
      },
      {
        internalType: "uint256",
        name: "price",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "quantity",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "cva",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "lf",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "partyAmm",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "partyBmm",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "maxFundingRate",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "deadline",
        type: "uint256",
      },
      {
        internalType: "address",
        name: "affiliate",
        type: "address",
      },
      {
        components: [
          {
            internalType: "bytes",
            name: "reqId",
            type: "bytes",
          },
          {
            internalType: "uint256",
            name: "timestamp",
            type: "uint256",
          },
          {
            internalType: "int256",
            name: "upnl",
            type: "int256",
          },
          {
            internalType: "uint256",
            name: "price",
            type: "uint256",
          },
          {
            internalType: "bytes",
            name: "gatewaySignature",
            type: "bytes",
          },
          {
            components: [
              {
                internalType: "uint256",
                name: "signature",
                type: "uint256",
              },
              {
                internalType: "address",
                name: "owner",
                type: "address",
              },
              {
                internalType: "address",
                name: "nonce",
                type: "address",
              },
            ],
            internalType: "struct IMuonSignatureVerifier.SchnorrSign",
            name: "sigs",
            type: "tuple",
          },
        ],
        internalType: "struct SingleUpnlAndPriceSig",
        name: "upnlSig",
        type: "tuple",
      },
    ],
    name: "sendQuoteWithAffiliate",
    outputs: [
      {
        internalType: "uint256",
        name: "quoteId",
        type: "uint256",
      },
    ],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address[]",
        name: "partyBsWhiteList",
        type: "address[]",
      },
      {
        internalType: "uint256",
        name: "symbolId",
        type: "uint256",
      },
      {
        internalType: "enum PositionType",
        name: "positionType",
        type: "uint8",
      },
      {
        internalType: "enum OrderType",
        name: "orderType",
        type: "uint8",
      },
      {
        internalType: "uint256",
        name: "price",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "quantity",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "cva",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "lf",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "partyAmm",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "partyBmm",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "deadline",
        type: "uint256",
      },
      {
        internalType: "address",
        name: "affiliate",
        type: "address",
      },
      {
        components: [
          {
            internalType: "bytes",
            name: "reqId",
            type: "bytes",
          },
          {
            internalType: "uint256",
            name: "timestamp",
            type: "uint256",
          },
          {
            internalType: "int256",
            name: "upnl",
            type: "int256",
          },
          {
            internalType: "uint256",
            name: "price",
            type: "uint256",
          },
          {
            internalType: "bytes",
            name: "gatewaySignature",
            type: "bytes",
          },
          {
            components: [
              {
                internalType: "uint256",
                name: "signature",
                type: "uint256",
              },
              {
                internalType: "address",
                name: "owner",
                type: "address",
              },
              {
                internalType: "address",
                name: "nonce",
                type: "address",
              },
            ],
            internalType: "struct IMuonSignatureVerifier.SchnorrSign",
            name: "sigs",
            type: "tuple",
          },
        ],
        internalType: "struct SingleUpnlAndPriceSig",
        name: "upnlSig",
        type: "tuple",
      },
      {
        internalType: "bytes",
        name: "data",
        type: "bytes",
      },
    ],
    name: "sendQuoteWithAffiliateAndData",
    outputs: [
      {
        internalType: "uint256",
        name: "quoteId",
        type: "uint256",
      },
    ],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "uint256",
        name: "id",
        type: "uint256",
      },
    ],
    name: "AcceptVirtualExternalTransfer",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "uint256",
        name: "id",
        type: "uint256",
      },
    ],
    name: "CancelVirtualExternalTransfer",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "sender",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "receiver",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "amount",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "address",
        name: "target",
        type: "address",
      },
    ],
    name: "ExternalTransfer",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "uint256",
        name: "id",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "address",
        name: "sender",
        type: "address",
      },
      {
        indexed: false,
        internalType: "address",
        name: "receiver",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "amount",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "address",
        name: "target",
        type: "address",
      },
      {
        indexed: false,
        internalType: "address",
        name: "provider",
        type: "address",
      },
    ],
    name: "InitiateVirtualExternalTransfer",
    type: "event",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "id",
        type: "uint256",
      },
    ],
    name: "acceptVirtualExternalTransfer",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "id",
        type: "uint256",
      },
    ],
    name: "cancelVirtualExternalTransfer",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "receiver",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "amount",
        type: "uint256",
      },
      {
        internalType: "address",
        name: "target",
        type: "address",
      },
    ],
    name: "externalTransfer",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "receiver",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "amount",
        type: "uint256",
      },
      {
        internalType: "address",
        name: "target",
        type: "address",
      },
      {
        internalType: "address",
        name: "virtualProvider",
        type: "address",
      },
    ],
    name: "virtualExternalTransfer",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "address",
        name: "partyA",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "time",
        type: "uint256",
      },
    ],
    name: "ActivateInstantActionMode",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "address",
        name: "partyA",
        type: "address",
      },
      {
        indexed: false,
        internalType: "address",
        name: "partyB",
        type: "address",
      },
    ],
    name: "BindToPartyB",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "address",
        name: "partyA",
        type: "address",
      },
    ],
    name: "CancelUnbindRequest",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "address",
        name: "partyA",
        type: "address",
      },
      {
        indexed: false,
        internalType: "address",
        name: "partyB",
        type: "address",
      },
    ],
    name: "CompleteUnbindRequest",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "address",
        name: "partyA",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "time",
        type: "uint256",
      },
    ],
    name: "DeactivateInstantActionMode",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "address",
        name: "partyA",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "time",
        type: "uint256",
      },
    ],
    name: "ProposeToDeactivateInstantActionMode",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "address",
        name: "partyA",
        type: "address",
      },
    ],
    name: "RequestToUnbindFromPartyB",
    type: "event",
  },
  {
    inputs: [],
    name: "activateInstantActionMode",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "partyB",
        type: "address",
      },
    ],
    name: "bindToPartyB",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "cancelUnbindRequest",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "partyA",
        type: "address",
      },
    ],
    name: "completeUnbindRequest",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "deactivateInstantActionMode",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "proposeToDeactivateInstantActionMode",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "requestToUnbindFromPartyB",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "address",
        name: "partyA",
        type: "address",
      },
      {
        indexed: false,
        internalType: "address",
        name: "partyB",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256[]",
        name: "quoteIds",
        type: "uint256[]",
      },
      {
        indexed: false,
        internalType: "address",
        name: "sender",
        type: "address",
      },
    ],
    name: "ChargeAccumulatedFundingFee",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "address",
        name: "partyB",
        type: "address",
      },
      {
        indexed: false,
        internalType: "address",
        name: "partyA",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256[]",
        name: "quoteIds",
        type: "uint256[]",
      },
      {
        indexed: false,
        internalType: "int256[]",
        name: "rates",
        type: "int256[]",
      },
    ],
    name: "ChargeFundingRate",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "uint256[]",
        name: "symbolIds",
        type: "uint256[]",
      },
      {
        indexed: false,
        internalType: "uint256[]",
        name: "durations",
        type: "uint256[]",
      },
      {
        indexed: false,
        internalType: "address",
        name: "partyB",
        type: "address",
      },
    ],
    name: "SetEpochDuration",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "uint256[]",
        name: "symbolIds",
        type: "uint256[]",
      },
      {
        indexed: false,
        internalType: "int256[]",
        name: "fees",
        type: "int256[]",
      },
      {
        indexed: false,
        internalType: "int256[]",
        name: "marketPrices",
        type: "int256[]",
      },
      {
        indexed: false,
        internalType: "address",
        name: "partyB",
        type: "address",
      },
    ],
    name: "SetLongFundingFee",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "uint256[]",
        name: "symbolIds",
        type: "uint256[]",
      },
      {
        indexed: false,
        internalType: "int256[]",
        name: "fees",
        type: "int256[]",
      },
      {
        indexed: false,
        internalType: "int256[]",
        name: "marketPrices",
        type: "int256[]",
      },
      {
        indexed: false,
        internalType: "address",
        name: "partyB",
        type: "address",
      },
    ],
    name: "SetShortFundingFee",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "uint256[]",
        name: "symbolIds",
        type: "uint256[]",
      },
      {
        indexed: false,
        internalType: "int256[]",
        name: "longRates",
        type: "int256[]",
      },
      {
        indexed: false,
        internalType: "int256[]",
        name: "shortRates",
        type: "int256[]",
      },
      {
        indexed: false,
        internalType: "int256[]",
        name: "marketPrices",
        type: "int256[]",
      },
      {
        indexed: false,
        internalType: "address",
        name: "partyB",
        type: "address",
      },
    ],
    name: "UpdateAccumulatedFundingFee",
    type: "event",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "partyA",
        type: "address",
      },
      {
        internalType: "address",
        name: "partyB",
        type: "address",
      },
      {
        internalType: "uint256[]",
        name: "quoteIds",
        type: "uint256[]",
      },
      {
        components: [
          {
            internalType: "bytes",
            name: "reqId",
            type: "bytes",
          },
          {
            internalType: "uint256",
            name: "timestamp",
            type: "uint256",
          },
          {
            internalType: "int256",
            name: "upnlPartyA",
            type: "int256",
          },
          {
            internalType: "int256",
            name: "upnlPartyB",
            type: "int256",
          },
          {
            internalType: "bytes",
            name: "gatewaySignature",
            type: "bytes",
          },
          {
            components: [
              {
                internalType: "uint256",
                name: "signature",
                type: "uint256",
              },
              {
                internalType: "address",
                name: "owner",
                type: "address",
              },
              {
                internalType: "address",
                name: "nonce",
                type: "address",
              },
            ],
            internalType: "struct IMuonSignatureVerifier.SchnorrSign",
            name: "sigs",
            type: "tuple",
          },
        ],
        internalType: "struct PairUpnlSig",
        name: "upnlSig",
        type: "tuple",
      },
    ],
    name: "chargeAccumulatedFundingFee",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "partyA",
        type: "address",
      },
      {
        internalType: "uint256[]",
        name: "quoteIds",
        type: "uint256[]",
      },
      {
        internalType: "int256[]",
        name: "rates",
        type: "int256[]",
      },
      {
        components: [
          {
            internalType: "bytes",
            name: "reqId",
            type: "bytes",
          },
          {
            internalType: "uint256",
            name: "timestamp",
            type: "uint256",
          },
          {
            internalType: "int256",
            name: "upnlPartyA",
            type: "int256",
          },
          {
            internalType: "int256",
            name: "upnlPartyB",
            type: "int256",
          },
          {
            internalType: "bytes",
            name: "gatewaySignature",
            type: "bytes",
          },
          {
            components: [
              {
                internalType: "uint256",
                name: "signature",
                type: "uint256",
              },
              {
                internalType: "address",
                name: "owner",
                type: "address",
              },
              {
                internalType: "address",
                name: "nonce",
                type: "address",
              },
            ],
            internalType: "struct IMuonSignatureVerifier.SchnorrSign",
            name: "sigs",
            type: "tuple",
          },
        ],
        internalType: "struct PairUpnlSig",
        name: "upnlSig",
        type: "tuple",
      },
    ],
    name: "chargeFundingRate",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256[]",
        name: "symbolIds",
        type: "uint256[]",
      },
      {
        internalType: "uint256[]",
        name: "durations",
        type: "uint256[]",
      },
    ],
    name: "setEpochDurations",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256[]",
        name: "symbolIds",
        type: "uint256[]",
      },
      {
        internalType: "int256[]",
        name: "longFees",
        type: "int256[]",
      },
      {
        internalType: "int256[]",
        name: "shortFees",
        type: "int256[]",
      },
      {
        internalType: "int256[]",
        name: "marketPrices",
        type: "int256[]",
      },
    ],
    name: "setFundingFee",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256[]",
        name: "symbolIds",
        type: "uint256[]",
      },
      {
        internalType: "int256[]",
        name: "longFees",
        type: "int256[]",
      },
      {
        internalType: "int256[]",
        name: "marketPrices",
        type: "int256[]",
      },
    ],
    name: "setLongFundingFee",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256[]",
        name: "symbolIds",
        type: "uint256[]",
      },
      {
        internalType: "int256[]",
        name: "shortFees",
        type: "int256[]",
      },
      {
        internalType: "int256[]",
        name: "marketPrices",
        type: "int256[]",
      },
    ],
    name: "setShortFundingFee",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256[]",
        name: "symbolIds",
        type: "uint256[]",
      },
      {
        internalType: "int256[]",
        name: "longRates",
        type: "int256[]",
      },
      {
        internalType: "int256[]",
        name: "shortRates",
        type: "int256[]",
      },
      {
        internalType: "int256[]",
        name: "marketPrices",
        type: "int256[]",
      },
    ],
    name: "updateAccumulatedFundingFee",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "partyB",
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
    name: "getActivePositionsFilteredByPartyB",
    outputs: [
      {
        components: [
          {
            internalType: "uint256",
            name: "id",
            type: "uint256",
          },
          {
            internalType: "address[]",
            name: "partyBsWhiteList",
            type: "address[]",
          },
          {
            internalType: "uint256",
            name: "symbolId",
            type: "uint256",
          },
          {
            internalType: "enum PositionType",
            name: "positionType",
            type: "uint8",
          },
          {
            internalType: "enum OrderType",
            name: "orderType",
            type: "uint8",
          },
          {
            internalType: "uint256",
            name: "openedPrice",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "initialOpenedPrice",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "requestedOpenPrice",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "marketPrice",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "quantity",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "closedAmount",
            type: "uint256",
          },
          {
            components: [
              {
                internalType: "uint256",
                name: "cva",
                type: "uint256",
              },
              {
                internalType: "uint256",
                name: "lf",
                type: "uint256",
              },
              {
                internalType: "uint256",
                name: "partyAmm",
                type: "uint256",
              },
              {
                internalType: "uint256",
                name: "partyBmm",
                type: "uint256",
              },
            ],
            internalType: "struct LockedValues",
            name: "initialLockedValues",
            type: "tuple",
          },
          {
            components: [
              {
                internalType: "uint256",
                name: "cva",
                type: "uint256",
              },
              {
                internalType: "uint256",
                name: "lf",
                type: "uint256",
              },
              {
                internalType: "uint256",
                name: "partyAmm",
                type: "uint256",
              },
              {
                internalType: "uint256",
                name: "partyBmm",
                type: "uint256",
              },
            ],
            internalType: "struct LockedValues",
            name: "lockedValues",
            type: "tuple",
          },
          {
            internalType: "uint256",
            name: "maxFundingRate",
            type: "uint256",
          },
          {
            internalType: "address",
            name: "partyA",
            type: "address",
          },
          {
            internalType: "address",
            name: "partyB",
            type: "address",
          },
          {
            internalType: "enum QuoteStatus",
            name: "quoteStatus",
            type: "uint8",
          },
          {
            internalType: "uint256",
            name: "avgClosedPrice",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "requestedClosePrice",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "quantityToClose",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "parentId",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "createTimestamp",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "statusModifyTimestamp",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "lastFundingPaymentTimestamp",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "deadline",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "tradingFee",
            type: "uint256",
          },
          {
            internalType: "address",
            name: "affiliate",
            type: "address",
          },
          {
            internalType: "int256",
            name: "accumulatedPaidFunding",
            type: "int256",
          },
          {
            internalType: "uint256",
            name: "closeFee",
            type: "uint256",
          },
          {
            internalType: "bytes",
            name: "data",
            type: "bytes",
          },
        ],
        internalType: "struct Quote[]",
        name: "",
        type: "tuple[]",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "getNextQuoteId",
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
        name: "partyB",
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
    name: "getOpenPositionsFilteredByPartyB",
    outputs: [
      {
        components: [
          {
            internalType: "uint256",
            name: "id",
            type: "uint256",
          },
          {
            internalType: "address[]",
            name: "partyBsWhiteList",
            type: "address[]",
          },
          {
            internalType: "uint256",
            name: "symbolId",
            type: "uint256",
          },
          {
            internalType: "enum PositionType",
            name: "positionType",
            type: "uint8",
          },
          {
            internalType: "enum OrderType",
            name: "orderType",
            type: "uint8",
          },
          {
            internalType: "uint256",
            name: "openedPrice",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "initialOpenedPrice",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "requestedOpenPrice",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "marketPrice",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "quantity",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "closedAmount",
            type: "uint256",
          },
          {
            components: [
              {
                internalType: "uint256",
                name: "cva",
                type: "uint256",
              },
              {
                internalType: "uint256",
                name: "lf",
                type: "uint256",
              },
              {
                internalType: "uint256",
                name: "partyAmm",
                type: "uint256",
              },
              {
                internalType: "uint256",
                name: "partyBmm",
                type: "uint256",
              },
            ],
            internalType: "struct LockedValues",
            name: "initialLockedValues",
            type: "tuple",
          },
          {
            components: [
              {
                internalType: "uint256",
                name: "cva",
                type: "uint256",
              },
              {
                internalType: "uint256",
                name: "lf",
                type: "uint256",
              },
              {
                internalType: "uint256",
                name: "partyAmm",
                type: "uint256",
              },
              {
                internalType: "uint256",
                name: "partyBmm",
                type: "uint256",
              },
            ],
            internalType: "struct LockedValues",
            name: "lockedValues",
            type: "tuple",
          },
          {
            internalType: "uint256",
            name: "maxFundingRate",
            type: "uint256",
          },
          {
            internalType: "address",
            name: "partyA",
            type: "address",
          },
          {
            internalType: "address",
            name: "partyB",
            type: "address",
          },
          {
            internalType: "enum QuoteStatus",
            name: "quoteStatus",
            type: "uint8",
          },
          {
            internalType: "uint256",
            name: "avgClosedPrice",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "requestedClosePrice",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "quantityToClose",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "parentId",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "createTimestamp",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "statusModifyTimestamp",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "lastFundingPaymentTimestamp",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "deadline",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "tradingFee",
            type: "uint256",
          },
          {
            internalType: "address",
            name: "affiliate",
            type: "address",
          },
          {
            internalType: "int256",
            name: "accumulatedPaidFunding",
            type: "int256",
          },
          {
            internalType: "uint256",
            name: "closeFee",
            type: "uint256",
          },
          {
            internalType: "bytes",
            name: "data",
            type: "bytes",
          },
        ],
        internalType: "struct Quote[]",
        name: "",
        type: "tuple[]",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "partyA",
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
    name: "getPartyAOpenPositions",
    outputs: [
      {
        components: [
          {
            internalType: "uint256",
            name: "id",
            type: "uint256",
          },
          {
            internalType: "address[]",
            name: "partyBsWhiteList",
            type: "address[]",
          },
          {
            internalType: "uint256",
            name: "symbolId",
            type: "uint256",
          },
          {
            internalType: "enum PositionType",
            name: "positionType",
            type: "uint8",
          },
          {
            internalType: "enum OrderType",
            name: "orderType",
            type: "uint8",
          },
          {
            internalType: "uint256",
            name: "openedPrice",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "initialOpenedPrice",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "requestedOpenPrice",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "marketPrice",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "quantity",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "closedAmount",
            type: "uint256",
          },
          {
            components: [
              {
                internalType: "uint256",
                name: "cva",
                type: "uint256",
              },
              {
                internalType: "uint256",
                name: "lf",
                type: "uint256",
              },
              {
                internalType: "uint256",
                name: "partyAmm",
                type: "uint256",
              },
              {
                internalType: "uint256",
                name: "partyBmm",
                type: "uint256",
              },
            ],
            internalType: "struct LockedValues",
            name: "initialLockedValues",
            type: "tuple",
          },
          {
            components: [
              {
                internalType: "uint256",
                name: "cva",
                type: "uint256",
              },
              {
                internalType: "uint256",
                name: "lf",
                type: "uint256",
              },
              {
                internalType: "uint256",
                name: "partyAmm",
                type: "uint256",
              },
              {
                internalType: "uint256",
                name: "partyBmm",
                type: "uint256",
              },
            ],
            internalType: "struct LockedValues",
            name: "lockedValues",
            type: "tuple",
          },
          {
            internalType: "uint256",
            name: "maxFundingRate",
            type: "uint256",
          },
          {
            internalType: "address",
            name: "partyA",
            type: "address",
          },
          {
            internalType: "address",
            name: "partyB",
            type: "address",
          },
          {
            internalType: "enum QuoteStatus",
            name: "quoteStatus",
            type: "uint8",
          },
          {
            internalType: "uint256",
            name: "avgClosedPrice",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "requestedClosePrice",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "quantityToClose",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "parentId",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "createTimestamp",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "statusModifyTimestamp",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "lastFundingPaymentTimestamp",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "deadline",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "tradingFee",
            type: "uint256",
          },
          {
            internalType: "address",
            name: "affiliate",
            type: "address",
          },
          {
            internalType: "int256",
            name: "accumulatedPaidFunding",
            type: "int256",
          },
          {
            internalType: "uint256",
            name: "closeFee",
            type: "uint256",
          },
          {
            internalType: "bytes",
            name: "data",
            type: "bytes",
          },
        ],
        internalType: "struct Quote[]",
        name: "",
        type: "tuple[]",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "partyA",
        type: "address",
      },
    ],
    name: "getPartyAPendingQuotes",
    outputs: [
      {
        internalType: "uint256[]",
        name: "",
        type: "uint256[]",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "partyB",
        type: "address",
      },
      {
        internalType: "address",
        name: "partyA",
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
    name: "getPartyBOpenPositions",
    outputs: [
      {
        components: [
          {
            internalType: "uint256",
            name: "id",
            type: "uint256",
          },
          {
            internalType: "address[]",
            name: "partyBsWhiteList",
            type: "address[]",
          },
          {
            internalType: "uint256",
            name: "symbolId",
            type: "uint256",
          },
          {
            internalType: "enum PositionType",
            name: "positionType",
            type: "uint8",
          },
          {
            internalType: "enum OrderType",
            name: "orderType",
            type: "uint8",
          },
          {
            internalType: "uint256",
            name: "openedPrice",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "initialOpenedPrice",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "requestedOpenPrice",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "marketPrice",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "quantity",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "closedAmount",
            type: "uint256",
          },
          {
            components: [
              {
                internalType: "uint256",
                name: "cva",
                type: "uint256",
              },
              {
                internalType: "uint256",
                name: "lf",
                type: "uint256",
              },
              {
                internalType: "uint256",
                name: "partyAmm",
                type: "uint256",
              },
              {
                internalType: "uint256",
                name: "partyBmm",
                type: "uint256",
              },
            ],
            internalType: "struct LockedValues",
            name: "initialLockedValues",
            type: "tuple",
          },
          {
            components: [
              {
                internalType: "uint256",
                name: "cva",
                type: "uint256",
              },
              {
                internalType: "uint256",
                name: "lf",
                type: "uint256",
              },
              {
                internalType: "uint256",
                name: "partyAmm",
                type: "uint256",
              },
              {
                internalType: "uint256",
                name: "partyBmm",
                type: "uint256",
              },
            ],
            internalType: "struct LockedValues",
            name: "lockedValues",
            type: "tuple",
          },
          {
            internalType: "uint256",
            name: "maxFundingRate",
            type: "uint256",
          },
          {
            internalType: "address",
            name: "partyA",
            type: "address",
          },
          {
            internalType: "address",
            name: "partyB",
            type: "address",
          },
          {
            internalType: "enum QuoteStatus",
            name: "quoteStatus",
            type: "uint8",
          },
          {
            internalType: "uint256",
            name: "avgClosedPrice",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "requestedClosePrice",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "quantityToClose",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "parentId",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "createTimestamp",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "statusModifyTimestamp",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "lastFundingPaymentTimestamp",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "deadline",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "tradingFee",
            type: "uint256",
          },
          {
            internalType: "address",
            name: "affiliate",
            type: "address",
          },
          {
            internalType: "int256",
            name: "accumulatedPaidFunding",
            type: "int256",
          },
          {
            internalType: "uint256",
            name: "closeFee",
            type: "uint256",
          },
          {
            internalType: "bytes",
            name: "data",
            type: "bytes",
          },
        ],
        internalType: "struct Quote[]",
        name: "",
        type: "tuple[]",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "partyB",
        type: "address",
      },
      {
        internalType: "address",
        name: "partyA",
        type: "address",
      },
    ],
    name: "getPartyBPendingQuotes",
    outputs: [
      {
        internalType: "uint256[]",
        name: "",
        type: "uint256[]",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "partyB",
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
    name: "getPositionsFilteredByPartyB",
    outputs: [
      {
        components: [
          {
            internalType: "uint256",
            name: "id",
            type: "uint256",
          },
          {
            internalType: "address[]",
            name: "partyBsWhiteList",
            type: "address[]",
          },
          {
            internalType: "uint256",
            name: "symbolId",
            type: "uint256",
          },
          {
            internalType: "enum PositionType",
            name: "positionType",
            type: "uint8",
          },
          {
            internalType: "enum OrderType",
            name: "orderType",
            type: "uint8",
          },
          {
            internalType: "uint256",
            name: "openedPrice",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "initialOpenedPrice",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "requestedOpenPrice",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "marketPrice",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "quantity",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "closedAmount",
            type: "uint256",
          },
          {
            components: [
              {
                internalType: "uint256",
                name: "cva",
                type: "uint256",
              },
              {
                internalType: "uint256",
                name: "lf",
                type: "uint256",
              },
              {
                internalType: "uint256",
                name: "partyAmm",
                type: "uint256",
              },
              {
                internalType: "uint256",
                name: "partyBmm",
                type: "uint256",
              },
            ],
            internalType: "struct LockedValues",
            name: "initialLockedValues",
            type: "tuple",
          },
          {
            components: [
              {
                internalType: "uint256",
                name: "cva",
                type: "uint256",
              },
              {
                internalType: "uint256",
                name: "lf",
                type: "uint256",
              },
              {
                internalType: "uint256",
                name: "partyAmm",
                type: "uint256",
              },
              {
                internalType: "uint256",
                name: "partyBmm",
                type: "uint256",
              },
            ],
            internalType: "struct LockedValues",
            name: "lockedValues",
            type: "tuple",
          },
          {
            internalType: "uint256",
            name: "maxFundingRate",
            type: "uint256",
          },
          {
            internalType: "address",
            name: "partyA",
            type: "address",
          },
          {
            internalType: "address",
            name: "partyB",
            type: "address",
          },
          {
            internalType: "enum QuoteStatus",
            name: "quoteStatus",
            type: "uint8",
          },
          {
            internalType: "uint256",
            name: "avgClosedPrice",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "requestedClosePrice",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "quantityToClose",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "parentId",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "createTimestamp",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "statusModifyTimestamp",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "lastFundingPaymentTimestamp",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "deadline",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "tradingFee",
            type: "uint256",
          },
          {
            internalType: "address",
            name: "affiliate",
            type: "address",
          },
          {
            internalType: "int256",
            name: "accumulatedPaidFunding",
            type: "int256",
          },
          {
            internalType: "uint256",
            name: "closeFee",
            type: "uint256",
          },
          {
            internalType: "bytes",
            name: "data",
            type: "bytes",
          },
        ],
        internalType: "struct Quote[]",
        name: "",
        type: "tuple[]",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "quoteId",
        type: "uint256",
      },
    ],
    name: "getQuote",
    outputs: [
      {
        components: [
          {
            internalType: "uint256",
            name: "id",
            type: "uint256",
          },
          {
            internalType: "address[]",
            name: "partyBsWhiteList",
            type: "address[]",
          },
          {
            internalType: "uint256",
            name: "symbolId",
            type: "uint256",
          },
          {
            internalType: "enum PositionType",
            name: "positionType",
            type: "uint8",
          },
          {
            internalType: "enum OrderType",
            name: "orderType",
            type: "uint8",
          },
          {
            internalType: "uint256",
            name: "openedPrice",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "initialOpenedPrice",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "requestedOpenPrice",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "marketPrice",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "quantity",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "closedAmount",
            type: "uint256",
          },
          {
            components: [
              {
                internalType: "uint256",
                name: "cva",
                type: "uint256",
              },
              {
                internalType: "uint256",
                name: "lf",
                type: "uint256",
              },
              {
                internalType: "uint256",
                name: "partyAmm",
                type: "uint256",
              },
              {
                internalType: "uint256",
                name: "partyBmm",
                type: "uint256",
              },
            ],
            internalType: "struct LockedValues",
            name: "initialLockedValues",
            type: "tuple",
          },
          {
            components: [
              {
                internalType: "uint256",
                name: "cva",
                type: "uint256",
              },
              {
                internalType: "uint256",
                name: "lf",
                type: "uint256",
              },
              {
                internalType: "uint256",
                name: "partyAmm",
                type: "uint256",
              },
              {
                internalType: "uint256",
                name: "partyBmm",
                type: "uint256",
              },
            ],
            internalType: "struct LockedValues",
            name: "lockedValues",
            type: "tuple",
          },
          {
            internalType: "uint256",
            name: "maxFundingRate",
            type: "uint256",
          },
          {
            internalType: "address",
            name: "partyA",
            type: "address",
          },
          {
            internalType: "address",
            name: "partyB",
            type: "address",
          },
          {
            internalType: "enum QuoteStatus",
            name: "quoteStatus",
            type: "uint8",
          },
          {
            internalType: "uint256",
            name: "avgClosedPrice",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "requestedClosePrice",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "quantityToClose",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "parentId",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "createTimestamp",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "statusModifyTimestamp",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "lastFundingPaymentTimestamp",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "deadline",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "tradingFee",
            type: "uint256",
          },
          {
            internalType: "address",
            name: "affiliate",
            type: "address",
          },
          {
            internalType: "int256",
            name: "accumulatedPaidFunding",
            type: "int256",
          },
          {
            internalType: "uint256",
            name: "closeFee",
            type: "uint256",
          },
          {
            internalType: "bytes",
            name: "data",
            type: "bytes",
          },
        ],
        internalType: "struct Quote",
        name: "",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "quoteId",
        type: "uint256",
      },
    ],
    name: "getQuoteCloseId",
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
        internalType: "uint256[]",
        name: "quoteIds",
        type: "uint256[]",
      },
    ],
    name: "getQuoteFundingDebts",
    outputs: [
      {
        internalType: "int256[]",
        name: "debts",
        type: "int256[]",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "partyA",
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
    name: "getQuotes",
    outputs: [
      {
        components: [
          {
            internalType: "uint256",
            name: "id",
            type: "uint256",
          },
          {
            internalType: "address[]",
            name: "partyBsWhiteList",
            type: "address[]",
          },
          {
            internalType: "uint256",
            name: "symbolId",
            type: "uint256",
          },
          {
            internalType: "enum PositionType",
            name: "positionType",
            type: "uint8",
          },
          {
            internalType: "enum OrderType",
            name: "orderType",
            type: "uint8",
          },
          {
            internalType: "uint256",
            name: "openedPrice",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "initialOpenedPrice",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "requestedOpenPrice",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "marketPrice",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "quantity",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "closedAmount",
            type: "uint256",
          },
          {
            components: [
              {
                internalType: "uint256",
                name: "cva",
                type: "uint256",
              },
              {
                internalType: "uint256",
                name: "lf",
                type: "uint256",
              },
              {
                internalType: "uint256",
                name: "partyAmm",
                type: "uint256",
              },
              {
                internalType: "uint256",
                name: "partyBmm",
                type: "uint256",
              },
            ],
            internalType: "struct LockedValues",
            name: "initialLockedValues",
            type: "tuple",
          },
          {
            components: [
              {
                internalType: "uint256",
                name: "cva",
                type: "uint256",
              },
              {
                internalType: "uint256",
                name: "lf",
                type: "uint256",
              },
              {
                internalType: "uint256",
                name: "partyAmm",
                type: "uint256",
              },
              {
                internalType: "uint256",
                name: "partyBmm",
                type: "uint256",
              },
            ],
            internalType: "struct LockedValues",
            name: "lockedValues",
            type: "tuple",
          },
          {
            internalType: "uint256",
            name: "maxFundingRate",
            type: "uint256",
          },
          {
            internalType: "address",
            name: "partyA",
            type: "address",
          },
          {
            internalType: "address",
            name: "partyB",
            type: "address",
          },
          {
            internalType: "enum QuoteStatus",
            name: "quoteStatus",
            type: "uint8",
          },
          {
            internalType: "uint256",
            name: "avgClosedPrice",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "requestedClosePrice",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "quantityToClose",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "parentId",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "createTimestamp",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "statusModifyTimestamp",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "lastFundingPaymentTimestamp",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "deadline",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "tradingFee",
            type: "uint256",
          },
          {
            internalType: "address",
            name: "affiliate",
            type: "address",
          },
          {
            internalType: "int256",
            name: "accumulatedPaidFunding",
            type: "int256",
          },
          {
            internalType: "uint256",
            name: "closeFee",
            type: "uint256",
          },
          {
            internalType: "bytes",
            name: "data",
            type: "bytes",
          },
        ],
        internalType: "struct Quote[]",
        name: "",
        type: "tuple[]",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "quoteId",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "size",
        type: "uint256",
      },
    ],
    name: "getQuotesByParent",
    outputs: [
      {
        components: [
          {
            internalType: "uint256",
            name: "id",
            type: "uint256",
          },
          {
            internalType: "address[]",
            name: "partyBsWhiteList",
            type: "address[]",
          },
          {
            internalType: "uint256",
            name: "symbolId",
            type: "uint256",
          },
          {
            internalType: "enum PositionType",
            name: "positionType",
            type: "uint8",
          },
          {
            internalType: "enum OrderType",
            name: "orderType",
            type: "uint8",
          },
          {
            internalType: "uint256",
            name: "openedPrice",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "initialOpenedPrice",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "requestedOpenPrice",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "marketPrice",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "quantity",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "closedAmount",
            type: "uint256",
          },
          {
            components: [
              {
                internalType: "uint256",
                name: "cva",
                type: "uint256",
              },
              {
                internalType: "uint256",
                name: "lf",
                type: "uint256",
              },
              {
                internalType: "uint256",
                name: "partyAmm",
                type: "uint256",
              },
              {
                internalType: "uint256",
                name: "partyBmm",
                type: "uint256",
              },
            ],
            internalType: "struct LockedValues",
            name: "initialLockedValues",
            type: "tuple",
          },
          {
            components: [
              {
                internalType: "uint256",
                name: "cva",
                type: "uint256",
              },
              {
                internalType: "uint256",
                name: "lf",
                type: "uint256",
              },
              {
                internalType: "uint256",
                name: "partyAmm",
                type: "uint256",
              },
              {
                internalType: "uint256",
                name: "partyBmm",
                type: "uint256",
              },
            ],
            internalType: "struct LockedValues",
            name: "lockedValues",
            type: "tuple",
          },
          {
            internalType: "uint256",
            name: "maxFundingRate",
            type: "uint256",
          },
          {
            internalType: "address",
            name: "partyA",
            type: "address",
          },
          {
            internalType: "address",
            name: "partyB",
            type: "address",
          },
          {
            internalType: "enum QuoteStatus",
            name: "quoteStatus",
            type: "uint8",
          },
          {
            internalType: "uint256",
            name: "avgClosedPrice",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "requestedClosePrice",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "quantityToClose",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "parentId",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "createTimestamp",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "statusModifyTimestamp",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "lastFundingPaymentTimestamp",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "deadline",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "tradingFee",
            type: "uint256",
          },
          {
            internalType: "address",
            name: "affiliate",
            type: "address",
          },
          {
            internalType: "int256",
            name: "accumulatedPaidFunding",
            type: "int256",
          },
          {
            internalType: "uint256",
            name: "closeFee",
            type: "uint256",
          },
          {
            internalType: "bytes",
            name: "data",
            type: "bytes",
          },
        ],
        internalType: "struct Quote[]",
        name: "",
        type: "tuple[]",
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
            internalType: "uint256",
            name: "size",
            type: "uint256",
          },
          {
            components: [
              {
                internalType: "uint256",
                name: "offset",
                type: "uint256",
              },
              {
                internalType: "uint256",
                name: "bitmap",
                type: "uint256",
              },
            ],
            internalType: "struct IViewFacetQuote.BitmapElement[]",
            name: "elements",
            type: "tuple[]",
          },
        ],
        internalType: "struct IViewFacetQuote.Bitmap",
        name: "bitmap",
        type: "tuple",
      },
      {
        internalType: "uint256",
        name: "gasNeededForReturn",
        type: "uint256",
      },
    ],
    name: "getQuotesWithBitmap",
    outputs: [
      {
        components: [
          {
            internalType: "uint256",
            name: "id",
            type: "uint256",
          },
          {
            internalType: "address[]",
            name: "partyBsWhiteList",
            type: "address[]",
          },
          {
            internalType: "uint256",
            name: "symbolId",
            type: "uint256",
          },
          {
            internalType: "enum PositionType",
            name: "positionType",
            type: "uint8",
          },
          {
            internalType: "enum OrderType",
            name: "orderType",
            type: "uint8",
          },
          {
            internalType: "uint256",
            name: "openedPrice",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "initialOpenedPrice",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "requestedOpenPrice",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "marketPrice",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "quantity",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "closedAmount",
            type: "uint256",
          },
          {
            components: [
              {
                internalType: "uint256",
                name: "cva",
                type: "uint256",
              },
              {
                internalType: "uint256",
                name: "lf",
                type: "uint256",
              },
              {
                internalType: "uint256",
                name: "partyAmm",
                type: "uint256",
              },
              {
                internalType: "uint256",
                name: "partyBmm",
                type: "uint256",
              },
            ],
            internalType: "struct LockedValues",
            name: "initialLockedValues",
            type: "tuple",
          },
          {
            components: [
              {
                internalType: "uint256",
                name: "cva",
                type: "uint256",
              },
              {
                internalType: "uint256",
                name: "lf",
                type: "uint256",
              },
              {
                internalType: "uint256",
                name: "partyAmm",
                type: "uint256",
              },
              {
                internalType: "uint256",
                name: "partyBmm",
                type: "uint256",
              },
            ],
            internalType: "struct LockedValues",
            name: "lockedValues",
            type: "tuple",
          },
          {
            internalType: "uint256",
            name: "maxFundingRate",
            type: "uint256",
          },
          {
            internalType: "address",
            name: "partyA",
            type: "address",
          },
          {
            internalType: "address",
            name: "partyB",
            type: "address",
          },
          {
            internalType: "enum QuoteStatus",
            name: "quoteStatus",
            type: "uint8",
          },
          {
            internalType: "uint256",
            name: "avgClosedPrice",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "requestedClosePrice",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "quantityToClose",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "parentId",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "createTimestamp",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "statusModifyTimestamp",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "lastFundingPaymentTimestamp",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "deadline",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "tradingFee",
            type: "uint256",
          },
          {
            internalType: "address",
            name: "affiliate",
            type: "address",
          },
          {
            internalType: "int256",
            name: "accumulatedPaidFunding",
            type: "int256",
          },
          {
            internalType: "uint256",
            name: "closeFee",
            type: "uint256",
          },
          {
            internalType: "bytes",
            name: "data",
            type: "bytes",
          },
        ],
        internalType: "struct Quote[]",
        name: "quotes",
        type: "tuple[]",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256[]",
        name: "quoteIds",
        type: "uint256[]",
      },
    ],
    name: "getSumQuoteFundingDebts",
    outputs: [
      {
        internalType: "int256",
        name: "sum",
        type: "int256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "partyA",
        type: "address",
      },
    ],
    name: "partyAPendingQuotesCount",
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
        name: "partyA",
        type: "address",
      },
    ],
    name: "partyAPositionsCount",
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
        name: "partyB",
        type: "address",
      },
      {
        internalType: "address",
        name: "partyA",
        type: "address",
      },
    ],
    name: "partyBPositionsCount",
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
        name: "partyA",
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
    name: "quoteIdsOf",
    outputs: [
      {
        internalType: "uint256[]",
        name: "",
        type: "uint256[]",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "user",
        type: "address",
      },
    ],
    name: "quotesLength",
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
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "address",
        name: "partyB",
        type: "address",
      },
      {
        indexed: false,
        internalType: "address",
        name: "partyA",
        type: "address",
      },
    ],
    name: "FullyLiquidatedPartyB",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "address",
        name: "liquidator",
        type: "address",
      },
      {
        indexed: false,
        internalType: "address",
        name: "partyB",
        type: "address",
      },
      {
        indexed: false,
        internalType: "address",
        name: "partyA",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256[]",
        name: "quoteIds",
        type: "uint256[]",
      },
      {
        indexed: false,
        internalType: "uint256[]",
        name: "liquidatedAmounts",
        type: "uint256[]",
      },
      {
        indexed: false,
        internalType: "uint256[]",
        name: "closeIds",
        type: "uint256[]",
      },
    ],
    name: "LiquidatePositionsPartyB",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "address",
        name: "liquidator",
        type: "address",
      },
      {
        indexed: false,
        internalType: "address",
        name: "partyB",
        type: "address",
      },
      {
        indexed: false,
        internalType: "address",
        name: "partyA",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256[]",
        name: "quoteIds",
        type: "uint256[]",
      },
      {
        indexed: false,
        internalType: "uint256[]",
        name: "liquidatedAmounts",
        type: "uint256[]",
      },
      {
        indexed: false,
        internalType: "uint256[]",
        name: "closeIds",
        type: "uint256[]",
      },
      {
        indexed: false,
        internalType: "uint256[]",
        name: "averageClosedPrices",
        type: "uint256[]",
      },
    ],
    name: "LiquidatePositionsPartyB",
    type: "event",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "partyB",
        type: "address",
      },
      {
        internalType: "address",
        name: "partyA",
        type: "address",
      },
      {
        components: [
          {
            internalType: "bytes",
            name: "reqId",
            type: "bytes",
          },
          {
            internalType: "uint256",
            name: "timestamp",
            type: "uint256",
          },
          {
            internalType: "int256",
            name: "upnl",
            type: "int256",
          },
          {
            internalType: "bytes",
            name: "gatewaySignature",
            type: "bytes",
          },
          {
            components: [
              {
                internalType: "uint256",
                name: "signature",
                type: "uint256",
              },
              {
                internalType: "address",
                name: "owner",
                type: "address",
              },
              {
                internalType: "address",
                name: "nonce",
                type: "address",
              },
            ],
            internalType: "struct IMuonSignatureVerifier.SchnorrSign",
            name: "sigs",
            type: "tuple",
          },
        ],
        internalType: "struct SingleUpnlSig",
        name: "upnlSig",
        type: "tuple",
      },
    ],
    name: "liquidatePartyB",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "partyB",
        type: "address",
      },
      {
        internalType: "address",
        name: "partyA",
        type: "address",
      },
      {
        components: [
          {
            internalType: "bytes",
            name: "reqId",
            type: "bytes",
          },
          {
            internalType: "uint256",
            name: "timestamp",
            type: "uint256",
          },
          {
            internalType: "uint256[]",
            name: "quoteIds",
            type: "uint256[]",
          },
          {
            internalType: "uint256[]",
            name: "prices",
            type: "uint256[]",
          },
          {
            internalType: "bytes",
            name: "gatewaySignature",
            type: "bytes",
          },
          {
            components: [
              {
                internalType: "uint256",
                name: "signature",
                type: "uint256",
              },
              {
                internalType: "address",
                name: "owner",
                type: "address",
              },
              {
                internalType: "address",
                name: "nonce",
                type: "address",
              },
            ],
            internalType: "struct IMuonSignatureVerifier.SchnorrSign",
            name: "sigs",
            type: "tuple",
          },
        ],
        internalType: "struct QuotePriceSig",
        name: "priceSig",
        type: "tuple",
      },
    ],
    name: "liquidatePositionsPartyB",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "address",
        name: "user",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "amount",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "newAllocatedBalance",
        type: "uint256",
      },
    ],
    name: "AllocatePartyA",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "address",
        name: "user",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "amount",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "newAllocatedBalance",
        type: "uint256",
      },
    ],
    name: "DeallocatePartyA",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "address",
        name: "admin",
        type: "address",
      },
      {
        indexed: false,
        internalType: "address",
        name: "user",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "amount",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "newAllocatedBalance",
        type: "uint256",
      },
    ],
    name: "DeallocateSuspendedUser",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "address",
        name: "sender",
        type: "address",
      },
      {
        indexed: false,
        internalType: "address",
        name: "user",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "amount",
        type: "uint256",
      },
    ],
    name: "Deposit",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "address",
        name: "sender",
        type: "address",
      },
      {
        indexed: false,
        internalType: "address",
        name: "user",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "amount",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "bool",
        name: "isVirtual",
        type: "bool",
      },
    ],
    name: "Deposit",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "provider",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "amount",
        type: "uint256",
      },
    ],
    name: "DepositVirtualFunds",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "address",
        name: "sender",
        type: "address",
      },
      {
        indexed: false,
        internalType: "address",
        name: "user",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "userNewAllocatedBalance",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "amount",
        type: "uint256",
      },
    ],
    name: "InternalTransfer",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "address",
        name: "sender",
        type: "address",
      },
      {
        indexed: false,
        internalType: "address",
        name: "user",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "userNewBalance",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "amount",
        type: "uint256",
      },
    ],
    name: "InternalTransferToBalance",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "address",
        name: "sender",
        type: "address",
      },
      {
        indexed: false,
        internalType: "address",
        name: "user",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "amount",
        type: "uint256",
      },
    ],
    name: "Withdraw",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "address",
        name: "admin",
        type: "address",
      },
      {
        indexed: false,
        internalType: "address",
        name: "user",
        type: "address",
      },
      {
        indexed: false,
        internalType: "address",
        name: "recipient",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "amount",
        type: "uint256",
      },
    ],
    name: "WithdrawSuspendedUser",
    type: "event",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "amount",
        type: "uint256",
      },
    ],
    name: "allocate",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "amount",
        type: "uint256",
      },
      {
        components: [
          {
            internalType: "bytes",
            name: "reqId",
            type: "bytes",
          },
          {
            internalType: "uint256",
            name: "timestamp",
            type: "uint256",
          },
          {
            internalType: "int256",
            name: "upnl",
            type: "int256",
          },
          {
            internalType: "bytes",
            name: "gatewaySignature",
            type: "bytes",
          },
          {
            components: [
              {
                internalType: "uint256",
                name: "signature",
                type: "uint256",
              },
              {
                internalType: "address",
                name: "owner",
                type: "address",
              },
              {
                internalType: "address",
                name: "nonce",
                type: "address",
              },
            ],
            internalType: "struct IMuonSignatureVerifier.SchnorrSign",
            name: "sigs",
            type: "tuple",
          },
        ],
        internalType: "struct SingleUpnlSig",
        name: "upnlSig",
        type: "tuple",
      },
    ],
    name: "deallocate",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "user",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "amount",
        type: "uint256",
      },
    ],
    name: "deallocateSuspendedUserFunds",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "amount",
        type: "uint256",
      },
    ],
    name: "deposit",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "amount",
        type: "uint256",
      },
    ],
    name: "depositAndAllocate",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "user",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "amount",
        type: "uint256",
      },
    ],
    name: "depositAndAllocateFor",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "user",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "amount",
        type: "uint256",
      },
    ],
    name: "depositFor",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "amount",
        type: "uint256",
      },
    ],
    name: "depositVirtualFunds",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "user",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "amount",
        type: "uint256",
      },
    ],
    name: "internalTransfer",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "user",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "amount",
        type: "uint256",
      },
    ],
    name: "internalTransferToBalance",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "amount",
        type: "uint256",
      },
      {
        components: [
          {
            internalType: "bytes",
            name: "reqId",
            type: "bytes",
          },
          {
            internalType: "uint256",
            name: "timestamp",
            type: "uint256",
          },
          {
            internalType: "int256",
            name: "upnl",
            type: "int256",
          },
          {
            internalType: "uint256",
            name: "pendingBalance",
            type: "uint256",
          },
          {
            internalType: "bytes",
            name: "gatewaySignature",
            type: "bytes",
          },
          {
            components: [
              {
                internalType: "uint256",
                name: "signature",
                type: "uint256",
              },
              {
                internalType: "address",
                name: "owner",
                type: "address",
              },
              {
                internalType: "address",
                name: "nonce",
                type: "address",
              },
            ],
            internalType: "struct IMuonSignatureVerifier.SchnorrSign",
            name: "sigs",
            type: "tuple",
          },
        ],
        internalType: "struct SingleUpnlWithPendingBalanceSig",
        name: "upnlSig",
        type: "tuple",
      },
    ],
    name: "safeDeallocate",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "user",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "amount",
        type: "uint256",
      },
    ],
    name: "virtualDepositFor",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "amount",
        type: "uint256",
      },
    ],
    name: "withdraw",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "user",
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
    name: "withdrawSuspendedUserFunds",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "user",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "amount",
        type: "uint256",
      },
    ],
    name: "withdrawTo",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "amount",
        type: "uint256",
      },
    ],
    name: "zeroUpnlDeallocate",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "user",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "amount",
        type: "uint256",
      },
    ],
    name: "virtualDepositAndAllocateFor",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "partyA",
        type: "address",
      },
      {
        indexed: false,
        internalType: "bytes",
        name: "liquidationId",
        type: "bytes",
      },
    ],
    name: "AutoTakeoverPartyALiquidation",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "subject",
        type: "address",
      },
      {
        indexed: false,
        internalType: "address[]",
        name: "parties",
        type: "address[]",
      },
      {
        indexed: false,
        internalType: "address[]",
        name: "allocationKeys",
        type: "address[]",
      },
      {
        indexed: false,
        internalType: "uint256[]",
        name: "amounts",
        type: "uint256[]",
      },
    ],
    name: "DeallocateForClearingHouse",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "subject",
        type: "address",
      },
      {
        indexed: false,
        internalType: "address[]",
        name: "receivers",
        type: "address[]",
      },
      {
        indexed: false,
        internalType: "address[]",
        name: "allocationKeys",
        type: "address[]",
      },
      {
        indexed: false,
        internalType: "uint256[]",
        name: "amounts",
        type: "uint256[]",
      },
    ],
    name: "DistributeForClearingHouse",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "partyA",
        type: "address",
      },
      {
        indexed: false,
        internalType: "address[]",
        name: "receivers",
        type: "address[]",
      },
      {
        indexed: false,
        internalType: "address[]",
        name: "allocationKeys",
        type: "address[]",
      },
      {
        indexed: false,
        internalType: "uint256[]",
        name: "amounts",
        type: "uint256[]",
      },
    ],
    name: "DistributeFromLiquidationEscrow",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "initiator",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "partyB",
        type: "address",
      },
      {
        indexed: false,
        internalType: "bytes",
        name: "liquidationId",
        type: "bytes",
      },
      {
        indexed: false,
        internalType: "int256",
        name: "upnl",
        type: "int256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "timestamp",
        type: "uint256",
      },
    ],
    name: "LiquidateCrossPartyB",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "subject",
        type: "address",
      },
      {
        indexed: false,
        internalType: "address[]",
        name: "counterparties",
        type: "address[]",
      },
      {
        indexed: false,
        internalType: "uint256[]",
        name: "liquidatedAmounts",
        type: "uint256[]",
      },
    ],
    name: "LiquidatePendingPositionsForClearingHouse",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "subject",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256[]",
        name: "quoteIds",
        type: "uint256[]",
      },
      {
        indexed: false,
        internalType: "uint256[]",
        name: "liquidatedAmounts",
        type: "uint256[]",
      },
      {
        indexed: false,
        internalType: "uint256[]",
        name: "closeIds",
        type: "uint256[]",
      },
      {
        indexed: false,
        internalType: "uint256[]",
        name: "prices",
        type: "uint256[]",
      },
    ],
    name: "LiquidatePositionsForClearingHouse",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "partyB",
        type: "address",
      },
    ],
    name: "SettleCrossPartyBLiquidation",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "partyA",
        type: "address",
      },
      {
        indexed: false,
        internalType: "bytes",
        name: "liquidationId",
        type: "bytes",
      },
    ],
    name: "SettlePartyATakeover",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "address",
        name: "partyB",
        type: "address",
      },
      {
        indexed: false,
        internalType: "address",
        name: "partyA",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "penaltyFromAllocated",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "penaltyFromBalance",
        type: "uint256",
      },
    ],
    name: "SoftPartyBLiquidation",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "partyA",
        type: "address",
      },
      {
        indexed: false,
        internalType: "bytes",
        name: "liquidationId",
        type: "bytes",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "timestamp",
        type: "uint256",
      },
    ],
    name: "TakeoverPartyALiquidation",
    type: "event",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "subject",
        type: "address",
      },
      {
        internalType: "address[]",
        name: "parties",
        type: "address[]",
      },
      {
        internalType: "address[]",
        name: "allocationKeys",
        type: "address[]",
      },
      {
        internalType: "uint256[]",
        name: "amounts",
        type: "uint256[]",
      },
    ],
    name: "deallocateForClearingHouse",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "subject",
        type: "address",
      },
      {
        internalType: "address[]",
        name: "receivers",
        type: "address[]",
      },
      {
        internalType: "address[]",
        name: "allocationKeys",
        type: "address[]",
      },
      {
        internalType: "uint256[]",
        name: "amounts",
        type: "uint256[]",
      },
    ],
    name: "distributeForClearingHouse",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "partyA",
        type: "address",
      },
      {
        internalType: "address[]",
        name: "receivers",
        type: "address[]",
      },
      {
        internalType: "address[]",
        name: "allocationKeys",
        type: "address[]",
      },
      {
        internalType: "uint256[]",
        name: "amounts",
        type: "uint256[]",
      },
    ],
    name: "distributeFromLiquidationEscrow",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "partyB",
        type: "address",
      },
      {
        internalType: "bytes",
        name: "liquidationId",
        type: "bytes",
      },
      {
        internalType: "int256",
        name: "upnl",
        type: "int256",
      },
      {
        internalType: "uint256",
        name: "timestamp",
        type: "uint256",
      },
    ],
    name: "liquidateCrossPartyB",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "subject",
        type: "address",
      },
      {
        internalType: "address[]",
        name: "counterparties",
        type: "address[]",
      },
    ],
    name: "liquidatePendingPositionsForClearingHouse",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "subject",
        type: "address",
      },
      {
        internalType: "uint256[]",
        name: "quoteIds",
        type: "uint256[]",
      },
      {
        internalType: "uint256[]",
        name: "prices",
        type: "uint256[]",
      },
    ],
    name: "liquidatePositionsForClearingHouse",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "partyB",
        type: "address",
      },
      {
        internalType: "address[]",
        name: "settledPartyAs",
        type: "address[]",
      },
      {
        internalType: "bool",
        name: "finalize",
        type: "bool",
      },
    ],
    name: "settleCrossPartyBLiquidation",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "partyA",
        type: "address",
      },
      {
        internalType: "address[]",
        name: "settledPartyBs",
        type: "address[]",
      },
    ],
    name: "settlePartyATakeover",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "partyB",
        type: "address",
      },
      {
        internalType: "address",
        name: "partyA",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "penaltyFromAllocated",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "penaltyFromBalance",
        type: "uint256",
      },
    ],
    name: "softPartyBLiquidation",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "partyA",
        type: "address",
      },
    ],
    name: "takeoverPartyALiquidation",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "uint256",
        name: "requestId",
        type: "uint256",
      },
      {
        indexed: true,
        internalType: "address",
        name: "user",
        type: "address",
      },
    ],
    name: "WithdrawAccepted",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "uint256",
        name: "requestId",
        type: "uint256",
      },
      {
        indexed: true,
        internalType: "address",
        name: "user",
        type: "address",
      },
    ],
    name: "WithdrawCancelRequested",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "uint256",
        name: "requestId",
        type: "uint256",
      },
      {
        indexed: true,
        internalType: "address",
        name: "user",
        type: "address",
      },
    ],
    name: "WithdrawCancelled",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "uint256",
        name: "requestId",
        type: "uint256",
      },
      {
        indexed: true,
        internalType: "address",
        name: "user",
        type: "address",
      },
    ],
    name: "WithdrawFinalized",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "uint256",
        name: "requestId",
        type: "uint256",
      },
      {
        indexed: true,
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
        indexed: false,
        internalType: "struct WithdrawReceiverPart[]",
        name: "parts",
        type: "tuple[]",
      },
      {
        indexed: false,
        internalType: "bool",
        name: "speedUp",
        type: "bool",
      },
      {
        indexed: false,
        internalType: "bytes",
        name: "providerData",
        type: "bytes",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "cooldownEndTime",
        type: "uint256",
      },
    ],
    name: "WithdrawInitiated",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "uint256",
        name: "requestId",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "address",
        name: "user",
        type: "address",
      },
    ],
    name: "WithdrawRejected",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "uint256",
        name: "requestId",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "address",
        name: "user",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "newCooldown",
        type: "uint256",
      },
    ],
    name: "WithdrawSpeedUpAccepted",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "uint256",
        name: "requestId",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "address",
        name: "user",
        type: "address",
      },
    ],
    name: "WithdrawSuspended",
    type: "event",
  },
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
      {
        internalType: "uint256",
        name: "newCooldown",
        type: "uint256",
      },
    ],
    name: "acceptSpeedUpRequest",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
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
    name: "acceptWithdrawCancelRequest",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
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
    name: "acceptWithdrawRequest",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
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
    name: "finalizeWithdrawRequest",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
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
    name: "forceCancelWithdraw",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
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
        internalType: "bool",
        name: "speedUp",
        type: "bool",
      },
      {
        internalType: "bytes",
        name: "data",
        type: "bytes",
      },
    ],
    name: "initiateWithdraw",
    outputs: [
      {
        internalType: "uint256",
        name: "requestId",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "cooldownEndTime",
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
        name: "user",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "requestId",
        type: "uint256",
      },
    ],
    name: "rejectWithdrawRequest",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "requestId",
        type: "uint256",
      },
    ],
    name: "requestCancelWithdraw",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
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
    name: "suspendWithdrawRequest",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "partyB",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "partyAsProcessed",
        type: "uint256",
      },
    ],
    name: "CrossLockedValuesMigrated",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "uint256",
        name: "quotesProvided",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "quotesMigrated",
        type: "uint256",
      },
    ],
    name: "QuotesMigrated",
    type: "event",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "partyB",
        type: "address",
      },
      {
        internalType: "address",
        name: "partyA",
        type: "address",
      },
    ],
    name: "isCrossLockedValuesMigrated",
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
        internalType: "uint256",
        name: "quoteId",
        type: "uint256",
      },
    ],
    name: "isQuoteMigrated",
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
        internalType: "address",
        name: "partyB",
        type: "address",
      },
      {
        internalType: "address[]",
        name: "partyAs",
        type: "address[]",
      },
    ],
    name: "migrateCrossLockedValues",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256[]",
        name: "quoteIds",
        type: "uint256[]",
      },
    ],
    name: "migrateQuotes",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "acceptOwnership",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "bridge",
        type: "address",
      },
    ],
    name: "addBridge",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "target",
        type: "address",
      },
      {
        internalType: "address",
        name: "relayer",
        type: "address",
      },
    ],
    name: "addRelayerForExternalTransferTarget",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "bytes32",
        name: "role",
        type: "bytes32",
      },
      {
        internalType: "address",
        name: "admin",
        type: "address",
      },
    ],
    name: "addRoleAdmin",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "cancelOwnershipTransfer",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "affiliate",
        type: "address",
      },
    ],
    name: "deregisterAffiliate",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "partyB",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "index",
        type: "uint256",
      },
    ],
    name: "deregisterPartyB",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "user",
        type: "address",
      },
      {
        internalType: "bytes32",
        name: "role",
        type: "bytes32",
      },
    ],
    name: "grantRole",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "affiliate",
        type: "address",
      },
    ],
    name: "registerAffiliate",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "provider",
        type: "address",
      },
    ],
    name: "registerExpressProvider",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "affiliate",
        type: "address",
      },
      {
        internalType: "address",
        name: "hook",
        type: "address",
      },
    ],
    name: "registerHook",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "partyB",
        type: "address",
      },
    ],
    name: "registerPartyB",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "provider",
        type: "address",
      },
    ],
    name: "registerVirtualProvider",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "bridge",
        type: "address",
      },
    ],
    name: "removeBridge",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "target",
        type: "address",
      },
    ],
    name: "removeRelayerForExternalTransferTarget",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "bytes32",
        name: "role",
        type: "bytes32",
      },
      {
        internalType: "address",
        name: "admin",
        type: "address",
      },
    ],
    name: "removeRoleAdmin",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "user",
        type: "address",
      },
      {
        internalType: "bytes32",
        name: "role",
        type: "bytes32",
      },
    ],
    name: "revokeRole",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "partyB",
        type: "address",
      },
      {
        internalType: "bool",
        name: "enabled",
        type: "bool",
      },
    ],
    name: "setADLEnabled",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "user",
        type: "address",
      },
    ],
    name: "setAdmin",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "affiliate",
        type: "address",
      },
      {
        internalType: "uint256[]",
        name: "symbolIds",
        type: "uint256[]",
      },
      {
        internalType: "uint256[]",
        name: "openFees",
        type: "uint256[]",
      },
      {
        internalType: "uint256[]",
        name: "closeFees",
        type: "uint256[]",
      },
    ],
    name: "setAffiliateFee",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "affiliate",
        type: "address",
      },
      {
        internalType: "address[]",
        name: "users",
        type: "address[]",
      },
      {
        internalType: "uint256[]",
        name: "symbolIds",
        type: "uint256[]",
      },
      {
        internalType: "uint256[]",
        name: "openFees",
        type: "uint256[]",
      },
      {
        internalType: "uint256[]",
        name: "closeFees",
        type: "uint256[]",
      },
    ],
    name: "setAffiliateFeeForUser",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "affiliate",
        type: "address",
      },
      {
        components: [
          {
            internalType: "string",
            name: "name",
            type: "string",
          },
          {
            internalType: "string",
            name: "brandColor",
            type: "string",
          },
          {
            internalType: "string",
            name: "metadata",
            type: "string",
          },
        ],
        internalType: "struct EntityMetadata",
        name: "metadata",
        type: "tuple",
      },
    ],
    name: "setAffiliateMetadata",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "balanceLimitPerUser",
        type: "uint256",
      },
    ],
    name: "setBalanceLimitPerUser",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "bool",
        name: "callFromInstantLayer",
        type: "bool",
      },
    ],
    name: "setCallFromInstantLayer",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "collateral",
        type: "address",
      },
    ],
    name: "setCollateral",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "partyB",
        type: "address",
      },
      {
        internalType: "bool",
        name: "enabled",
        type: "bool",
      },
    ],
    name: "setCrossPartyB",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "bool",
        name: "activated",
        type: "bool",
      },
    ],
    name: "setCrossPartyBModeActivated",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "deallocateCooldown",
        type: "uint256",
      },
    ],
    name: "setDeallocateCooldown",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "deallocateDebounceTime",
        type: "uint256",
      },
    ],
    name: "setDeallocateDebounceTime",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "feeCollector",
        type: "address",
      },
    ],
    name: "setDefaultFeeCollector",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "affiliate",
        type: "address",
      },
      {
        internalType: "address",
        name: "feeCollector",
        type: "address",
      },
    ],
    name: "setFeeCollector",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "forceCancelCloseCooldown",
        type: "uint256",
      },
    ],
    name: "setForceCancelCloseCooldown",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "forceCancelCooldown",
        type: "uint256",
      },
    ],
    name: "setForceCancelCooldown",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "forceCloseFirstCooldown",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "forceCloseSecondCooldown",
        type: "uint256",
      },
    ],
    name: "setForceCloseCooldowns",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "symbolId",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "forceCloseGapRatio",
        type: "uint256",
      },
    ],
    name: "setForceCloseGapRatio",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "forceCloseMinSigPeriod",
        type: "uint256",
      },
    ],
    name: "setForceCloseMinSigPeriod",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "forceClosePricePenalty",
        type: "uint256",
      },
    ],
    name: "setForceClosePricePenalty",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "bool",
        name: "instantOpenMode",
        type: "bool",
      },
    ],
    name: "setInstantOpenMode",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "pool",
        type: "address",
      },
    ],
    name: "setInvalidBridgedAmountsPool",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "bool",
        name: "deprecated",
        type: "bool",
      },
    ],
    name: "setLegacyDeallocateDeprecated",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "insuranceVault",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "maxLiquidationProfit",
        type: "uint256",
      },
    ],
    name: "setLiquidationInsuranceVaultParams",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "liquidationTimeout",
        type: "uint256",
      },
    ],
    name: "setLiquidationTimeout",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "liquidatorShare",
        type: "uint256",
      },
    ],
    name: "setLiquidatorShare",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "maxLimit",
        type: "uint256",
      },
    ],
    name: "setMaxPartyAConnectionLimit",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "_maxWithdrawParts",
        type: "uint256",
      },
    ],
    name: "setMaxWithdrawParts",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "minAffiliateFee",
        type: "uint256",
      },
    ],
    name: "setMinAffiliateFee",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "cooldown",
        type: "uint256",
      },
    ],
    name: "setMinWithdrawCooldown",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "upnlValidTime",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "priceValidTime",
        type: "uint256",
      },
    ],
    name: "setMuonConfig",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "muonAppId",
        type: "uint256",
      },
    ],
    name: "setMuonIds",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "partyB",
        type: "address",
      },
      {
        internalType: "bool",
        name: "bindable",
        type: "bool",
      },
    ],
    name: "setPartyBBindable",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "partyB",
        type: "address",
      },
      {
        components: [
          {
            internalType: "string",
            name: "name",
            type: "string",
          },
          {
            internalType: "string",
            name: "brandColor",
            type: "string",
          },
          {
            internalType: "string",
            name: "metadata",
            type: "string",
          },
        ],
        internalType: "struct EntityMetadata",
        name: "metadata",
        type: "tuple",
      },
    ],
    name: "setPartyBMetadata",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "pendingQuotesValidLength",
        type: "uint256",
      },
    ],
    name: "setPendingQuotesValidLength",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "blackout",
        type: "uint256",
      },
    ],
    name: "setPureVirtualCancelBlackout",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "settlementCooldown",
        type: "uint256",
      },
    ],
    name: "setSettlementCooldown",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "signatureVerifier",
        type: "address",
      },
    ],
    name: "setSignatureVerifierAddress",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "signer",
        type: "address",
      },
    ],
    name: "setSigner",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "softLiquidationPenaltyCollector",
        type: "address",
      },
    ],
    name: "setSoftLiquidationPenaltyCollector",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "user",
        type: "address",
      },
      {
        internalType: "bool",
        name: "speedUp",
        type: "bool",
      },
    ],
    name: "setSpeedUpUser",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "unbindCooldown",
        type: "uint256",
      },
    ],
    name: "setUnbindCooldown",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "_withdrawCooldownPeriod",
        type: "uint256",
      },
    ],
    name: "setWithdrawCooldownPeriod",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "owner",
        type: "address",
      },
    ],
    name: "transferOwnership",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "provider",
        type: "address",
      },
    ],
    name: "unregisterExpressProvider",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "provider",
        type: "address",
      },
    ],
    name: "unregisterVirtualProvider",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "cooldown",
        type: "uint256",
      },
    ],
    name: "setDeactiveInstantActionModeCooldown",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "uint256",
        name: "quoteId",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "amount",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "price",
        type: "uint256",
      },
    ],
    name: "ADLClose",
    type: "event",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "quoteId",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "sigCurrentPrice",
        type: "uint256",
      },
      {
        internalType: "int256",
        name: "sigUpnlPartyA",
        type: "int256",
      },
      {
        internalType: "int256",
        name: "sigUpnlPartyB",
        type: "int256",
      },
      {
        internalType: "uint256",
        name: "closePrice",
        type: "uint256",
      },
    ],
    name: "getAvailableBalancesAfterClose",
    outputs: [
      {
        internalType: "int256",
        name: "partyBAvailableBalance",
        type: "int256",
      },
      {
        internalType: "int256",
        name: "partyAAvailableBalance",
        type: "int256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "quoteId",
        type: "uint256",
      },
      {
        components: [
          {
            internalType: "bytes",
            name: "reqId",
            type: "bytes",
          },
          {
            internalType: "uint256",
            name: "timestamp",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "symbolId",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "highest",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "lowest",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "averagePrice",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "startTime",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "endTime",
            type: "uint256",
          },
          {
            internalType: "int256",
            name: "upnlPartyB",
            type: "int256",
          },
          {
            internalType: "int256",
            name: "upnlPartyA",
            type: "int256",
          },
          {
            internalType: "uint256",
            name: "currentPrice",
            type: "uint256",
          },
          {
            internalType: "bytes",
            name: "gatewaySignature",
            type: "bytes",
          },
          {
            components: [
              {
                internalType: "uint256",
                name: "signature",
                type: "uint256",
              },
              {
                internalType: "address",
                name: "owner",
                type: "address",
              },
              {
                internalType: "address",
                name: "nonce",
                type: "address",
              },
            ],
            internalType: "struct IMuonSignatureVerifier.SchnorrSign",
            name: "sigs",
            type: "tuple",
          },
        ],
        internalType: "struct HighLowPriceSig",
        name: "highLowPrice",
        type: "tuple",
      },
      {
        internalType: "enum MuonFunction",
        name: "func",
        type: "uint8",
      },
    ],
    name: "validateForceCloseConditions",
    outputs: [],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "quoteId",
        type: "uint256",
      },
      {
        components: [
          {
            internalType: "bytes",
            name: "reqId",
            type: "bytes",
          },
          {
            internalType: "uint256",
            name: "timestamp",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "symbolId",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "highest",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "lowest",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "averagePrice",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "startTime",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "endTime",
            type: "uint256",
          },
          {
            internalType: "int256",
            name: "upnlPartyB",
            type: "int256",
          },
          {
            internalType: "int256",
            name: "upnlPartyA",
            type: "int256",
          },
          {
            internalType: "uint256",
            name: "currentPrice",
            type: "uint256",
          },
          {
            internalType: "bytes",
            name: "gatewaySignature",
            type: "bytes",
          },
          {
            components: [
              {
                internalType: "uint256",
                name: "signature",
                type: "uint256",
              },
              {
                internalType: "address",
                name: "owner",
                type: "address",
              },
              {
                internalType: "address",
                name: "nonce",
                type: "address",
              },
            ],
            internalType: "struct IMuonSignatureVerifier.SchnorrSign",
            name: "sigs",
            type: "tuple",
          },
        ],
        internalType: "struct HighLowPriceSig",
        name: "sig",
        type: "tuple",
      },
    ],
    name: "verifyAndGetClosePrice",
    outputs: [
      {
        internalType: "uint256",
        name: "closePrice",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "AFFILIATE_MANAGER_ROLE",
    outputs: [
      {
        internalType: "bytes32",
        name: "",
        type: "bytes32",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "BALANCE_SETTLER_ROLE",
    outputs: [
      {
        internalType: "bytes32",
        name: "",
        type: "bytes32",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "BRIDGE_MANAGER_ROLE",
    outputs: [
      {
        internalType: "bytes32",
        name: "",
        type: "bytes32",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "CLEARING_HOUSE_ROLE",
    outputs: [
      {
        internalType: "bytes32",
        name: "",
        type: "bytes32",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "COOLDOWN_ADMIN_ROLE",
    outputs: [
      {
        internalType: "bytes32",
        name: "",
        type: "bytes32",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "DEFAULT_ADMIN_ROLE",
    outputs: [
      {
        internalType: "bytes32",
        name: "",
        type: "bytes32",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "DISPUTE_ROLE",
    outputs: [
      {
        internalType: "bytes32",
        name: "",
        type: "bytes32",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "EMERGENCY_ADMIN_ROLE",
    outputs: [
      {
        internalType: "bytes32",
        name: "",
        type: "bytes32",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "FEE_ADMIN_ROLE",
    outputs: [
      {
        internalType: "bytes32",
        name: "",
        type: "bytes32",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "FORCE_CLOSE_GAP_RATIO_ADMIN_ROLE",
    outputs: [
      {
        internalType: "bytes32",
        name: "",
        type: "bytes32",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "INSTANT_LAYER_ROLE",
    outputs: [
      {
        internalType: "bytes32",
        name: "",
        type: "bytes32",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "INTEGRATION_ADMIN_ROLE",
    outputs: [
      {
        internalType: "bytes32",
        name: "",
        type: "bytes32",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "LIQUIDATOR_ROLE",
    outputs: [
      {
        internalType: "bytes32",
        name: "",
        type: "bytes32",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "MIGRATION_ROLE",
    outputs: [
      {
        internalType: "bytes32",
        name: "",
        type: "bytes32",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "MUON_SETTER_ROLE",
    outputs: [
      {
        internalType: "bytes32",
        name: "",
        type: "bytes32",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "PARTYB_LIQUIDATOR_ROLE",
    outputs: [
      {
        internalType: "bytes32",
        name: "",
        type: "bytes32",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "PARTY_B_MANAGER_ROLE",
    outputs: [
      {
        internalType: "bytes32",
        name: "",
        type: "bytes32",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "PAUSER_ROLE",
    outputs: [
      {
        internalType: "bytes32",
        name: "",
        type: "bytes32",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "PROTOCOL_CONFIG_ROLE",
    outputs: [
      {
        internalType: "bytes32",
        name: "",
        type: "bytes32",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "PROVIDER_ADMIN_ROLE",
    outputs: [
      {
        internalType: "bytes32",
        name: "",
        type: "bytes32",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "SIGNER_ADMIN_ROLE",
    outputs: [
      {
        internalType: "bytes32",
        name: "",
        type: "bytes32",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "SOFT_LIQUIDATOR_ROLE",
    outputs: [
      {
        internalType: "bytes32",
        name: "",
        type: "bytes32",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "SUSPENDED_FUNDS_WITHDRAWER_ROLE",
    outputs: [
      {
        internalType: "bytes32",
        name: "",
        type: "bytes32",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "SUSPENDER_ROLE",
    outputs: [
      {
        internalType: "bytes32",
        name: "",
        type: "bytes32",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "SYMBOL_MANAGER_ROLE",
    outputs: [
      {
        internalType: "bytes32",
        name: "",
        type: "bytes32",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "UNPAUSER_ROLE",
    outputs: [
      {
        internalType: "bytes32",
        name: "",
        type: "bytes32",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "UNSUSPENDER_ROLE",
    outputs: [
      {
        internalType: "bytes32",
        name: "",
        type: "bytes32",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "VIRTUAL_DEPOSITOR_ROLE",
    outputs: [
      {
        internalType: "bytes32",
        name: "",
        type: "bytes32",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "WITHDRAW_FORCE_CANCEL_ROLE",
    outputs: [
      {
        internalType: "bytes32",
        name: "",
        type: "bytes32",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "WITHDRAW_SPEED_UP_ROLE",
    outputs: [
      {
        internalType: "bytes32",
        name: "",
        type: "bytes32",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "partyA",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "amount",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "enum SharedEvents.BalanceChangeType",
        name: "_type",
        type: "uint8",
      },
    ],
    name: "BalanceChangePartyA",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "partyB",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "partyA",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "amount",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "enum SharedEvents.BalanceChangeType",
        name: "_type",
        type: "uint8",
      },
    ],
    name: "BalanceChangePartyB",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "uint256",
        name: "quoteId",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "amount",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "address",
        name: "partyA",
        type: "address",
      },
      {
        indexed: false,
        internalType: "address",
        name: "partyB",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "symbolId",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "address",
        name: "affiliate",
        type: "address",
      },
      {
        indexed: false,
        internalType: "enum SharedEvents.TradeVolumeType",
        name: "_type",
        type: "uint8",
      },
    ],
    name: "TradeVolumeRecorded",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "uint256",
        name: "quoteId",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "amount",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "address",
        name: "partyA",
        type: "address",
      },
      {
        indexed: false,
        internalType: "address",
        name: "partyB",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "symbolId",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "address",
        name: "affiliate",
        type: "address",
      },
      {
        indexed: false,
        internalType: "enum SharedEvents.TradingFeeType",
        name: "_type",
        type: "uint8",
      },
    ],
    name: "TradingFeeCharged",
    type: "event",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "quoteId",
        type: "uint256",
      },
    ],
    name: "getAccumulatedFundingFee",
    outputs: [
      {
        internalType: "int256",
        name: "fee",
        type: "int256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "address",
        name: "value",
        type: "address",
      },
    ],
    name: "LogAddress",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "int256",
        name: "value",
        type: "int256",
      },
    ],
    name: "LogInt",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "string",
        name: "value",
        type: "string",
      },
    ],
    name: "LogString",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "uint256",
        name: "value",
        type: "uint256",
      },
    ],
    name: "LogUint",
    type: "event",
  },
] as const;
