"use client";

import { ResultError, ResultNote } from "@/components/result";
import { useEnigmaPriceServiceHealth } from "@symmio/trading-react";
import { Button } from "@symmio/ui/components/button";
import { Spinner } from "@symmio/ui/components/spinner";
import { MethodCard } from "../inspector/method-card";
import { JsonResult } from "./json-result";

export function ReadEnigmaPriceServiceHealth() {
  const query = useEnigmaPriceServiceHealth({ query: { enabled: false } });

  return (
    <MethodCard
      testId="method-getEnigmaPriceServiceHealth"
      name="getEnigmaPriceServiceHealth"
      mutability="view"
      description="Read the health endpoint from the configured Enigma price service."
      wide
    >
      <Button
        type="button"
        size="sm"
        disabled={query.isFetching}
        onClick={() => void query.refetch()}
        data-testid="button-read-enigma-price-service-health"
      >
        {query.isFetching ? (
          <>
            <Spinner className="size-4" /> Reading...
          </>
        ) : (
          "Read health"
        )}
      </Button>

      <ResultPanel testId="result-getEnigmaPriceServiceHealth" query={query} />
    </MethodCard>
  );
}

function ResultPanel({ testId, query }: { testId: string; query: ReturnType<typeof useEnigmaPriceServiceHealth> }) {
  if (query.isFetching) {
    return (
      <ResultNote testId={`${testId}-loading`} loading>
        Loading...
      </ResultNote>
    );
  }
  if (query.error) {
    return <ResultError testId={`${testId}-error`} kind={query.error.kind} message={query.error.message} />;
  }
  if (query.data === undefined) {
    return <ResultNote testId={`${testId}-idle`}>Click the button to read service health.</ResultNote>;
  }

  return <JsonResult testId={`${testId}-data`} value={query.data} />;
}
