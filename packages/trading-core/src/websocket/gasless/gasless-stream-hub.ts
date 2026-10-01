import type { Config } from "../../core/config";
import { SymmError } from "../../shared/errors/symm-error";
import type { WebSocketConstructor } from "../../shared/types/websocket";
import { computeBackoffDelay } from "../socket/backoff";
import { createReconnectingSocket, type ReconnectingSocket } from "../socket/create-reconnecting-socket";
import { classifyGaslessCloseCode, GASLESS_STREAM_BOUNDED_ATTEMPTS } from "./close-code-policy";
import {
  buildGaslessSubscribeCommand,
  buildGaslessUnsubscribeCommand,
  gaslessStreamSelectorKey,
  parseGaslessStreamMessage,
  type GaslessStreamSelector,
} from "./parse-gasless-stream-message";
import type { GaslessStreamEndpoint } from "./resolve-gasless-stream-url";
import type { GaslessRequestStreamUpdate, GaslessStreamStatus, GaslessStreamStatusDetail } from "./types";

/** Dial backoff: 1 s doubling to 30 s, jittered, reset only after a snapshot. */
const BACKOFF = { baseDelayMs: 1_000, maxDelayMs: 30_000, jitter: true } as const;
/** Minimum spacing between client commands; they share the caller's request quota. */
const COMMAND_INTERVAL_MS = 250;
/** How long a command waits for its snapshot / ack before it is retried. */
const COMMAND_ACK_TIMEOUT_MS = 10_000;
/** A throttled command waits at least this long, since `Retry-After` is not on the socket. */
const THROTTLE_BACKOFF_MS = 1_000;
/** No inbound frame for this long (heartbeats arrive about every 20 s) means the socket is dead. */
const LIVENESS_TIMEOUT_MS = 60_000;
/** Grace period before the last watcher's departure closes the socket (absorbs StrictMode remounts). */
const IDLE_CLOSE_MS = 2_000;
/**
 * Grace period before an unwatched selector is unsubscribed.
 *
 * One relayed write is followed by two waits in sequence — broadcast, then
 * terminal — and without this the handoff between them costs a full
 * unsubscribe/subscribe round trip plus the HTTP read the second wait takes
 * while its new subscription is still pending. Runs alongside
 * {@link IDLE_CLOSE_MS}, not after it, so an idle socket still closes as
 * promptly as before.
 */
const SELECTOR_IDLE_MS = 2_000;
/** The `ready` handshake must arrive within this long after the socket opens. */
const READY_TIMEOUT_MS = 10_000;
/** Resubscribes tolerated for the accept-vs-record race after a 202. */
const NOT_FOUND_RETRIES = 3;
/** Delay between those resubscribes. */
const NOT_FOUND_RETRY_MS = 1_500;

/**
 * One watcher of one selector.
 *
 * @internal
 */
export interface GaslessStreamListener {
  onUpdate: (update: GaslessRequestStreamUpdate) => void;
  onStatusChange?: (status: GaslessStreamStatus, detail: GaslessStreamStatusDetail | null) => void;
  onError?: (error: SymmError) => void;
}

interface SelectorEntry {
  selector: GaslessStreamSelector;
  listeners: Set<GaslessStreamListener>;
  /** `pending` until its snapshot arrives; `overflow` while the socket is at its cap. */
  state: "pending" | "live" | "overflow" | "not-found";
  notFoundRetries: number;
  /** Set once a terminal record arrived, so a reconnect does not resubscribe it. */
  done: boolean;
  /** The last frame delivered for this selector, replayed to a late joiner. */
  lastUpdate?: GaslessRequestStreamUpdate;
  /** Pending removal while nobody watches this selector. */
  idle?: ReturnType<typeof setTimeout>;
}

interface QueuedCommand {
  key: string;
  kind: "subscribe" | "unsubscribe";
  frame: string;
}

interface Hub {
  endpoint: GaslessStreamEndpoint;
  /** Resolved once per hub: the config's WebSocket implementation. */
  webSocketConstructor: WebSocketConstructor;
  socket: ReconnectingSocket | null;
  phase: "idle" | "connecting" | "ready" | "backoff" | "disabled";
  status: GaslessStreamStatus;
  detail: GaslessStreamStatusDetail | null;
  maxSubscriptions: number;
  selectors: Map<string, SelectorEntry>;
  queue: QueuedCommand[];
  inFlight: QueuedCommand | null;
  attempt: number;
  /** When the last command was sent, so pacing spans a burst and not an idle socket. */
  lastCommandAt: number;
  timers: {
    redial?: ReturnType<typeof setTimeout>;
    command?: ReturnType<typeof setTimeout>;
    ack?: ReturnType<typeof setTimeout>;
    liveness?: ReturnType<typeof setTimeout>;
    idle?: ReturnType<typeof setTimeout>;
    ready?: ReturnType<typeof setTimeout>;
  };
  random: () => number;
}

const hubRegistries = new WeakMap<Config, Map<string, Hub>>();

function clearTimer(hub: Hub, name: keyof Hub["timers"]): void {
  const timer = hub.timers[name];
  if (timer !== undefined) {
    clearTimeout(timer);
    hub.timers[name] = undefined;
  }
}

function clearAllTimers(hub: Hub): void {
  for (const name of Object.keys(hub.timers) as (keyof Hub["timers"])[]) clearTimer(hub, name);
}

function setStatus(hub: Hub, status: GaslessStreamStatus, detail: GaslessStreamStatusDetail | null): void {
  hub.status = status;
  hub.detail = detail;
  for (const entry of hub.selectors.values()) {
    /** An overflowed selector is never `live`, whatever the socket is doing. */
    const effective = status === "live" && entry.state !== "live" ? "degraded" : status;
    for (const listener of entry.listeners) listener.onStatusChange?.(effective, detail);
  }
}

function notifyError(hub: Hub, key: string | null, error: SymmError): void {
  const entries = key === null ? [...hub.selectors.values()] : [hub.selectors.get(key)].filter(Boolean);
  for (const entry of entries as SelectorEntry[]) {
    for (const listener of entry.listeners) listener.onError?.(error);
  }
}

/** Selectors that still want a subscription, capped by what the gateway allows. */
function wantedSelectors(hub: Hub): SelectorEntry[] {
  return [...hub.selectors.values()].filter(
    (entry) => !entry.done && entry.state !== "not-found" && entry.listeners.size > 0,
  );
}

/** Whether anything still watches this hub. Entries inside their idle grace do not count. */
function hasWatchers(hub: Hub): boolean {
  for (const entry of hub.selectors.values()) if (entry.listeners.size > 0) return true;
  return false;
}

/** Cancel a selector's pending removal — a new watcher arrived in time. */
function clearSelectorIdle(entry: SelectorEntry): void {
  if (entry.idle !== undefined) {
    clearTimeout(entry.idle);
    entry.idle = undefined;
  }
}

/** Whether a watched selector is sitting over the cap, waiting for a slot. */
function hasOverflowedSelector(hub: Hub): boolean {
  for (const entry of hub.selectors.values()) {
    if (entry.state === "overflow" && entry.listeners.size > 0) return true;
  }
  return false;
}

/** Give up a selector nobody watches: unsubscribe it and hand its slot on. */
function removeSelector(hub: Hub, key: string, entry: SelectorEntry): void {
  clearSelectorIdle(entry);
  if (entry.listeners.size > 0) return;

  hub.selectors.delete(key);
  if (hub.phase === "ready" && !entry.done && entry.state === "live") {
    enqueue(hub, { key, kind: "unsubscribe", frame: buildGaslessUnsubscribeCommand(entry.selector) });
  }
  /** A freed slot may let an overflowed selector subscribe. */
  if (hub.phase === "ready") subscribeAll(hub);
}

/** Whether a command for this selector is already queued or in flight. */
function isCommandPending(hub: Hub, key: string): boolean {
  return hub.inFlight?.key === key || hub.queue.some((command) => command.key === key);
}

/**
 * Subscribe a selector that wants one and has no command out for it yet.
 *
 * Shared by a first watcher and by one that rejoined an entry whose grace had
 * not expired: rejoining a `live` entry needs no command at all, which is the
 * whole point of the grace.
 */
function ensureSubscribed(hub: Hub, key: string, entry: SelectorEntry): void {
  if (hub.phase !== "ready" || entry.done) return;
  if (entry.state === "live" || entry.state === "not-found") return;
  if (isCommandPending(hub, key)) return;

  const live = wantedSelectors(hub).filter((candidate) => candidate.state !== "overflow").length;
  if (live > hub.maxSubscriptions) {
    entry.state = "overflow";
    return;
  }
  entry.state = "pending";
  enqueue(hub, { key, kind: "subscribe", frame: buildGaslessSubscribeCommand(entry.selector) });
}

function enqueue(hub: Hub, command: QueuedCommand): void {
  hub.queue.push(command);
  pumpQueue(hub);
}

/** Send one command at a time, paced, and only while the socket is ready. */
function pumpQueue(hub: Hub): void {
  if (hub.phase !== "ready" || hub.inFlight !== null || hub.queue.length === 0) return;
  if (hub.timers.command !== undefined) return;

  /**
   * Paced from the last command sent, not from now: the interval exists to keep
   * a burst of commands off the caller's request quota, and a socket that has
   * been quiet has already served it. The first subscribe after `ready` is what
   * a status wait is blocked on, so it goes out at once.
   */
  const delay = Math.max(0, COMMAND_INTERVAL_MS - (Date.now() - hub.lastCommandAt));

  hub.timers.command = setTimeout(() => {
    hub.timers.command = undefined;
    if (hub.phase !== "ready" || hub.inFlight !== null) return;
    const command = hub.queue.shift();
    if (!command) return;
    hub.inFlight = command;
    hub.lastCommandAt = Date.now();
    hub.socket?.send(command.frame);
    hub.timers.ack = setTimeout(() => {
      hub.timers.ack = undefined;
      /** No ack in time: put it back at the head and try again. */
      const pending = hub.inFlight;
      hub.inFlight = null;
      if (pending) hub.queue.unshift(pending);
      pumpQueue(hub);
    }, COMMAND_ACK_TIMEOUT_MS);
  }, delay);
}

function completeInFlight(hub: Hub, key: string): void {
  if (hub.inFlight?.key !== key) return;
  hub.inFlight = null;
  clearTimer(hub, "ack");
  pumpQueue(hub);
}

function subscribeAll(hub: Hub): void {
  const wanted = wantedSelectors(hub);
  wanted.forEach((entry, index) => {
    const key = gaslessStreamSelectorKey(entry.selector);
    if (index >= hub.maxSubscriptions) {
      /** Over the cap: this selector stays on HTTP until a slot frees. */
      entry.state = "overflow";
      for (const listener of entry.listeners) {
        listener.onStatusChange?.("degraded", {
          reason: "subscription-limit",
          detail: `The gateway allows ${hub.maxSubscriptions} subscriptions per socket; this workflow keeps polling over HTTP until a slot frees.`,
        });
      }
      return;
    }
    if (isCommandPending(hub, key)) return;
    entry.state = "pending";
    enqueue(hub, { key, kind: "subscribe", frame: buildGaslessSubscribeCommand(entry.selector) });
  });
}

function armLiveness(hub: Hub): void {
  clearTimer(hub, "liveness");
  hub.timers.liveness = setTimeout(() => {
    hub.timers.liveness = undefined;
    /** Heartbeats stopped: treat it as a dead connection and redial. */
    dropSocket(hub);
    scheduleRedial(hub, {
      reason: "unreachable",
      detail: "The gateway stopped sending heartbeats; reconnecting while status reads continue over HTTP.",
    });
  }, LIVENESS_TIMEOUT_MS);
}

function dropSocket(hub: Hub): void {
  clearTimer(hub, "ready");
  clearTimer(hub, "command");
  clearTimer(hub, "ack");
  clearTimer(hub, "liveness");
  hub.inFlight = null;
  hub.queue = [];
  const socket = hub.socket;
  hub.socket = null;
  socket?.close(1000);
}

function scheduleRedial(hub: Hub, detail: GaslessStreamStatusDetail): void {
  if (hub.phase === "disabled") return;
  hub.phase = "backoff";
  setStatus(hub, "degraded", detail);
  const delay = computeBackoffDelay(hub.attempt, BACKOFF, hub.random);
  hub.attempt += 1;
  clearTimer(hub, "redial");
  hub.timers.redial = setTimeout(() => {
    hub.timers.redial = undefined;
    if (hub.selectors.size === 0) {
      hub.phase = "idle";
      return;
    }
    connect(hub);
  }, delay);
}

function disable(hub: Hub, detail: GaslessStreamStatusDetail, error?: SymmError): void {
  hub.phase = "disabled";
  dropSocket(hub);
  clearTimer(hub, "redial");
  for (const entry of hub.selectors.values()) entry.state = "overflow";
  setStatus(hub, "disabled", detail);
  if (error) notifyError(hub, null, error);
}

function handleMessage(hub: Hub, data: unknown): void {
  armLiveness(hub);
  const message = parseGaslessStreamMessage(data);

  /** The throttle notice has no type or instance, so it is handled first. */
  if (message.type === "throttle") {
    const pending = hub.inFlight;
    hub.inFlight = null;
    clearTimer(hub, "ack");
    if (pending) hub.queue.unshift(pending);
    clearTimer(hub, "command");
    hub.timers.command = setTimeout(
      () => {
        hub.timers.command = undefined;
        pumpQueue(hub);
      },
      THROTTLE_BACKOFF_MS + Math.round(hub.random() * THROTTLE_BACKOFF_MS),
    );
    return;
  }

  if (message.type === "unparseable" || message.type === "transport") return;

  if (message.type === "error") {
    const key = message.selector ? gaslessStreamSelectorKey(message.selector) : null;
    if (key) completeInFlight(hub, key);
    const entry = key ? hub.selectors.get(key) : undefined;

    if (message.code === "NOT_FOUND" && entry) {
      /**
       * The accepted record may not be readable the instant a 202 returns, and
       * the gateway does not retain a NOT_FOUND subscription, so resubscribe a
       * few times before giving up on the stream for this workflow.
       */
      if (entry.notFoundRetries < NOT_FOUND_RETRIES) {
        entry.notFoundRetries += 1;
        const retried = entry;
        setTimeout(() => {
          if (hub.phase !== "ready" || retried.done) return;
          enqueue(hub, {
            key: gaslessStreamSelectorKey(retried.selector),
            kind: "subscribe",
            frame: buildGaslessSubscribeCommand(retried.selector),
          });
        }, NOT_FOUND_RETRY_MS);
        return;
      }
      entry.state = "not-found";
      for (const listener of entry.listeners) {
        listener.onStatusChange?.("degraded", {
          reason: "not-found",
          detail:
            "The gateway does not store this workflow on the configured instance; status reads continue over HTTP.",
        });
      }
      notifyError(
        hub,
        key,
        new SymmError(
          "api",
          "GASLESS_STREAM_NOT_FOUND",
          "Gasless: the status stream does not know this request id on the configured protocol instance. Check that the workflow was accepted by this instance; status reads continue over HTTP.",
        ),
      );
      return;
    }

    if (message.code === "SUBSCRIPTION_LIMIT" && entry) {
      entry.state = "overflow";
      for (const listener of entry.listeners) {
        listener.onStatusChange?.("degraded", {
          reason: "subscription-limit",
          detail: "The socket is at its subscription limit; this workflow keeps polling over HTTP.",
        });
      }
      return;
    }

    notifyError(
      hub,
      key,
      new SymmError(
        "api",
        message.code === "INVALID_MESSAGE" ? "GASLESS_STREAM_COMMAND_INVALID" : "GASLESS_STREAM_PROTOCOL_ERROR",
        `Gasless: the status stream rejected a command with ${message.code}.`,
      ),
    );
    return;
  }

  /** Every remaining frame names an instance; a mismatch means a different deployment answered. */
  if (message.protocolInstance !== hub.endpoint.protocolInstance) {
    disable(
      hub,
      {
        reason: "instance-mismatch",
        detail: `The status stream answered for protocol instance "${message.protocolInstance}" but the config pins "${hub.endpoint.protocolInstance}". Status reads continue over HTTP.`,
      },
      new SymmError(
        "api",
        "GASLESS_STREAM_INSTANCE_MISMATCH",
        `Gasless: the status stream answered for protocol instance "${message.protocolInstance}" but the config pins "${hub.endpoint.protocolInstance}".`,
      ),
    );
    return;
  }

  if (message.type === "ready") {
    clearTimer(hub, "ready");
    hub.phase = "ready";
    hub.maxSubscriptions = message.maxSubscriptions;
    setStatus(hub, "connecting", null);
    subscribeAll(hub);
    return;
  }

  if (message.type === "unsubscribed") {
    completeInFlight(hub, gaslessStreamSelectorKey(message.selector));
    return;
  }

  const key = gaslessStreamSelectorKey(message.selector);
  const entry = hub.selectors.get(key);
  if (!entry) return;
  if (message.type === "snapshot") {
    completeInFlight(hub, key);
    /** A delivering socket is healthy, so the dial backoff starts over. */
    hub.attempt = 0;
  }
  entry.state = "live";
  entry.notFoundRetries = 0;
  setStatus(hub, "live", null);
  const update: GaslessRequestStreamUpdate = {
    kind: message.type,
    request: message.request,
    transactions: message.transactions,
  };
  /** Kept so a watcher that joins this subscription later starts from it. */
  entry.lastUpdate = update;
  for (const listener of entry.listeners) listener.onUpdate(update);
}

function handleClose(hub: Hub, code?: number): void {
  if (hub.phase === "disabled") return;
  const reachedReady = hub.phase === "ready";
  hub.socket = null;
  clearTimer(hub, "ready");
  clearTimer(hub, "command");
  clearTimer(hub, "ack");
  clearTimer(hub, "liveness");
  hub.inFlight = null;
  hub.queue = [];
  for (const entry of hub.selectors.values()) if (entry.state === "live") entry.state = "pending";

  const policy = classifyGaslessCloseCode(code);
  const detail: GaslessStreamStatusDetail = { reason: policy.reason, closeCode: code, detail: policy.detail };

  if (policy.action === "disable") {
    disable(hub, detail, new SymmError("api", "GASLESS_STREAM_DISABLED", `Gasless: ${policy.detail}`));
    return;
  }
  if (policy.action === "retry-bounded" && !reachedReady && hub.attempt >= GASLESS_STREAM_BOUNDED_ATTEMPTS) {
    disable(
      hub,
      detail,
      new SymmError(
        "api",
        "GASLESS_STREAM_DISABLED",
        `Gasless: the status stream closed ${GASLESS_STREAM_BOUNDED_ATTEMPTS} times without connecting. ${policy.detail}`,
      ),
    );
    return;
  }
  scheduleRedial(hub, detail);
}

function connect(hub: Hub): void {
  if (hub.phase === "disabled" || hub.socket !== null) return;
  hub.phase = "connecting";
  setStatus(hub, "connecting", null);

  let socket: ReconnectingSocket;
  try {
    socket = createReconnectingSocket({
      url: hub.endpoint.url,
      webSocketConstructor: hub.webSocketConstructor,
      /** The hub owns reconnects: the close code decides whether to redial at all. */
      reconnect: { enabled: false },
      onMessage: (data) => handleMessage(hub, data),
      onClose: ({ code }) => handleClose(hub, code),
      onError: () => {
        /** A transport error is always followed by a close, which carries the policy. */
      },
    });
  } catch (err) {
    scheduleRedial(hub, {
      reason: "unreachable",
      detail: `The status stream could not be opened (${err instanceof Error ? err.message : String(err)}); status reads continue over HTTP.`,
    });
    return;
  }
  hub.socket = socket;
  armLiveness(hub);
  hub.timers.ready = setTimeout(() => {
    hub.timers.ready = undefined;
    /** Opened but never greeted: close and redial rather than sending into the void. */
    dropSocket(hub);
    handleClose(hub, 1006);
  }, READY_TIMEOUT_MS);
}

/**
 * Parameters for {@link acquireGaslessStreamSelector}.
 *
 * @internal
 */
export interface AcquireGaslessStreamSelectorParameters {
  /** The resolved stream endpoint; one hub per URL per config. */
  endpoint: GaslessStreamEndpoint;
  /** What this watcher wants to follow. */
  selector: GaslessStreamSelector;
  /** This watcher's callbacks. */
  listener: GaslessStreamListener;
  /** Randomness for backoff and throttle jitter; injectable for tests. */
  random?: () => number;
}

/**
 * Join (or open) the shared status stream for an endpoint and subscribe one
 * selector.
 *
 * One socket serves every watcher of a `(config, endpoint)` pair: the hub keeps
 * the desired selector set independent of the connection, replays it after each
 * `ready`, paces commands so they do not eat the caller's request quota, and
 * routes every frame to the watchers of its selector. Watchers are told when the
 * stream is not delivering so they can poll instead — the hub itself never
 * issues HTTP.
 *
 * A subscription outlives its last watcher by a short grace, and a watcher that
 * joins one which has already delivered is handed that record. Together they
 * make the handoff between two waits on the same workflow free: no
 * unsubscribe/subscribe round trip, and nothing to read over HTTP.
 *
 * @returns A release function; the socket closes shortly after the last watcher releases.
 *
 * @internal
 */
export function acquireGaslessStreamSelector(
  config: Config,
  parameters: AcquireGaslessStreamSelectorParameters,
): () => void {
  const { endpoint, selector, listener, random = Math.random } = parameters;

  let registry = hubRegistries.get(config);
  if (!registry) {
    registry = new Map();
    hubRegistries.set(config, registry);
  }

  let hub = registry.get(endpoint.url);
  if (!hub) {
    hub = {
      endpoint,
      socket: null,
      phase: "idle",
      status: "idle",
      detail: null,
      maxSubscriptions: 1,
      selectors: new Map(),
      queue: [],
      inFlight: null,
      attempt: 0,
      lastCommandAt: 0,
      timers: {},
      random,
      webSocketConstructor: config.getWebSocketConstructor(),
    };
    registry.set(endpoint.url, hub);
  }
  const currentHub = hub;
  const currentRegistry = registry;
  clearTimer(currentHub, "idle");

  const key = gaslessStreamSelectorKey(selector);
  let entry = currentHub.selectors.get(key);
  if (!entry) {
    entry = { selector, listeners: new Set(), state: "pending", notFoundRetries: 0, done: false };
    currentHub.selectors.set(key, entry);
  }
  const currentEntry = entry;
  /** Rejoined inside its grace: the subscription is still good, so keep it. */
  clearSelectorIdle(currentEntry);
  currentEntry.listeners.add(listener);
  ensureSubscribed(currentHub, key, currentEntry);

  /** Sync the late joiner to the stream's current health. */
  listener.onStatusChange?.(
    currentHub.status === "live" && currentEntry.state !== "live" ? "degraded" : currentHub.status,
    currentHub.detail,
  );

  /**
   * A watcher joining a subscription that already delivered starts from what it
   * delivered: the gateway sends its snapshot once per *subscribe*, not once
   * per listener, so without this a joiner would wait for a change that may
   * never come.
   *
   * Deferred by a microtask because `watchGaslessRequest` releases its selector
   * from inside `onUpdate` when the record is terminal — delivering inline
   * would re-enter the hub in the middle of this acquire.
   */
  if (currentEntry.lastUpdate) {
    queueMicrotask(() => {
      /** Re-read rather than capture: a frame that landed meanwhile is the one to deliver. */
      const update = currentEntry.lastUpdate;
      if (update && currentEntry.listeners.has(listener)) listener.onUpdate(update);
    });
  }

  if (currentHub.phase === "idle") connect(currentHub);

  let released = false;
  return () => {
    if (released) return;
    released = true;
    currentEntry.listeners.delete(listener);
    if (currentEntry.listeners.size > 0) return;

    /**
     * Nobody is watching, but the next wait on this workflow is often moments
     * away, so the subscription is held briefly before it is given up — unless
     * another selector is over the cap and waiting for exactly this slot. The
     * grace saves a round trip; it is never a claim on a scarce resource.
     */
    clearSelectorIdle(currentEntry);
    if (hasOverflowedSelector(currentHub)) {
      removeSelector(currentHub, key, currentEntry);
    } else {
      currentEntry.idle = setTimeout(() => {
        currentEntry.idle = undefined;
        removeSelector(currentHub, key, currentEntry);
      }, SELECTOR_IDLE_MS);
    }

    if (!hasWatchers(currentHub)) {
      clearTimer(currentHub, "idle");
      currentHub.timers.idle = setTimeout(() => {
        currentHub.timers.idle = undefined;
        if (hasWatchers(currentHub)) return;
        for (const entry of currentHub.selectors.values()) clearSelectorIdle(entry);
        currentHub.selectors.clear();
        clearAllTimers(currentHub);
        dropSocket(currentHub);
        currentHub.phase = currentHub.phase === "disabled" ? "disabled" : "idle";
        currentRegistry.delete(endpoint.url);
      }, IDLE_CLOSE_MS);
    }
  };
}

/**
 * Mark a selector finished, so a reconnect does not resubscribe it.
 *
 * The caller decides what "finished" means — a terminal workflow status, or a
 * dismissed row — and the hub unsubscribes it from the live socket.
 *
 * @internal
 */
export function releaseGaslessStreamSelector(
  config: Config,
  endpointUrl: string,
  selector: GaslessStreamSelector,
): void {
  const hub = hubRegistries.get(config)?.get(endpointUrl);
  if (!hub) return;
  const key = gaslessStreamSelectorKey(selector);
  const entry = hub.selectors.get(key);
  if (!entry || entry.done) return;
  entry.done = true;
  if (hub.phase === "ready" && entry.state === "live") {
    enqueue(hub, { key, kind: "unsubscribe", frame: buildGaslessUnsubscribeCommand(selector) });
  }
}
