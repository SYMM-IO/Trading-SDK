import { getAddress, type Address } from "viem";
import type { Config } from "../core/config";
import type { ChainIdParameter, Compute } from "../shared/types/properties";
import type { PendingInstantOpen } from "../solvers/instant-open/get-instant-opens/to-pending-instant-open";
import { isolationTypeForSide } from "../solvers/instant-open/shared/types";
import { getVirtualAccountsAddressesOfSubAccount } from "../symmio-contracts/account-layer/actions/get-virtual-accounts-addresses-of-sub-account";
import { getPredictedNextVirtualAccount } from "../symmio-contracts/account-layer/actions/predict-next-virtual-account";

/**
 * Parameters for {@link resolveQuoteAccounts}.
 */
export type ResolveQuoteAccountsParameters = Compute<
  ChainIdParameter & {
    /** The subaccount whose full quote picture is being assembled. */
    subAccount: Address;
    /**
     * Pending instant-opens for the subaccount. Each lands in a Virtual Account
     * (VA) that may not exist on-chain yet; its address is predicted up front.
     */
    instantOpens?: readonly PendingInstantOpen[];
    /**
     * Union the subaccount's existing on-chain VAs into the result.
     * @default true
     */
    includeVirtualAccounts?: boolean;
    /** Extra accounts to union in (e.g. VAs already known to the consumer). */
    extraAccounts?: readonly Address[];
  }
>;

/** Result of {@link resolveQuoteAccounts}. */
export interface ResolveQuoteAccountsResult {
  /**
   * The deduplicated, checksummed set of on-chain `partyA` accounts to read
   * quotes across — the subaccount itself, its existing VAs, the predicted VAs
   * of its pending instant-opens, and any `extraAccounts`. Order is preserved
   * (subaccount first, then VAs, then predicted VAs, then extras).
   */
  accounts: Address[];
  /**
   * Map from a pending instant-open's `tempQuoteId` to the predicted VA address
   * its position will land in. Lets the caller stamp the optimistic quote row
   * with its eventual VA before the trade anchors on-chain.
   */
  instantOpenVaByTempId: Record<number, Address>;
}

/**
 * Resolve the full set of on-chain `partyA` accounts that together hold a
 * subaccount's quote picture.
 *
 * In lowcap, each isolated position lives under a Virtual Account (VA), and the
 * VA — not the subaccount — is the on-chain `partyA` for quote reads. A
 * brand-new instant-open lands in a VA that does not exist on-chain yet, so its
 * address is predicted from `(subAccount, isolationType, symbolId)` via
 * {@link getPredictedNextVirtualAccount}. This assembles:
 *
 * 1. the subaccount itself;
 * 2. its existing VAs (when `includeVirtualAccounts`, default `true`);
 * 3. one predicted VA per pending instant-open (predictions are deduped by
 *    `(isolationType, symbolId)` and run in parallel);
 * 4. any `extraAccounts`.
 *
 * Addresses are deduped case-insensitively, returned checksummed, and kept in
 * the order above.
 *
 * @param config - The SDK config.
 * @param parameters - Subaccount, optional pending opens / VA inclusion / extras, optional chain id.
 * @returns The account set plus the `tempQuoteId` → predicted-VA map.
 * @throws {SymmError} when the chain is not supported.
 * @throws Viem's `ContractFunctionExecutionError` and friends for on-chain failures.
 *
 * @example
 * ```ts
 * const { accounts, instantOpenVaByTempId } = await resolveQuoteAccounts(config, {
 *   subAccount: "0xsub…",
 *   instantOpens,
 * });
 * ```
 */
export async function resolveQuoteAccounts(
  config: Config,
  parameters: ResolveQuoteAccountsParameters,
): Promise<ResolveQuoteAccountsResult> {
  const { chainId, subAccount, instantOpens = [], includeVirtualAccounts = true, extraAccounts = [] } = parameters;

  /**
   * `seen` tracks lowercased addresses already collected so dedupe is
   * case-insensitive; `accounts` keeps the checksummed addresses in order.
   */
  const seen = new Set<string>();
  const accounts: Address[] = [];

  const add = (address: Address) => {
    const checksummed = getAddress(address);
    const lower = checksummed.toLowerCase();
    if (seen.has(lower)) return;
    seen.add(lower);
    accounts.push(checksummed);
  };

  add(subAccount);

  if (includeVirtualAccounts) {
    const virtualAccounts = await getVirtualAccountsAddressesOfSubAccount(config, { chainId, subAccount });
    for (const virtualAccount of virtualAccounts) add(virtualAccount);
  }

  /**
   * TODO: dose we need to predict the VA's?
   * Predict each pending open's VA. Many opens may share the same
   * `(isolationType, symbolId)` — the prediction is identical for those (until
   * the nonce advances), so dedupe the on-chain reads while still mapping every
   * `tempQuoteId` to its address.
   */
  const predictionByKey = new Map<string, Promise<Address>>();
  const predictPromises = instantOpens.map((open) => {
    const isolationType = isolationTypeForSide(open.positionType);
    const symbolId = BigInt(open.marketId);
    const key = `${isolationType}:${symbolId}`;
    let prediction = predictionByKey.get(key);
    if (!prediction) {
      prediction = getPredictedNextVirtualAccount(config, { chainId, subAccount, isolationType, symbolId });
      predictionByKey.set(key, prediction);
    }
    return prediction.then((predictedVa) => ({ tempQuoteId: open.tempQuoteId, predictedVa }));
  });
  const predicted = await Promise.all(predictPromises);

  const instantOpenVaByTempId: Record<number, Address> = {};
  for (const { tempQuoteId, predictedVa } of predicted) {
    const checksummed = getAddress(predictedVa);
    instantOpenVaByTempId[tempQuoteId] = checksummed;
    add(checksummed);
  }

  for (const extra of extraAccounts) add(extra);

  return { accounts, instantOpenVaByTempId };
}
