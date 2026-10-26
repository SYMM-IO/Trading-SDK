import { isAddressEqual, zeroAddress, type Address, type Hex } from "viem";
import type { Config } from "../../core/config";
import { SymmError } from "../../shared/errors/symm-error";
import type { ReadSolverParameter } from "../../shared/types/properties";
import { getSolverInfo } from "../../solvers/get-solver-info";
import {
  getMinTimelockDelay,
  getSelectorTimelock,
  resolveTimelockRootAccount,
} from "../../symmio-contracts/account-layer/actions/timelock";
import type { TimelockApprovalCapability } from "../approval";
import { INSTANT_OPEN_TIMELOCK_SELECTORS, requiredTimelockDelay } from "../policy";

/** One selector's primary correction. The observed values remain available to show all differences. */
export type TimelockSelectorStatus = "ok" | "missing" | "wrong-unlocker" | "delay-too-short";

/** Policy query inputs. Omit capability to fetch the selected solver's `/info`; custom providers may supply it. */
export type GetTimelockPolicyParameters = ReadSolverParameter & {
  account: Address;
  capability?: TimelockApprovalCapability;
  selectors?: readonly Hex[];
};

/** Complete on-chain policy report. On-chain readiness does not prove solver indexing. */
export interface TimelockPolicyReport {
  account: Address;
  rootAccount: Address;
  capability: TimelockApprovalCapability;
  contractMinimum: bigint;
  requiredDelay: bigint;
  ready: boolean;
  selectors: { selector: Hex; unlocker: Address; delay: bigint; status: TimelockSelectorStatus }[];
}

/** Read deployment configuration or fail explicitly when the selected solver does not advertise timelocks. @internal */
export async function resolveTimelockCapability(
  config: Config,
  parameters: GetTimelockPolicyParameters,
): Promise<TimelockApprovalCapability> {
  const capability = parameters.capability ?? (await getSolverInfo(config, parameters)).timelockApproval;
  if (!capability)
    throw new SymmError(
      "config",
      "TIMELOCK_NOT_SUPPORTED",
      "The selected provider does not advertise timelock approval support.",
    );
  const chain = config.getChainConfig(parameters.chainId);
  if (
    Number(capability.requestDomain.chainId) !== chain.chainId ||
    !isAddressEqual(capability.requestDomain.verifyingContract, chain.addresses.accountLayerAddress)
  ) {
    throw new SymmError(
      "validation",
      "TIMELOCK_APPROVAL_DOMAIN_MISMATCH",
      "Timelock capability belongs to another deployment.",
    );
  }
  return capability;
}

/**
 * Resolve any account to its root and report every required selector in one pass.
 * @param config - SDK chain/client configuration.
 * @param parameters - Account, selected deployment/provider and optional selector subset.
 * @returns All observed policies and the greater of the contract/provider minimum delays.
 * @example const policy = await getTimelockPolicy(config, { account });
 */
export async function getTimelockPolicy(
  config: Config,
  parameters: GetTimelockPolicyParameters,
): Promise<TimelockPolicyReport> {
  const [capability, rootAccount, contractMinimum] = await Promise.all([
    resolveTimelockCapability(config, parameters),
    resolveTimelockRootAccount(config, parameters),
    getMinTimelockDelay(config, parameters),
  ]);
  const requiredDelay = requiredTimelockDelay(contractMinimum, capability.minTimelockDelaySeconds);
  const selectors = await Promise.all(
    (parameters.selectors ?? INSTANT_OPEN_TIMELOCK_SELECTORS).map(async (selector) => {
      const policy = await getSelectorTimelock(config, { chainId: parameters.chainId, account: rootAccount, selector });
      const status: TimelockSelectorStatus = isAddressEqual(policy.unlocker, zeroAddress)
        ? "missing"
        : !isAddressEqual(policy.unlocker, capability.unlocker)
          ? "wrong-unlocker"
          : policy.delay < requiredDelay
            ? "delay-too-short"
            : "ok";
      return { selector, ...policy, status };
    }),
  );
  return {
    account: parameters.account,
    rootAccount,
    capability,
    contractMinimum,
    requiredDelay,
    ready: selectors.every((item) => item.status === "ok"),
    selectors,
  };
}
