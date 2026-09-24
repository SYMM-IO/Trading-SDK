/**
 * Full ABI for the SYMMIO `InstantLayer` contract at version **0.8.6**.
 *
 * @remarks
 * Complete, unabridged copy of the source artifact — never trim it to the
 * methods the SDK currently wraps.
 *
 * @see Source of truth — the SYMMIO `perps-core` repo, pinned to the matching
 * version tag: {@link https://github.com/SYMM-IO/perps-core/blob/version_0.8.6/abis/instantLayer.json}.
 */
export const instantLayerAbi = [
  {
    inputs: [
      {
        internalType: "address",
        name: "_symmio",
        type: "address",
      },
      {
        internalType: "address",
        name: "_admin",
        type: "address",
      },
    ],
    stateMutability: "nonpayable",
    type: "constructor",
  },
  {
    inputs: [],
    name: "AccessControlBadConfirmation",
    type: "error",
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
        name: "neededRole",
        type: "bytes32",
      },
    ],
    name: "AccessControlUnauthorizedAccount",
    type: "error",
  },
  {
    inputs: [],
    name: "AccountLayerNotSet",
    type: "error",
  },
  {
    inputs: [],
    name: "ArrayLengthMismatch",
    type: "error",
  },
  {
    inputs: [
      {
        internalType: "bytes",
        name: "res",
        type: "bytes",
      },
      {
        internalType: "uint256",
        name: "length",
        type: "uint256",
      },
    ],
    name: "BadSourceResultLength",
    type: "error",
  },
  {
    inputs: [],
    name: "CallDataLengthMismatch",
    type: "error",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "deadline",
        type: "uint256",
      },
    ],
    name: "DeadlineExpired",
    type: "error",
  },
  {
    inputs: [
      {
        internalType: "bytes32",
        name: "hash",
        type: "bytes32",
      },
    ],
    name: "DelegationAlreadyExecuted",
    type: "error",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "expiryTimestamp",
        type: "uint256",
      },
    ],
    name: "DelegationExpired",
    type: "error",
  },
  {
    inputs: [],
    name: "EmptyArray",
    type: "error",
  },
  {
    inputs: [],
    name: "EmptyBatch",
    type: "error",
  },
  {
    inputs: [],
    name: "EmptyTemplate",
    type: "error",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "offset",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "length",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "callDataLength",
        type: "uint256",
      },
    ],
    name: "FlexFieldOutOfBounds",
    type: "error",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "offset",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "length",
        type: "uint256",
      },
    ],
    name: "InsertionPointOutOfBounds",
    type: "error",
  },
  {
    inputs: [],
    name: "InvalidCallData",
    type: "error",
  },
  {
    inputs: [],
    name: "InvalidDelegation",
    type: "error",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "expected",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "provided",
        type: "uint256",
      },
    ],
    name: "InvalidFlexFillLength",
    type: "error",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "fieldIndex",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "expected",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "provided",
        type: "uint256",
      },
    ],
    name: "InvalidFlexFillValueLength",
    type: "error",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "fieldIndex",
        type: "uint256",
      },
    ],
    name: "InvalidFlexFillerSignature",
    type: "error",
  },
  {
    inputs: [],
    name: "InvalidGrantOperation",
    type: "error",
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
        name: "expected",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "provided",
        type: "uint256",
      },
    ],
    name: "InvalidNonce",
    type: "error",
  },
  {
    inputs: [],
    name: "InvalidShortString",
    type: "error",
  },
  {
    inputs: [],
    name: "InvalidSignature",
    type: "error",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "sourceIndex",
        type: "uint256",
      },
    ],
    name: "InvalidSourceIndex",
    type: "error",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "templateId",
        type: "uint256",
      },
    ],
    name: "InvalidTemplate",
    type: "error",
  },
  {
    inputs: [
      {
        internalType: "bytes32",
        name: "hash",
        type: "bytes32",
      },
      {
        internalType: "uint256",
        name: "maxUses",
        type: "uint256",
      },
    ],
    name: "MaxUsesExceeded",
    type: "error",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "signer",
        type: "address",
      },
      {
        internalType: "address",
        name: "account",
        type: "address",
      },
    ],
    name: "MismatchSignerAndAccount",
    type: "error",
  },
  {
    inputs: [],
    name: "MissingSourceResult",
    type: "error",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "sender",
        type: "address",
      },
      {
        internalType: "address",
        name: "account",
        type: "address",
      },
    ],
    name: "NotOwnerOfAccount",
    type: "error",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "operationIndex",
        type: "uint256",
      },
      {
        internalType: "bytes",
        name: "revertData",
        type: "bytes",
      },
    ],
    name: "OperationFailed",
    type: "error",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "partyB",
        type: "address",
      },
    ],
    name: "PartyBAlreadyRegistered",
    type: "error",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "partyB",
        type: "address",
      },
    ],
    name: "PartyBNotRegistered",
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
        internalType: "uint256",
        name: "eta",
        type: "uint256",
      },
    ],
    name: "RevocationCooldownNotOver",
    type: "error",
  },
  {
    inputs: [],
    name: "SelfDelegation",
    type: "error",
  },
  {
    inputs: [
      {
        internalType: "string",
        name: "str",
        type: "string",
      },
    ],
    name: "StringTooLong",
    type: "error",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "target",
        type: "address",
      },
    ],
    name: "TargetNotWhitelisted",
    type: "error",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "templateId",
        type: "uint256",
      },
    ],
    name: "TemplateNotActive",
    type: "error",
  },
  {
    inputs: [],
    name: "TemplateOperationLengthMismatch",
    type: "error",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "accountLayer",
        type: "address",
      },
    ],
    name: "UnregisteredAccountLayer",
    type: "error",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "partyB",
        type: "address",
      },
    ],
    name: "UnregisteredPartyB",
    type: "error",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "oldAccountLayer",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "newAccountLayer",
        type: "address",
      },
    ],
    name: "AccountLayerUpdated",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "delegator",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "delegate",
        type: "address",
      },
      {
        indexed: false,
        internalType: "bytes4",
        name: "selector",
        type: "bytes4",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "expiryTimestamp",
        type: "uint256",
      },
    ],
    name: "DelegationGranted",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "delegator",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "newNonce",
        type: "uint256",
      },
    ],
    name: "DelegationNonceIncremented",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "delegator",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "delegate",
        type: "address",
      },
      {
        indexed: false,
        internalType: "bytes4",
        name: "selector",
        type: "bytes4",
      },
    ],
    name: "DelegationSelectorRevoked",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [],
    name: "EIP712DomainChanged",
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
        indexed: false,
        internalType: "uint256",
        name: "newNonce",
        type: "uint256",
      },
    ],
    name: "NonceIncremented",
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
    name: "PartyBRegistered",
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
    name: "PartyBUnregistered",
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
    name: "RevocationCooldownUpdated",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "delegator",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "delegate",
        type: "address",
      },
      {
        indexed: false,
        internalType: "bytes4",
        name: "selector",
        type: "bytes4",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "eta",
        type: "uint256",
      },
    ],
    name: "RevocationScheduled",
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
        internalType: "bytes32",
        name: "previousAdminRole",
        type: "bytes32",
      },
      {
        indexed: true,
        internalType: "bytes32",
        name: "newAdminRole",
        type: "bytes32",
      },
    ],
    name: "RoleAdminChanged",
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
        name: "target",
        type: "address",
      },
      {
        indexed: false,
        internalType: "bool",
        name: "allowed",
        type: "bool",
      },
    ],
    name: "TargetWhitelistUpdated",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "uint256",
        name: "templateId",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "string",
        name: "name",
        type: "string",
      },
    ],
    name: "TemplateAdded",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "uint256",
        name: "templateId",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "bool",
        name: "active",
        type: "bool",
      },
    ],
    name: "TemplateUpdated",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "bool",
        name: "enabled",
        type: "bool",
      },
    ],
    name: "TransientContextEnabledUpdated",
    type: "event",
  },
  {
    inputs: [],
    name: "ACCOUNT_TYPEHASH",
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
    name: "DELEGATION_INFO_TYPEHASH",
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
    name: "FLEX_FIELD_TYPEHASH",
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
    name: "FLEX_FILL_AUTH_TYPEHASH",
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
    name: "OPERATOR_ROLE",
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
    name: "REPLAY_HEADER_TYPEHASH",
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
    name: "REVOKER_ROLE",
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
    name: "SIGNED_DELEGATION_TYPEHASH",
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
    name: "accountLayer",
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
        internalType: "string",
        name: "name",
        type: "string",
      },
      {
        components: [
          {
            internalType: "uint256[]",
            name: "insertionPoints",
            type: "uint256[]",
          },
          {
            internalType: "uint256[]",
            name: "sourceIndices",
            type: "uint256[]",
          },
          {
            internalType: "uint256[]",
            name: "sourceOffsets",
            type: "uint256[]",
          },
        ],
        internalType: "struct InstantLayer.Operation[]",
        name: "operations",
        type: "tuple[]",
      },
    ],
    name: "addTemplate",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "",
        type: "address",
      },
    ],
    name: "delegationNonces",
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
    inputs: [],
    name: "domainSeparator",
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
    name: "eip712Domain",
    outputs: [
      {
        internalType: "bytes1",
        name: "fields",
        type: "bytes1",
      },
      {
        internalType: "string",
        name: "name",
        type: "string",
      },
      {
        internalType: "string",
        name: "version",
        type: "string",
      },
      {
        internalType: "uint256",
        name: "chainId",
        type: "uint256",
      },
      {
        internalType: "address",
        name: "verifyingContract",
        type: "address",
      },
      {
        internalType: "bytes32",
        name: "salt",
        type: "bytes32",
      },
      {
        internalType: "uint256[]",
        name: "extensions",
        type: "uint256[]",
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
            internalType: "address",
            name: "signer",
            type: "address",
          },
          {
            internalType: "address",
            name: "target",
            type: "address",
          },
          {
            internalType: "bytes",
            name: "callData",
            type: "bytes",
          },
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
            name: "signerAccount",
            type: "tuple",
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
                name: "length",
                type: "uint256",
              },
              {
                internalType: "address",
                name: "authorizedFlexFiller",
                type: "address",
              },
            ],
            internalType: "struct InstantLayer.FlexField[]",
            name: "flexFields",
            type: "tuple[]",
          },
          {
            internalType: "uint256",
            name: "maxUses",
            type: "uint256",
          },
          {
            components: [
              {
                internalType: "uint256",
                name: "nonce",
                type: "uint256",
              },
              {
                internalType: "uint256",
                name: "deadline",
                type: "uint256",
              },
              {
                internalType: "bytes32",
                name: "salt",
                type: "bytes32",
              },
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
      {
        internalType: "bytes[]",
        name: "signatures",
        type: "bytes[]",
      },
      {
        internalType: "bytes[][]",
        name: "fills",
        type: "bytes[][]",
      },
      {
        internalType: "bytes[][]",
        name: "flexFillerSignatures",
        type: "bytes[][]",
      },
    ],
    name: "executeBatch",
    outputs: [
      {
        internalType: "bytes[]",
        name: "results",
        type: "bytes[]",
      },
    ],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "templateId",
        type: "uint256",
      },
      {
        components: [
          {
            internalType: "address",
            name: "signer",
            type: "address",
          },
          {
            internalType: "address",
            name: "target",
            type: "address",
          },
          {
            internalType: "bytes",
            name: "callData",
            type: "bytes",
          },
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
            name: "signerAccount",
            type: "tuple",
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
                name: "length",
                type: "uint256",
              },
              {
                internalType: "address",
                name: "authorizedFlexFiller",
                type: "address",
              },
            ],
            internalType: "struct InstantLayer.FlexField[]",
            name: "flexFields",
            type: "tuple[]",
          },
          {
            internalType: "uint256",
            name: "maxUses",
            type: "uint256",
          },
          {
            components: [
              {
                internalType: "uint256",
                name: "nonce",
                type: "uint256",
              },
              {
                internalType: "uint256",
                name: "deadline",
                type: "uint256",
              },
              {
                internalType: "bytes32",
                name: "salt",
                type: "bytes32",
              },
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
      {
        internalType: "bytes[]",
        name: "signatures",
        type: "bytes[]",
      },
      {
        internalType: "bytes[][]",
        name: "fills",
        type: "bytes[][]",
      },
      {
        internalType: "bytes[][]",
        name: "flexFillerSignatures",
        type: "bytes[][]",
      },
    ],
    name: "executeTemplate",
    outputs: [
      {
        internalType: "bytes[]",
        name: "results",
        type: "bytes[]",
      },
    ],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
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
        name: "delegate",
        type: "address",
      },
      {
        internalType: "bytes4[]",
        name: "selectors",
        type: "bytes4[]",
      },
    ],
    name: "finalizeRevokeDelegation",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
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
        name: "_delegator",
        type: "tuple",
      },
      {
        internalType: "address[]",
        name: "delegates",
        type: "address[]",
      },
      {
        internalType: "bytes4[][]",
        name: "selectors",
        type: "bytes4[][]",
      },
    ],
    name: "getActiveDelegations",
    outputs: [
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
        internalType: "struct InstantLayer.DelegationInfo[]",
        name: "activeDelegates",
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
            name: "delegationInfo",
            type: "tuple",
          },
          {
            components: [
              {
                internalType: "uint256",
                name: "nonce",
                type: "uint256",
              },
              {
                internalType: "uint256",
                name: "deadline",
                type: "uint256",
              },
              {
                internalType: "bytes32",
                name: "salt",
                type: "bytes32",
              },
            ],
            internalType: "struct InstantLayer.ReplayAttackHeader",
            name: "replayAttackHeader",
            type: "tuple",
          },
        ],
        internalType: "struct InstantLayer.SignedDelegation",
        name: "signedDelegation",
        type: "tuple",
      },
    ],
    name: "getDelegationHash",
    outputs: [
      {
        internalType: "bytes32",
        name: "msgDigest",
        type: "bytes32",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "bytes32",
        name: "opHash",
        type: "bytes32",
      },
      {
        internalType: "uint256",
        name: "fieldIndex",
        type: "uint256",
      },
      {
        internalType: "bytes",
        name: "value",
        type: "bytes",
      },
    ],
    name: "getFlexFillAuthHash",
    outputs: [
      {
        internalType: "bytes32",
        name: "msgDigest",
        type: "bytes32",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "getNextTemplateId",
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
        components: [
          {
            internalType: "address",
            name: "signer",
            type: "address",
          },
          {
            internalType: "address",
            name: "target",
            type: "address",
          },
          {
            internalType: "bytes",
            name: "callData",
            type: "bytes",
          },
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
            name: "signerAccount",
            type: "tuple",
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
                name: "length",
                type: "uint256",
              },
              {
                internalType: "address",
                name: "authorizedFlexFiller",
                type: "address",
              },
            ],
            internalType: "struct InstantLayer.FlexField[]",
            name: "flexFields",
            type: "tuple[]",
          },
          {
            internalType: "uint256",
            name: "maxUses",
            type: "uint256",
          },
          {
            components: [
              {
                internalType: "uint256",
                name: "nonce",
                type: "uint256",
              },
              {
                internalType: "uint256",
                name: "deadline",
                type: "uint256",
              },
              {
                internalType: "bytes32",
                name: "salt",
                type: "bytes32",
              },
            ],
            internalType: "struct InstantLayer.ReplayAttackHeader",
            name: "replayAttackHeader",
            type: "tuple",
          },
        ],
        internalType: "struct InstantLayer.SignedOperation",
        name: "signedOp",
        type: "tuple",
      },
    ],
    name: "getOperationHash",
    outputs: [
      {
        internalType: "bytes32",
        name: "msgDigest",
        type: "bytes32",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "bytes32",
        name: "role",
        type: "bytes32",
      },
    ],
    name: "getRoleAdmin",
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
    inputs: [
      {
        internalType: "bytes32",
        name: "role",
        type: "bytes32",
      },
      {
        internalType: "uint256",
        name: "index",
        type: "uint256",
      },
    ],
    name: "getRoleMember",
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
        internalType: "bytes32",
        name: "role",
        type: "bytes32",
      },
    ],
    name: "getRoleMemberCount",
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
        name: "role",
        type: "bytes32",
      },
    ],
    name: "getRoleMembers",
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
        internalType: "uint256",
        name: "templateId",
        type: "uint256",
      },
    ],
    name: "getTemplate",
    outputs: [
      {
        components: [
          {
            internalType: "string",
            name: "name",
            type: "string",
          },
          {
            components: [
              {
                internalType: "uint256[]",
                name: "insertionPoints",
                type: "uint256[]",
              },
              {
                internalType: "uint256[]",
                name: "sourceIndices",
                type: "uint256[]",
              },
              {
                internalType: "uint256[]",
                name: "sourceOffsets",
                type: "uint256[]",
              },
            ],
            internalType: "struct InstantLayer.Operation[]",
            name: "operations",
            type: "tuple[]",
          },
          {
            internalType: "bool",
            name: "active",
            type: "bool",
          },
        ],
        internalType: "struct InstantLayer.Template",
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
        name: "templateId",
        type: "uint256",
      },
    ],
    name: "getTemplateOperations",
    outputs: [
      {
        components: [
          {
            internalType: "uint256[]",
            name: "insertionPoints",
            type: "uint256[]",
          },
          {
            internalType: "uint256[]",
            name: "sourceIndices",
            type: "uint256[]",
          },
          {
            internalType: "uint256[]",
            name: "sourceOffsets",
            type: "uint256[]",
          },
        ],
        internalType: "struct InstantLayer.Operation[]",
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
        name: "startId",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "limit",
        type: "uint256",
      },
    ],
    name: "getTemplates",
    outputs: [
      {
        components: [
          {
            internalType: "string",
            name: "name",
            type: "string",
          },
          {
            components: [
              {
                internalType: "uint256[]",
                name: "insertionPoints",
                type: "uint256[]",
              },
              {
                internalType: "uint256[]",
                name: "sourceIndices",
                type: "uint256[]",
              },
              {
                internalType: "uint256[]",
                name: "sourceOffsets",
                type: "uint256[]",
              },
            ],
            internalType: "struct InstantLayer.Operation[]",
            name: "operations",
            type: "tuple[]",
          },
          {
            internalType: "bool",
            name: "active",
            type: "bool",
          },
        ],
        internalType: "struct InstantLayer.Template[]",
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
            name: "delegationInfo",
            type: "tuple",
          },
          {
            components: [
              {
                internalType: "uint256",
                name: "nonce",
                type: "uint256",
              },
              {
                internalType: "uint256",
                name: "deadline",
                type: "uint256",
              },
              {
                internalType: "bytes32",
                name: "salt",
                type: "bytes32",
              },
            ],
            internalType: "struct InstantLayer.ReplayAttackHeader",
            name: "replayAttackHeader",
            type: "tuple",
          },
        ],
        internalType: "struct InstantLayer.SignedDelegation",
        name: "signedDelegation",
        type: "tuple",
      },
      {
        internalType: "bytes",
        name: "signature",
        type: "bytes",
      },
    ],
    name: "grantBatchDelegationBySig",
    outputs: [],
    stateMutability: "nonpayable",
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
  {
    inputs: [
      {
        internalType: "bytes32",
        name: "role",
        type: "bytes32",
      },
      {
        internalType: "address",
        name: "account",
        type: "address",
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
        internalType: "bytes32",
        name: "role",
        type: "bytes32",
      },
      {
        internalType: "address",
        name: "account",
        type: "address",
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
        name: "delegate",
        type: "address",
      },
      {
        internalType: "bytes4[]",
        name: "selectors",
        type: "bytes4[]",
      },
    ],
    name: "initiateRevokeDelegation",
    outputs: [],
    stateMutability: "nonpayable",
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
        internalType: "address",
        name: "addr",
        type: "address",
      },
    ],
    name: "isPartyBRegistered",
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
    name: "nextTemplateId",
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
        name: "",
        type: "address",
      },
    ],
    name: "nonces",
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
        name: "",
        type: "bytes32",
      },
    ],
    name: "operationUsageCount",
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
    name: "pendingRevocationEta",
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
        internalType: "address[]",
        name: "partyBs",
        type: "address[]",
      },
    ],
    name: "registerPartyBs",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "",
        type: "address",
      },
    ],
    name: "registeredPartyBs",
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
        internalType: "bytes32",
        name: "role",
        type: "bytes32",
      },
      {
        internalType: "address",
        name: "callerConfirmation",
        type: "address",
      },
    ],
    name: "renounceRole",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "revocationCooldown",
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
        name: "role",
        type: "bytes32",
      },
      {
        internalType: "address",
        name: "account",
        type: "address",
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
        name: "_accountLayer",
        type: "address",
      },
    ],
    name: "setAccountLayer",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "newCooldown",
        type: "uint256",
      },
    ],
    name: "setRevocationCooldown",
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
        internalType: "bool",
        name: "allowed",
        type: "bool",
      },
    ],
    name: "setTargetWhitelist",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "templateId",
        type: "uint256",
      },
      {
        internalType: "bool",
        name: "active",
        type: "bool",
      },
    ],
    name: "setTemplateActive",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "templateId",
        type: "uint256",
      },
      {
        internalType: "bool",
        name: "mode",
        type: "bool",
      },
    ],
    name: "setTemplateInstantOpenMode",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "bool",
        name: "enabled",
        type: "bool",
      },
    ],
    name: "setTransientContextEnabled",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "bytes4",
        name: "interfaceId",
        type: "bytes4",
      },
    ],
    name: "supportsInterface",
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
    name: "symmio",
    outputs: [
      {
        internalType: "contract ISymmio",
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
        name: "",
        type: "uint256",
      },
    ],
    name: "templateInstantOpenMode",
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
        name: "",
        type: "uint256",
      },
    ],
    name: "templates",
    outputs: [
      {
        internalType: "string",
        name: "name",
        type: "string",
      },
      {
        internalType: "bool",
        name: "active",
        type: "bool",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "transientContextEnabled",
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
    name: "unregisterPartyB",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "bytes32",
        name: "",
        type: "bytes32",
      },
    ],
    name: "usedDelegationHashes",
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
        name: "",
        type: "address",
      },
    ],
    name: "whitelistedTargets",
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
] as const;
