"use client";

import {
  getQuoteTpSlQueryKey,
  getQuoteTpSlQueryOptions,
  type ConfigParameter,
  type GetQuoteTpSlOptions,
  type QuoteTpSl,
  type QuoteTpSlRow,
  type TpSlNotification,
} from "@symm-frontier/core";
import { useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import type { Address } from "viem";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";
import { toQuoteTpSl } from "./to-quote-tpsl";
import {
  clearTpSlConfirmingSide,
  EMPTY_TPSL_CONFIRMING,
  getTpSlConfirmingQueryKey,
  type TpSlConfirming,
} from "./tpsl-confirming";
import { useWatchTpSlNotifications } from "./use-watch-tpsl-notifications";

/** Parameters for {@link useQuoteTpSl}. */
export type UseQuoteTpSlParameters = GetQuoteTpSlOptions &
  ConfigParameter & {
    /**
     * SubAccount address — when provided, the hook also subscribes to the
     * TP/SL WebSocket and reconciles the snapshot (`confirming` → `new`)
     * without manual polling. Omit to skip WS (REST-only).
     */
    account?: Address;
  };

/** Return type of {@link useQuoteTpSl}. */
export type UseQuoteTpSlReturnType = UseQueryResult<QuoteTpSl, SymmioRequestError> & {
  /** The unfiltered conditional-order rows returned by the handler. */
  rows: QuoteTpSlRow[] | undefined;
};

/**
 * Read the TP/SL snapshot for one on-chain quote.
 *
 * The query caches the **raw handler rows** (every state — `pending` / `new` /
 * `triggered` / `canceled` / `killed`); the hook returns a folded
 * {@link QuoteTpSl} via {@link toQuoteTpSl}.
 *
 * State machine — when a POST just landed (via
 * {@link useSetQuoteTpSl}) the shared "confirming" slot is set for the
 * submitted sides; this hook overlays `tpState` / `slState = "confirming"`
 * until a matching WebSocket `report` arrives with `successful: true`. On
 * that report the slot is cleared and the rows query is invalidated, so the
 * fresh snapshot flips the side to `new` (active).
 */
export function useQuoteTpSl(parameters: UseQuoteTpSlParameters): UseQuoteTpSlReturnType {
  const config = useSymmioConfig(parameters);
  const defaultChainId = useSymmioChainId();
  const chainId = parameters.chainId ?? defaultChainId;
  const queryClient = useQueryClient();
  const configKey = config.getChainConfigKey(chainId);

  const options = getQuoteTpSlQueryOptions(config, { ...parameters, chainId });
  const queryResult = useQuery({
    ...options,
    queryFn: async () => {
      try {
        return await options.queryFn();
      } catch (err) {
        throw normalizeSymmError(err);
      }
    },
  });

  const rowsKey = getQuoteTpSlQueryKey({ ...parameters, chainId, configKey });
  const confirmingKey = getTpSlConfirmingQueryKey({ chainId, quoteId: parameters.quoteId, configKey });

  const confirmingQuery = useQuery<TpSlConfirming>({
    queryKey: confirmingKey,
    queryFn: () => queryClient.getQueryData<TpSlConfirming>(confirmingKey) ?? EMPTY_TPSL_CONFIRMING,
    initialData: EMPTY_TPSL_CONFIRMING,
    staleTime: Infinity,
    gcTime: Infinity,
  });
  const confirming = confirmingQuery.data ?? EMPTY_TPSL_CONFIRMING;

  const folded = useMemo(() => {
    if (!queryResult.data) return undefined;
    const snapshot = toQuoteTpSl(queryResult.data);
    return applyConfirmingOverlay(snapshot, confirming);
  }, [queryResult.data, confirming]);

  const wsAccount = parameters.account;
  const matchQuoteId = parameters.quoteId;
  const rowsKeySerialized = JSON.stringify(rowsKey);

  useWatchTpSlNotifications({
    account: wsAccount,
    enabled: Boolean(wsAccount) && matchQuoteId > 0n,
    onNotification: (notification) => {
      if (!matchesQuote(notification, matchQuoteId)) return;
      if (notification.successful) {
        const side =
          notification.conditionalOrderType === "take_profit"
            ? "tp"
            : notification.conditionalOrderType === "stop_loss"
              ? "sl"
              : null;
        if (side && (notification.state === "new" || notification.state === "edit")) {
          clearTpSlConfirmingSide(queryClient, confirmingKey, side);
        }
      }
      void queryClient.invalidateQueries({ queryKey: rowsKey });
    },
  });

  useEffect(() => {
    void rowsKeySerialized;
  }, [rowsKeySerialized]);

  const result = { ...queryResult, data: folded, rows: queryResult.data } as unknown as UseQuoteTpSlReturnType;
  return result;
}

function matchesQuote(notification: TpSlNotification, quoteId: bigint): boolean {
  return notification.quoteId === Number(quoteId);
}

/**
 * If a side is awaiting WS confirmation, override its state to `confirming`
 * (the row snapshot may or may not have caught up yet — either way, "await
 * WS" takes precedence over what the REST rows report).
 */
function applyConfirmingOverlay(snapshot: QuoteTpSl, confirming: TpSlConfirming): QuoteTpSl {
  if (!confirming.tp && !confirming.sl) return snapshot;
  return {
    ...snapshot,
    tpState: confirming.tp ? "confirming" : snapshot.tpState,
    slState: confirming.sl ? "confirming" : snapshot.slState,
  };
}
