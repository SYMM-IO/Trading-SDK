import { encodeAbiParameters, zeroAddress, type Address, type Hex } from "viem";

/**
 * ABI shape of the `bytes metadata` an AccountLayer subaccount carries.
 *
 * `createSubAccounts` stores the blob verbatim and then forwards it to the
 * affiliate's `onAccountCreation` hook, whose revert propagates as
 * `HookFailed(bytes)` — so an affiliate that registers a hook decides the
 * encoding, and a mismatched blob fails the whole creation. Every deployment
 * this app targets uses the tuple below.
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
   * The hook keeps codes in one GLOBAL namespace and rejects a code that is
   * already registered — a second creation reverts `HookFailed(0x7ab9fd97)`,
   * verified against the live Arbitrum affiliate. So this can never be a fixed
   * literal: it must be a handle the product owns and knows is free (a
   * username), which this app has no concept of. Omitting it registers no code,
   * and an empty code is skipped rather than stored, so it stays reusable
   * forever — including twice inside one `createSubAccounts` call.
   */
  rflCode?: string;
  /** PartyB (solver) the hook binds the subaccount to. Omit — or pass the zero address — when the chain binds none. */
  partyBToBind?: Address;
  /** Referrer NFT id, `0n` when there is no referrer. */
  referrerTokenId?: bigint;
}

/**
 * Encode the `metadata` blob for a new subaccount so the affiliate's
 * `onAccountCreation` hook can decode it.
 *
 * Returns `0x` when there is no PartyB to bind: with nothing to hand the hook,
 * the empty blob is what a hookless affiliate expects, and an affiliate that
 * does bind a PartyB always has one configured.
 *
 * @example
 * ```ts
 * const metadata = encodeSubAccountHookMetadata({ partyBToBind: solver.address });
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
