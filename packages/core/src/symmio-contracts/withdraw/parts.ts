import { zeroAddress, type Address } from "viem";
import type { WithdrawReceiverPart } from "./types";

/**
 * Build a {@link WithdrawReceiverPart} for a standard same-chain withdrawal — no
 * express, no virtual provider.
 *
 * Convenience over hand-constructing the tuple: it fills both provider fields
 * with the zero address. `initiateWithdraw` still accepts the full `parts` array
 * directly, so use this only when you want the classic single-part case.
 *
 * @remarks
 * A 20-byte EVM address is already its own `bytes` representation, so `receiver`
 * is the destination address as-is — no encoding needed for EVM destinations.
 *
 * @param parameters - Part id, amount (collateral units), destination address, destination chain id.
 * @returns A classic (provider-free) withdraw receiver part.
 *
 * @example
 * ```ts
 * const part = createClassicWithdrawPart({ id: 0n, amount: 1_000000n, receiver: "0xabc…", chainId: 999n });
 * await initiateWithdraw(config, { account, parts: [part] });
 * ```
 */
export function createClassicWithdrawPart(parameters: {
  /** Caller-assigned part id, unique within the request. */
  id: bigint;
  /** Amount of collateral for this part, in the collateral token's smallest unit. */
  amount: bigint;
  /** Destination EVM address. */
  receiver: Address;
  /** Destination chain id (use the source chain id for a same-chain withdrawal). */
  chainId: bigint;
}): WithdrawReceiverPart {
  return {
    id: parameters.id,
    amount: parameters.amount,
    chainId: parameters.chainId,
    receiver: parameters.receiver,
    virtualProvider: zeroAddress,
    expressProvider: zeroAddress,
  };
}
