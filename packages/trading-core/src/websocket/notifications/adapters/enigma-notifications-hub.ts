import type { Config } from "../../../core/config";
import { createReconnectingSocket, type ReconnectingSocket } from "../../socket/create-reconnecting-socket";
import type { SocketStatus } from "../../socket/socket-status";
import { parseFramePayload } from "../parse-frame-payload";
import { toNotificationsError } from "../to-notifications-error";
import type {
  EnigmaNotificationFrame,
  NotificationEnvelopeSubscription,
  WatchNotificationEnvelopesParameters,
} from "../types";

interface Subscriber {
  subscriptions: Map<string, NotificationEnvelopeSubscription>;
  parameters: WatchNotificationEnvelopesParameters;
}

interface Hub {
  socket?: ReconnectingSocket;
  subscribers: Set<Subscriber>;
  status: SocketStatus;
}

const registries = new WeakMap<Config, Map<string, Hub>>();

function subscriptionKey(subscription: NotificationEnvelopeSubscription): string {
  return JSON.stringify([subscription.account.toLowerCase(), subscription.channel]);
}

function activeSubscriptions(hub: Hub): Map<string, NotificationEnvelopeSubscription> {
  const union = new Map<string, NotificationEnvelopeSubscription>();
  for (const subscriber of hub.subscribers) {
    for (const [key, subscription] of subscriber.subscriptions) union.set(key, subscription);
  }
  return union;
}

function subscribeFrame(hub: Hub): string {
  return JSON.stringify({
    channel_patterns: [...activeSubscriptions(hub).values()].map(({ account, channel }) => ({
      app_name: channel,
      address: account,
      primary_identifier: "*",
      secondary_identifier: "*",
    })),
  });
}

function reportError(subscriber: Subscriber, error: unknown): void {
  try {
    subscriber.parameters.onError?.(toNotificationsError(error));
  } catch {
    /* A consumer must not interrupt other subscribers. */
  }
}

function notifyStatus(hub: Hub, status: SocketStatus): void {
  hub.status = status;
  for (const subscriber of hub.subscribers) {
    try {
      subscriber.parameters.onStatusChange?.(status);
    } catch (error) {
      reportError(subscriber, error);
    }
  }
}

function dispatch(hub: Hub, data: unknown): void {
  let envelope: EnigmaNotificationFrame;
  try {
    const parsed = parseFramePayload(data);
    if (!parsed) return;
    if (parsed.data !== undefined) {
      if (!parsed.data || typeof parsed.data !== "object" || Array.isArray(parsed.data)) return;
    } else if (!("last_seen_action" in parsed) && !("notification_type" in parsed) && !("state_type" in parsed)) {
      return; // Subscription acknowledgements and control frames are not events.
    }
    envelope = parsed as EnigmaNotificationFrame;
  } catch (error) {
    for (const subscriber of hub.subscribers) reportError(subscriber, error);
    return;
  }
  const inner =
    envelope.data && typeof envelope.data === "object" ? (envelope.data as Record<string, unknown>) : envelope;
  const account =
    typeof envelope.address === "string"
      ? envelope.address.toLowerCase()
      : typeof inner.address === "string"
        ? inner.address.toLowerCase()
        : undefined;
  const channel =
    typeof envelope.app_name === "string"
      ? envelope.app_name
      : typeof inner.app_name === "string"
        ? inner.app_name
        : undefined;
  // Older frames omit channel metadata. Deliver them only when the active
  // subscriber covers every matching pair in the active subscription union.
  const matches = [...activeSubscriptions(hub)].filter(
    ([, subscription]) =>
      (account === undefined || subscription.account.toLowerCase() === account) &&
      (channel === undefined || subscription.channel === channel),
  );
  const ambiguous = (account === undefined || channel === undefined) && matches.length > 1;
  const keys = new Set(matches.map(([key]) => key));
  for (const subscriber of hub.subscribers) {
    if (![...subscriber.subscriptions.keys()].some((key) => keys.has(key))) continue;
    if (ambiguous && ![...keys].every((key) => subscriber.subscriptions.has(key))) continue;
    try {
      subscriber.parameters.onEnvelope(envelope);
    } catch (error) {
      reportError(subscriber, error);
    }
  }
}

/** Join the deployment-scoped Enigma transport. Internal to the two public watchers. */
export function acquireEnigmaNotificationEnvelopes(
  config: Config,
  url: string,
  parameters: WatchNotificationEnvelopesParameters,
): () => void {
  if (parameters.subscriptions.length === 0) return () => {};
  const webSocketConstructor = config.getWebSocketConstructor();
  let registry = registries.get(config);
  if (!registry) {
    registry = new Map();
    registries.set(config, registry);
  }
  const key = JSON.stringify([config.getChainConfigKey(parameters.chainId), url]);
  let hub = registry.get(key);
  const subscriber: Subscriber = {
    subscriptions: new Map(
      parameters.subscriptions.map((subscription) => [subscriptionKey(subscription), { ...subscription }]),
    ),
    parameters,
  };
  if (!hub) {
    hub = { subscribers: new Set([subscriber]), status: "connecting" };
    registry.set(key, hub);
    const created = hub;
    created.socket = createReconnectingSocket({
      url,
      webSocketConstructor,
      reconnect: parameters.reconnect,
      getOpenMessages: () => [subscribeFrame(created)],
      onMessage: (data) => dispatch(created, data),
      onStatusChange: (status) => notifyStatus(created, status),
      onError: (error) => {
        for (const listener of created.subscribers) reportError(listener, error);
      },
    });
  } else {
    const before = subscribeFrame(hub);
    hub.subscribers.add(subscriber);
    if (hub.socket?.getStatus() === "open" && before !== subscribeFrame(hub)) hub.socket.send(subscribeFrame(hub));
  }
  try {
    parameters.onStatusChange?.(hub.status);
  } catch (error) {
    reportError(subscriber, error);
  }
  const current = hub;
  const currentRegistry = registry;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    const before = subscribeFrame(current);
    current.subscribers.delete(subscriber);
    if (current.subscribers.size === 0) {
      currentRegistry.delete(key);
      current.socket?.close();
    } else if (current.socket?.getStatus() === "open" && before !== subscribeFrame(current)) {
      // A cumulative server may retain old patterns until reconnect; local
      // filtering stops removed subscriptions immediately in either protocol variant.
      current.socket.send(subscribeFrame(current));
    }
  };
}
