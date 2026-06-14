import type { Address, Hex } from "viem";
import type { Config } from "../../../core/config";
import type { ChainIdParameter, Compute } from "../../../shared/types/properties";
import { VIRTUAL_ACCOUNT_ISOLATION_TYPE, type VirtualAccountIsolationType } from "../../../solvers/instant-open/shared/types";
import { accountLayerAbi } from "../../abi/v0.8.5/account-layer";

/**
 * Parameters for {@link getVirtualAccount}.
 */
export type GetVirtualAccountParameters = Compute<
  ChainIdParameter & {
    /** The Virtual Account address to look up. */
    account: Address;
  }
>;

/**
 * Decoded result of {@link getVirtualAccount}.
 *
 * Field shapes and ordering mirror the on-chain `VirtualAccountDetail` struct
 * (perps-core v0.8.5) exactly. `isolationType` is surfaced as the
 * {@link VirtualAccountIsolationType} numeric union (matches
 * {@link VIRTUAL_ACCOUNT_ISOLATION_TYPE}).
 */
export interface VirtualAccountDetail {
  /** The VA's own address. */
  accountAddress: Address;
  /** The subaccount that created this VA. */
  parentAccount: Address;
  /** Market identifier (`symbolId`) the VA trades. */
  symbolId: bigint;
  /** `true` once the VA has been created on-chain. */
  isExists: boolean;
  /** Opaque per-VA metadata blob, or `0x`. */
  metadata: Hex;
  /** Isolation mode the VA was created with — encodes side for `MARKET_LONG` / `MARKET_SHORT`. */
  isolationType: VirtualAccountIsolationType;
}

/** Return type of {@link getVirtualAccount}. */
export type GetVirtualAccountReturnType = VirtualAccountDetail;

/**
 * Read a Virtual Account's on-chain detail struct.
 *
 * The struct carries enough to derive `(market, side)` for the VA without a
 * second call: `symbolId` is the market; `isolationType === MARKET_LONG`
 * (resp. `MARKET_SHORT`) pins the side. `MARKET` isolation means both sides
 * share the VA; `POSITION` isolation means the VA is bound to a single quote.
 *
 * The mapping is fixed at VA creation time and never changes, so the result
 * is safe to cache indefinitely (`staleTime: Infinity`).
 *
 * @throws {SymmError} when the chain is not supported.
 * @throws Viem's `ContractFunctionExecutionError` and friends for on-chain failures.
 *
 * @example
 * ```ts
 * const detail = await getVirtualAccount(config, { account: vaAddress });
 * // detail.symbolId, detail.isolationType
 * ```
 */
export async function getVirtualAccount(
  config: Config,
  parameters: GetVirtualAccountParameters,
): Promise<GetVirtualAccountReturnType> {
  const { chainId, account } = parameters;
  const { addresses } = config.getChainConfig(chainId);
  const client = config.getClient({ chainId });

  const raw = await client.readContract({
    address: addresses.accountLayerAddress,
    abi: accountLayerAbi,
    functionName: "getVirtualAccount",
    args: [account],
  });

  return {
    accountAddress: raw.accountAddress,
    parentAccount: raw.parentAccount,
    symbolId: raw.symbolId,
    isExists: raw.isExists,
    metadata: raw.metadata,
    isolationType: raw.isolationType as VirtualAccountIsolationType,
  };
}
