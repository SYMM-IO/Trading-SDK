/**
 * Complete ABI for the SYMMIO `AccountLayer` contract at version **0.8.6**.
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
 * version tag: {@link https://github.com/SYMM-IO/perps-core/blob/version_0.8.6/abis/accountLayer.json}.
 * Upgrading to a new contracts version means swapping the fragments in this
 * folder in place as part of a new SDK release — see `ARCHITECTURE.md` §2.
 */
export const accountLayerAbi = [
  {
    inputs: [],
    name: "AccountAlreadyExists",
    type: "error",
  },
  {
    inputs: [],
    name: "AccountDoesNotExist",
    type: "error",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "scope",
        type: "address",
      },
      {
        internalType: "address",
        name: "account",
        type: "address",
      },
    ],
    name: "AccountOutOfScope",
    type: "error",
  },
  {
    inputs: [],
    name: "AffiliateNotActive",
    type: "error",
  },
  {
    inputs: [],
    name: "AlreadyDeleted",
    type: "error",
  },
  {
    inputs: [],
    name: "AlreadyRegistered",
    type: "error",
  },
  {
    inputs: [],
    name: "CoreNotFound",
    type: "error",
  },
  {
    inputs: [],
    name: "DeploymentFailed",
    type: "error",
  },
  {
    inputs: [],
    name: "EmptyArray",
    type: "error",
  },
  {
    inputs: [],
    name: "EnforcedPause",
    type: "error",
  },
  {
    inputs: [],
    name: "ExpectedPause",
    type: "error",
  },
  {
    inputs: [],
    name: "ExternalCallFailed",
    type: "error",
  },
  {
    inputs: [],
    name: "ExternalCallSignerWasModified",
    type: "error",
  },
  {
    inputs: [],
    name: "HasActiveVirtualAccounts",
    type: "error",
  },
  {
    inputs: [
      {
        internalType: "bytes",
        name: "reason",
        type: "bytes",
      },
    ],
    name: "HookActionFailed",
    type: "error",
  },
  {
    inputs: [
      {
        internalType: "bytes",
        name: "reason",
        type: "bytes",
      },
    ],
    name: "HookFailed",
    type: "error",
  },
  {
    inputs: [],
    name: "InvalidCallData",
    type: "error",
  },
  {
    inputs: [],
    name: "InvalidIsolationType",
    type: "error",
  },
  {
    inputs: [],
    name: "InvalidNameLength",
    type: "error",
  },
  {
    inputs: [],
    name: "InvalidNonce",
    type: "error",
  },
  {
    inputs: [],
    name: "InvalidParent",
    type: "error",
  },
  {
    inputs: [],
    name: "InvalidSelector",
    type: "error",
  },
  {
    inputs: [],
    name: "InvalidShare",
    type: "error",
  },
  {
    inputs: [],
    name: "InvalidState",
    type: "error",
  },
  {
    inputs: [],
    name: "LegacyAccountNotOwned",
    type: "error",
  },
  {
    inputs: [],
    name: "LegacyContractNotRegistered",
    type: "error",
  },
  {
    inputs: [],
    name: "MarginKeyMismatch",
    type: "error",
  },
  {
    inputs: [],
    name: "MustBeRoleAdmin",
    type: "error",
  },
  {
    inputs: [],
    name: "MustHaveRole",
    type: "error",
  },
  {
    inputs: [],
    name: "NoActiveHookContext",
    type: "error",
  },
  {
    inputs: [],
    name: "NoPendingUpdate",
    type: "error",
  },
  {
    inputs: [],
    name: "NoWhitelistedSymmioCore",
    type: "error",
  },
  {
    inputs: [],
    name: "NotAdmin",
    type: "error",
  },
  {
    inputs: [],
    name: "NotAffiliateAdmin",
    type: "error",
  },
  {
    inputs: [],
    name: "NotOwner",
    type: "error",
  },
  {
    inputs: [],
    name: "NotPending",
    type: "error",
  },
  {
    inputs: [],
    name: "NotSymmioCore",
    type: "error",
  },
  {
    inputs: [],
    name: "NotVirtualAccount",
    type: "error",
  },
  {
    inputs: [],
    name: "OnlyCustomIsolationCanCreateManually",
    type: "error",
  },
  {
    inputs: [],
    name: "OpenPositionsExist",
    type: "error",
  },
  {
    inputs: [],
    name: "PendingQuotesExist",
    type: "error",
  },
  {
    inputs: [],
    name: "PositionTypeNotAllowedForThisAccount",
    type: "error",
  },
  {
    inputs: [],
    name: "ReentrancyGuardReentrantCall",
    type: "error",
  },
  {
    inputs: [
      {
        internalType: "bytes4",
        name: "selector",
        type: "bytes4",
      },
    ],
    name: "SelectorNotAllowed",
    type: "error",
  },
  {
    inputs: [],
    name: "SharesMustSumTo100",
    type: "error",
  },
  {
    inputs: [],
    name: "SingleVAModeNotApplicable",
    type: "error",
  },
  {
    inputs: [],
    name: "SubAccountNotEmpty",
    type: "error",
  },
  {
    inputs: [],
    name: "SymbolNotAllowedForThisAccount",
    type: "error",
  },
  {
    inputs: [],
    name: "SymmioCoreNotAllowed",
    type: "error",
  },
  {
    inputs: [],
    name: "Unauthorized",
    type: "error",
  },
  {
    inputs: [],
    name: "UnauthorizedHookCaller",
    type: "error",
  },
  {
    inputs: [],
    name: "ZeroAddress",
    type: "error",
  },
  {
    inputs: [],
    name: "ZeroAmount",
    type: "error",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "virtualAccount",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "subAccount",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "amount",
        type: "uint256",
      },
    ],
    name: "AddMargin",
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
        name: "account",
        type: "address",
      },
      {
        indexed: false,
        internalType: "bytes",
        name: "callData",
        type: "bytes",
      },
      {
        indexed: false,
        internalType: "bool",
        name: "success",
        type: "bool",
      },
      {
        indexed: false,
        internalType: "bytes",
        name: "resultData",
        type: "bytes",
      },
    ],
    name: "Call",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "account",
        type: "address",
      },
      {
        indexed: false,
        internalType: "string",
        name: "name",
        type: "string",
      },
    ],
    name: "EditAccountName",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "account",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "affiliate",
        type: "address",
      },
      {
        indexed: false,
        internalType: "bytes4",
        name: "selector",
        type: "bytes4",
      },
    ],
    name: "HookActionExecuted",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "account",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "owner",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "legacyContract",
        type: "address",
      },
      {
        indexed: false,
        internalType: "address",
        name: "affiliate",
        type: "address",
      },
    ],
    name: "LegacyAccountImported",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "address",
        name: "account",
        type: "address",
      },
    ],
    name: "Paused",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "subAccount",
        type: "address",
      },
      {
        indexed: false,
        internalType: "bool",
        name: "enabled",
        type: "bool",
      },
    ],
    name: "SingleVAModeChanged",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "account",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "owner",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "affiliate",
        type: "address",
      },
      {
        indexed: false,
        internalType: "string",
        name: "name",
        type: "string",
      },
    ],
    name: "SubAccountCreated",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "account",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "owner",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "affiliate",
        type: "address",
      },
    ],
    name: "SubAccountDeleted",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "account",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "oldOwner",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "newOwner",
        type: "address",
      },
    ],
    name: "SubAccountOwnershipTransferred",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "address",
        name: "account",
        type: "address",
      },
    ],
    name: "Unpaused",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "account",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "parent",
        type: "address",
      },
    ],
    name: "VirtualAccountCreated",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "account",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "parent",
        type: "address",
      },
    ],
    name: "VirtualAccountDeleted",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "account",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "parent",
        type: "address",
      },
    ],
    name: "VirtualAccountReused",
    type: "event",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "account",
        type: "address",
      },
      {
        internalType: "bytes[]",
        name: "callDatas",
        type: "bytes[]",
      },
    ],
    name: "_call",
    outputs: [
      {
        internalType: "bytes[]",
        name: "",
        type: "bytes[]",
      },
    ],
    stateMutability: "nonpayable",
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
        internalType: "enum VirtualAccountIsolationType",
        name: "isolationType",
        type: "uint8",
      },
      {
        internalType: "uint256",
        name: "symbolId",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "marginAmount",
        type: "uint256",
      },
      {
        internalType: "bytes[]",
        name: "callDatas",
        type: "bytes[]",
      },
    ],
    name: "_callWithMargin",
    outputs: [
      {
        internalType: "bytes[]",
        name: "",
        type: "bytes[]",
      },
    ],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "parentAccount",
        type: "address",
      },
      {
        internalType: "bytes",
        name: "metadata",
        type: "bytes",
      },
      {
        internalType: "enum VirtualAccountIsolationType",
        name: "isolationType",
        type: "uint8",
      },
      {
        internalType: "uint256",
        name: "symbolId",
        type: "uint256",
      },
    ],
    name: "createCustomVirtualAccount",
    outputs: [
      {
        internalType: "address",
        name: "",
        type: "address",
      },
    ],
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
            internalType: "bytes",
            name: "metadata",
            type: "bytes",
          },
          {
            internalType: "address",
            name: "symmioCore",
            type: "address",
          },
          {
            internalType: "enum SubAccountIsolationType",
            name: "isolationType",
            type: "uint8",
          },
          {
            internalType: "bool",
            name: "singleVAMode",
            type: "bool",
          },
        ],
        internalType: "struct SubAccountCreationData[]",
        name: "accountsData",
        type: "tuple[]",
      },
    ],
    name: "createSubAccounts",
    outputs: [
      {
        internalType: "address[]",
        name: "",
        type: "address[]",
      },
    ],
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
            internalType: "bytes",
            name: "metadata",
            type: "bytes",
          },
          {
            internalType: "address",
            name: "symmioCore",
            type: "address",
          },
          {
            internalType: "enum SubAccountIsolationType",
            name: "isolationType",
            type: "uint8",
          },
          {
            internalType: "bool",
            name: "singleVAMode",
            type: "bool",
          },
        ],
        internalType: "struct SubAccountCreationData[]",
        name: "accountsData",
        type: "tuple[]",
      },
    ],
    name: "createSubAccountsFor",
    outputs: [
      {
        internalType: "address[]",
        name: "",
        type: "address[]",
      },
    ],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "subAccount",
        type: "address",
      },
    ],
    name: "deleteSubAccount",
    outputs: [],
    stateMutability: "nonpayable",
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
        internalType: "uint256",
        name: "amount",
        type: "uint256",
      },
    ],
    name: "depositAndAllocateForAccount",
    outputs: [],
    stateMutability: "nonpayable",
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
        internalType: "uint256",
        name: "amount",
        type: "uint256",
      },
    ],
    name: "depositForAccount",
    outputs: [],
    stateMutability: "nonpayable",
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
        internalType: "string",
        name: "name",
        type: "string",
      },
    ],
    name: "editAccountName",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "bytes",
        name: "callData",
        type: "bytes",
      },
    ],
    name: "executeForAccount",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "legacyContract",
        type: "address",
      },
      {
        internalType: "address",
        name: "affiliate",
        type: "address",
      },
      {
        internalType: "address[]",
        name: "symmioCores",
        type: "address[]",
      },
      {
        components: [
          {
            internalType: "address",
            name: "account",
            type: "address",
          },
          {
            internalType: "string",
            name: "name",
            type: "string",
          },
          {
            internalType: "uint256",
            name: "coreIndex",
            type: "uint256",
          },
        ],
        internalType: "struct LegacyAccountImportData[]",
        name: "accountsData",
        type: "tuple[]",
      },
    ],
    name: "importLegacyAccounts",
    outputs: [
      {
        internalType: "address[]",
        name: "importedAccounts",
        type: "address[]",
      },
    ],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "subAccount",
        type: "address",
      },
      {
        internalType: "bool",
        name: "enabled",
        type: "bool",
      },
    ],
    name: "setSingleVAMode",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "subAccount",
        type: "address",
      },
      {
        internalType: "address",
        name: "newOwner",
        type: "address",
      },
    ],
    name: "transferSubAccountOwnership",
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
    name: "onCancelQuote",
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
    name: "onCloseExpired",
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
    name: "onClosePosition",
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
        name: "amount",
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
        internalType: "uint256",
        name: "symbolId",
        type: "uint256",
      },
      {
        internalType: "address",
        name: "affiliate",
        type: "address",
      },
      {
        internalType: "uint8",
        name: "feeType",
        type: "uint8",
      },
    ],
    name: "onFeeCharged",
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
    name: "onLiquidationSettled",
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
        name: "openedPrice",
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
    ],
    name: "onOpenPosition",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "MAX_NAME_LENGTH",
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
    name: "accountManagerImplementation",
    outputs: [
      {
        internalType: "bytes",
        name: "",
        type: "bytes",
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
        name: "symmio",
        type: "address",
      },
    ],
    name: "dryClaimAllFees",
    outputs: [
      {
        internalType: "address[]",
        name: "holders",
        type: "address[]",
      },
      {
        internalType: "uint256[]",
        name: "shares",
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
        name: "registrant",
        type: "address",
      },
      {
        internalType: "string",
        name: "name",
        type: "string",
      },
    ],
    name: "generateAccountManagerAddress",
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
        name: "subAccount",
        type: "address",
      },
      {
        internalType: "enum VirtualAccountIsolationType",
        name: "isolationType",
        type: "uint8",
      },
      {
        internalType: "uint256",
        name: "symbolId",
        type: "uint256",
      },
    ],
    name: "getActiveVAByKey",
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
    ],
    name: "getAffiliate",
    outputs: [
      {
        components: [
          {
            internalType: "address",
            name: "affiliateAddress",
            type: "address",
          },
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
            internalType: "address",
            name: "admin",
            type: "address",
          },
          {
            internalType: "address",
            name: "pendingAdmin",
            type: "address",
          },
          {
            internalType: "enum AffiliateState",
            name: "state",
            type: "uint8",
          },
          {
            internalType: "uint256",
            name: "symmioShare",
            type: "uint256",
          },
          {
            components: [
              {
                internalType: "address",
                name: "receiver",
                type: "address",
              },
              {
                internalType: "uint256",
                name: "share",
                type: "uint256",
              },
            ],
            internalType: "struct Stakeholder[]",
            name: "stakeholders",
            type: "tuple[]",
          },
          {
            internalType: "address",
            name: "feeDistributor",
            type: "address",
          },
          {
            internalType: "bytes",
            name: "metadata",
            type: "bytes",
          },
          {
            internalType: "address[]",
            name: "legacyMultiAccounts",
            type: "address[]",
          },
          {
            internalType: "address[]",
            name: "symmioCores",
            type: "address[]",
          },
          {
            internalType: "address",
            name: "accountManager",
            type: "address",
          },
          {
            internalType: "address",
            name: "registrant",
            type: "address",
          },
          {
            internalType: "uint256",
            name: "registrationNonce",
            type: "uint256",
          },
          {
            components: [
              {
                internalType: "bool",
                name: "exists",
                type: "bool",
              },
              {
                internalType: "uint256",
                name: "timestamp",
                type: "uint256",
              },
              {
                internalType: "uint256",
                name: "symmioShare",
                type: "uint256",
              },
              {
                components: [
                  {
                    internalType: "address",
                    name: "receiver",
                    type: "address",
                  },
                  {
                    internalType: "uint256",
                    name: "share",
                    type: "uint256",
                  },
                ],
                internalType: "struct Stakeholder[]",
                name: "stakeholders",
                type: "tuple[]",
              },
            ],
            internalType: "struct PendingFeeUpdate",
            name: "pendingFeeUpdate",
            type: "tuple",
          },
        ],
        internalType: "struct AffiliateDetail",
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
    name: "getAffiliateAdmin",
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
    ],
    name: "getAffiliateFeeDistributor",
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
        name: "account",
        type: "address",
      },
    ],
    name: "getAffiliateForAccount",
    outputs: [
      {
        internalType: "address",
        name: "affiliate",
        type: "address",
      },
      {
        internalType: "bool",
        name: "exists",
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
      {
        internalType: "bytes4[]",
        name: "selectors",
        type: "bytes4[]",
      },
    ],
    name: "getAffiliateSelectorConfigs",
    outputs: [
      {
        components: [
          {
            internalType: "bytes4",
            name: "selector",
            type: "bytes4",
          },
          {
            internalType: "address",
            name: "hook",
            type: "address",
          },
          {
            internalType: "bool",
            name: "hookAllowed",
            type: "bool",
          },
          {
            internalType: "bool",
            name: "callAllowed",
            type: "bool",
          },
        ],
        internalType: "struct AffiliateSelectorConfig[]",
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
        name: "affiliate",
        type: "address",
      },
    ],
    name: "getAffiliateStakeholders",
    outputs: [
      {
        components: [
          {
            internalType: "address",
            name: "receiver",
            type: "address",
          },
          {
            internalType: "uint256",
            name: "share",
            type: "uint256",
          },
        ],
        internalType: "struct Stakeholder[]",
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
        name: "affiliate",
        type: "address",
      },
    ],
    name: "getAffiliateState",
    outputs: [
      {
        internalType: "enum AffiliateState",
        name: "",
        type: "uint8",
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
    name: "getAffiliateSymmioCores",
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
        name: "affiliate",
        type: "address",
      },
    ],
    name: "getAffiliateSymmioShare",
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
        internalType: "bytes4",
        name: "selector",
        type: "bytes4",
      },
    ],
    name: "getHook",
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
        name: "owner",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "maxResults",
        type: "uint256",
      },
    ],
    name: "getLegacyAccountsOfUser",
    outputs: [
      {
        components: [
          {
            internalType: "address",
            name: "accountAddress",
            type: "address",
          },
          {
            internalType: "string",
            name: "name",
            type: "string",
          },
          {
            internalType: "address",
            name: "legacyContract",
            type: "address",
          },
          {
            internalType: "bool",
            name: "alreadyImported",
            type: "bool",
          },
        ],
        internalType: "struct LegacyAccountInfo[]",
        name: "accounts",
        type: "tuple[]",
      },
      {
        internalType: "bool",
        name: "hasMore",
        type: "bool",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "getLegacyMultiAccounts",
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
    inputs: [],
    name: "getOwner",
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
        name: "account",
        type: "address",
      },
    ],
    name: "getRelatedCore",
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
    name: "getSignerScope",
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
        name: "account",
        type: "address",
      },
    ],
    name: "getSubAccount",
    outputs: [
      {
        components: [
          {
            internalType: "address",
            name: "accountAddress",
            type: "address",
          },
          {
            internalType: "address",
            name: "owner",
            type: "address",
          },
          {
            internalType: "string",
            name: "name",
            type: "string",
          },
          {
            internalType: "bool",
            name: "isExists",
            type: "bool",
          },
          {
            internalType: "bool",
            name: "singleVAMode",
            type: "bool",
          },
          {
            internalType: "address",
            name: "affiliate",
            type: "address",
          },
          {
            internalType: "address",
            name: "symmioCore",
            type: "address",
          },
          {
            internalType: "bytes",
            name: "metadata",
            type: "bytes",
          },
          {
            internalType: "enum SubAccountIsolationType",
            name: "isolationType",
            type: "uint8",
          },
        ],
        internalType: "struct SubAccountDetail",
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
        name: "subAccount",
        type: "address",
      },
    ],
    name: "getSubAccountVirtualNonce",
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
        name: "owner",
        type: "address",
      },
    ],
    name: "getSubAccountsCountOfUser",
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
        name: "owner",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "offset",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "limit",
        type: "uint256",
      },
    ],
    name: "getUserSubAccounts",
    outputs: [
      {
        components: [
          {
            internalType: "address",
            name: "accountAddress",
            type: "address",
          },
          {
            internalType: "address",
            name: "owner",
            type: "address",
          },
          {
            internalType: "string",
            name: "name",
            type: "string",
          },
          {
            internalType: "bool",
            name: "isExists",
            type: "bool",
          },
          {
            internalType: "bool",
            name: "singleVAMode",
            type: "bool",
          },
          {
            internalType: "address",
            name: "affiliate",
            type: "address",
          },
          {
            internalType: "address",
            name: "symmioCore",
            type: "address",
          },
          {
            internalType: "bytes",
            name: "metadata",
            type: "bytes",
          },
          {
            internalType: "enum SubAccountIsolationType",
            name: "isolationType",
            type: "uint8",
          },
        ],
        internalType: "struct SubAccountDetail[]",
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
        name: "owner",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "offset",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "limit",
        type: "uint256",
      },
    ],
    name: "getUserSubAccountsAddresses",
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
        name: "account",
        type: "address",
      },
    ],
    name: "getVirtualAccount",
    outputs: [
      {
        components: [
          {
            internalType: "address",
            name: "accountAddress",
            type: "address",
          },
          {
            internalType: "address",
            name: "parentAccount",
            type: "address",
          },
          {
            internalType: "uint256",
            name: "symbolId",
            type: "uint256",
          },
          {
            internalType: "bool",
            name: "isExists",
            type: "bool",
          },
          {
            internalType: "bytes",
            name: "metadata",
            type: "bytes",
          },
          {
            internalType: "enum VirtualAccountIsolationType",
            name: "isolationType",
            type: "uint8",
          },
        ],
        internalType: "struct VirtualAccountDetail",
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
        name: "account",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "offset",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "limit",
        type: "uint256",
      },
    ],
    name: "getVirtualAccountQuoteIds",
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
        name: "subAccount",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "offset",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "limit",
        type: "uint256",
      },
    ],
    name: "getVirtualAccountsAddressesOfSubAccount",
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
        name: "subAccount",
        type: "address",
      },
    ],
    name: "getVirtualAccountsCountOfSubAccount",
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
        name: "subAccount",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "offset",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "limit",
        type: "uint256",
      },
    ],
    name: "getVirtualAccountsOfSubAccount",
    outputs: [
      {
        components: [
          {
            internalType: "address",
            name: "accountAddress",
            type: "address",
          },
          {
            internalType: "address",
            name: "parentAccount",
            type: "address",
          },
          {
            internalType: "uint256",
            name: "symbolId",
            type: "uint256",
          },
          {
            internalType: "bool",
            name: "isExists",
            type: "bool",
          },
          {
            internalType: "bytes",
            name: "metadata",
            type: "bytes",
          },
          {
            internalType: "enum VirtualAccountIsolationType",
            name: "isolationType",
            type: "uint8",
          },
        ],
        internalType: "struct VirtualAccountDetail[]",
        name: "",
        type: "tuple[]",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "globalNonce",
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
        name: "account",
        type: "address",
      },
    ],
    name: "isLegacyMultiAccount",
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
      {
        internalType: "bytes4",
        name: "selector",
        type: "bytes4",
      },
      {
        internalType: "address",
        name: "operator",
        type: "address",
      },
    ],
    name: "isOperator",
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
        name: "core",
        type: "address",
      },
    ],
    name: "isWhitelistedSymmioCore",
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
        name: "account",
        type: "address",
      },
    ],
    name: "ownerOf",
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
    name: "paused",
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
    inputs: [
      {
        internalType: "address",
        name: "subAccount",
        type: "address",
      },
      {
        internalType: "enum VirtualAccountIsolationType",
        name: "isolationType",
        type: "uint8",
      },
      {
        internalType: "uint256",
        name: "symbolId",
        type: "uint256",
      },
    ],
    name: "predictNextVirtualAccountAddress",
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
    name: "symmioFeeReceiver",
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
    ],
    name: "SafeERC20FailedOperation",
    type: "error",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "affiliate",
        type: "address",
      },
    ],
    name: "AdminTransferCancelled",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "affiliate",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "oldAdmin",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "newAdmin",
        type: "address",
      },
    ],
    name: "AdminTransferCompleted",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "affiliate",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "newAdmin",
        type: "address",
      },
    ],
    name: "AdminTransferProposed",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "affiliate",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "feeDistributor",
        type: "address",
      },
    ],
    name: "AffiliateApproved",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "affiliate",
        type: "address",
      },
    ],
    name: "AffiliatePaused",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "affiliate",
        type: "address",
      },
      {
        indexed: false,
        internalType: "string",
        name: "name",
        type: "string",
      },
    ],
    name: "AffiliateRegistered",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "affiliate",
        type: "address",
      },
    ],
    name: "AffiliateUnpaused",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "affiliate",
        type: "address",
      },
      {
        indexed: false,
        internalType: "string",
        name: "name",
        type: "string",
      },
      {
        indexed: false,
        internalType: "string",
        name: "brandColor",
        type: "string",
      },
    ],
    name: "AffiliateUpdated",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "affiliate",
        type: "address",
      },
    ],
    name: "FeeUpdateCancelled",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "affiliate",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "symmio",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "amount",
        type: "uint256",
      },
    ],
    name: "FeesClaimed",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
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
    name: "FeesDistributed",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "affiliate",
        type: "address",
      },
      {
        indexed: true,
        internalType: "bytes4",
        name: "selector",
        type: "bytes4",
      },
    ],
    name: "HookRemoved",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "affiliate",
        type: "address",
      },
      {
        indexed: true,
        internalType: "bytes4",
        name: "selector",
        type: "bytes4",
      },
      {
        indexed: false,
        internalType: "address",
        name: "hook",
        type: "address",
      },
    ],
    name: "HookSet",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "affiliate",
        type: "address",
      },
      {
        indexed: true,
        internalType: "bytes4",
        name: "selector",
        type: "bytes4",
      },
      {
        indexed: true,
        internalType: "address",
        name: "operator",
        type: "address",
      },
      {
        indexed: false,
        internalType: "bool",
        name: "status",
        type: "bool",
      },
    ],
    name: "OperatorSet",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "affiliate",
        type: "address",
      },
    ],
    name: "RegistrationCancelled",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "affiliate",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "admin",
        type: "address",
      },
    ],
    name: "RegistrationRejected",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "affiliate",
        type: "address",
      },
    ],
    name: "StakeholdersUpdateRequested",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "affiliate",
        type: "address",
      },
    ],
    name: "StakeholdersUpdated",
    type: "event",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "affiliate",
        type: "address",
      },
    ],
    name: "acceptAdminTransfer",
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
    name: "approveAffiliate",
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
    name: "approveFeeUpdate",
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
        name: "symmio",
        type: "address",
      },
      {
        internalType: "bytes",
        name: "callData",
        type: "bytes",
      },
    ],
    name: "callAsAffiliate",
    outputs: [
      {
        internalType: "bytes",
        name: "result",
        type: "bytes",
      },
    ],
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
    name: "cancelAdminTransfer",
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
    name: "cancelFeeUpdate",
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
    name: "cancelRegistration",
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
        name: "symmio",
        type: "address",
      },
    ],
    name: "claimAllFees",
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
        name: "symmio",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "amount",
        type: "uint256",
      },
    ],
    name: "claimFees",
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
    name: "pauseAffiliate",
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
        name: "newAdmin",
        type: "address",
      },
    ],
    name: "proposeAdminTransfer",
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
    name: "rejectRegistration",
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
        internalType: "bytes4",
        name: "selector",
        type: "bytes4",
      },
    ],
    name: "removeHook",
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
            internalType: "address",
            name: "receiver",
            type: "address",
          },
          {
            internalType: "uint256",
            name: "share",
            type: "uint256",
          },
        ],
        internalType: "struct Stakeholder[]",
        name: "newStakeholders",
        type: "tuple[]",
      },
      {
        internalType: "uint256",
        name: "newSymmioShare",
        type: "uint256",
      },
    ],
    name: "requestFeeUpdate",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
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
            internalType: "address",
            name: "admin",
            type: "address",
          },
          {
            components: [
              {
                internalType: "address",
                name: "receiver",
                type: "address",
              },
              {
                internalType: "uint256",
                name: "share",
                type: "uint256",
              },
            ],
            internalType: "struct Stakeholder[]",
            name: "stakeholders",
            type: "tuple[]",
          },
          {
            internalType: "uint256",
            name: "symmioShare",
            type: "uint256",
          },
          {
            internalType: "bytes",
            name: "metadata",
            type: "bytes",
          },
          {
            internalType: "address[]",
            name: "legacyMultiAccounts",
            type: "address[]",
          },
          {
            internalType: "address[]",
            name: "symmioCores",
            type: "address[]",
          },
        ],
        internalType: "struct AffiliateRegistration",
        name: "reg",
        type: "tuple",
      },
    ],
    name: "requestToRegisterAffiliate",
    outputs: [
      {
        internalType: "address",
        name: "affiliateAddress",
        type: "address",
      },
    ],
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
        internalType: "bytes4",
        name: "selector",
        type: "bytes4",
      },
      {
        internalType: "address",
        name: "hook",
        type: "address",
      },
    ],
    name: "setHook",
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
        internalType: "bytes4",
        name: "selector",
        type: "bytes4",
      },
      {
        internalType: "address",
        name: "operator",
        type: "address",
      },
      {
        internalType: "bool",
        name: "status",
        type: "bool",
      },
    ],
    name: "setOperator",
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
    name: "unpauseAffiliate",
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
        internalType: "string",
        name: "name",
        type: "string",
      },
      {
        internalType: "string",
        name: "brandColor",
        type: "string",
      },
    ],
    name: "updateAffiliateDetails",
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
        name: "virtualAccount",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "subAccount",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "amount",
        type: "uint256",
      },
    ],
    name: "EmergencyMarginRecovered",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "virtualAccount",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "subAccount",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "amount",
        type: "uint256",
      },
    ],
    name: "RemoveMargin",
    type: "event",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "virtualAccount",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "amount",
        type: "uint256",
      },
    ],
    name: "addMargin",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "subAccount",
        type: "address",
      },
      {
        internalType: "enum VirtualAccountIsolationType",
        name: "isolationType",
        type: "uint8",
      },
      {
        internalType: "uint256",
        name: "symbolId",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "amount",
        type: "uint256",
      },
    ],
    name: "addMarginToNextVA",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "subAccount",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "nonce",
        type: "uint256",
      },
    ],
    name: "emergencyRecoverMargin",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "virtualAccount",
        type: "address",
      },
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
            internalType: "struct ISymmio.SchnorrSign",
            name: "sigs",
            type: "tuple",
          },
        ],
        internalType: "struct ISymmio.SingleUpnlSig",
        name: "upnlSig",
        type: "tuple",
      },
    ],
    name: "removeMargin",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "virtualAccount",
        type: "address",
      },
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
            name: "fundingDebt",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "pendingBalance",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "scaledLockedBalance",
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
            internalType: "struct ISymmio.SchnorrSign",
            name: "sigs",
            type: "tuple",
          },
        ],
        internalType: "struct ISymmio.SingleUpnlWithPendingBalanceSig",
        name: "upnlSig",
        type: "tuple",
      },
    ],
    name: "safeRemoveMargin",
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
        name: "affiliate",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "accountManager",
        type: "address",
      },
    ],
    name: "AccountManagerDeployed",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "bytes",
        name: "oldImplementation",
        type: "bytes",
      },
      {
        indexed: false,
        internalType: "bytes",
        name: "newImplementation",
        type: "bytes",
      },
    ],
    name: "AccountManagerImplementationUpdated",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "affiliate",
        type: "address",
      },
      {
        indexed: false,
        internalType: "bytes4[]",
        name: "selectors",
        type: "bytes4[]",
      },
      {
        indexed: false,
        internalType: "bool",
        name: "allowed",
        type: "bool",
      },
    ],
    name: "CallAllowedSelectorsSet",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "affiliate",
        type: "address",
      },
      {
        indexed: false,
        internalType: "bytes4[]",
        name: "selectors",
        type: "bytes4[]",
      },
      {
        indexed: false,
        internalType: "bool",
        name: "allowed",
        type: "bool",
      },
    ],
    name: "HookAllowedSelectorsSet",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "bytes32",
        name: "role",
        type: "bytes32",
      },
      {
        indexed: true,
        internalType: "address",
        name: "account",
        type: "address",
      },
      {
        indexed: false,
        internalType: "bool",
        name: "status",
        type: "bool",
      },
      {
        indexed: true,
        internalType: "address",
        name: "sender",
        type: "address",
      },
    ],
    name: "RoleAdminSet",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "bytes32",
        name: "role",
        type: "bytes32",
      },
      {
        indexed: true,
        internalType: "address",
        name: "account",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "sender",
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
        indexed: true,
        internalType: "bytes32",
        name: "role",
        type: "bytes32",
      },
      {
        indexed: true,
        internalType: "address",
        name: "account",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "sender",
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
        indexed: true,
        internalType: "address",
        name: "signer",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "scope",
        type: "address",
      },
    ],
    name: "SignerScopeUpdated",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "address",
        name: "oldSigner",
        type: "address",
      },
      {
        indexed: false,
        internalType: "address",
        name: "newSigner",
        type: "address",
      },
    ],
    name: "SignerUpdated",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "affiliate",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "core",
        type: "address",
      },
    ],
    name: "SymmioCoreAddedToAffiliate",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "oldReceiver",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "newReceiver",
        type: "address",
      },
    ],
    name: "SymmioFeeReceiverUpdated",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "core",
        type: "address",
      },
      {
        indexed: false,
        internalType: "bool",
        name: "status",
        type: "bool",
      },
    ],
    name: "WhitelistedSymmioCoreSet",
    type: "event",
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
        name: "affiliate",
        type: "address",
      },
      {
        internalType: "address",
        name: "core",
        type: "address",
      },
    ],
    name: "addSymmioCoreToAffiliate",
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
    inputs: [],
    name: "pause",
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
        internalType: "bytes",
        name: "implementation",
        type: "bytes",
      },
    ],
    name: "setAccountManagerImplementation",
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
        internalType: "bytes4[]",
        name: "selectors",
        type: "bytes4[]",
      },
      {
        internalType: "bool",
        name: "allowed",
        type: "bool",
      },
    ],
    name: "setCallAllowedSelectors",
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
        internalType: "bytes4[]",
        name: "selectors",
        type: "bytes4[]",
      },
      {
        internalType: "bool",
        name: "allowed",
        type: "bool",
      },
    ],
    name: "setHookAllowedSelectors",
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
      {
        internalType: "bool",
        name: "status",
        type: "bool",
      },
    ],
    name: "setRoleAdmin",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "_signer",
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
        name: "_signer",
        type: "address",
      },
      {
        internalType: "address",
        name: "_scope",
        type: "address",
      },
    ],
    name: "setSignerScoped",
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
    ],
    name: "setSymmioFeeReceiver",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "signerOrZero",
        type: "address",
      },
    ],
    name: "setTransientSigner",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "signerOrZero",
        type: "address",
      },
      {
        internalType: "address",
        name: "scope",
        type: "address",
      },
    ],
    name: "setTransientSignerScoped",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "core",
        type: "address",
      },
      {
        internalType: "bool",
        name: "status",
        type: "bool",
      },
    ],
    name: "setWhitelistedSymmioCore",
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
    inputs: [],
    name: "unpause",
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
        name: "pendingOwner",
        type: "address",
      },
    ],
    name: "OwnershipTransferCanceled",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "currentOwner",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "pendingOwner",
        type: "address",
      },
    ],
    name: "OwnershipTransferStarted",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "previousOwner",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "newOwner",
        type: "address",
      },
    ],
    name: "OwnershipTransferred",
    type: "event",
  },
  {
    inputs: [
      {
        internalType: "bytes",
        name: "cd",
        type: "bytes",
      },
    ],
    name: "decodeQuoteParams",
    outputs: [
      {
        components: [
          {
            internalType: "uint256",
            name: "symbolId",
            type: "uint256",
          },
          {
            internalType: "enum ISymmio.PositionType",
            name: "positionType",
            type: "uint8",
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
            name: "quantity",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "price",
            type: "uint256",
          },
          {
            internalType: "enum ISymmio.OrderType",
            name: "orderType",
            type: "uint8",
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
                internalType: "struct ISymmio.SchnorrSign",
                name: "sigs",
                type: "tuple",
              },
            ],
            internalType: "struct ISymmio.SingleUpnlAndPriceSig",
            name: "sig",
            type: "tuple",
          },
          {
            internalType: "address",
            name: "affiliate",
            type: "address",
          },
        ],
        internalType: "struct QuoteParams",
        name: "",
        type: "tuple",
      },
    ],
    stateMutability: "pure",
    type: "function",
  },
  {
    inputs: [],
    name: "ACCOUNT_CREATOR_ROLE",
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
    name: "APPROVER_ROLE",
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
    name: "DEPLOYER_ROLE",
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
    name: "DISTRIBUTOR_ROLE",
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
    name: "SETTER_ROLE",
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
    name: "SIGNER_SETTER_ROLE",
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
] as const;
