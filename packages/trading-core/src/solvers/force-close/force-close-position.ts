import { encodeFunctionData, type Address, type Hash } from "viem";
import type { Config } from "../../core/config";
import type { Compute, WriteContractParameter } from "../../shared/types/properties";
import { symmioAbi } from "../../symmio-contracts/abi/v0.8.6/symmio";
import { callAsSubAccount } from "../../symmio-contracts/symmio/internal/call-as-sub-account";
import type { HighLowPriceSig } from "../../symmio-contracts/symmio/types";

/**
 * Parameters for {@link forceClosePosition}.
 */
export type ForceClosePositionParameters = Compute<
  WriteContractParameter & {
    /**
     * The subaccount (partyA) that owns the position. The call is routed through
     * the AccountLayer `_call` proxy so the core sees this subaccount as the
     * caller; the connected wallet must be its on-chain `owner`.
     */
    account: Address;
    /** The `CLOSE_PENDING` limit quote id to force-close. */
    quoteId: bigint;
    /** The Muon `priceRange` attestation — see `getForceClosePriceSig`. */
    sig: HighLowPriceSig;
  }
>;

/** Return type of {@link forceClosePosition}: the submitted transaction hash. */
export type ForceClosePositionReturnType = Hash;

/**
 * Send the single-call force close (`forceClosePosition(quoteId, sig)`) — the
 * low-level write. The eligibility gate and Muon signature must already be
 * resolved (use {@link forceCloseAuto} for the end-to-end flow). Routed through
 * `AccountLayer._call(account, …)`, so the connected wallet must be the
 * subaccount's `owner`.
 *
 * @remarks
 * Reverts `ForceActionsFacet: Cross partyB mode enabled` when the position's
 * partyB runs cross-margin settlement — that solver needs the (not-yet-supported)
 * 3-step `initializeForceClose` / `finalizeForceClose` flow.
 *
 * @param config - The SDK config (must have a `getWalletClient` resolver).
 * @param parameters - The owning subaccount, the quote id, the Muon sig, optional `from` / pre-flight / chain id.
 * @returns The submitted transaction hash.
 * @throws {SymmError} when the chain is unsupported or no wallet client is available.
 *
 * @example
 * ```ts
 * const hash = await forceClosePosition(config, { account: "0xsub…", quoteId: 42n, sig });
 * ```
 */
export async function forceClosePosition(
  config: Config,
  parameters: ForceClosePositionParameters,
): Promise<ForceClosePositionReturnType> {
  const { chainId, account, quoteId, sig } = parameters;

  const data = encodeFunctionData({
    abi: symmioAbi,
    functionName: "forceClosePosition",
    args: [quoteId, sig],
  });

  return callAsSubAccount(config, {
    account,
    data,
    chainId,
    from: parameters.from,
    simulateBeforeWrite: parameters.simulateBeforeWrite,
  });
}
