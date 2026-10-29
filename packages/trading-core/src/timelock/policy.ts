import { getAbiItem, toFunctionSelector, type Address, type Hex } from "viem";
import type { Config } from "../core/config";
import { accountLayerAbi } from "../symmio-contracts/abi/v0.8.6/account-layer";
import { symmioAbi } from "../symmio-contracts/abi/v0.8.6/symmio";
import { assertTimelockSupported } from "./support";

/** Core operations whose AccountLayer policy must cover for wrapped instant opens. */
export const INSTANT_OPEN_TIMELOCK_CORE_FUNCTIONS = [
  "withdraw",
  "withdrawTo",
  "initiateWithdraw",
  "internalTransfer",
  "allocate",
  "externalTransfer",
  "virtualExternalTransfer",
  "transferToBridge",
  "deallocate",
  "safeDeallocate",
  "depositToReserveVault",
  "approveOperationalFee",
  "approveOperationalFeeWithMultiplier",
] as const;

/** Direct AccountLayer operations whose policy must cover for wrapped instant opens. */
export const INSTANT_OPEN_TIMELOCK_ACCOUNT_LAYER_FUNCTIONS = [
  "addMargin",
  "addMarginToNextVA",
  "removeMargin",
  "safeRemoveMargin",
  "emergencyRecoverMargin",
  "transferSubAccountOwnership",
  "deleteSubAccount",
  "setSingleVAMode",
  "createCustomVirtualAccount",
] as const;

/** The exact 22-selector policy. `_call` is intentionally not included. */
export const INSTANT_OPEN_TIMELOCK_SELECTORS: readonly Hex[] = [
  ...INSTANT_OPEN_TIMELOCK_CORE_FUNCTIONS.map((name) => toFunctionSelector(getAbiItem({ abi: symmioAbi, name }))),
  ...INSTANT_OPEN_TIMELOCK_ACCOUNT_LAYER_FUNCTIONS.map((name) =>
    toFunctionSelector(getAbiItem({ abi: accountLayerAbi, name })),
  ),
];

/** Select the larger of the contract and provider minimum delays. */
export function requiredTimelockDelay(contractMinimum: bigint, providerMinimum: bigint | number): bigint {
  const provider = BigInt(providerMinimum);
  return contractMinimum > provider ? contractMinimum : provider;
}

/** Read whether a root account satisfies a provider's complete selector policy. */
export async function isTimelockPolicyConfigured(
  config: Config,
  parameters: {
    chainId?: number;
    account: Address;
    unlocker: Address;
    minimumDelay: bigint;
    selectors: readonly Hex[];
  },
): Promise<boolean> {
  assertTimelockSupported(config, parameters.chainId);
  const { addresses } = config.getChainConfig(parameters.chainId);
  return config.getClient({ chainId: parameters.chainId }).readContract({
    address: addresses.accountLayerAddress,
    abi: accountLayerAbi,
    functionName: "allTimelockedBy",
    args: [parameters.account, parameters.unlocker, parameters.minimumDelay, [...parameters.selectors]],
  });
}
