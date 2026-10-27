import { isAddress } from "viem";
import type { DeploymentContract, FieldSpec, ReadSpec } from "./read-catalog";

/** A field's text as typed: one string for a scalar, the added items for a list. */
export type DraftValue = string | readonly string[];

/** The form as the user left it: which fields are on it, in order, and what each holds. */
export interface FormDraft {
  fields: readonly string[];
  values: Readonly<Record<string, DraftValue>>;
}

/** The hook parameters the valid fields make, and why each invalid field was left out. */
export interface BuildResult {
  parameters: Record<string, unknown>;
  errors: Readonly<Record<string, string>>;
}

const LIST_KINDS = new Set<FieldSpec["kind"]>(["address-list", "hash-list", "id-list", "market-list", "enum-list"]);

export function isListField(field: FieldSpec): boolean {
  return LIST_KINDS.has(field.kind);
}

/** The value a field starts with when it is added to the form. */
export function emptyValue(field: FieldSpec): DraftValue {
  return isListField(field) ? [] : "";
}

/** This deployment's contract addresses, by the name a `source` field uses. */
export type DeploymentAddresses = Readonly<Record<DeploymentContract, string>>;

/** The address a `source` field offers as "this deployment"; `undefined` for any other field. */
export function deploymentAddress(field: FieldSpec, deployment: DeploymentAddresses | undefined): string | undefined {
  return field.key === "source" ? deployment?.[field.contract ?? "symmio"] : undefined;
}

/**
 * The form a read opens with: its required fields, plus `source` filled with the
 * contract this deployment indexes the read's entity from, when the read takes one.
 */
export function initialDraft(read: ReadSpec, deployment: DeploymentAddresses | undefined): FormDraft {
  const fields = read.fields.filter((field) => field.required || deploymentAddress(field, deployment));
  return {
    fields: fields.map((field) => field.key),
    values: Object.fromEntries(
      fields.map((field) => [field.key, deploymentAddress(field, deployment) ?? emptyValue(field)]),
    ),
  };
}

const UINT = /^\d+$/;
const TX_HASH = /^0x[0-9a-fA-F]{64}$/;

/**
 * Check one item typed into a list field. Returns the normalized item, or an
 * error message when it is not a valid entry for the field.
 */
export function parseListItem(field: FieldSpec, text: string): { item: string } | { error: string } {
  const value = text.trim();
  switch (field.kind) {
    case "address-list":
      return isAddress(value) ? { item: value } : { error: "Not an address." };
    case "hash-list":
      return TX_HASH.test(value) ? { item: value } : { error: "Not a 32-byte transaction hash." };
    case "id-list":
    case "market-list":
      return UINT.test(value) ? { item: BigInt(value).toString() } : { error: "Not a whole number." };
    default:
      return field.options?.some((option) => option.value === value)
        ? { item: value }
        : { error: "Not one of the options." };
  }
}

function toListValue(field: FieldSpec, item: string): unknown {
  switch (field.kind) {
    case "id-list":
      return field.wrapAsQuote ? { quoteId: BigInt(item) } : BigInt(item);
    case "market-list":
      return Number(item);
    case "enum-list":
      return field.numeric ? Number(item) : item;
    default:
      return item;
  }
}

function toScalarValue(field: FieldSpec, text: string): { value: unknown } | { error: string } {
  switch (field.kind) {
    case "address":
      return isAddress(text) ? { value: text } : { error: "Not an address." };
    case "integer":
    case "time": {
      if (!UINT.test(text)) return { error: "Not a whole number." };
      if (field.bigint) return { value: BigInt(text) };
      const value = Number(text);
      return Number.isSafeInteger(value) ? { value } : { error: "Too large." };
    }
    case "enum":
      if (!field.options?.some((option) => option.value === text)) return { error: "Not one of the options." };
      return { value: field.numeric ? Number(text) : text };
    default:
      return { value: text };
  }
}

/**
 * Turn the form into the object passed to the read's hook. A field that is off
 * the form, or on it but left empty, is not sent at all — the SDK reads a missing
 * filter as "no filter", and an empty list as "match nothing". A required field
 * left empty is an error instead.
 */
export function buildParameters(read: ReadSpec, draft: FormDraft): BuildResult {
  const parameters: Record<string, unknown> = {};
  const errors: Record<string, string> = {};

  for (const field of read.fields) {
    if (!draft.fields.includes(field.key)) continue;
    const raw = draft.values[field.key] ?? emptyValue(field);

    if (Array.isArray(raw)) {
      if (raw.length === 0) {
        if (field.required) errors[field.key] = "Add at least one.";
        continue;
      }
      parameters[field.key] = raw.map((item) => toListValue(field, item));
      continue;
    }

    const text = String(raw).trim();
    if (text === "") {
      if (field.required) errors[field.key] = "Required.";
      continue;
    }
    const result = toScalarValue(field, text);
    if ("error" in result) errors[field.key] = result.error;
    else parameters[field.key] = result.value;
  }

  return { parameters, errors };
}

export function hasErrors(result: BuildResult): boolean {
  return Object.keys(result.errors).length > 0;
}

/** The draft scalar of `key`, or `""` when it is a list or off the form. */
export function scalarValue(draft: FormDraft, key: string): string {
  const value = draft.values[key];
  return typeof value === "string" && draft.fields.includes(key) ? value.trim() : "";
}

/** `draft` with `key` on the form and set to `value`. */
export function withValue(draft: FormDraft, key: string, value: DraftValue): FormDraft {
  return {
    fields: draft.fields.includes(key) ? draft.fields : [...draft.fields, key],
    values: { ...draft.values, [key]: value },
  };
}

/** `draft` without `key`. */
export function withoutField(draft: FormDraft, key: string): FormDraft {
  return {
    fields: draft.fields.filter((field) => field !== key),
    values: Object.fromEntries(Object.entries(draft.values).filter(([field]) => field !== key)),
  };
}

/** `draft` with every required field of `read` on it — a restored link may have left one out. */
export function withRequiredFields(read: ReadSpec, draft: FormDraft): FormDraft {
  return read.fields
    .filter((field) => field.required && !draft.fields.includes(field.key))
    .reduce((next, field) => withValue(next, field.key, emptyValue(field)), draft);
}
