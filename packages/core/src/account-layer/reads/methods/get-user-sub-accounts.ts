import { type Address, type Chain, type Hex, type PublicClient, type Transport } from "viem";
import { accountLayerAbi } from "../../../abi/v0.8.5/account-layer";
import { resolveAccountLayerAddress } from "../../resolve-address";
import type { SubAccountIsolationType } from "../../types";

/**
 * One subaccount owned by a user EOA on a SYMMIO `AccountLayer` deployment.
 *
 * Field shapes mirror the on-chain `SubAccountDetail` struct exactly so callers
 * comparing against raw viem decodings do not have to translate.
 */
export interface SubAccountDetail {
  /**
   * The subaccount's proxy address on-chain.
   */
  accountAddress: Address;
  /**
   * The EOA that created and owns the subaccount.
   */
  owner: Address;
  /**
   * User-defined display name. Editable via the `editAccountName` write.
   */
  name: string;
  /**
   * `false` for a subaccount that has been deleted on-chain.
   */
  isExists: boolean;
  /**
   * `true` when the subaccount routes successive quotes for the same market
   * into the existing active VA instead of creating a fresh VA per `sendQuote`.
   * Toggleable only while no VAs are active on the subaccount.
   */
  singleVAMode: boolean;
  /**
   * Affiliate address attributed to the subaccount, or the zero address.
   */
  affiliate: Address;
  /**
   * The Symmio core (diamond) address this subaccount trades against.
   */
  symmioCore: Address;
  /**
   * Free-form contract metadata blob. May be `0x` (empty) for most accounts.
   */
  metadata: Hex;
  /**
   * Strategy the AccountLayer uses to create VAs for this subaccount's trades.
   */
  isolationType: SubAccountIsolationType;
}

/**
 * Parameters for {@link getUserSubAccounts}.
 */
export interface GetUserSubAccountsParams {
  /**
   * EOA whose subaccounts to list.
   */
  user: Address;
  /**
   * Pagination offset, in subaccounts.
   *
   * @default 0n
   */
  offset?: bigint;
  /**
   * Pagination limit, in subaccounts. The default matches the value the SYMM
   * Explorer Inspector page uses.
   *
   * @default 200n
   */
  limit?: bigint;
  /**
   * Override the `AccountLayer` contract address. Defaults to the built-in
   * registry for `client.chain.id`. Useful for staging deployments and for
   * chains the SDK does not yet ship a built-in address for.
   */
  accountLayerAddress?: Address;
}

/**
 * Read all SYMMIO subaccounts owned by `user` on the chain bound to `client`.
 *
 * The chain is resolved from `client.chain.id` and used to look up the
 * `AccountLayer` address in the SDK's built-in registry, unless
 * `params.accountLayerAddress` is passed to override it.
 *
 * @example
 * const subs = await getUserSubAccounts(publicClient, {
 *   user: "0xabc...",
 *   limit: 100n,
 * });
 *
 * @throws {SymmError} when the client has no chain and no address override is provided.
 * @throws Viem's `ContractFunctionExecutionError` and friends for on-chain failures.
 */
export async function getUserSubAccounts<TTransport extends Transport, TChain extends Chain | undefined>(
  client: PublicClient<TTransport, TChain>,
  params: GetUserSubAccountsParams,
): Promise<readonly SubAccountDetail[]> {
  const address = resolveAccountLayerAddress(client, params.accountLayerAddress);

  const result = await client.readContract({
    address,
    abi: accountLayerAbi,
    functionName: "getUserSubAccounts",
    args: [params.user, params.offset ?? 0n, params.limit ?? 200n],
  });

  return result as readonly SubAccountDetail[];
}
