"use client";

import { ResultWarning } from "@/components/result";
import { Badge } from "@symmio/ui/components/badge";
import { Button } from "@symmio/ui/components/button";
import { CopyButton } from "@symmio/ui/components/copy-button";
import { JsonView } from "@symmio/ui/components/json-view";
import { useCallback, useEffect, useState } from "react";
import { MethodCard } from "../inspector/method-card";
import { FilterBuilder } from "./filter-builder";
import { scalarValue, type DeploymentAddresses, type FormDraft } from "./form-draft";
import { readCardId, type ReadSpec } from "./read-catalog";
import { ReadRunner } from "./read-runner";
import { readHref, replaceReadUrl } from "./url-state";
import { useSubgraphForm } from "./use-subgraph-form";

interface Props {
  read: ReadSpec;
  initial: FormDraft;
  resetTo: FormDraft;
  runOnMount: boolean;
  chainId: number;
  /** The endpoint this read queries, or `undefined` when the chain configures none. */
  endpoint: string | undefined;
  deployment: DeploymentAddresses | undefined;
  collateralDecimals: number;
}

const SECTION_TITLE = "text-muted-foreground text-xs font-medium tracking-[0.18em] uppercase";

/**
 * One read's card: its form, the request it builds, and — once it has run — the
 * rows the last Run returned. Each card keeps its own form, so several reads can
 * be compared on the page at once; a Run points the address bar at its card.
 */
export function ReadCard({
  read,
  initial,
  resetTo,
  runOnMount,
  chainId,
  endpoint,
  deployment,
  collateralDecimals,
}: Props) {
  /** Stable, so the form's commit effect fires on a Run rather than on every render. */
  const onCommit = useCallback((draft: FormDraft) => replaceReadUrl(read, draft), [read]);
  const form = useSubgraphForm({ read, initial, resetTo, runOnMount, onCommit });
  const [copied, setCopied] = useState(false);
  const cardId = readCardId(read);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1400);
    return () => clearTimeout(timer);
  }, [copied]);

  const filters = read.fields.filter((field) => field.section === "filter");
  const params = read.fields.filter((field) => field.section === "param");
  const committed = form.committed;
  const errorCount = Object.keys(form.built.errors).length;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${readHref(read, form.draft)}`);
      setCopied(true);
    } catch {
      /* clipboard blocked: the link stays in the address bar after a Run */
    }
  }

  return (
    <MethodCard testId={cardId} name={read.id} mutability="view" description={read.summary} wide>
      <div
        className="flex min-w-0 flex-col gap-6"
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) form.run();
        }}
      >
        <div className="flex min-w-0 flex-wrap items-center gap-2 font-mono text-xs" data-testid="subgraph-endpoint">
          <Badge variant="outline" className="font-mono">
            {read.hook}
          </Badge>
          <span className="text-foreground shrink-0">
            chain {chainId} · {read.subgraph}
          </span>
          {endpoint ? (
            <span className="text-muted-foreground flex min-w-0 items-center gap-1.5">
              <span className="truncate" title={endpoint}>
                {endpoint}
              </span>
              <CopyButton value={endpoint} label="Copy subgraph URL" />
            </span>
          ) : null}
        </div>

        {endpoint ? null : (
          <ResultWarning testId="subgraph-endpoint-missing">
            Chain {chainId} configures no {read.subgraph} subgraph, so this read fails until one is set.
          </ResultWarning>
        )}

        <FilterBuilder
          title="Filters"
          cardId={cardId}
          fields={filters}
          draft={form.draft}
          errors={form.showErrors ? form.built.errors : undefined}
          onValueChange={form.setValue}
          onAdd={form.addField}
          onRemove={form.removeField}
          deployment={deployment}
        />
        <FilterBuilder
          title="Params"
          cardId={cardId}
          fields={params}
          draft={form.draft}
          errors={form.showErrors ? form.built.errors : undefined}
          onValueChange={form.setValue}
          onAdd={form.addField}
          onRemove={form.removeField}
        />

        <details className="group" data-testid="subgraph-request">
          <summary className={`${SECTION_TITLE} cursor-pointer`}>
            Request
            <span className="ml-2 tracking-normal normal-case">
              what Run passes to {read.hook}; chainId comes from the app
            </span>
          </summary>
          <div className="mt-2" data-testid="subgraph-request-json">
            <JsonView data={form.built.parameters} defaultExpandedDepth={2} />
          </div>
        </details>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" onClick={form.run} data-testid="subgraph-run">
            Run
          </Button>
          <Button type="button" variant="outline" onClick={form.reset} data-testid="subgraph-reset">
            Reset
          </Button>
          <Button type="button" variant="ghost" onClick={copyLink} data-testid="subgraph-copy-link">
            {copied ? "Copied" : "Copy link"}
          </Button>
          <span className="text-muted-foreground text-xs">⌘/Ctrl + Enter runs</span>
          {form.showErrors && errorCount > 0 ? (
            <span className="text-destructive text-xs" data-testid="subgraph-run-blocked">
              Fix {errorCount} field{errorCount === 1 ? "" : "s"} to run.
            </span>
          ) : null}
        </div>

        {committed ? (
          <div className="border-border/60 flex min-w-0 flex-col gap-3 border-t pt-5" data-testid="subgraph-results">
            <div className={SECTION_TITLE}>Results</div>
            <ReadRunner
              read={read}
              parameters={committed.parameters}
              runId={committed.runId}
              collateralDecimals={collateralDecimals}
              paging={
                read.defaultPageSize === undefined
                  ? undefined
                  : {
                      pageIndex: form.pageIndex,
                      canGoBack: form.canGoBack,
                      onPrevious: form.previousPage,
                      onNext: form.nextPage,
                      pageSize: Number(scalarValue(committed.draft, "first") || read.defaultPageSize),
                    }
              }
            />
          </div>
        ) : null}
      </div>
    </MethodCard>
  );
}
