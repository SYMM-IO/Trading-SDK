import { encodeAbiParameters, zeroAddress, type Address, type Hex } from "viem";

/**
 * ABI shape of the `bytes metadata` the default affiliate's creation hook decodes.
 *
 * `createSubAccounts` stores the blob verbatim and then forwards it to the
 * affiliate's `onAccountCreation` hook, whose revert propagates as
 * `HookFailed(bytes)` — so the hook an affiliate registers decides the
 * encoding. The chains' default affiliates (`affiliatesAddress`) use the tuple
 * below; an affiliate without a hook stores any blob unread.
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
   * The hook keeps codes in one **global** namespace, across every wallet, and
   * rejects a code that is already registered: the creation reverts
   * `HookFailed(0x7ab9fd97)`, and so does the same code twice in one
   * `createSubAccounts` call. An empty code is skipped rather than stored, so it
   * never collides.
   */
  rflCode?: string;
  /** PartyB (solver) the hook binds the subaccount to. Omit it, or pass the zero address, to bind none. */
  partyBToBind?: Address;
  /** Referrer NFT id; `0n` when there is no referrer. */
  referrerTokenId?: bigint;
}

/**
 * Encode the `metadata` blob of a new subaccount in the format the chains'
 * default affiliate hook decodes:
 * `abi.encode((string rflCode, uint256 referrerTokenId, address partyBToBind))`.
 *
 * Pass the result as `SubAccountCreationData.metadata` to `createSubAccounts`,
 * or as `accountData.metadata` to `settleGaslessDepositNewAccount`. Both hand
 * `metadata` to the affiliate's hook unchanged, so an affiliate with its own
 * hook needs whatever blob that hook decodes; encode it yourself.
 *
 * @param input - Referral code, PartyB to bind, and referrer NFT id. All optional.
 * @returns The ABI-encoded tuple, with the zero address for a missing PartyB, or
 *   `"0x"` when every field is empty and there is nothing to hand the hook.
 *
 * @example
 * ```ts
 * import { createSubAccounts, encodeSubAccountHookMetadata, SubAccountIsolationType } from "@symmio/trading-core";
 *
 * const metadata = encodeSubAccountHookMetadata({ partyBToBind: solverAddress });
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
  partyBToBind = zeroAddress,
  referrerTokenId = 0n,
}: SubAccountHookMetadataInput): Hex {
  if (rflCode === "" && referrerTokenId === 0n && partyBToBind === zeroAddress) return "0x";

  return encodeAbiParameters(SUB_ACCOUNT_HOOK_METADATA_ABI, [{ rflCode, referrerTokenId, partyBToBind }]);
}
