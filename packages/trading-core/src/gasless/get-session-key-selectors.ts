import type { Hex } from "viem";
import type { Config } from "../core/config";
import { SymmError } from "../shared/errors/symm-error";
import type { ChainIdParameter, Compute } from "../shared/types/properties";
import { getInstantTradeRequiredSelectors } from "../solvers/instant-open/shared/selectors";
import { GASLESS_SESSION_KEY_SELECTORS, GASLESS_SESSION_KEY_WITHDRAW_SELECTORS } from "./relayable-writes";

/**
 * Which authority to include in a session key's delegation grant.
 *
 * Each flag is a separate decision, so an app grants exactly the authority its
 * key needs and nothing more.
 */
export interface SessionKeySelectorScope {
  /**
   * Include the instant trade lifecycle — open, close and margin top-up —
   * resolved for the chain's contracts generation. Defaults to `true`.
   */
  trade?: boolean;
  /**
   * Include gasless account management (`GASLESS_SESSION_KEY_SELECTORS`):
   * allocation, margin, cancellations, force-cancels, the operational-fee
   * approval, renaming, and settling or cancelling an already-initiated
   * withdrawal. Defaults to `true`.
   */
  account?: boolean;
  /**
   * Include `initiateWithdraw` (`GASLESS_SESSION_KEY_WITHDRAW_SELECTORS`).
   * Defaults to **`false`**: its parts carry a caller-supplied `receiver`, so a
   * key holding it can send the sub-account's collateral to an address of its
   * own choosing. Opt in only for a key that must run withdrawals unattended.
   */
  withdraw?: boolean;
}

/**
 * Parameters for {@link getSessionKeySelectors}: the target chain plus the
 * authority scope to grant.
 */
export type GetSessionKeySelectorsParameters = Compute<ChainIdParameter & SessionKeySelectorScope>;

/**
 * Normalize to lowercase and drop repeats while preserving first-seen order.
 *
 * The scopes overlap by design (a selector may appear in more than one source
 * set), and `grantDelegation` rejects a duplicate-bearing selector array, so the
 * union has to be de-duplicated before it reaches the contract.
 */
function dedupeSelectors(selectors: readonly Hex[]): readonly Hex[] {
  const seen = new Set<Hex>();
  const unique: Hex[] = [];
  for (const selector of selectors) {
    const normalized = selector.toLowerCase() as Hex;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    unique.push(normalized);
  }
  return unique;
}

/**
 * Build the selector set to grant a session key — **this is the function to
 * call**. {@link GASLESS_SESSION_KEY_SELECTORS} and
 * {@link GASLESS_SESSION_KEY_WITHDRAW_SELECTORS} are its low-level pieces, and
 * the trade lifecycle is a third piece that is chain-dependent; this resolves
 * all three for one chain and hands back a single array for `grantDelegation`.
 *
 * The default scope — trade **and** account management, **without**
 * `initiateWithdraw` — is the onboarding grant: one signature buys a key
 * promptless, gas-free authority over the whole trading lifecycle and the
 * account's own bookkeeping, while the one write that names a destination for
 * collateral stays behind an explicit `withdraw: true`.
 *
 * The returned order is stable and meaningful — account selectors, then the
 * withdraw selector, then the trade selectors — so two grants diff readably in a
 * UI. Values are lowercase and de-duplicated.
 *
 * @param config - The SDK config.
 * @param parameters - Optional `chainId` (defaults to the config's
 *   `defaultChainId`) and scope flags.
 * @returns The de-duplicated, lowercase selector set for the requested scope.
 * @throws {SymmError} `UNSUPPORTED_CHAIN` when the chain is not configured.
 * @throws {SymmError} `SESSION_KEY_SELECTORS_UNSUPPORTED_CHAIN` when the `account`
 *   or `withdraw` scope is requested on a chain whose `contractsVersion` is not
 *   `"0.8.6"`. Those selectors come from the v0.8.6 ABIs and include
 *   `approveOperationalFeeWithMultiplier`, which does not exist on a v0.8.5
 *   diamond. A trade-only request (`{ account: false }`) works on both
 *   generations.
 *
 * @example
 * ```ts
 * await grantDelegation(config, {
 *   account: { addr: subAccount, isPartyB: false },
 *   delegatedSigner: sessionKey,
 *   selectors: getSessionKeySelectors(config, { chainId }),
 *   expiryTimestamp,
 *   gasless: true,
 * });
 * ```
 *
 * @example
 * ```ts
 * // A key that also withdraws unattended — it can move the collateral out.
 * const selectors = getSessionKeySelectors(config, { chainId, withdraw: true });
 * ```
 */
export function getSessionKeySelectors(
  config: Config,
  parameters: GetSessionKeySelectorsParameters = {},
): readonly Hex[] {
  const { chainId, trade = true, account = true, withdraw = false } = parameters;

  const selectors: Hex[] = [];

  if (account || withdraw) {
    const chain = config.getChainConfig(chainId);
    if (chain.contractsVersion !== "0.8.6") {
      throw new SymmError(
        "config",
        "SESSION_KEY_SELECTORS_UNSUPPORTED_CHAIN",
        `Session keys: chain ${chain.chainId} runs contracts ${chain.contractsVersion}, but the account-management selectors exist only on perps-core ("0.8.6") deployments. Request \`{ account: false, withdraw: false }\` for a trade-only key.`,
      );
    }
    if (account) selectors.push(...GASLESS_SESSION_KEY_SELECTORS);
    if (withdraw) selectors.push(...GASLESS_SESSION_KEY_WITHDRAW_SELECTORS);
  }

  if (trade) selectors.push(...getInstantTradeRequiredSelectors(config, { chainId }));

  return dedupeSelectors(selectors);
}
