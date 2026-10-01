import { isAddress, isAddressEqual, type Address } from "viem";
import { SymmApiError } from "../shared/errors/symm-error";
import { requireGaslessRequestId } from "./to-gasless-submit-receipt";
import type { GaslessDepositSubmitReceipt } from "./types";
import { parseGaslessWalletId } from "./wallet-id";
import { toGaslessAcceptanceStatus, toGaslessOptionalAmount } from "./wire-parse";
import type { GaslessWireDepositAccepted } from "./wire-types";

/**
 * What the submitter knows about a settlement the acceptance body does not
 * echo, plus the wallet it must have settled.
 *
 * @internal
 */
export interface GaslessDepositSubmitContext {
  /** The `owner` the settlement was submitted for. */
  owner: Address;
  /** The wallet id the settlement was submitted for. */
  walletId: bigint;
  /** The idempotency key the settlement was submitted with. */
  idempotencyKey: string;
  /** The protocol instance the submit was routed to, or `null` for a proxy base that names none. */
  protocolInstance: string | null;
}

/**
 * Parse a deposit settlement's `202` acceptance into
 * {@link GaslessDepositSubmitReceipt}. Shared by the new-account and
 * existing-account settlement actions.
 *
 * Tolerant in the same way as the operations receipt: only `request_id` is
 * required, an unknown status reads as `queued`, unreported amounts read as
 * `null`, and an omitted `wallet_id` means wallet `0` — the service's own
 * default for a request that names none.
 *
 * @param raw - The acceptance body.
 * @param context - What the submitter knows that the body does not echo.
 * @returns The normalized receipt.
 * @throws {SymmError} `GASLESS_ACCEPTANCE_INVALID` when the body carries no `request_id`.
 * @throws {SymmError} `GASLESS_WALLET_ID_INVALID` when `wallet_id` is present but not a `uint256` decimal.
 *
 * @internal
 */
export function toGaslessDepositReceipt(
  raw: GaslessWireDepositAccepted,
  context: GaslessDepositSubmitContext,
): GaslessDepositSubmitReceipt {
  return {
    requestId: requireGaslessRequestId(raw?.request_id),
    status: toGaslessAcceptanceStatus(raw.status),
    depositAddress: raw.deposit_address as Address,
    walletId: raw.wallet_id === undefined || raw.wallet_id === null ? 0n : parseGaslessWalletId(raw.wallet_id),
    owner: context.owner,
    observedAmount: toGaslessOptionalAmount(raw.observed_amount),
    paidFee: toGaslessOptionalAmount(raw.paid_fee),
    creditedAmount: toGaslessOptionalAmount(raw.credited_amount),
    idempotencyKey: context.idempotencyKey,
    protocolInstance: context.protocolInstance,
  };
}

/**
 * Assert that the accepted settlement is the one that was asked for: the same
 * wallet id, sweeping the same deposit address.
 *
 * The vendor requires this check (doc: "verify the returned ID and address
 * match the wallet funded for this workflow"), because a wrong wallet sweeps a
 * balance the user never meant to move. The request is already accepted when
 * this runs, so the error carries the parsed receipt — the `requestId` must
 * survive the mismatch or the workflow becomes untrackable.
 *
 * @param receipt - The parsed acceptance.
 * @param expected - The wallet the settlement was submitted for, with its derived deposit address.
 * @throws {SymmApiError} `GASLESS_DEPOSIT_WALLET_MISMATCH`, with the receipt as `responseData`.
 *
 * @internal
 */
export function assertGaslessDepositWallet(
  receipt: GaslessDepositSubmitReceipt,
  expected: { walletId: bigint; depositAddress: Address; url: string; path: string },
): void {
  const sameWallet = receipt.walletId === expected.walletId;
  const sameAddress =
    isAddress(receipt.depositAddress) && isAddressEqual(receipt.depositAddress, expected.depositAddress);
  if (sameWallet && sameAddress) return;

  throw new SymmApiError({
    code: "GASLESS_DEPOSIT_WALLET_MISMATCH",
    message: `Gasless: settlement ${receipt.requestId} was accepted for wallet ${receipt.walletId} at ${receipt.depositAddress}, but it was submitted for wallet ${expected.walletId} at ${expected.depositAddress}. The request is already accepted — reconcile it by its request id before funding or settling anything else.`,
    status: 202,
    statusText: "Accepted",
    responseData: receipt,
    url: `${expected.url}${expected.path}`,
    method: "POST",
  });
}
