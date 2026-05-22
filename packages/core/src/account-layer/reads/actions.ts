import type { Chain, PublicClient, Transport } from "viem";
import {
  getUserSubAccounts,
  type GetUserSubAccountsParams,
  type SubAccountDetail,
} from "./methods/get-user-sub-accounts";

/**
 * Read methods added to a viem `PublicClient` by {@link accountLayerReadActions}.
 */
export interface AccountLayerReadActions {
  getUserSubAccounts(params: GetUserSubAccountsParams): Promise<readonly SubAccountDetail[]>;
}

/**
 * Attach `AccountLayer` read methods to a viem `PublicClient` via `.extend()`.
 *
 * @example
 * const client = createPublicClient({ chain: hyperevm, transport: http() }).extend(accountLayerReadActions);
 * const subs = await client.getUserSubAccounts({ user: "0xabc..." });
 */
export function accountLayerReadActions<TTransport extends Transport, TChain extends Chain | undefined>(
  client: PublicClient<TTransport, TChain>,
): AccountLayerReadActions {
  return {
    getUserSubAccounts(params) {
      return getUserSubAccounts(client, params);
    },
  };
}
