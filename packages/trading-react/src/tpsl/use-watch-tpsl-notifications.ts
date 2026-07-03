"use client";

import {
  watchTpSlNotifications,
  type ConfigParameter,
  type SocketStatus,
  type TpSlNotification,
} from "@symmio/trading-core";
import { useEffect, useRef, useState } from "react";
import type { Address } from "viem";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/**
 * Parameters for {@link useWatchTpSlNotifications}.
 */
export interface UseWatchTpSlNotificationsParameters extends ConfigParameter {
  /** SubAccount address — required to subscribe. */
  account?: Address;
  /** Target chain id. Defaults to the connected chain. */
  chainId?: number;
  /** Subscribe only when `true` (and `account` is set). Default `true`. */
  enabled?: boolean;
  /** Called for every normalized TP/SL report. */
  onNotification?: (notification: TpSlNotification) => void;
}

/** Return type of {@link useWatchTpSlNotifications}. */
export interface UseWatchTpSlNotificationsReturnType {
  /** Live socket status. */
  status: SocketStatus;
  /** Last transport / parse error, normalized, or `null`. */
  error: SymmioRequestError | null;
}

/**
 * Subscribe to the TP/SL notifications WebSocket for a subaccount. Reuses the
 * SDK's shared socket pool so multiple components on the same account share
 * one connection.
 */
export function useWatchTpSlNotifications(
  parameters: UseWatchTpSlNotificationsParameters,
): UseWatchTpSlNotificationsReturnType {
  const { account, chainId, enabled = true, onNotification } = parameters;
  const config = useSymmioConfig(parameters);
  const defaultChainId = useSymmioChainId();
  const resolvedChainId = chainId ?? defaultChainId;

  const [status, setStatus] = useState<SocketStatus>("closed");
  const [error, setError] = useState<SymmioRequestError | null>(null);

  const onNotificationRef = useRef(onNotification);
  onNotificationRef.current = onNotification;

  const active = enabled && Boolean(account);

  useEffect(() => {
    if (!active || !account) {
      setStatus("closed");
      return;
    }
    setError(null);
    let unwatch: (() => void) | undefined;
    try {
      unwatch = watchTpSlNotifications(config, {
        account,
        chainId: resolvedChainId,
        onNotification: (notification) => onNotificationRef.current?.(notification),
        onStatusChange: setStatus,
        onError: (err) => setError(normalizeSymmError(err)),
      });
    } catch (err) {
      setError(normalizeSymmError(err));
      setStatus("closed");
    }
    return () => unwatch?.();
  }, [active, account, config, resolvedChainId]);

  return { status, error };
}
