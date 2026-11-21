import { decodeFunctionData, getAbiItem, isAddressEqual, toFunctionSelector, type Address, type Hex } from "viem";
import { symmioAbi } from "../../symmio-contracts/abi/v0.8.6/symmio";
import {
  gaslessBatchCallData,
  gaslessCallDataSelector,
  isGaslessBatchWalletExecute,
  type GaslessBatchCall,
} from "../batch/calls";

const APPROVE_SELECTORS: ReadonlySet<Hex> = new Set(
  (["approveOperationalFee", "approveOperationalFeeWithMultiplier"] as const).map((name) =>
    toFunctionSelector(getAbiItem({ abi: symmioAbi, name })),
  ),
);

/**
 * The operational-fee allowance the batch itself sets for `charger`, keyed by
 * lowercase payer, or nothing for a payer the batch does not approve.
 *
 * Every relayed call runs as the batch `account`, so a core `approveOperationalFee`
 * or `approveOperationalFeeWithMultiplier` in the batch sets that account's
 * allowance. The contract stores the named amount (`LibOperationalFee.setAllowance`)
 * and fees are collected after every call has run, so the last approval wins. A
 * reduction the contract would delay is taken as immediate, which can only
 * under-state the allowance. GaslessWallet calls run as the wallet, and calls
 * wrapped in `executeTimelockOp` are not decoded, so neither counts.
 * `approveOperationalFeeWithMultiplier` may also change the fee multiplier;
 * the quoted fees were priced before the batch, so that change is not reflected.
 *
 * @internal
 */
export function batchFeeApprovals(
  account: Address,
  calls: readonly GaslessBatchCall[],
  charger: Address,
): ReadonlyMap<Address, bigint> {
  const approvals = new Map<Address, bigint>();
  for (const call of calls) {
    if (isGaslessBatchWalletExecute(call)) continue;
    const data = gaslessBatchCallData(call);
    if (!APPROVE_SELECTORS.has(gaslessCallDataSelector(data))) continue;
    const { args } = decodeFunctionData({ abi: symmioAbi, data });
    const [chargers, amounts] = args as unknown as readonly [readonly Address[], readonly bigint[]];
    chargers.forEach((approved, index) => {
      const amount = amounts[index];
      if (amount !== undefined && isAddressEqual(approved, charger)) {
        approvals.set(account.toLowerCase() as Address, amount);
      }
    });
  }
  return approvals;
}
