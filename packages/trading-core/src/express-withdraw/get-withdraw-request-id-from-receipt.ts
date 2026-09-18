import { isAddressEqual, parseEventLogs, type Address, type TransactionReceipt } from "viem";
import { SymmError } from "../shared/errors/symm-error";
import { symmioAbi } from "../symmio-contracts/abi/v0.8.6/symmio";

/**
 * Extract the exact request id emitted for a subaccount from a mined receipt.
 *
 * @param receipt - Successful withdrawal transaction receipt.
 * @param parameters - Expected subaccount and SYMMIO Diamond address.
 * @returns The emitted per-user request id.
 */
export function getWithdrawRequestIdFromReceipt(
  receipt: TransactionReceipt,
  parameters: { user: Address; symmioAddress: Address },
): bigint {
  if (receipt.status !== "success") {
    throw new SymmError(
      "validation",
      "WITHDRAW_RECEIPT_REVERTED",
      "Cannot extract a withdrawal request id from a reverted transaction receipt.",
    );
  }
  const events = parseEventLogs({
    abi: symmioAbi,
    eventName: "WithdrawInitiated",
    logs: receipt.logs.filter((log) => isAddressEqual(log.address, parameters.symmioAddress)),
    strict: false,
  }).filter((event) => event.args.user && isAddressEqual(event.args.user, parameters.user));

  if (events.length === 0) {
    throw new SymmError(
      "validation",
      "WITHDRAW_INITIATED_EVENT_NOT_FOUND",
      `The transaction receipt contains no WithdrawInitiated event for ${parameters.user}.`,
    );
  }
  if (events.length > 1) {
    throw new SymmError(
      "validation",
      "WITHDRAW_INITIATED_EVENT_AMBIGUOUS",
      `The transaction receipt contains multiple WithdrawInitiated events for ${parameters.user}.`,
    );
  }
  const requestId = events[0]?.args.requestId;
  if (requestId === undefined) {
    throw new SymmError("validation", "WITHDRAW_REQUEST_ID_MISSING", "WithdrawInitiated did not contain a request id.");
  }
  return requestId;
}
