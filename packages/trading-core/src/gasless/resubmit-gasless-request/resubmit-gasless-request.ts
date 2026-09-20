import { isAddress, type Address } from "viem";
import type { Config } from "../../core/config";
import { SymmError } from "../../shared/errors/symm-error";
import { getGaslessWalletAddress } from "../get-gasless-wallet-address/get-gasless-wallet-address";
import { postGaslessSubmit, resolveGaslessHttp } from "../http";
import { assertGaslessDepositWallet, toGaslessDepositReceipt } from "../to-gasless-deposit-receipt";
import { toGaslessSubmitReceipt } from "../to-gasless-submit-receipt";
import type { GaslessDepositSubmitReceipt, GaslessSubmitReceipt } from "../types";
import type { GaslessUnconfirmedSubmit } from "../unconfirmed-submit";
import { parseGaslessWalletId } from "../wallet-id";
import type { GaslessWireDepositAccepted, GaslessWireOperationAccepted } from "../wire-types";

/** Parameters for {@link resubmitGaslessRequest}: the recorded submit, unchanged. */
export type ResubmitGaslessRequestParameters = GaslessUnconfirmedSubmit;

/** Return type of {@link resubmitGaslessRequest}. */
export type ResubmitGaslessRequestReturnType = GaslessSubmitReceipt | GaslessDepositSubmitReceipt;

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new SymmError(
      "validation",
      "GASLESS_RESUBMIT_BODY_INVALID",
      "Gasless: the recorded submit has no JSON object body, so there is nothing to resend. Only a GaslessUnconfirmedSubmit taken from getGaslessUnconfirmedSubmit can be resubmitted.",
    );
  }
  return value as Record<string, unknown>;
}

/** Read an address the recorded body must carry, without rebuilding the body. */
function requireAddress(body: Record<string, unknown>, field: string): Address {
  const value = body[field];
  if (typeof value !== "string" || !isAddress(value)) {
    throw new SymmError(
      "validation",
      "GASLESS_RESUBMIT_BODY_INVALID",
      `Gasless: the recorded submit body has no valid "${field}" address, so the acceptance could not be attributed to an owner. Resubmit only a GaslessUnconfirmedSubmit taken from getGaslessUnconfirmedSubmit.`,
    );
  }
  return value;
}

/**
 * Resend an **unconfirmed** gasless submit, byte for byte, under its original
 * idempotency key.
 *
 * This is the vendor's prescribed recovery for a lost response: the same key
 * with the same payload either lands the request or returns the record the
 * service already created, so it can never execute the intent twice. It is the
 * *only* safe response to `GASLESS_SUBMIT_UNCONFIRMED` — re-running the intent
 * through the wallet would double-execute whatever the relayer accepted.
 *
 * The body is sent exactly as recorded, never rebuilt: the signatures inside it
 * cover specific nonces and deadlines, and a regenerated payload would be a
 * different request under a key the service has already bound.
 *
 * A deposit settlement is re-verified the same way the original submit was —
 * the wallet's deterministic address is read before the POST and checked
 * against the acceptance — so a replay can never sweep a wallet you did not
 * fund.
 *
 * @param config - The SDK config.
 * @param submit - The record from `getGaslessUnconfirmedSubmit(err)`, unmodified.
 * @returns The acceptance receipt: an operation receipt for `/gateway/relay-instant`,
 *   a deposit receipt for either settlement path.
 * @throws {SymmError} `GASLESS_NOT_CONFIGURED` / `GASLESS_UNSUPPORTED_CONTRACTS_VERSION` for the recorded chain.
 * @throws {SymmError} `GASLESS_RESUBMIT_BODY_INVALID` when the record is not a submit this SDK produced.
 * @throws {SymmApiError} `GASLESS_SUBMIT_UNCONFIRMED` again when the replay is itself
 *   inconclusive — keep the record and try again later.
 *
 * @example
 * ```ts
 * try {
 *   await relayInstantOperations(config, parameters);
 * } catch (err) {
 *   const pending = getGaslessUnconfirmedSubmit(err);
 *   if (!pending) throw err;
 *   await store.save(pending);
 *   const receipt = await resubmitGaslessRequest(config, pending);
 *   await store.clear(pending.idempotencyKey);
 * }
 * ```
 */
export async function resubmitGaslessRequest(
  config: Config,
  submit: ResubmitGaslessRequestParameters,
): Promise<ResubmitGaslessRequestReturnType> {
  const { chainId, path, body, idempotencyKey } = submit;
  const context = resolveGaslessHttp(config, { chainId, service: submit.service });
  const record = asRecord(body);

  if (path === "/gateway/relay-instant") {
    const owner = requireAddress(record, "userAddress");
    const walletIds = Array.isArray(record.walletIds)
      ? record.walletIds.map((walletId, index) => parseGaslessWalletId(walletId, `walletIds[${index}]`))
      : [];
    const raw = await postGaslessSubmit<GaslessWireOperationAccepted>(context, path, body, idempotencyKey);
    return toGaslessSubmitReceipt(raw, {
      owner,
      walletIds,
      idempotencyKey,
      protocolInstance: context.protocolInstance,
    });
  }

  const owner = requireAddress(record, "owner");
  const walletId =
    record.walletId === undefined || record.walletId === null ? 0n : parseGaslessWalletId(record.walletId);

  /** Read before the POST, exactly as the original settlement did: a failed read must not follow a 202. */
  const depositAddress = await getGaslessWalletAddress(config, { chainId, owner, walletId });

  const raw = await postGaslessSubmit<GaslessWireDepositAccepted>(context, path, body, idempotencyKey);
  const receipt = toGaslessDepositReceipt(raw, {
    owner,
    walletId,
    idempotencyKey,
    protocolInstance: context.protocolInstance,
  });
  assertGaslessDepositWallet(receipt, { walletId, depositAddress, url: context.baseURL, path });
  return receipt;
}
