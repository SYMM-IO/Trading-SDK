import {
  getChainConfig,
  listSupportedChains,
  SymmioSupportedChainId,
  type CreateConfigParameters,
  type DeepPartial,
  type SymmioChainConfig,
} from "@symm-frontier/core";
import { getAddress, isAddress } from "viem";

/** Top-level group a config field belongs to, matching {@link SymmioChainConfig}. */
export type ConfigFieldGroup = "addresses" | "solver" | "subgraphs" | "notifications";

/** How a field is rendered and validated in the editor. */
export type ConfigFieldKind = "address" | "decimals" | "url" | "wsUrl" | "text";

/** Metadata describing one editable field of a chain config. */
export interface ConfigFieldDef {
  group: ConfigFieldGroup;
  key: string;
  label: string;
  kind: ConfigFieldKind;
  /** Optional helper note shown under the control. */
  hint?: string;
}

/** A labelled section of related fields in the editor. */
export interface ConfigGroupDef {
  group: ConfigFieldGroup;
  title: string;
  fields: ConfigFieldDef[];
}

/** The editable surface of a chain config, grouped for display. */
export const CONFIG_GROUPS: ConfigGroupDef[] = [
  {
    group: "addresses",
    title: "Contracts & collateral",
    fields: [
      {
        group: "addresses",
        key: "symmioAddress",
        label: "SYMMIO Diamond",
        kind: "address",
        hint: "Core protocol diamond",
      },
      { group: "addresses", key: "accountLayerAddress", label: "Account Layer", kind: "address" },
      { group: "addresses", key: "instantLayerAddress", label: "Instant Layer", kind: "address" },
      { group: "addresses", key: "affiliatesAddress", label: "Affiliates", kind: "address" },
      { group: "addresses", key: "collateralAddress", label: "Collateral token", kind: "address" },
      { group: "addresses", key: "collateralDecimals", label: "Collateral decimals", kind: "decimals" },
    ],
  },
  {
    group: "solver",
    title: "Solver",
    fields: [
      { group: "solver", key: "name", label: "Solver name", kind: "text" },
      { group: "solver", key: "address", label: "Solver address", kind: "address", hint: "partyB" },
      { group: "solver", key: "url", label: "Solver API", kind: "url" },
    ],
  },
  {
    group: "subgraphs",
    title: "Subgraphs",
    fields: [{ group: "subgraphs", key: "analytics", label: "Analytics", kind: "url" }],
  },
  {
    group: "notifications",
    title: "Notifications",
    fields: [
      {
        group: "notifications",
        key: "url",
        label: "WebSocket URL",
        kind: "wsUrl",
        hint: "Live notifications stream",
      },
      { group: "notifications", key: "channel", label: "Channel", kind: "text", hint: "app_name" },
    ],
  },
];

/** Flat list of every editable field across all groups. */
export const CONFIG_FIELDS: ConfigFieldDef[] = CONFIG_GROUPS.flatMap((group) => group.fields);

/** Chain ids the SDK ships built-in configs for. */
export const SUPPORTED_CHAIN_IDS: number[] = listSupportedChains();

const CHAIN_LABELS: Record<number, string> = {
  [SymmioSupportedChainId.HYPER_EVM]: "HyperEVM",
};

/** Human-readable name for a supported chain id. */
export function chainLabel(chainId: number): string {
  return CHAIN_LABELS[chainId] ?? `Chain ${chainId}`;
}

/** Per-field draft strings keyed by `"group.key"`, grouped by chain id. */
export type ConfigDraft = Record<number, Record<string, string>>;

/** Stable draft key for a field (`"addresses.symmioAddress"`). */
export function fieldPath(field: ConfigFieldDef): string {
  return `${field.group}.${field.key}`;
}

function readField(config: SymmioChainConfig, field: ConfigFieldDef): unknown {
  return (config[field.group] as unknown as Record<string, unknown>)[field.key];
}

/** The built-in default value for a field, as the string the input shows. */
export function defaultFieldValue(chainId: number, field: ConfigFieldDef): string {
  return String(readField(getChainConfig(chainId), field));
}

/**
 * Validate one raw input value for a field.
 * @returns an error message, or `null` when valid. An empty value is always
 *   valid and means "inherit the default".
 */
export function validateFieldValue(field: ConfigFieldDef, raw: string): string | null {
  const value = raw.trim();
  if (value === "") return null;
  switch (field.kind) {
    case "address":
      return isAddress(value) ? null : "Enter a valid 0x address";
    case "decimals": {
      const parsed = Number(value);
      return Number.isInteger(parsed) && parsed >= 0 && parsed <= 36 ? null : "Whole number, 0–36";
    }
    case "url":
      return /^https?:\/\/\S+$/.test(value) ? null : "Must be an http(s) URL";
    case "wsUrl":
      return /^wss?:\/\/\S+$/.test(value) ? null : "Must be a ws(s) URL";
    case "text":
      return null;
  }
}

/** True when a draft value differs from the chain's built-in default. */
export function isFieldOverridden(field: ConfigFieldDef, raw: string, chainId: number): boolean {
  const value = raw.trim();
  if (value === "") return false;
  const def = defaultFieldValue(chainId, field);
  if (field.kind === "address") return value.toLowerCase() !== def.toLowerCase();
  if (field.kind === "decimals") return Number(value) !== Number(def);
  return value !== def;
}

function coerceField(field: ConfigFieldDef, value: string): string | number {
  if (field.kind === "decimals") return Number(value);
  if (field.kind === "address") return getAddress(value);
  return value;
}

/**
 * Build the SDK `chainOverrides` object from an editor draft. Only fields that
 * are valid and differ from the built-in default become overrides; everything
 * else inherits the default. Returns `undefined` when nothing is overridden.
 */
export function buildChainOverrides(draft: ConfigDraft): CreateConfigParameters["chainOverrides"] {
  const result: Record<number, DeepPartial<SymmioChainConfig>> = {};

  for (const chainId of SUPPORTED_CHAIN_IDS) {
    const chainDraft = draft[chainId] ?? {};
    const groups: Record<ConfigFieldGroup, Record<string, unknown>> = {
      addresses: {},
      solver: {},
      subgraphs: {},
      notifications: {},
    };

    for (const field of CONFIG_FIELDS) {
      const raw = chainDraft[fieldPath(field)] ?? "";
      if (validateFieldValue(field, raw) !== null) continue;
      if (!isFieldOverridden(field, raw, chainId)) continue;
      groups[field.group][field.key] = coerceField(field, raw.trim());
    }

    const chainOverride: Record<string, unknown> = {};
    if (Object.keys(groups.addresses).length) chainOverride.addresses = groups.addresses;
    if (Object.keys(groups.solver).length) chainOverride.solver = groups.solver;
    if (Object.keys(groups.subgraphs).length) chainOverride.subgraphs = groups.subgraphs;
    if (Object.keys(groups.notifications).length) chainOverride.notifications = groups.notifications;
    if (Object.keys(chainOverride).length) result[chainId] = chainOverride as DeepPartial<SymmioChainConfig>;
  }

  return Object.keys(result).length ? result : undefined;
}

/**
 * Expand a `chainOverrides` object into a complete editor draft: every field is
 * filled with its override value when present, otherwise the built-in default.
 */
export function draftFromOverrides(overrides: CreateConfigParameters["chainOverrides"]): ConfigDraft {
  const draft: ConfigDraft = {};

  for (const chainId of SUPPORTED_CHAIN_IDS) {
    const chainOverride = overrides?.[chainId];
    const entries: Record<string, string> = {};

    for (const field of CONFIG_FIELDS) {
      const overrideGroup = chainOverride?.[field.group] as Record<string, unknown> | undefined;
      const overrideValue = overrideGroup?.[field.key];
      entries[fieldPath(field)] =
        overrideValue !== undefined ? String(overrideValue) : defaultFieldValue(chainId, field);
    }

    draft[chainId] = entries;
  }

  return draft;
}

/** Count of fields (across all chains) that an overrides object changes from default. */
export function countOverrides(overrides: CreateConfigParameters["chainOverrides"]): number {
  const draft = draftFromOverrides(overrides);
  let total = 0;
  for (const chainId of SUPPORTED_CHAIN_IDS) {
    for (const field of CONFIG_FIELDS) {
      if (isFieldOverridden(field, draft[chainId]?.[fieldPath(field)] ?? "", chainId)) total++;
    }
  }
  return total;
}

/** Count of overridden fields for a single chain. */
export function countChainOverrides(overrides: CreateConfigParameters["chainOverrides"], chainId: number): number {
  const draft = draftFromOverrides(overrides);
  let total = 0;
  for (const field of CONFIG_FIELDS) {
    if (isFieldOverridden(field, draft[chainId]?.[fieldPath(field)] ?? "", chainId)) total++;
  }
  return total;
}

/** Structural equality of two overrides objects, compared field-by-field. */
export function sameOverrides(
  a: CreateConfigParameters["chainOverrides"],
  b: CreateConfigParameters["chainOverrides"],
): boolean {
  const da = draftFromOverrides(a);
  const db = draftFromOverrides(b);
  for (const chainId of SUPPORTED_CHAIN_IDS) {
    for (const field of CONFIG_FIELDS) {
      const path = fieldPath(field);
      const va = (da[chainId]?.[path] ?? "").trim();
      const vb = (db[chainId]?.[path] ?? "").trim();
      if (field.kind === "address") {
        if (va.toLowerCase() !== vb.toLowerCase()) return false;
      } else if (field.kind === "decimals") {
        if (Number(va) !== Number(vb)) return false;
      } else if (va !== vb) {
        return false;
      }
    }
  }
  return true;
}
