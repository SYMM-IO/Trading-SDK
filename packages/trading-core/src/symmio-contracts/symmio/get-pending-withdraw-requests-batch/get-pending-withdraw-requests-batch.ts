import { isAddress, type Address } from "viem";
import type { Config } from "../../../core/config";
import { SymmError } from "../../../shared/errors/symm-error";
import type { ChainIdParameter } from "../../../shared/types/properties";
import { getLastWithdrawRequestId } from "../actions/get-last-withdraw-request-id";
import { getPendingWithdrawRequests } from "../actions/get-pending-withdraw-requests";
import type { WithdrawRequest } from "../types";
import { createConcurrencyLimiter } from "./limit-concurrency";

/** Parameters for a complete pending-withdrawal scan across subaccounts. */
export type GetPendingWithdrawRequestsBatchParameters = ChainIdParameter & {
  /** Subaccounts to scan. Duplicate/case-equivalent addresses are read once. */
  users: readonly Address[];
  /** Request IDs per RPC page, from 1 to 200. @default 200n */
  pageSize?: bigint;
};

/** Pending requests for one normalized subaccount, including an empty result. */
export interface PendingWithdrawRequestsForUser {
  /** Lowercase subaccount address. */
  user: Address;
  /** Every active request found up to the last ID observed at the start of the scan. */
  requests: readonly WithdrawRequest[];
}

/** Complete per-user results, ordered by normalized user address. */
export type GetPendingWithdrawRequestsBatchReturnType = readonly PendingWithdrawRequestsForUser[];

/** The most RPC reads the batch keeps in flight, across every user and page. */
const MAX_READS_IN_FLIGHT = 6;

/**
 * Read all pending-withdrawal pages for each distinct subaccount. Empty/sparse
 * pages never terminate the scan: the last request ID bounds its ranges.
 * A failed page rejects the whole read rather than reporting incomplete funds.
 * At most 6 reads are in flight at once, so a long scan does not trip an RPC
 * rate limit, and no new read starts after the first failure.
 * @param config - SDK configuration and read client.
 * @param parameters - Users, optional chain and bounded page size.
 * @returns One result per distinct user, including users with no requests.
 * @example
 * const pending = await getPendingWithdrawRequestsBatch(config, { users: [subAccount] });
 */
export async function getPendingWithdrawRequestsBatch(
  config: Config,
  { users, chainId, pageSize = 200n }: GetPendingWithdrawRequestsBatchParameters,
): Promise<GetPendingWithdrawRequestsBatchReturnType> {
  if (pageSize < 1n || pageSize > 200n)
    throw new SymmError("validation", "INVALID_WITHDRAW_PAGE_SIZE", "pageSize must be between 1 and 200");

  if (users.some((user) => !isAddress(user, { strict: false })))
    throw new SymmError("validation", "INVALID_WITHDRAW_USER", "users must contain valid addresses");

  const normalized = [...new Set(users.map((user) => user.toLowerCase() as Address))].sort();
  /** One budget for every read in the batch, so a long scan never bursts the RPC. */
  const read = createConcurrencyLimiter(MAX_READS_IN_FLIGHT);

  return Promise.all(
    normalized.map(async (user) => {
      const last = await read(() => getLastWithdrawRequestId(config, { chainId, user }));
      const pages: Promise<readonly WithdrawRequest[]>[] = [];

      for (let start = 1n; start <= last; start += pageSize) {
        const remaining = last - start + 1n;

        pages.push(
          read(() =>
            getPendingWithdrawRequests(config, {
              user,
              start,
              chainId,
              size: remaining < pageSize ? remaining : pageSize,
            }),
          ),
        );
      }
      return { user, requests: (await Promise.all(pages)).flat() };
    }),
  );
}
