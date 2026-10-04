/**
 * Complete ABI for the GasLessQ **GaslessLayer** contract (the gateway proxy)
 * shipped with SYMMIO perps-core **0.8.6** — the multi-wallet generation, where
 * a gasless wallet is identified by `(owner, walletId)`.
 *
 * @remarks
 * Complete, unabridged copy of the source artifact — every constructor, error,
 * event, and function. Never trim it to the methods the SDK currently wraps.
 *
 * Pinned to perps-core commit `b63ee55e` (fetched 2026-09-17) rather than the
 * moving `version_0.8.6` branch, because the GaslessLayer surface changed
 * within that branch: the removed `getAccountOperationalFee` quote is replaced
 * by `previewFeeQuote`, and the wallet-scoped methods lost their pre-multi-wallet
 * overloads.
 *
 * Verified on 2026-09-17 by read-only `eth_call` against the staging proxy
 * `0x386EF97D913acf02B3C9452da4Cd4aaEc82eFBca` (implementation
 * `0x640b404a0b2cC8D7F95b6356CC97e44639b91d64`, Arbitrum): `getGaslessWalletAddress`,
 * `walletOperationNonces`, `getWalletCreationFee`, `previewFeeQuote`, the 5-argument
 * `relayInstantBatch`, `instantLayer`, `collateralToken`, `depositFee` and
 * `minimumDeposit`. The production proxy `0x8347953D80037b8d82827246f37EC7442AD188B4`
 * still runs the pre-multi-wallet implementation and is **unsupported** until it is
 * upgraded: every multi-wallet signature reverts there with empty data.
 *
 * @see Source of truth — the SYMMIO `perps-core` repo, pinned to the verified
 * commit: {@link https://github.com/SYMM-IO/perps-core/blob/b63ee55e4cfbbc6a9757d23212102d5572e5d829/abis/gaslessLayer.json}.
 */
export const gaslessLayerAbi = [
  {
    inputs: [],
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
    inputs: [
      {
        internalType: "address",
        name: "account",
        type: "address",
      },
      {
        internalType: "address",
        name: "expectedOwner",
        type: "address",
      },
      {
        internalType: "address",
        name: "actualOwner",
        type: "address",
      },
    ],
    name: "AccountOwnerMismatch",
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
    name: "AddressEmptyCode",
    type: "error",
  },
  {
    inputs: [],
    name: "ArrayLengthMismatch",
    type: "error",
  },
  {
    inputs: [],
    name: "CollateralRecoveryDisabled",
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
        internalType: "uint256",
        name: "limit",
        type: "uint256",
      },
    ],
    name: "DailyFreeOpsLimitExceeded",
    type: "error",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "payer",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "limit",
        type: "uint256",
      },
    ],
    name: "DailySponsoredNativeLimitExceeded",
    type: "error",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "amount",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "minimum",
        type: "uint256",
      },
    ],
    name: "DepositAmountBelowMinimum",
    type: "error",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "amount",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "totalFees",
        type: "uint256",
      },
    ],
    name: "DepositAmountNotAboveFees",
    type: "error",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "implementation",
        type: "address",
      },
    ],
    name: "ERC1967InvalidImplementation",
    type: "error",
  },
  {
    inputs: [],
    name: "ERC1967NonPayable",
    type: "error",
  },
  {
    inputs: [],
    name: "EmptyOperationBatch",
    type: "error",
  },
  {
    inputs: [],
    name: "FailedCall",
    type: "error",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "actual18",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "maximum18",
        type: "uint256",
      },
    ],
    name: "FeeLimitExceeded",
    type: "error",
  },
  {
    inputs: [],
    name: "FeeQuoteContextActive",
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
    name: "FeeQuoteExecutionFailed",
    type: "error",
  },
  {
    inputs: [
      {
        components: [
          {
            internalType: "address",
            name: "collateralToken",
            type: "address",
          },
          {
            internalType: "uint8",
            name: "collateralDecimals",
            type: "uint8",
          },
          {
            internalType: "uint256",
            name: "blockNumber",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "timestamp",
            type: "uint256",
          },
          {
            internalType: "bool",
            name: "exact",
            type: "bool",
          },
          {
            components: [
              {
                internalType: "address",
                name: "account",
                type: "address",
              },
              {
                internalType: "address",
                name: "payer",
                type: "address",
              },
              {
                internalType: "uint8",
                name: "source",
                type: "uint8",
              },
              {
                internalType: "uint256",
                name: "operationalFee18",
                type: "uint256",
              },
              {
                internalType: "uint256",
                name: "depositFee18",
                type: "uint256",
              },
              {
                internalType: "uint256",
                name: "walletCreationFee18",
                type: "uint256",
              },
              {
                internalType: "uint256",
                name: "nativeTopUpFee18",
                type: "uint256",
              },
              {
                internalType: "uint256",
                name: "nativeGasCollateral18",
                type: "uint256",
              },
            ],
            internalType: "struct IGaslessLayer.FeePayment[]",
            name: "payments",
            type: "tuple[]",
          },
          {
            internalType: "uint256",
            name: "totalFee18",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "totalDebit18",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "freeOpsApplied",
            type: "uint256",
          },
          {
            internalType: "bool",
            name: "nativeSponsored",
            type: "bool",
          },
        ],
        internalType: "struct IGaslessLayer.FeeQuote",
        name: "quote",
        type: "tuple",
      },
    ],
    name: "FeeQuoteResult",
    type: "error",
  },
  {
    inputs: [],
    name: "GaslessWalletAddressMismatch",
    type: "error",
  },
  {
    inputs: [],
    name: "InvalidInitialization",
    type: "error",
  },
  {
    inputs: [],
    name: "InvalidNativeGasTopUpSignature",
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
    name: "InvalidWalletExecuteSelector",
    type: "error",
  },
  {
    inputs: [],
    name: "InvalidWalletOperationSignature",
    type: "error",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "expectedOwner",
        type: "address",
      },
      {
        internalType: "address",
        name: "actualSigner",
        type: "address",
      },
    ],
    name: "InvalidWalletOperationSigner",
    type: "error",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "expected",
        type: "address",
      },
      {
        internalType: "address",
        name: "actual",
        type: "address",
      },
    ],
    name: "InvalidWalletOperationTarget",
    type: "error",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "minimumDeposit",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "depositFee",
        type: "uint256",
      },
    ],
    name: "MinimumDepositNotAboveFee",
    type: "error",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "actual",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "minAmountOut",
        type: "uint256",
      },
    ],
    name: "NativeGasTopUpAmountBelowMin",
    type: "error",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "amount",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "maxAmount",
        type: "uint256",
      },
    ],
    name: "NativeGasTopUpAmountExceedsMax",
    type: "error",
  },
  {
    inputs: [],
    name: "NativeGasTopUpAmountZero",
    type: "error",
  },
  {
    inputs: [],
    name: "NativeGasTopUpCollateralAmountZero",
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
    name: "NativeGasTopUpExpired",
    type: "error",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "feeBps",
        type: "uint256",
      },
    ],
    name: "NativeGasTopUpFeeBpsTooHigh",
    type: "error",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "payerAccount",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "expected",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "actual",
        type: "uint256",
      },
    ],
    name: "NativeGasTopUpNonceMismatch",
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
    name: "NativeGasTransferFailed",
    type: "error",
  },
  {
    inputs: [],
    name: "NotInitializing",
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
        internalType: "address",
        name: "token",
        type: "address",
      },
    ],
    name: "SafeERC20FailedOperation",
    type: "error",
  },
  {
    inputs: [],
    name: "UUPSUnauthorizedCallContext",
    type: "error",
  },
  {
    inputs: [
      {
        internalType: "bytes32",
        name: "slot",
        type: "bytes32",
      },
    ],
    name: "UUPSUnsupportedProxiableUUID",
    type: "error",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "value",
        type: "uint256",
      },
    ],
    name: "UnexpectedNativeValue",
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
    name: "UnsupportedFeeQuoteCall",
    type: "error",
  },
  {
    inputs: [],
    name: "WalletCallDataTooShort",
    type: "error",
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
    name: "WalletDelegationMissing",
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
    name: "WalletOperationExpired",
    type: "error",
  },
  {
    inputs: [],
    name: "WalletOperationForPartyBUnsupported",
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
        internalType: "uint256",
        name: "expected",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "actual",
        type: "uint256",
      },
    ],
    name: "WalletOperationInvalidNonce",
    type: "error",
  },
  {
    inputs: [],
    name: "WalletWithdrawalAmountZero",
    type: "error",
  },
  {
    inputs: [],
    name: "ZeroAddress",
    type: "error",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "uint256",
        name: "limit",
        type: "uint256",
      },
    ],
    name: "DailyFreeOpsLimitUpdated",
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
        internalType: "uint256",
        name: "opsCount",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "usedToday",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "limit",
        type: "uint256",
      },
    ],
    name: "DailyFreeOpsUsed",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "payer",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "nativeAmount",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "usedToday",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "limit",
        type: "uint256",
      },
    ],
    name: "DailyNativeGasSponsored",
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
    ],
    name: "DefaultSelectorFeeUpdated",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "owner",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "treasury",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "amount",
        type: "uint256",
      },
    ],
    name: "DepositFeeCollected",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "uint256",
        name: "depositFee",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "minimumDeposit",
        type: "uint256",
      },
    ],
    name: "DepositFeeConfigUpdated",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "bool",
        name: "revertWhenFreeQuotaExhausted",
        type: "bool",
      },
    ],
    name: "FreeQuotaExhaustionPolicyUpdated",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "owner",
        type: "address",
      },
      {
        indexed: true,
        internalType: "uint256",
        name: "walletId",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "address",
        name: "wallet",
        type: "address",
      },
    ],
    name: "GaslessWalletDeployed",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "uint64",
        name: "version",
        type: "uint64",
      },
    ],
    name: "Initialized",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "relayer",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "operationCount",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "totalFee18",
        type: "uint256",
      },
    ],
    name: "InstantBatchRelayed",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "address",
        name: "instantLayer",
        type: "address",
      },
    ],
    name: "InstantLayerUpdated",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "relayer",
        type: "address",
      },
      {
        indexed: true,
        internalType: "uint256",
        name: "templateId",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "operationCount",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "totalFee18",
        type: "uint256",
      },
    ],
    name: "InstantTemplateRelayed",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "uint256",
        name: "maxNativeAmount",
        type: "uint256",
      },
    ],
    name: "MaxNativeGasTopUpAmountUpdated",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "uint256",
        name: "dailySponsoredNativeLimit",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "bool",
        name: "revertWhenNativeSponsorLimitExhausted",
        type: "bool",
      },
    ],
    name: "NativeGasTopUpConfigUpdated",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "uint256",
        name: "feeBps",
        type: "uint256",
      },
    ],
    name: "NativeGasTopUpFeeBpsUpdated",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "relayer",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "payerAccount",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "payer",
        type: "address",
      },
      {
        indexed: false,
        internalType: "address",
        name: "recipientWallet",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "nativeAmount",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "collateralAmount",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "totalCollateralCharge",
        type: "uint256",
      },
    ],
    name: "NativeGasTopUpRelayed",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "signerAccount",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "payer",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "amount18",
        type: "uint256",
      },
    ],
    name: "OperationalFeeRouted",
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
        internalType: "bytes4",
        name: "selector",
        type: "bytes4",
      },
      {
        indexed: false,
        internalType: "bool",
        name: "configured",
        type: "bool",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "amount",
        type: "uint256",
      },
    ],
    name: "SelectorFeeConfigUpdated",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "address",
        name: "treasury",
        type: "address",
      },
    ],
    name: "TreasuryUpdated",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "implementation",
        type: "address",
      },
    ],
    name: "Upgraded",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "wallet",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "payer",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "amount",
        type: "uint256",
      },
    ],
    name: "WalletCreationFeeCollected",
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
    ],
    name: "WalletCreationFeeUpdated",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "owner",
        type: "address",
      },
      {
        indexed: true,
        internalType: "uint256",
        name: "walletId",
        type: "uint256",
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
        name: "netDeposit",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "depositFee",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "enum IGaslessLayer.DepositDestination",
        name: "destination",
        type: "uint8",
      },
    ],
    name: "WalletDepositSettled",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "owner",
        type: "address",
      },
      {
        indexed: true,
        internalType: "uint256",
        name: "walletId",
        type: "uint256",
      },
      {
        indexed: true,
        internalType: "address",
        name: "token",
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
    name: "WalletFundsWithdrawn",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "wallet",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "token",
        type: "address",
      },
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
    name: "WalletNonCollateralTokenRecovered",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "relayer",
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
        name: "wallet",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "callCount",
        type: "uint256",
      },
    ],
    name: "WalletOperationRelayed",
    type: "event",
  },
  {
    inputs: [],
    name: "CONFIG_ADMIN_ROLE",
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
    name: "RELAYER_ROLE",
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
    name: "UPGRADE_INTERFACE_VERSION",
    outputs: [
      {
        internalType: "string",
        name: "",
        type: "string",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "WALLET_ACCOUNT_TYPEHASH",
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
    name: "WALLET_EXECUTION_SENTINEL_SELECTOR",
    outputs: [
      {
        internalType: "bytes4",
        name: "",
        type: "bytes4",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "WALLET_REPLAY_HEADER_TYPEHASH",
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
        internalType: "contract ISymmioAccountLayer",
        name: "",
        type: "address",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "collateralToken",
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
    name: "core",
    outputs: [
      {
        internalType: "contract ISymmioCore",
        name: "",
        type: "address",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "dailyFreeOpsLimit",
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
        name: "account",
        type: "address",
      },
    ],
    name: "dailyFreeOpsRemaining",
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
    name: "dailyFreeOpsUsage",
    outputs: [
      {
        internalType: "uint64",
        name: "day",
        type: "uint64",
      },
      {
        internalType: "uint192",
        name: "count",
        type: "uint192",
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
    name: "dailyNativeSponsorUsage",
    outputs: [
      {
        internalType: "uint64",
        name: "day",
        type: "uint64",
      },
      {
        internalType: "uint192",
        name: "amount",
        type: "uint192",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "dailySponsoredNativeLimit",
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
    name: "defaultSelectorFee",
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
    name: "depositFee",
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
        internalType: "bytes",
        name: "callData",
        type: "bytes",
      },
      {
        internalType: "uint256",
        name: "maxTotalDebit18",
        type: "uint256",
      },
    ],
    name: "executeWithFeeLimit",
    outputs: [
      {
        internalType: "bytes",
        name: "",
        type: "bytes",
      },
    ],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "bytes4",
        name: "selector",
        type: "bytes4",
      },
    ],
    name: "getBaseOperationalFee",
    outputs: [
      {
        internalType: "uint256",
        name: "amount18",
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
        name: "walletId",
        type: "uint256",
      },
    ],
    name: "getGaslessWalletAddress",
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
        name: "collateralAmount18",
        type: "uint256",
      },
    ],
    name: "getNativeGasTopUpCharge",
    outputs: [
      {
        internalType: "uint256",
        name: "feeAmount18",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "totalCollateralCharge18",
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
        internalType: "address",
        name: "owner",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "walletId",
        type: "uint256",
      },
    ],
    name: "getWalletCreationFee",
    outputs: [
      {
        internalType: "uint256",
        name: "feeTokenUnits",
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
            internalType: "struct IInstantLayer.Account",
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
            internalType: "struct IInstantLayer.FlexField[]",
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
            internalType: "struct IInstantLayer.ReplayAttackHeader",
            name: "replayAttackHeader",
            type: "tuple",
          },
        ],
        internalType: "struct IInstantLayer.SignedOperation",
        name: "signedOp",
        type: "tuple",
      },
    ],
    name: "getWalletOperationHash",
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
        internalType: "address",
        name: "admin",
        type: "address",
      },
      {
        internalType: "address",
        name: "core_",
        type: "address",
      },
      {
        internalType: "address",
        name: "accountLayer_",
        type: "address",
      },
      {
        internalType: "address",
        name: "instantLayer_",
        type: "address",
      },
      {
        internalType: "address",
        name: "treasury_",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "depositFee_",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "walletCreationFee_",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "minimumDeposit_",
        type: "uint256",
      },
    ],
    name: "initialize",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "instantLayer",
    outputs: [
      {
        internalType: "contract IInstantLayer",
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
            internalType: "struct IInstantLayer.Account",
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
            internalType: "struct IInstantLayer.FlexField[]",
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
            internalType: "struct IInstantLayer.ReplayAttackHeader",
            name: "replayAttackHeader",
            type: "tuple",
          },
        ],
        internalType: "struct IInstantLayer.SignedOperation",
        name: "signedOp",
        type: "tuple",
      },
      {
        internalType: "bytes",
        name: "signature",
        type: "bytes",
      },
    ],
    name: "isValidWalletOperationSignature",
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
    name: "maxNativeGasTopUpAmount",
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
    name: "minimumDeposit",
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
    name: "nativeGasTopUpFeeBps",
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
        internalType: "bytes",
        name: "callData",
        type: "bytes",
      },
      {
        internalType: "uint256",
        name: "nativeAmount",
        type: "uint256",
      },
    ],
    name: "previewFeeQuote",
    outputs: [
      {
        components: [
          {
            internalType: "address",
            name: "collateralToken",
            type: "address",
          },
          {
            internalType: "uint8",
            name: "collateralDecimals",
            type: "uint8",
          },
          {
            internalType: "uint256",
            name: "blockNumber",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "timestamp",
            type: "uint256",
          },
          {
            internalType: "bool",
            name: "exact",
            type: "bool",
          },
          {
            components: [
              {
                internalType: "address",
                name: "account",
                type: "address",
              },
              {
                internalType: "address",
                name: "payer",
                type: "address",
              },
              {
                internalType: "uint8",
                name: "source",
                type: "uint8",
              },
              {
                internalType: "uint256",
                name: "operationalFee18",
                type: "uint256",
              },
              {
                internalType: "uint256",
                name: "depositFee18",
                type: "uint256",
              },
              {
                internalType: "uint256",
                name: "walletCreationFee18",
                type: "uint256",
              },
              {
                internalType: "uint256",
                name: "nativeTopUpFee18",
                type: "uint256",
              },
              {
                internalType: "uint256",
                name: "nativeGasCollateral18",
                type: "uint256",
              },
            ],
            internalType: "struct IGaslessLayer.FeePayment[]",
            name: "payments",
            type: "tuple[]",
          },
          {
            internalType: "uint256",
            name: "totalFee18",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "totalDebit18",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "freeOpsApplied",
            type: "uint256",
          },
          {
            internalType: "bool",
            name: "nativeSponsored",
            type: "bool",
          },
        ],
        internalType: "struct IGaslessLayer.FeeQuote",
        name: "",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "proxiableUUID",
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
        internalType: "address",
        name: "owner",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "walletId",
        type: "uint256",
      },
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
    name: "recoverNonCollateralToken",
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
            internalType: "struct IInstantLayer.Account",
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
            internalType: "struct IInstantLayer.FlexField[]",
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
            internalType: "struct IInstantLayer.ReplayAttackHeader",
            name: "replayAttackHeader",
            type: "tuple",
          },
        ],
        internalType: "struct IInstantLayer.SignedOperation[]",
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
      {
        internalType: "uint256[]",
        name: "walletIds",
        type: "uint256[]",
      },
    ],
    name: "relayInstantBatch",
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
            internalType: "struct IInstantLayer.Account",
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
            internalType: "struct IInstantLayer.FlexField[]",
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
            internalType: "struct IInstantLayer.ReplayAttackHeader",
            name: "replayAttackHeader",
            type: "tuple",
          },
        ],
        internalType: "struct IInstantLayer.SignedOperation[]",
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
    name: "relayInstantTemplate",
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
            name: "payerAccount",
            type: "address",
          },
          {
            internalType: "address",
            name: "recipientWallet",
            type: "address",
          },
          {
            internalType: "uint256",
            name: "collateralAmount",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "minNativeAmountOut",
            type: "uint256",
          },
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
        ],
        internalType: "struct IGaslessLayer.NativeGasTopUpRequest",
        name: "request",
        type: "tuple",
      },
      {
        internalType: "bytes",
        name: "signature",
        type: "bytes",
      },
    ],
    name: "relayNativeGasTopUp",
    outputs: [],
    stateMutability: "payable",
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
    name: "revertWhenFreeQuotaExhausted",
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
    name: "revertWhenNativeSponsorLimitExhausted",
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
        internalType: "bytes4",
        name: "",
        type: "bytes4",
      },
    ],
    name: "selectorFeeConfigs",
    outputs: [
      {
        internalType: "bool",
        name: "configured",
        type: "bool",
      },
      {
        internalType: "uint256",
        name: "amount",
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
        name: "limit",
        type: "uint256",
      },
    ],
    name: "setDailyFreeOpsLimit",
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
    name: "setDefaultSelectorFee",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "depositFee_",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "minimumDeposit_",
        type: "uint256",
      },
    ],
    name: "setDepositFeeConfig",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "instantLayer_",
        type: "address",
      },
    ],
    name: "setInstantLayer",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "maxNativeAmount",
        type: "uint256",
      },
    ],
    name: "setMaxNativeGasTopUpAmount",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "dailySponsoredNativeLimit_",
        type: "uint256",
      },
      {
        internalType: "bool",
        name: "revertWhenNativeSponsorLimitExhausted_",
        type: "bool",
      },
    ],
    name: "setNativeGasTopUpConfig",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "feeBps",
        type: "uint256",
      },
    ],
    name: "setNativeGasTopUpFeeBps",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "bool",
        name: "value",
        type: "bool",
      },
    ],
    name: "setRevertWhenFreeQuotaExhausted",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "bytes4",
        name: "selector",
        type: "bytes4",
      },
      {
        internalType: "bool",
        name: "configured",
        type: "bool",
      },
      {
        internalType: "uint256",
        name: "amount",
        type: "uint256",
      },
    ],
    name: "setSelectorFeeConfig",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "treasury_",
        type: "address",
      },
    ],
    name: "setTreasury",
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
    name: "setWalletCreationFee",
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
      {
        internalType: "uint256",
        name: "walletId",
        type: "uint256",
      },
      {
        internalType: "address",
        name: "subAccount",
        type: "address",
      },
    ],
    name: "settleDepositToExistingAccount",
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
      {
        internalType: "uint256",
        name: "walletId",
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
        internalType: "struct SubAccountCreationData",
        name: "accountData",
        type: "tuple",
      },
    ],
    name: "settleDepositToNewAccount",
    outputs: [
      {
        internalType: "address",
        name: "subAccount",
        type: "address",
      },
    ],
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
    name: "simulateFeeQuote",
    outputs: [],
    stateMutability: "payable",
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
    inputs: [
      {
        internalType: "address",
        name: "",
        type: "address",
      },
    ],
    name: "topUpNonces",
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
    name: "treasury",
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
        name: "newImplementation",
        type: "address",
      },
      {
        internalType: "bytes",
        name: "data",
        type: "bytes",
      },
    ],
    name: "upgradeToAndCall",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [],
    name: "walletCreationFee",
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
        name: "walletId",
        type: "uint256",
      },
      {
        internalType: "address",
        name: "signerAccount",
        type: "address",
      },
    ],
    name: "walletOperationNonces",
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
        name: "walletId",
        type: "uint256",
      },
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
    name: "withdrawWalletFunds",
    outputs: [
      {
        internalType: "uint256",
        name: "withdrawnAmount",
        type: "uint256",
      },
    ],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;
