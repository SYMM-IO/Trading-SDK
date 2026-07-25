import { isAddress } from "viem";
import * as yup from "yup";
import { isValidEmail, percentToBps, type RegistrationDraft } from "./registration-utils";

/** One editable stakeholder row (a `useFieldArray` item). */
export interface StakeholderValue {
  /** Recipient address (raw input). */
  receiver: string;
  /** Fee share as a percent string (raw input). */
  percent: string;
}

/** A single address row, wrapped in an object so `useFieldArray` has a stable item to key. */
export interface AddressValue {
  value: string;
}

/**
 * The full react-hook-form value shape for the registration form. Mirrors the
 * legacy `RegistrationDraft` except the two bare `string[]` lists become
 * `AddressValue[]` so `useFieldArray` can manage them.
 */
export interface RegistrationValues {
  name: string;
  brandColor: string;
  admin: string;
  stakeholders: StakeholderValue[];
  symmioPercent: string;
  metadata: string;
  symmioCores: AddressValue[];
  legacyMultiAccounts: AddressValue[];
  /** Off-chain, optional: where to notify the applicant once approved. */
  email: string;
}

/** True when a raw input trims to a valid checksummed address. */
function isAddr(value?: string): boolean {
  return isAddress((value ?? "").trim());
}

/**
 * yup schema for the registration form. Every rule mirrors the form's original
 * per-field validation field-for-field, so the only behavioural change is *when*
 * errors surface (react-hook-form shows them on blur/submit, not on mount).
 *
 * The cross-field "shares total exactly 100%" rule is intentionally **not** here
 * — it is derived live in the fee allocator and re-checked at submit — because it
 * belongs to no single field and reads best as its own line under the meter.
 */
export const registrationSchema: yup.ObjectSchema<RegistrationValues> = yup.object({
  name: yup
    .string()
    .default("")
    .test("required", "Enter an affiliate name.", (value) => (value ?? "").trim() !== ""),
  brandColor: yup.string().default(""),
  admin: yup.string().default("").test("valid-admin", "Enter a valid admin address.", isAddr),
  stakeholders: yup
    .array()
    .of(
      yup.object({
        receiver: yup.string().default("").test("valid-receiver", "Invalid address.", isAddr),
        percent: yup
          .string()
          .default("")
          .test("range", "0–100 only.", (value) => percentToBps(value ?? "") !== null)
          .test("positive", "Must be > 0.", (value) => (percentToBps(value ?? "") ?? 0) > 0),
      }),
    )
    .min(1, "Add at least one recipient.")
    .default([]),
  symmioPercent: yup
    .string()
    .default("")
    .test("range", "0–100 only.", (value) => percentToBps(value ?? "") !== null),
  metadata: yup.string().default(""),
  symmioCores: yup
    .array()
    .of(yup.object({ value: yup.string().default("") }))
    .test("at-least-one", "At least one Symmio core is required.", (rows) =>
      (rows ?? []).some((row) => (row.value ?? "").trim() !== ""),
    )
    .test("all-valid", "Every core must be a valid address.", (rows) =>
      (rows ?? []).filter((row) => (row.value ?? "").trim() !== "").every((row) => isAddr(row.value)),
    )
    .default([]),
  legacyMultiAccounts: yup
    .array()
    .of(yup.object({ value: yup.string().default("") }))
    .test("all-valid", "Every entry must be a valid address.", (rows) =>
      (rows ?? []).filter((row) => (row.value ?? "").trim() !== "").every((row) => isAddr(row.value)),
    )
    .default([]),
  email: yup
    .string()
    .default("")
    .test(
      "valid",
      "Enter a valid email or leave it blank.",
      (value) => (value ?? "").trim() === "" || isValidEmail(value ?? ""),
    ),
});

/** Sum of every share in basis points (stakeholders + symmio). Target: `10_000`. */
export function sharesTotalBps(values: Pick<RegistrationValues, "stakeholders" | "symmioPercent">): number {
  const fromStakeholders = values.stakeholders.reduce((sum, row) => sum + (percentToBps(row.percent) ?? 0), 0);
  return fromStakeholders + (percentToBps(values.symmioPercent) ?? 0);
}

/**
 * Convert validated RHF {@link RegistrationValues} back into the legacy
 * {@link RegistrationDraft} shape, so `buildRegistration` and
 * `toNotificationPayload` keep working unchanged.
 */
export function valuesToDraft(values: RegistrationValues): RegistrationDraft {
  return {
    name: values.name,
    brandColor: values.brandColor,
    admin: values.admin,
    stakeholders: values.stakeholders.map((row, index) => ({
      id: `s${index}`,
      receiver: row.receiver,
      percent: row.percent,
    })),
    symmioPercent: values.symmioPercent,
    metadata: values.metadata,
    symmioCores: values.symmioCores.map((row) => row.value),
    legacyMultiAccounts: values.legacyMultiAccounts.map((row) => row.value),
    email: values.email,
  };
}
