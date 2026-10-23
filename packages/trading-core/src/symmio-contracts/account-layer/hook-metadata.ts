import { encodeAbiParameters, zeroAddress, type Address, type Hex } from "viem";

/**
 * ABI shape of the `bytes metadata` an AccountLayer subaccount carries.
 *
 * `createSubAccounts` stores the blob verbatim and then forwards it to the
 * affiliate's `onAccountCreation` hook, whose revert propagates as
 * `HookFailed(bytes)` — so an affiliate that registers a hook decides the
 * encoding, and a mismatched blob fails the whole creation. Every SYMMIO
 * deployment the SDK ships uses the tuple below.
 */
const SUB_ACCOUNT_HOOK_METADATA_ABI = [
  {
    type: "tuple",
    components: [
      { type: "string", name: "rflCode" },
      { type: "uint256", name: "referrerTokenId" },
      { type: "address", name: "partyBToBind" },
    ],
  },
] as const;

/** Inputs of {@link encodeSubAccountHookMetadata}. */
export interface SubAccountHookMetadataInput {
  /**
   * Referral code to register for the subaccount.
   *
   * The hook keeps codes in one **global** namespace and rejects a code that is
   * already registered: a second creation reverts `HookFailed(0x7ab9fd97)`. So
   * this can never be a fixed literal. Pass a handle your product owns and knows
   * is free (a username), or omit it: an empty code is skipped rather than
   * stored, so it stays reusable, including twice inside one `createSubAccounts`
   * call.
   */
  rflCode?: string;
  /**
   * PartyB (solver) the hook binds the subaccount to — the chain's solver
   * address. Omit it, or pass the zero address, only when the affiliate binds
   * none.
   */
  partyBToBind?: Address;
  /** Referrer NFT id; `0n` when there is no referrer. */
  referrerTokenId?: bigint;
}

/**
 * Encode the `metadata` blob of a new subaccount, so the affiliate's
 * `onAccountCreation` hook can decode it:
 * `abi.encode((string rflCode, uint256 referrerTokenId, address partyBToBind))`.
 *
 * Pass the result as `SubAccountCreationData.metadata` to `createSubAccounts`,
 * or as `accountData.metadata` to `settleGaslessDepositNewAccount`. A hooked
 * affiliate rejects an empty blob with `HookFailed`, so `"0x"` is only right for
 * an affiliate without a hook.
 *
 * @param input - Referral code, PartyB to bind, and referrer NFT id. All optional.
 * @returns The ABI-encoded tuple, or `"0x"` when there is no PartyB to bind: an
 *   affiliate that binds a PartyB always has one configured, so with nothing to
 *   hand the hook, the empty blob is what a hookless affiliate expects.
 *
 * @example
 * ```ts
 * import { createSubAccounts, encodeSubAccountHookMetadata, SubAccountIsolationType } from "@symmio/trading-core";
 *
 * const metadata = encodeSubAccountHookMetadata({ rflCode: username, partyBToBind: solverAddress });
 * await createSubAccounts(config, {
 *   affiliate,
 *   accountsData: [
 *     { name: "Main", metadata, symmioCore, isolationType: SubAccountIsolationType.MARKET_DIRECTION, singleVAMode: true },
 *   ],
 * });
 * ```
 */
export function encodeSubAccountHookMetadata({
  rflCode = "",
  partyBToBind,
  referrerTokenId = 0n,
}: SubAccountHookMetadataInput): Hex {
  if (partyBToBind === undefined || partyBToBind === zeroAddress) return "0x";

  return encodeAbiParameters(SUB_ACCOUNT_HOOK_METADATA_ABI, [{ rflCode, referrerTokenId, partyBToBind }]);
}
