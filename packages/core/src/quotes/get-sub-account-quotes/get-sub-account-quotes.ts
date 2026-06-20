import type { Address } from "viem";
import type { Config } from "../../core/config";
import type { ChainIdParameter, Compute } from "../../shared/types/properties";
import { getInstantCloses } from "../../solvers/instant-close/get-instant-closes/get-instant-closes";
import { getInstantOpens } from "../../solvers/instant-open/get-instant-opens/get-instant-opens";
import { getPartyAOpenPositions } from "../../symmio-contracts/symmio/actions/get-party-a-open-positions";
import { getPartyAPendingQuotes } from "../../symmio-contracts/symmio/actions/get-party-a-pending-quotes";
import { getQuote } from "../../symmio-contracts/symmio/actions/get-quote";
import type { Quote } from "../../symmio-contracts/symmio/types";
import { reconcileQuotes } from "../reconcile-quotes";
import { resolveQuoteAccounts } from "../resolve-quote-accounts";
import type { UnifiedQuote } from "../unified-quote";

/**
 * Parameters for {@link getSubAccountQuotes}.
 */
export type GetSubAccountQuotesParameters = Compute<
  ChainIdParameter & {
    /** The subaccount whose full quote picture to assemble. */
    subAccount: Address;
    /**
     * Union the subaccount's existing on-chain Virtual Accounts (VAs) into the
     * read. In lowcap, each isolated position lives under a VA, so this is
     * required to see the full picture.
     * @default true
     */
    includeVirtualAccounts?: boolean;
    /** Extra accounts to read quotes across (e.g. VAs already known to the consumer). */
    extraAccounts?: readonly Address[];
    /**
     * Hedger base URL for the off-chain instant-open / instant-close reads.
     * Defaults to the chain config's `solver.url`.
     */
    baseUrl?: string;
  }
>;

/** Return type of {@link getSubAccountQuotes}. */
export interface GetSubAccountQuotesReturnType {
  /** The merged, de-duplicated, lifecycle-tagged quote rows for the subaccount. */
  quotes: UnifiedQuote[];
  /** The on-chain `partyA` accounts the quotes were read across (subaccount + VAs + extras). */
  accounts: Address[];
}

/**
 * Read a subaccount's full quote picture across every account that holds it.
 *
 * Lowcap positions are isolated into Virtual Accounts (VAs), so a subaccount's
 * quotes are spread across its VAs rather than the subaccount itself. This:
 *
 * 1. fetches the subaccount's pending instant-opens and instant-closes (off-chain,
 *    sub-account scoped);
 * 2. resolves the full account set — the subaccount, its existing VAs, and the
 *    predicted VAs of its pending instant-opens — via {@link resolveQuoteAccounts};
 * 3. reads `getPartyAOpenPositions` and `getPartyAPendingQuotes` (hydrated with
 *    `getQuote`) for every account in parallel;
 * 4. reconciles all sources into one stable, de-duplicated {@link UnifiedQuote}
 *    list with {@link reconcileQuotes} ("active quotes only" — a pure, stateless
 *    one-shot merge).
 *
 * This is a one-shot snapshot. For live updates, poll it (or drive
 * {@link reconcileQuotes} directly with notifications) from the framework layer.
 *
 * @param config - The SDK config.
 * @param parameters - Subaccount, optional VA inclusion / extras / hedger base url, optional chain id.
 * @returns The merged quote rows plus the accounts they were read across.
 * @throws {SymmError} when the chain is not supported, or {@link SymmApiError} when a hedger read fails.
 * @throws Viem's `ContractFunctionExecutionError` and friends for on-chain failures.
 *
 * @example
 * ```ts
 * const { quotes, accounts } = await getSubAccountQuotes(config, { subAccount: "0xsub…" });
 * ```
 */
export async function getSubAccountQuotes(
  config: Config,
  parameters: GetSubAccountQuotesParameters,
): Promise<GetSubAccountQuotesReturnType> {
  const { chainId, subAccount, baseUrl, includeVirtualAccounts = true, extraAccounts = [] } = parameters;

  const [instantOpens, instantCloses] = await Promise.all([
    getInstantOpens(config, { chainId, partyA: subAccount, baseUrl }),
    getInstantCloses(config, { chainId, partyA: subAccount, baseUrl }),
  ]);

  // TODO: could we remove instantOpens from resolveQuoteAccounts? if we drop it it can get paraller with Promise.all
  const { accounts, instantOpenVaByTempId } = await resolveQuoteAccounts(config, {
    chainId,
    subAccount,
    instantOpens,
    includeVirtualAccounts,
    extraAccounts,
  });

  const perAccount = await Promise.all(
    accounts.map(async (account) => {
      const [openPositions, pendingIds] = await Promise.all([
        getPartyAOpenPositions(config, { chainId, partyA: account }),
        getPartyAPendingQuotes(config, { chainId, partyA: account }),
      ]);
      const pendingQuotes = await Promise.all(pendingIds.map((quoteId) => getQuote(config, { chainId, quoteId })));
      return {
        openPositions,
        pendingQuotes: pendingQuotes.filter((quote): quote is Quote => quote !== null),
      };
    }),
  );

  const onchainPositions = perAccount.flatMap((account) => account.openPositions);
  const onchainPendingQuotes = perAccount.flatMap((account) => account.pendingQuotes);

  const { quotes } = reconcileQuotes({
    partyA: subAccount,
    onchainPositions,
    onchainPendingQuotes,
    instantOpens,
    instantCloses,
    instantOpenVaByTempId,
  });

  return { quotes, accounts };
}
