"use client";

import { ResultError, ResultNote } from "@/components/result";
import { useEnigmaPriceServicePricesByNames } from "@theoldvarorg/react";
import { Button } from "@theoldvarorg/ui/components/button";
import { Spinner } from "@theoldvarorg/ui/components/spinner";
import { useState } from "react";
import { MethodCard } from "../inspector/method-card";
import { JsonResult } from "./json-result";
import { PriceServiceSymbolNameMultiSelect } from "./price-service-symbol-name-multi-select";

export function ReadEnigmaPriceServicePricesByNames() {
  const [names, setNames] = useState<string[]>([]);
  const nameCount = names.length;
  const query = useEnigmaPriceServicePricesByNames({ names, query: { enabled: false } });

  return (
    <MethodCard
      testId="method-getEnigmaPriceServicePricesByNames"
      name="getEnigmaPriceServicePricesByNames"
      mutability="view"
      description="Fetch mark prices by comma-separated market names."
      wide
    >
      <PriceServiceSymbolNameMultiSelect
        idPrefix="input-enigma-price-service-prices-by-names"
        value={names}
        onValueChange={setNames}
        hint="Select markets from price-service symbols info or paste comma-separated names. Max 50 per request."
      />

      <Button
        type="button"
        size="sm"
        disabled={nameCount === 0 || query.isFetching}
        onClick={() => void query.refetch()}
        data-testid="button-read-enigma-price-service-prices-by-names"
      >
        {query.isFetching ? (
          <>
            <Spinner className="size-4" /> Reading...
          </>
        ) : (
          "Read prices"
        )}
      </Button>

      <ResultPanel testId="result-getEnigmaPriceServicePricesByNames" query={query} />
    </MethodCard>
  );
}

function ResultPanel({
  testId,
  query,
}: {
  testId: string;
  query: ReturnType<typeof useEnigmaPriceServicePricesByNames>;
}) {
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
  if (!query.data) {
    return <ResultNote testId={`${testId}-idle`}>Select markets and read prices.</ResultNote>;
  }

  if (Object.keys(query.data).length === 0) {
    return <ResultNote testId={`${testId}-empty`}>No prices returned.</ResultNote>;
  }

  return <JsonResult testId={`${testId}-data`} value={query.data} />;
}
