"use client";

import { useEffect, useMemo, useState } from "react";
import {
  buildParameters,
  emptyValue,
  hasErrors,
  scalarValue,
  withoutField,
  withValue,
  type BuildResult,
  type DraftValue,
  type FormDraft,
} from "./form-draft";
import type { ReadSpec } from "./read-catalog";

/** A request the user ran: the form it came from and the parameters handed to the hook. */
export interface CommittedRun {
  draft: FormDraft;
  parameters: Record<string, unknown>;
  /** Bumped on every Run, so running an unchanged form still refetches. */
  runId: number;
}

interface Options {
  read: ReadSpec;
  /** The form the read opens with — its starting state, or one restored from a link. */
  initial: FormDraft;
  /** The form `Reset` returns to. */
  resetTo: FormDraft;
  /** Run `initial` straight away (a shared link). */
  runOnMount: boolean;
  /** Called with each committed form, to keep the URL in step. */
  onCommit: (draft: FormDraft) => void;
}

function commit(read: ReadSpec, draft: FormDraft, runId: number): CommittedRun | null {
  const built = buildParameters(read, draft);
  return hasErrors(built) ? null : { draft, parameters: built.parameters, runId };
}

/**
 * Form state for one read: the draft being edited, the committed request the
 * result shows, and the page history behind Prev. Editing never refetches; only
 * Run, Next and Prev change what the hook is asked for.
 */
export function useSubgraphForm({ read, initial, resetTo, runOnMount, onCommit }: Options) {
  const [draft, setDraft] = useState(initial);
  const [committed, setCommitted] = useState<CommittedRun | null>(() => (runOnMount ? commit(read, initial, 1) : null));
  const [history, setHistory] = useState<readonly CommittedRun[]>([]);
  const [showErrors, setShowErrors] = useState(false);

  const built: BuildResult = useMemo(() => buildParameters(read, draft), [read, draft]);

  useEffect(() => {
    if (committed) onCommit(committed.draft);
  }, [committed, onCommit]);

  function nextRunId() {
    return (committed?.runId ?? 0) + 1;
  }

  function setValue(key: string, value: DraftValue) {
    setDraft((previous) => withValue(previous, key, value));
  }

  function addField(key: string) {
    const field = read.fields.find((candidate) => candidate.key === key);
    if (field) setDraft((previous) => withValue(previous, key, emptyValue(field)));
  }

  function removeField(key: string) {
    setDraft((previous) => withoutField(previous, key));
  }

  function run() {
    if (hasErrors(built)) {
      setShowErrors(true);
      return;
    }
    setShowErrors(false);
    setHistory([]);
    setCommitted({ draft, parameters: built.parameters, runId: nextRunId() });
  }

  function reset() {
    setDraft(resetTo);
    setCommitted(null);
    setHistory([]);
    setShowErrors(false);
  }

  /**
   * Ask for the page after the committed one. Sorted by `id` ascending, it moves
   * the `idGt` cursor to the last row's id (and drops `skip`, which would skip
   * past the cursor); otherwise it advances `skip` by the page size. An `id_gt`
   * cursor only pages correctly in ascending id order — ids do not follow time —
   * so the SDK sorts by id ascending whenever `idGt` is sent without a sort.
   */
  function nextPage(lastRow: object | undefined) {
    if (!committed) return;
    const current = committed.draft;
    const cursorSent = scalarValue(current, "idGt") !== "";
    const orderBy = scalarValue(current, "orderBy") || (cursorSent ? "id" : "timestamp");
    const orderDirection = scalarValue(current, "orderDirection") || (cursorSent ? "asc" : "desc");
    let next: FormDraft;

    if (read.cursor && orderBy === "id" && orderDirection === "asc") {
      const id = lastRow ? (lastRow as Record<string, unknown>).id : undefined;
      if (typeof id !== "string" || id === "") return;
      next = withoutField(withValue(current, "idGt", id), "skip");
    } else {
      const pageSize = Number(scalarValue(current, "first") || read.defaultPageSize || 0);
      const skip = Number(scalarValue(current, "skip") || 0);
      if (pageSize <= 0) return;
      next = withValue(current, "skip", String(skip + pageSize));
    }

    const nextRun = commit(read, next, nextRunId());
    if (!nextRun) return;
    setHistory((previous) => [...previous, committed]);
    setDraft(next);
    setCommitted(nextRun);
  }

  function previousPage() {
    const previous = history.at(-1);
    if (!previous) return;
    setHistory(history.slice(0, -1));
    setDraft(previous.draft);
    setCommitted(previous);
  }

  return {
    draft,
    built,
    committed,
    showErrors,
    pageIndex: history.length,
    canGoBack: history.length > 0,
    setValue,
    addField,
    removeField,
    run,
    reset,
    nextPage,
    previousPage,
  };
}
