import {
  getChainConfig,
  listSupportedChains,
  SymmioSupportedChainId,
  type CreateConfigParameters,
  type SymmioChainConfigInput,
  type SymmioNotificationsProtocol,
  type SymmioSolverConfig,
} from "@symmio/trading-core";
import { getAddress, isAddress, type Address } from "viem";
import { symmioChains } from "./symmio";

/**
 * Group a config field belongs to. `addresses` and `subgraphs` are chain-level
 * blocks of the SDK's `SymmioChainConfig`; `solver` and `notifications` are
 * **per-solver** and resolve against the chain's default solver
 * (`solvers[defaultSolverId]` and its nested `notifications` block).
 */
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
  /**
   * Notifications protocols the field exists on. Omit for fields every protocol
   * carries. A field whose protocols exclude the chain's own notifications
   * protocol is unavailable there — `channel` only exists on `enigma`, so it is
   * hidden (and never written) on a `rasa` chain. See {@link isFieldAvailable}.
   */
  protocols?: readonly SymmioNotificationsProtocol[];
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
    fields: [
      { group: "subgraphs", key: "analytics", label: "Analytics", kind: "url" },
      { group: "subgraphs", key: "events", label: "Events", kind: "url" },
    ],
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
      {
        group: "notifications",
        key: "channel",
        label: "Channel",
        kind: "text",
        hint: "app_name",
        protocols: ["enigma"],
      },
    ],
  },
];

/** Flat list of every editable field across all groups. */
export const CONFIG_FIELDS: ConfigFieldDef[] = CONFIG_GROUPS.flatMap((group) => group.fields);

/** Chain ids the SDK ships built-in configs for. */
export const SUPPORTED_CHAIN_IDS: number[] = listSupportedChains();

const CHAIN_LABELS: Record<number, string> = {
  [SymmioSupportedChainId.HYPER_EVM]: "HyperEVM",
  [SymmioSupportedChainId.BASE]: "Base",
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

/**
 * The chain's default solver config, or `undefined` when the chain has no solver
 * wired for its `defaultSolverId` yet.
 */
function defaultSolver(chainId: number): SymmioSolverConfig | undefined {
  const chainConfig = getChainConfig(chainId);
  return chainConfig.solvers[chainConfig.defaultSolverId];
}

/** The field's built-in value on a chain, before any override (`undefined` when absent). */
function readField(chainId: number, field: ConfigFieldDef): unknown {
  const solver = defaultSolver(chainId) as unknown as Record<string, unknown> | undefined;
  if (field.group === "solver") return solver?.[field.key];
  if (field.group === "notifications") {
    return (solver?.notifications as Record<string, unknown> | undefined)?.[field.key];
  }
  const chainConfig = getChainConfig(chainId) as unknown as Record<string, Record<string, unknown>>;
  return chainConfig[field.group]?.[field.key];
}

/**
 * Read a field's override value from an app override entry (or `undefined`).
 *
 * The editor shows solver and notifications fields as their own UI groups, but
 * both live under the solver on the chain config — `solvers.<defaultSolverId>`
 * and `solvers.<defaultSolverId>.notifications` — so this bridges the two.
 */
function overrideFieldValue(
  chainId: number,
  chainOverride: SymmioChainConfigInput | undefined,
  field: ConfigFieldDef,
): unknown {
  if (!chainOverride) return undefined;
  const record = chainOverride as unknown as Record<string, Record<string, unknown>>;
  if (field.group === "solver" || field.group === "notifications") {
    const solvers = record.solvers as Record<string, Record<string, unknown>> | undefined;
    const solver = solvers?.[getChainConfig(chainId).defaultSolverId];
    if (field.group === "solver") return solver?.[field.key];
    return (solver?.notifications as Record<string, unknown> | undefined)?.[field.key];
  }
  return record[field.group]?.[field.key];
}

/**
 * Whether a field exists on a given chain. Protocol-exclusive notifications
 * fields (today the enigma `channel`) do not exist on a chain whose solver
 * speaks another protocol, so the editor neither shows nor writes them there.
 */
export function isFieldAvailable(chainId: number, field: ConfigFieldDef): boolean {
  if (!field.protocols) return true;
  const protocol = defaultSolver(chainId)?.notifications.protocol;
  return protocol !== undefined && field.protocols.includes(protocol);
}

/**
 * The built-in default value for a field, as the string the input shows.
 *
 * A field the chain does not carry — an unwired solver, an optional block like
 * `notifications.searchUrl`, or a protocol-exclusive key — reads as `""` rather
 * than the string `"undefined"`.
 */
export function defaultFieldValue(chainId: number, field: ConfigFieldDef): string {
  const value = readField(chainId, field);
  return value === undefined || value === null ? "" : String(value);
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
 * Build the SDK `symmioConfig` object from an editor draft. Only fields that are
 * valid and differ from the built-in default become overrides; everything else
 * inherits the default — **except** each chain's `addresses.affiliatesAddress`,
 * which is mandatory (see {@link SymmioChainConfigInput}) and is always emitted
 * from the edited value or the app baseline.
 */
export function buildChainOverrides(draft: ConfigDraft): CreateConfigParameters["symmioConfig"] {
  const result: NonNullable<CreateConfigParameters["symmioConfig"]> = {};

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
      if (!isFieldAvailable(chainId, field)) continue;
      if (validateFieldValue(field, raw) !== null) continue;
      if (!isFieldOverridden(field, raw, chainId)) continue;
      groups[field.group][field.key] = coerceField(field, raw.trim());
    }

    // Affiliate is mandatory per chain — always emit it (the edited value if
    // present, else the app baseline), even when it equals the built-in default
    // and would otherwise be stripped as a no-op override.
    const affiliate =
      (groups.addresses.affiliatesAddress as Address | undefined) ??
      symmioChains?.[chainId]?.addresses?.affiliatesAddress;
    if (affiliate) groups.addresses.affiliatesAddress = affiliate;

    const chainOverride: Record<string, unknown> = { addresses: groups.addresses };
    /**
     * Notifications are per-solver, so they nest inside the solver override
     * rather than sitting beside it on the chain (see `SymmioSolverConfig`).
     */
    const solverOverride: Record<string, unknown> = { ...groups.solver };
    if (Object.keys(groups.notifications).length) solverOverride.notifications = groups.notifications;
    if (Object.keys(solverOverride).length) {
      chainOverride.solvers = { [getChainConfig(chainId).defaultSolverId]: solverOverride };
    }
    if (Object.keys(groups.subgraphs).length) chainOverride.subgraphs = groups.subgraphs;
    result[chainId] = chainOverride as SymmioChainConfigInput;
  }

  return result;
}

/**
 * Expand a `chainOverrides` object into a complete editor draft: every field is
 * filled with its override value when present, otherwise the built-in default.
 */
export function draftFromOverrides(overrides: CreateConfigParameters["symmioConfig"]): ConfigDraft {
  const draft: ConfigDraft = {};

  for (const chainId of SUPPORTED_CHAIN_IDS) {
    const chainOverride = overrides?.[chainId];
    const entries: Record<string, string> = {};

    for (const field of CONFIG_FIELDS) {
      if (!isFieldAvailable(chainId, field)) {
        entries[fieldPath(field)] = "";
        continue;
      }
      const overrideValue = overrideFieldValue(chainId, chainOverride, field);
      entries[fieldPath(field)] =
        overrideValue !== undefined ? String(overrideValue) : defaultFieldValue(chainId, field);
    }

    draft[chainId] = entries;
  }

  return draft;
}

/** Count of fields (across all chains) that an overrides object changes from default. */
export function countOverrides(overrides: CreateConfigParameters["symmioConfig"]): number {
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
export function countChainOverrides(overrides: CreateConfigParameters["symmioConfig"], chainId: number): number {
  const draft = draftFromOverrides(overrides);
  let total = 0;
  for (const field of CONFIG_FIELDS) {
    if (isFieldOverridden(field, draft[chainId]?.[fieldPath(field)] ?? "", chainId)) total++;
  }
  return total;
}

/** Structural equality of two overrides objects, compared field-by-field. */
export function sameOverrides(
  a: CreateConfigParameters["symmioConfig"],
  b: CreateConfigParameters["symmioConfig"],
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
