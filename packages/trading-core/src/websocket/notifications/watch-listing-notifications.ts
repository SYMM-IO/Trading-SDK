import type { Config } from "../../core/config";
import type { EnigmaNotificationFrame, WatchNotificationEnvelopesParameters } from "./types";
import { watchNotificationEnvelopes } from "./watch-notification-envelopes";
const kinds = [
  "deposit_received",
  "deposit_finalized",
  "pool_created",
  "pool_creation_failed",
  "insufficient_deposit",
] as const;
/** A listing lifecycle event emitted for the subscribed account. */
export interface ListingNotification {
  kind: (typeof kinds)[number];
  account: string;
  channel: string;
  marketId?: string;
  eventId?: string;
  /** Event time in Unix milliseconds, when supplied by the service. */
  timestamp?: number;
  notificationType?: string;
  successful?: boolean;
  tokenContractAddress?: string;
  chainId?: number;
  tokenName?: string;
  tokenTicker?: string;
  tokenDecimal?: number;
  marketStatus?: string;
  depositStatus?: string;
  listingTime?: number;
  depositAmount1e18?: string;
  depositedAmount1e18?: string;
  minimumRequiredAmount1e18?: string;
  listingFeeAmount1e18?: string;
  retryCount?: number;
  retryLimit?: number;
  errorCode?: number;
  errorMessage?: string;
  statusCode?: number;
  completedStep?: string;
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function listingDetails(value: unknown): Record<string, unknown> {
  if (typeof value !== "string") return record(value);
  try {
    return record(JSON.parse(value));
  } catch {
    return {};
  }
}

function stringField(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) return value;
  return typeof value === "number" && Number.isFinite(value) ? String(value) : undefined;
}

function numberField(value: unknown): number | undefined {
  if (typeof value !== "number" && !(typeof value === "string" && value.trim())) return;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function booleanField(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    if (value.toLowerCase() === "true") return true;
    if (value.toLowerCase() === "false") return false;
  }
}

/** Normalize supported listing events from the channel payload and its optional details. */
export function normalizeListingNotification(frame: EnigmaNotificationFrame): ListingNotification | undefined {
  const data = { ...frame.data, ...record(frame.data.data) };
  const details = listingDetails(data.details);
  const eventKeys = ["last_seen_action", "event", "event_type", "notification_event"];
  const candidates = [data, details].flatMap((source) => eventKeys.map((key) => source[key]));
  const kind = candidates.find((value): value is ListingNotification["kind"] => kinds.some((kind) => kind === value));
  if (!kind) return;

  function field(...keys: string[]): unknown {
    for (const key of keys) {
      const value = data[key] ?? details[key];
      if (value != null) return value;
    }
  }
  const time = numberField(field("modify_time", "sent_time", "timestamp") ?? frame.create_time ?? frame.timestamp);
  return {
    kind,
    account: frame.address,
    channel: frame.app_name,
    marketId: stringField(
      field("market_id", "marketId") ?? frame.secondary_identifier ?? field("secondary_identifier"),
    ),
    eventId: stringField(field("id", "event_id", "eventId") ?? frame.id),
    timestamp: time === undefined ? undefined : time < 10_000_000_000 ? Math.round(time * 1000) : time,
    notificationType: stringField(frame.notification_type ?? field("notification_type", "notificationType")),
    successful: booleanField(frame.successful ?? field("successful")),
    tokenContractAddress: stringField(
      field("token_contract_address", "tokenContractAddress", "contract_address", "contractAddress"),
    ),
    chainId: numberField(field("chain_id", "chainId", "deposit_chain", "depositChain")),
    tokenName: stringField(field("token_name", "tokenName")),
    tokenTicker: stringField(field("token_ticker", "tokenTicker")),
    tokenDecimal: numberField(field("token_decimal", "tokenDecimal")),
    marketStatus: stringField(field("market_status", "marketStatus")),
    depositStatus: stringField(field("deposit_status", "depositStatus")),
    listingTime: numberField(field("listing_time", "listingTime")),
    depositAmount1e18: stringField(field("deposit_amount_1e18", "depositAmount1e18")),
    depositedAmount1e18: stringField(field("deposited_amount_1e18", "depositedAmount1e18")),
    minimumRequiredAmount1e18: stringField(field("minimum_required_amount_1e18", "minimumRequiredAmount1e18")),
    listingFeeAmount1e18: stringField(field("listing_fee_amount_1e18", "listingFeeAmount1e18")),
    retryCount: numberField(field("retry_count", "retryCount")),
    retryLimit: numberField(field("retry_limit", "retryLimit")),
    errorCode: numberField(field("error_code", "errorCode")),
    errorMessage: stringField(field("error_message", "errorMessage", "failure_message")),
    statusCode: numberField(field("status_code", "statusCode")),
    completedStep: stringField(field("completed_step", "completedStep")),
  };
}
/** Accounts and listing channels to observe and their normalized event callback. */
export type WatchListingNotificationsParameters = Omit<WatchNotificationEnvelopesParameters, "onEnvelope"> & {
  onNotification: (event: ListingNotification) => void;
};
/** Subscribe to listing lifecycle updates. Returns the unsubscribe function.
 * @example const stop = watchListingNotifications(config, {subscriptions:[{account,channel}],onNotification:console.log});
 */
export function watchListingNotifications(
  config: Config,
  { onNotification, ...options }: WatchListingNotificationsParameters,
) {
  return watchNotificationEnvelopes(config, {
    ...options,
    onEnvelope: (frame) => {
      const event = normalizeListingNotification(frame);
      if (event) onNotification(event);
    },
  });
}
