"use client";

import { useMarkets } from "@symmio/trading-react";
import { LiveResult } from "./live-result";
import type { MagicMethodPanelProps } from "./magic-types";

/** Magic-method panel polling the solver's tradable markets. No inputs. */
export function MarketsLivePanel({ intervalMs, enabled, persistKey }: MagicMethodPanelProps) {
  const query = useMarkets({
    query: { enabled, refetchInterval: enabled ? intervalMs : false, refetchIntervalInBackground: true },
  });

  return (
    <LiveResult
      query={{
        data: query.data,
        dataUpdatedAt: query.dataUpdatedAt,
        isFetching: query.isFetching,
        error: query.error,
      }}
      active={enabled}
      persistKey={persistKey}
    />
  );
}
