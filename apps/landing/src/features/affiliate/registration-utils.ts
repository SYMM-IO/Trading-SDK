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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
  /** Off-chain, optional: where to notify the applicant once approved. */
  email: string;
}

/**
 * The off-chain payload posted to the notify route on a successful registration.
 * Carries the optional contact email that never goes on-chain, plus the on-chain
 * correlation fields (registrant, affiliate address, tx hash) the team needs to
 * find and approve the request.
 */
export interface NotificationPayload {
  /** Discriminates this from a {@link CancellationPayload} on the shared notify route. */
  kind: "registration";
  name: string;
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

/**
 * The off-chain payload posted to the notify route when a still-`PENDING`
 * registration is cancelled. Far thinner than a {@link NotificationPayload}: the
 * status page knows only the affiliate address it looked up, the wallet that
 * cancelled it, and the cancel transaction — enough for the team to find and
 * retire the request.
 */
export interface CancellationPayload {
  /** Discriminates this from a {@link NotificationPayload} on the shared notify route. */
  kind: "cancellation";
  /** The affiliate (AccountManager) address whose pending registration was cancelled. */
  affiliate: string;
  /** The wallet that submitted the cancel — the affiliate `admin`. */
  canceller: string;
  chainId: number;
  txHash: string;
  /** Anti-spam honeypot — must be empty for a genuine submission. */
  honeypot?: string;
}

/** Assemble the {@link NotificationPayload} from a validated draft plus tx context. */
export function toNotificationPayload(
  draft: RegistrationDraft,
  context: { registrant: string; affiliate?: string; chainId: number; txHash: string; honeypot?: string },
): NotificationPayload {
  return {
    kind: "registration",
    name: draft.name.trim(),
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
