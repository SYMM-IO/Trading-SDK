"use client";

import { ResponseHistoryView } from "./response-history-view";
import { usePollHistory } from "./use-poll-history";

/**
 * Transport-agnostic shape a live panel feeds into {@link LiveResult}. A
 * react-query result maps directly (`isFetching` → live tick); a future socket
 * subscription can supply the same fields.
 */
export interface LiveQueryLike {
  /** Latest response, or `undefined` before the first value. */
  data: unknown;
  /** Timestamp (ms epoch) of the latest value. */
  dataUpdatedAt: number;
  /** Whether a value is currently being fetched/received (drives the pulse). */
  isFetching: boolean;
  /** Latest error, or `null`. */
  error: { message: string } | null;
}

interface Props {
  query: LiveQueryLike;
  /** Whether the source is actively running (inputs satisfied, card expanded). */
  active: boolean;
  /** Hint shown while the source is idle (e.g. waiting for inputs). */
  idleHint?: string;
}

/**
 * Renders a live source's output: an idle hint until inputs are satisfied, any
 * error, and the latest response with prior responses dimmed as stale history.
 * The {@link usePollHistory} buffer makes "what changed, and when" obvious.
 */
export function LiveResult({ query, active, idleHint }: Props) {
  const history = usePollHistory(query.data, query.dataUpdatedAt);

  return (
    <div className="flex flex-col gap-3">
      {!active && idleHint ? <p className="text-muted-foreground text-xs">{idleHint}</p> : null}
      {query.error ? (
        <p className="text-destructive text-xs" role="alert">
          {query.error.message}
        </p>
      ) : null}
      <ResponseHistoryView entries={history} isFetching={active && query.isFetching} />
    </div>
  );
}
