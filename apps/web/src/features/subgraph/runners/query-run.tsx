"use client";

import type { SymmioRequestError } from "@symmio/trading-react";
import { keepPreviousData, type UseQueryResult } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import type { ReadSpec } from "../read-catalog";
import { ResultView, type PagingControls } from "../result-view";

/** What every runner receives: the read and the parameters the user ran. */
export interface RunnerProps {
  read: ReadSpec;
  /** The object handed to the hook, as built from the form. */
  parameters: Record<string, unknown>;
  runId: number;
  paging?: PagingControls;
  collateralDecimals: number;
}

/**
 * The form's parameters, typed as a hook's. Sound because `defineRead` checks
 * every field key against the hook's parameters, and the form refuses to commit
 * while a required field is empty — so the object always carries what the hook
 * requires, under the names it expects.
 */
export function hookParameters<TParameters>(parameters: Record<string, unknown>): TParameters {
  return parameters as TParameters;
}

/**
 * TanStack overrides for a test page: keep the last page on screen while the
 * next loads, fail on the first error so a rejected request shows at once, and
 * never refetch behind the user's back when the window regains focus.
 */
export const RUN_QUERY = {
  placeholderData: keepPreviousData,
  retry: false,
  refetchOnWindowFocus: false,
} as const;

function toKey(parameters: Record<string, unknown>): string {
  return JSON.stringify(parameters, (_key, value: unknown) => (typeof value === "bigint" ? `${value}n` : value));
}

/**
 * Refetch when the user runs the same request again. A changed request already
 * fetches through its new query key, so only an unchanged one needs the nudge.
 */
function useRefetchOnRerun(refetch: () => unknown, runId: number, parameters: Record<string, unknown>) {
  const last = useRef({ runId, key: toKey(parameters) });

  useEffect(() => {
    const key = toKey(parameters);
    if (runId !== last.current.runId && key === last.current.key) void refetch();
    last.current = { runId, key };
  }, [refetch, runId, parameters]);
}

interface PageData {
  rows: readonly object[];
  hasMore?: boolean;
}

/** Render a hook's `UseQueryResult` through the shared result view. */
export function QueryRun<TData extends PageData>({
  query,
  read,
  parameters,
  runId,
  paging,
  collateralDecimals,
}: RunnerProps & { query: UseQueryResult<TData, SymmioRequestError> }) {
  useRefetchOnRerun(query.refetch, runId, parameters);

  return (
    <ResultView
      read={read}
      paging={paging}
      collateralDecimals={collateralDecimals}
      result={{
        rows: query.data?.rows,
        hasMore: query.data?.hasMore,
        isLoading: query.isLoading,
        isFetching: query.isFetching,
        error: query.error ?? null,
      }}
    />
  );
}
