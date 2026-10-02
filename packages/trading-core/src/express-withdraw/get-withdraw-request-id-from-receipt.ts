import { isAddressEqual, parseEventLogs, type Address, type TransactionReceipt } from "viem";
import { SymmError } from "../shared/errors/symm-error";
import { symmioAbi } from "../symmio-contracts/abi/v0.8.6/symmio";

/**
 * Extract the exact request id emitted for a subaccount from a mined receipt.
 *
 * Decodes the single `WithdrawInitiated` event the SYMMIO Diamond emitted for
 * `user`. With `requireFinalized`, the receipt must also carry the Diamond's
 * `WithdrawFinalized` event for that same request. The immediate classic route
 * of `withdrawWithExpress` needs this check: its one-transaction batch finalizes
 * a guessed id, so a concurrent request on the same subaccount can be finalized
 * in place of the new one. `WithdrawFinalized.user` is the core signer, which is
 * the subaccount itself when it finalizes its own request inside that batch.
 *
 * @param receipt - Successful withdrawal transaction receipt.
 * @param parameters - Expected subaccount and SYMMIO Diamond address, plus
 *   `requireFinalized` to also require that this transaction finalized the request
 *   it initiated (defaults to `false`).
 * @returns The emitted per-user request id.
 * @throws {SymmError} `WITHDRAW_RECEIPT_REVERTED` when the receipt did not succeed.
 * @throws {SymmError} `WITHDRAW_INITIATED_EVENT_NOT_FOUND` when the Diamond emitted no
 *   `WithdrawInitiated` event for `user`.
 * @throws {SymmError} `WITHDRAW_INITIATED_EVENT_AMBIGUOUS` when it emitted more than one.
 * @throws {SymmError} `WITHDRAW_REQUEST_ID_MISSING` when the event carries no request id.
 * @throws {SymmError} `WITHDRAW_REQUEST_NOT_FINALIZED` when `requireFinalized` is set
 *   and the transaction finalized another request, or none. The initiated request stays
 *   pending: call again without the flag to recover its id, then finalize or cancel it.
 *
 * @example
 * ```ts
 * const { hash, route } = await withdrawWithExpress(config, { account, amount, receiver });
 * const receipt = await publicClient.waitForTransactionReceipt({ hash });
 * const requestId = getWithdrawRequestIdFromReceipt(receipt, {
 *   user: account,
 *   symmioAddress: config.getChainConfig().addresses.symmioAddress,
 *   requireFinalized: route.kind === "classic" && route.finalize === "immediate",
 * });
 * ```
 */
export function getWithdrawRequestIdFromReceipt(
  receipt: TransactionReceipt,
  parameters: {
    /** Subaccount that initiated the withdrawal. */
    user: Address;
    /** SYMMIO Diamond that emitted the withdrawal events. */
    symmioAddress: Address;
    /** Also require a `WithdrawFinalized` event for the initiated request. Defaults to `false`. */
    requireFinalized?: boolean;
  },
): bigint {
  if (receipt.status !== "success") {
    throw new SymmError(
      "validation",
      "WITHDRAW_RECEIPT_REVERTED",
      "Cannot extract a withdrawal request id from a reverted transaction receipt.",
    );
  }
  const diamondLogs = receipt.logs.filter((log) => isAddressEqual(log.address, parameters.symmioAddress));
  const events = parseEventLogs({
    abi: symmioAbi,
    eventName: "WithdrawInitiated",
    logs: diamondLogs,
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

  if (parameters.requireFinalized) {
    const finalizedIds = parseEventLogs({
      abi: symmioAbi,
      eventName: "WithdrawFinalized",
      logs: diamondLogs,
      strict: false,
    })
      .filter((event) => event.args.user && isAddressEqual(event.args.user, parameters.user))
      .flatMap((event) => (event.args.requestId === undefined ? [] : [event.args.requestId]));

    if (!finalizedIds.includes(requestId)) {
      const finalized =
        finalizedIds.length === 0 ? "no withdrawal request" : finalizedIds.map((id) => `#${id}`).join(", ");
      throw new SymmError(
        "validation",
        "WITHDRAW_REQUEST_NOT_FINALIZED",
        `Withdrawal request #${requestId} for ${parameters.user} was initiated but not finalized (this transaction finalized ${finalized}); it stays pending until it is finalized or cancelled.`,
      );
    }
  }
  return requestId;
}
