import type { Address } from "viem";
import type { Config } from "../core/config";
import { collateralToCore18 } from "../shared/utils/core-units";
import { getAccountBalanceOf } from "../symmio-contracts/account-layer";
import { getWithdrawableTime } from "../symmio-contracts/symmio";

/**
 * Read whether an account's available balance covers a withdrawal and whether a
 * request initiated now could be finalized in the same block. Route preparation
 * and the prepared-immediate recheck both use it, so their units and clock
 * cannot drift apart.
 *
 * `balanceOf` reports SYMMIO's 18-decimal internal balance whatever the
 * collateral token's decimals, while `amount` is in collateral base units. The
 * amount is scaled with `collateralToCore18`, which matches
 * `WithdrawFacetImpl._to18Decimals`, before the comparison that
 * `initiateWithdraw`'s `Insufficient balance` require makes.
 *
 * The cooldown is judged against chain time, never `Date.now()`:
 * `getWithdrawableTime` returns `max(cooldownEnd, block.timestamp)`, so an
 * account whose cooldown is over reads back the block's own timestamp, which a
 * browser clock that lags or leads the chain would misjudge. Comparing with the
 * latest block's timestamp is exact; if that block is older than the one the
 * view ran against, the result is a fail-safe "not ready".
 *
 * @param config - SDK configuration with a public client for `chainId`.
 * @param parameters - Subaccount, amount in collateral base units, and the resolved chain id.
 * @returns `sufficientBalance` when the 18-decimal available balance covers the
 *   scaled amount; `cooldownReady` when the withdrawable time is at or before the
 *   latest block's timestamp.
 *
 * @internal
 */
export async function resolveAvailableWithdrawState(
  config: Config,
  parameters: { user: Address; amount: bigint; chainId: number },
): Promise<{ sufficientBalance: boolean; cooldownReady: boolean }> {
  const { user, amount, chainId } = parameters;
  const { collateralDecimals } = config.getChainConfig(chainId).addresses;
  const [withdrawableTime, availableBalance, block] = await Promise.all([
    getWithdrawableTime(config, { user, chainId }),
    getAccountBalanceOf(config, { account: user, chainId }),
    config.getClient({ chainId }).getBlock({ blockTag: "latest" }),
  ]);

  return {
    sufficientBalance: availableBalance >= collateralToCore18(amount, collateralDecimals),
    cooldownReady: withdrawableTime <= block.timestamp,
  };
}
