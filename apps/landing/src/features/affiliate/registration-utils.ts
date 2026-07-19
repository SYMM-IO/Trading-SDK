import type { AffiliateRegistration } from "@symmio/trading-core";
import { isHex, stringToHex, type Address, type Hex } from "viem";

/** `1e18` — the on-chain scale a full 100% fee share encodes to. */
export const ONE_E18 = 10n ** 18n;
/** Basis-point scale: `10_000` bps = 100.00% = `1e18`. */
export const BPS_SCALE = 10_000;
/** Wei per basis point (`1e18 / 10_000`). Multiplying keeps the total exact. */
export const WEI_PER_BPS = 10n ** 14n;

/**
 * Parse a human percent string (`"12.5"`) into integer basis points (`1250`).
 * Accepts up to two decimals. Returns `null` for anything unparseable or out of
 * the `0..100` range.
 */
export function percentToBps(input: string): number | null {
  const trimmed = input.trim();
  if (trimmed === "") return null;
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value < 0 || value > 100) return null;
  return Math.round(value * 100);
}

/** Convert basis points to the `1e18`-scaled share the contract expects. */
export function bpsToWei(bps: number): bigint {
  return BigInt(bps) * WEI_PER_BPS;
}

/** A `0x…` address shortened for display (`0x1234…abcd`). */
export function truncateAddress(address: string, chars = 4): string {
  if (address.length <= chars * 2 + 2) return address;
  return `${address.slice(0, chars + 2)}…${address.slice(-chars)}`;
}

const DOMAIN_RE = /^([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Strip scheme, path, and trailing dots from a domain input → a bare lowercase host. */
export function normalizeDomain(input: string): string {
  return input
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/.*$/, "")
    .replace(/\.+$/, "")
    .toLowerCase();
}

/** True when `input` normalizes to a plausible domain (`app.acme.markets`). */
export function isValidDomain(input: string): boolean {
  return DOMAIN_RE.test(normalizeDomain(input));
}

/** True when `input` looks like an email address. */
export function isValidEmail(input: string): boolean {
  return EMAIL_RE.test(input.trim());
}

/**
 * Encode the free-form metadata field into `bytes`. Empty → `0x`; an already-hex
 * value passes through; anything else is UTF-8 encoded to hex.
 */
export function toMetadataHex(text: string): Hex {
  const trimmed = text.trim();
  if (trimmed === "") return "0x";
  if (isHex(trimmed)) return trimmed;
  return stringToHex(trimmed);
}

/** One editable stakeholder row in the fee allocator. */
export interface StakeholderDraft {
  /** Stable row id for React keys. */
  id: string;
  /** Recipient address (raw input). */
  receiver: string;
  /** Fee share as a percent string (raw input). */
  percent: string;
}

/** The full editable registration form state. */
export interface RegistrationDraft {
  name: string;
  brandColor: string;
  admin: string;
  stakeholders: StakeholderDraft[];
  symmioPercent: string;
  metadata: string;
  symmioCores: string[];
  legacyMultiAccounts: string[];
  /** Off-chain: the frontend/app domain, shared with the team for review. */
  domain: string;
  /** Off-chain, optional: where to notify the applicant once approved. */
  email: string;
}

/**
 * The off-chain payload posted to the notify route on a successful registration.
 * Carries the contact details (domain, email) that never go on-chain, plus the
 * on-chain correlation fields (registrant, affiliate address, tx hash) the team
 * needs to find and approve the request.
 */
export interface NotificationPayload {
  name: string;
  domain: string;
  email?: string;
  brandColor: string;
  admin: string;
  registrant: string;
  /** The predicted affiliate (AccountManager) address, when known. */
  affiliate?: string;
  chainId: number;
  txHash: string;
  symmioPercent: string;
  stakeholders: { receiver: string; percent: string }[];
  /** Free-form metadata the registrant attached, when non-empty. */
  metadata?: string;
  /** The whitelisted Symmio core (diamond) addresses registered against. */
  symmioCores: string[];
  /** Legacy multi-account addresses migrated in, when any. */
  legacyMultiAccounts: string[];
  /** Anti-spam honeypot — must be empty for a genuine submission. */
  honeypot?: string;
}

/** Assemble the {@link NotificationPayload} from a validated draft plus tx context. */
export function toNotificationPayload(
  draft: RegistrationDraft,
  context: { registrant: string; affiliate?: string; chainId: number; txHash: string; honeypot?: string },
): NotificationPayload {
  return {
    name: draft.name.trim(),
    domain: normalizeDomain(draft.domain),
    email: draft.email.trim() || undefined,
    brandColor: draft.brandColor.trim(),
    admin: draft.admin,
    registrant: context.registrant,
    affiliate: context.affiliate,
    chainId: context.chainId,
    txHash: context.txHash,
    symmioPercent: draft.symmioPercent.trim(),
    stakeholders: draft.stakeholders.map((row) => ({ receiver: row.receiver, percent: row.percent })),
    metadata: draft.metadata.trim() || undefined,
    symmioCores: draft.symmioCores.map((core) => core.trim()).filter((core) => core !== ""),
    legacyMultiAccounts: draft.legacyMultiAccounts.map((account) => account.trim()).filter((account) => account !== ""),
    honeypot: context.honeypot,
  };
}

/**
 * Encode a validated {@link RegistrationDraft} into the `AffiliateRegistration`
 * tuple the SDK's `requestToRegisterAffiliate` expects. Assumes the draft has
 * passed the form's `registrationSchema` (and the 100%-total submit check).
 */
export function buildRegistration(draft: RegistrationDraft): AffiliateRegistration {
  return {
    name: draft.name.trim(),
    brandColor: draft.brandColor.trim(),
    admin: draft.admin as Address,
    stakeholders: draft.stakeholders.map((row) => ({
      receiver: row.receiver as Address,
      share: bpsToWei(percentToBps(row.percent) ?? 0),
    })),
    symmioShare: bpsToWei(percentToBps(draft.symmioPercent) ?? 0),
    metadata: toMetadataHex(draft.metadata),
    legacyMultiAccounts: draft.legacyMultiAccounts
      .map((a) => a.trim())
      .filter((a) => a !== "")
      .map((a) => a as Address),
    symmioCores: draft.symmioCores
      .map((c) => c.trim())
      .filter((c) => c !== "")
      .map((c) => c as Address),
  };
}
