import { isAddress, isAddressEqual, zeroAddress } from "viem";
import type { SymmioChainConfig } from "../../core/chains/types";
import { SymmError } from "../../shared/errors/symm-error";
import type { TimelockApprovalCapability } from "../../timelock/approval";

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

/** Normalize optional Enigma metadata; an explicitly malformed capability never selects a legacy path. @internal */
export function parseTimelockInfo(value: unknown, chain: SymmioChainConfig): TimelockApprovalCapability | undefined {
  const info = record(value);
  if (info && !("timelock_approval" in info)) return undefined;
  const metadata = record(info?.timelock_approval);
  const domain = record(metadata?.request_domain);
  const unlocker = metadata?.unlocker;
  const validity = metadata?.validity_seconds;
  const delay = metadata?.min_timelock_delay_seconds;
  if (
    typeof unlocker !== "string" ||
    !isAddress(unlocker, { strict: false }) ||
    isAddressEqual(unlocker, zeroAddress) ||
    typeof validity !== "number" ||
    !Number.isSafeInteger(validity) ||
    validity <= 0 ||
    typeof delay !== "number" ||
    !Number.isSafeInteger(delay) ||
    delay < 0 ||
    domain?.name !== "SymmioTimelockApprovalRequest" ||
    domain.version !== "1" ||
    typeof domain.chainId !== "string" ||
    domain.chainId !== String(chain.chainId) ||
    typeof domain.verifyingContract !== "string" ||
    !isAddress(domain.verifyingContract, { strict: false }) ||
    !isAddressEqual(domain.verifyingContract, chain.addresses.accountLayerAddress)
  )
    throw new SymmError(
      "api",
      "INVALID_TIMELOCK_METADATA",
      "Solver timelock metadata is malformed or does not match the selected deployment.",
    );
  return {
    unlocker,
    validitySeconds: validity,
    minTimelockDelaySeconds: delay,
    requestDomain: {
      name: domain.name,
      version: domain.version,
      chainId: domain.chainId,
      verifyingContract: domain.verifyingContract,
    },
  };
}
