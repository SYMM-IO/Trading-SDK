import { isAddressEqual, type Address, type Hex } from "viem";
import type { Config } from "../core/config";
import { getSubAccount } from "../symmio-contracts/account-layer/actions/get-sub-account";
import { getIsDelegationActive } from "../symmio-contracts/instant-layer/actions/get-is-delegation-active";

/**
 * One owner read per (config, chainId, sub-account).
 *
 * Cached for the config's lifetime, which is a deliberate trade: the AccountLayer
 * does expose `transferSubAccountOwnership`, so an owner is not strictly
 * immutable, but a transfer mid-session is rare and the alternative is an extra
 * RPC read on every relayed write. A stale entry costs a spurious delegation
 * probe, never a wrong authorization — the contract re-checks both the owner and
 * the delegation on execution.
 */
const accountOwners = new WeakMap<Config, Map<string, Promise<Address | null>>>();

/**
 * The owning EOA of a sub-account, read once per config lifetime.
 *
 * The real promise is cached (so concurrent writes share the single in-flight
 * read instead of each issuing their own), and the entry is dropped on rejection
 * so a transient RPC failure cannot poison the config.
 *
 * @param config - The SDK config.
 * @param chainId - The chain the sub-account lives on.
 * @param account - The sub-account.
 * @returns The owner, or `null` when the AccountLayer knows no such sub-account.
 *
 * @internal
 */
export function getCachedGaslessAccountOwner(
  config: Config,
  chainId: number,
  account: Address,
): Promise<Address | null> {
  let byAccount = accountOwners.get(config);
  if (!byAccount) {
    byAccount = new Map();
    accountOwners.set(config, byAccount);
  }
  const cache = byAccount;
  const key = `${chainId}:${account.toLowerCase()}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const read = getSubAccount(config, { chainId, account }).then((detail) =>
    /**
     * An unknown or deleted sub-account reports `isExists: false` with a zero
     * `owner`. Returning that zero address would make every signer compare
     * unequal to the owner, so the dispatcher would classify even the real owner
     * as a delegate and reject the write with a misleading
     * `GASLESS_SIGNER_NOT_DELEGATED`. `null` instead means "cannot establish an
     * owner" and skips the pre-flight, leaving the contract to give the accurate
     * error.
     */
    detail.isExists ? detail.owner : null,
  );
  cache.set(key, read);
  read.catch(() => {
    if (cache.get(key) === read) cache.delete(key);
  });
  return read;
}

/**
 * Selectors the signing key may not relay under `signerAccount`.
 *
 * The owner needs no delegation, so an owner signer short-circuits after the
 * (cached) owner read with zero extra calls. Any other signer is a delegate — a
 * session key — and every distinct selector is checked against
 * `isDelegationActive` concurrently.
 *
 * @param config - The SDK config.
 * @param parameters - The chain, the signing key, the account it signs under, and the selectors it relays.
 * @returns The selectors with no active delegation; empty when the signer may
 *   relay every call.
 *
 * @internal
 */
export async function findUndelegatedGaslessSelectors(
  config: Config,
  parameters: { chainId: number; signer: Address; signerAccount: Address; selectors: readonly Hex[] },
): Promise<Hex[]> {
  const owner = await getCachedGaslessAccountOwner(config, parameters.chainId, parameters.signerAccount);
  if (owner === null || isAddressEqual(parameters.signer, owner)) return [];

  const selectors = [...new Set(parameters.selectors)];
  const active = await Promise.all(
    selectors.map((selector) =>
      getIsDelegationActive(config, {
        chainId: parameters.chainId,
        account: parameters.signerAccount,
        delegate: parameters.signer,
        selector,
      }),
    ),
  );
  return selectors.filter((_, index) => !active[index]);
}
