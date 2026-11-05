import { isAddressEqual, sliceHex, zeroAddress, type Address, type Hex } from "viem";
import type { Config } from "../core/config";
import { SymmError } from "../shared/errors/symm-error";
import { getSelectorTimelock } from "../symmio-contracts/account-layer/get-selector-timelock";
import { encodeTimelockedCoreCall } from "./approval";

/** Reject a Core call whose outer AccountLayer `_call` needs a separate authorization. */
export async function assertCoreTimelockWrapperUnprotected(
  config: Config,
  parameters: { chainId?: number; account: Address; rootAccount: Address; callData: Hex },
): Promise<void> {
  const wrapper = encodeTimelockedCoreCall(parameters.account, parameters.callData);
  const outer = await getSelectorTimelock(config, {
    account: parameters.rootAccount,
    chainId: parameters.chainId,
    selector: sliceHex(wrapper, 0, 4),
  });
  if (!isAddressEqual(outer.unlocker, zeroAddress))
    throw new SymmError(
      "validation",
      "TIMELOCK_OUTER_CALL_UNSUPPORTED",
      "The outer _call selector is timelocked; it requires separate authorization.",
    );
}
