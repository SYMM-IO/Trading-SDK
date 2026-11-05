import { decodeFunctionData, isAddress, isAddressEqual, type Address, type Hex } from "viem";
import { accountLayerAbi } from "../symmio-contracts/abi/v0.8.6/account-layer";

/** Check that a scheduled raw call is exactly the direct or single-Core-call execution payload. */
export function matchesScheduledCall(account: Address, rawCallData: Hex, innerCallData: Hex): boolean {
  if (!/^0x(?:[\da-fA-F]{2}){4,}$/.test(rawCallData) || !/^0x(?:[\da-fA-F]{2}){4,}$/.test(innerCallData)) return false;
  if (rawCallData.toLowerCase() === innerCallData.toLowerCase())
    return matchesDirectAccountLayerCall(account, innerCallData);
  try {
    const decoded = decodeFunctionData({ abi: accountLayerAbi, data: innerCallData });
    if (decoded.functionName !== "_call") return false;
    const [target, calls] = decoded.args;
    return (
      isAddressEqual(target, account) && calls.length === 1 && calls[0]?.toLowerCase() === rawCallData.toLowerCase()
    );
  } catch {
    return false;
  }
}

function matchesDirectAccountLayerCall(account: Address, callData: Hex): boolean {
  try {
    const decoded = decodeFunctionData({ abi: accountLayerAbi, data: callData });
    if (decoded.functionName === "_call") {
      const [target] = decoded.args;
      return isAddressEqual(target, account);
    }
    if (decoded.functionName === "executeTimelockOp") return matchesDirectAccountLayerCall(account, decoded.args[1]);
    const item = accountLayerAbi.find(
      (candidate) => candidate.type === "function" && candidate.name === decoded.functionName,
    );
    if (!item || item.type !== "function") return true;
    const accountIndex = item.inputs.findIndex(
      (input) => input.type === "address" && /^(?:account|subAccount|virtualAccount)$/.test(input.name),
    );
    if (accountIndex < 0) return true;
    const target = decoded.args[accountIndex];
    return typeof target === "string" && isAddress(target) && isAddressEqual(target, account);
  } catch {
    // Preserve exact matching for extension selectors outside the pinned ABI.
    return true;
  }
}
