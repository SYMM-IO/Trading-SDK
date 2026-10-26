import { decodeFunctionData, isAddressEqual, toFunctionSelector, type Address, type Hex } from "viem";
import type { Config } from "../../core/config";
import { SymmError } from "../../shared/errors/symm-error";
import { accountLayerAbi } from "../../symmio-contracts/abi/v0.8.6/account-layer";
import { instantLayerAbi } from "../../symmio-contracts/abi/v0.8.6/instant-layer";
import { getVirtualAccount } from "../../symmio-contracts/account-layer/actions/get-virtual-account";
import { getIsDelegationActive } from "../../symmio-contracts/instant-layer/actions/get-is-delegation-active";
import type { ResolvedGaslessBatchEntry } from "../batch/resolve-gasless-batch";
import { getEffectiveInstantSelectors } from "../effective-instant-selectors";
import { getGaslessWalletExecuteSelectors } from "../gasless-wallet-execute/selectors";
import type { GaslessWalletIdentities } from "../resolve-wallet-identities";

/** Grant operations are owner-only even if a delegate holds their selectors. */
const GRANT_SELECTORS: ReadonlySet<Hex> = new Set(
  instantLayerAbi
    .filter((item) => item.type === "function" && (item.name === "grantDelegation" || item.name === "grantDelegations"))
    .map((item) => toFunctionSelector(item).toLowerCase() as Hex),
);

/**
 * Check each entry against the authority available at its execution position.
 * Valid owner grants extend authority only for subsequent entries. On-chain
 * delegation reads are deduplicated by signer and selector.
 *
 * @param config - The SDK config.
 * @param parameters - Chain, operation account, aligned entries/signers, and any resolved wallet identities.
 * @returns The account's current owner, without the GaslessWallet bare-account fallback.
 * @throws {SymmError} For an invalid grant or missing delegation, before signing.
 * @internal
 */
export async function preflightBatchDelegations(
  config: Config,
  parameters: {
    chainId: number;
    account: Address;
    entries: readonly ResolvedGaslessBatchEntry[];
    entrySigners: readonly Address[];
    identities: GaslessWalletIdentities | null;
  },
): Promise<Address> {
  const { chainId, account, entries, entrySigners, identities } = parameters;
  const client = config.getClient({ chainId });
  const { addresses } = config.getChainConfig(chainId);
  const [owner, canonicalAccount] = await Promise.all([
    client.readContract({
      address: addresses.accountLayerAddress,
      abi: accountLayerAbi,
      functionName: "ownerOf",
      args: [account],
    }),
    identities?.canonicalAccount ??
      getVirtualAccount(config, { chainId, account }).then((detail) =>
        detail.isExists ? detail.parentAccount : account,
      ),
  ]);
  const granted = new Map<string, Set<Hex>>();
  const required = new Map<string, { signer: Address; selectors: Set<Hex> }>();
  let blockTimestamp: bigint | undefined;

  for (const [index, entry] of entries.entries()) {
    const signer = entrySigners[index]!;
    if (entry.type === "instant" && GRANT_SELECTORS.has(entry.selector)) {
      if (!isAddressEqual(signer, owner)) throw invalidGrant(index, "only the account owner can sign a grant");
      const decoded = decodeFunctionData({ abi: instantLayerAbi, data: entry.callData });
      const infos =
        decoded.functionName === "grantDelegation"
          ? [decoded.args[0]]
          : decoded.functionName === "grantDelegations"
            ? decoded.args[0]
            : [];
      if (infos.length === 0) throw invalidGrant(index, "a grant must contain at least one delegation");
      blockTimestamp ??= (await client.getBlock({ blockTag: "latest" })).timestamp;

      for (const info of infos) {
        if (!isAddressEqual(info.account.addr, account) || info.account.isPartyB)
          throw invalidGrant(index, "every delegation must name the operation's PartyA account");
        if (isAddressEqual(info.delegatedSigner, owner))
          throw invalidGrant(index, "the owner cannot delegate to itself");
        if (info.expiryTimestamp <= blockTimestamp)
          throw invalidGrant(index, "delegation expiry must be later than the latest block timestamp");
        if (info.selectors.length === 0) throw invalidGrant(index, "a delegation must contain at least one selector");
        const key = info.delegatedSigner.toLowerCase();
        const selectors = granted.get(key) ?? new Set<Hex>();
        for (const selector of info.selectors) selectors.add(selector.toLowerCase() as Hex);
        granted.set(key, selectors);
      }
      continue;
    }

    const entryOwner = entry.type === "wallet" ? identities!.ownerWallet : owner;
    if (isAddressEqual(signer, entryOwner)) continue;
    const selectors =
      entry.type === "wallet"
        ? getGaslessWalletExecuteSelectors(entry.walletCalls)
        : getEffectiveInstantSelectors(entry.callData);
    const key = signer.toLowerCase();
    const group = required.get(key) ?? { signer, selectors: new Set<Hex>() };
    for (const selector of selectors) {
      const normalized = selector.toLowerCase() as Hex;
      if (!granted.get(key)?.has(normalized)) group.selectors.add(normalized);
    }
    if (group.selectors.size > 0) required.set(key, group);
  }

  const missing = await Promise.all(
    [...required.values()].map(async ({ signer, selectors }) => {
      const checks = await Promise.all(
        [...selectors].map(async (selector) => ({
          selector,
          active: await getIsDelegationActive(config, {
            chainId,
            account: canonicalAccount,
            delegate: signer,
            selector,
          }),
        })),
      );
      return { signer, selectors: checks.filter((check) => !check.active).map((check) => check.selector) };
    }),
  );
  const failures = missing.filter((group) => group.selectors.length > 0);
  if (failures.length > 0) {
    const details = failures
      .map(
        (group) =>
          `signer ${group.signer} holds no active InstantLayer delegation from ${canonicalAccount} for selector(s) ${group.selectors.join(", ")}`,
      )
      .join("; ");
    throw new SymmError(
      "validation",
      "GASLESS_SIGNER_NOT_DELEGATED",
      `Gasless: ${details}. Grant getGaslessBatchSelectors(delegateCalls) for only the calls each delegate signs on ${canonicalAccount}, or sign those entries with the account's owner.`,
    );
  }
  return owner;
}

function invalidGrant(index: number, reason: string): SymmError {
  return new SymmError(
    "validation",
    "GASLESS_INVALID_DELEGATION_GRANT",
    `Gasless: calls[${index}] is an invalid delegation grant: ${reason}.`,
  );
}
