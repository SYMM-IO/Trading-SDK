import { GaslessRequestStatus } from "./types";

/** Every value the lifecycle enum accepts, for tolerant inbound parsing. */
const STATUS_VALUES = new Set<string>(Object.values(GaslessRequestStatus));

/**
 * Parse an **acceptance** status tolerantly: anything outside the documented
 * lifecycle becomes {@link GaslessRequestStatus.QUEUED}.
 *
 * A `202` means the workflow exists server-side and may execute. Throwing on an
 * unrecognized acceptance status would discard the `request_id` with it, and a
 * lost id is unrecoverable — there is no list-by-wallet endpoint. Queued is the
 * only safe reading of "accepted, outcome unknown": the caller keeps polling
 * and the stored record supplies the real status. Stored records are parsed
 * strictly instead (`toGaslessRequestStatus`), where a loud failure costs
 * nothing.
 *
 * @param raw - The wire `status` value.
 * @returns The parsed status, or `queued` when it is not a known one.
 *
 * @internal
 */
export function toGaslessAcceptanceStatus(raw: unknown): GaslessRequestStatus {
  return typeof raw === "string" && STATUS_VALUES.has(raw)
    ? (raw as GaslessRequestStatus)
    : GaslessRequestStatus.QUEUED;
}

/** A canonical unsigned decimal amount: digits only, as the service reports amounts. */
const DECIMAL_AMOUNT = /^[0-9]+$/;

/**
 * Parse an optional decimal-string amount into a `bigint`, or `null`.
 *
 * Every raw amount on the wire is optional and nullable, and a malformed one is
 * a vendor bug rather than a reason to lose the record it travels with — so an
 * unparseable value reads as "not reported" rather than throwing.
 *
 * @param value - The raw wire value.
 * @returns The amount, or `null` when it is absent or not a plain decimal.
 *
 * @internal
 */
export function toGaslessOptionalAmount(value: unknown): bigint | null {
  if (typeof value === "bigint") return value;
  if (typeof value !== "string" || !DECIMAL_AMOUNT.test(value)) return null;
  return BigInt(value);
}
