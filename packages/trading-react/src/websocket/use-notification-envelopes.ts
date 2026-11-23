"use client";

import {
  watchNotificationEnvelopes,
  type ConfigParameter,
  type SocketStatus,
  type WatchNotificationEnvelopesParameters,
} from "@symmio/trading-core";
import { useEffect, useRef, useState } from "react";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/** React lifecycle inputs for the shared, lossless Enigma stream. */
export interface UseNotificationEnvelopesParameters extends ConfigParameter, WatchNotificationEnvelopesParameters {
  /** Subscribe while true. Defaults to true; empty subscriptions always remain idle. */
  enabled?: boolean;
}

/** Connection state; this hook neither buffers events nor invalidates queries. */
export interface UseNotificationEnvelopesReturnType {
  /** Current shared connection status. */
  status: SocketStatus;
  /** Last normalized transport or subscription error. */
  error: SymmioRequestError | null;
}

/**
 * Receive full server envelopes using the SDK's shared notification connection.
 * Callback identity changes do not reconnect. Changing account/channel pairs,
 * deployment, or enabled state releases the previous subscription.
 * @param parameters - Explicit subscriptions, event callback, and deployment.
 * @returns Transport status and last error; product effects remain caller-owned.
 * @example
 * ```tsx
 * const { status } = useNotificationEnvelopes({
 *   chainId: 42161, subscriptions: [{ account, channel }], onEnvelope,
 * });
 * ```
 */
export function useNotificationEnvelopes(
  parameters: UseNotificationEnvelopesParameters,
): UseNotificationEnvelopesReturnType {
  const config = useSymmioConfig(parameters);
  const defaultChainId = useSymmioChainId();
  const chainId = parameters.chainId ?? defaultChainId;
  const { solverId, enabled = true } = parameters;
  const latest = useRef(parameters);
  latest.current = parameters;
  const subscriptionKey = JSON.stringify(
    [
      ...new Set(
        parameters.subscriptions.map(({ account, channel }) => JSON.stringify([account.toLowerCase(), channel])),
      ),
    ].sort(),
  );
  const [status, setStatus] = useState<SocketStatus>("closed");
  const [error, setError] = useState<SymmioRequestError | null>(null);

  useEffect(() => {
    setError(null);
    if (!enabled || latest.current.subscriptions.length === 0) {
      setStatus("closed");
      return;
    }
    let active = true;
    let stop: (() => void) | undefined;
    try {
      stop = watchNotificationEnvelopes(config, {
        chainId,
        solverId,
        subscriptions: latest.current.subscriptions,
        reconnect: latest.current.reconnect,
        onEnvelope: (envelope) => {
          if (active) latest.current.onEnvelope(envelope);
        },
        onStatusChange: (next) => {
          if (active) {
            setStatus(next);
            latest.current.onStatusChange?.(next);
          }
        },
        onError: (failure) => {
          if (active) {
            setError(normalizeSymmError(failure));
            latest.current.onError?.(failure);
          }
        },
      });
    } catch (failure) {
      setError(normalizeSymmError(failure));
      setStatus("closed");
    }
    return () => {
      active = false;
      stop?.();
    };
  }, [config, chainId, solverId, enabled, subscriptionKey]);

  return { status, error };
}
