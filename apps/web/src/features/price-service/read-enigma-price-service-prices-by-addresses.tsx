"use client";

import { ResultError, ResultNote } from "@/components/result";
import { useEnigmaPriceServicePricesByAddresses } from "@symm-frontier/react";
import { Button } from "@symm-frontier/ui/components/button";
import { Spinner } from "@symm-frontier/ui/components/spinner";
import { useState } from "react";
import { MethodCard } from "../inspector/method-card";
import { JsonResult } from "./json-result";
import { PriceServiceSymbolMultiSelect } from "./price-service-symbol-multi-select";

export function ReadEnigmaPriceServicePricesByAddresses() {
  const [addresses, setAddresses] = useState<string[]>([]);
  const tokenCount = addresses.length;
  const query = useEnigmaPriceServicePricesByAddresses({ addresses, query: { enabled: false } });

  return (
    <MethodCard
      testId="method-getEnigmaPriceServicePricesByAddresses"
      name="getEnigmaPriceServicePricesByAddresses"
      mutability="view"
      description="Fetch mark prices by comma-separated token addresses."
      wide
    >
      <PriceServiceSymbolMultiSelect
        idPrefix="input-enigma-price-service-prices-by-addresses"
        value={addresses}
        onValueChange={setAddresses}
        hint="Select symbols from price-service symbols info or paste comma-separated token addresses. Max 50 per request."
      />

      <Button
        type="button"
        size="sm"
        disabled={tokenCount === 0 || query.isFetching}
        onClick={() => void query.refetch()}
        data-testid="button-read-enigma-price-service-prices-by-addresses"
      >
        {query.isFetching ? (
          <>
            <Spinner className="size-4" /> Reading...
          </>
        ) : (
          "Read prices"
        )}
      </Button>

      <ResultPanel testId="result-getEnigmaPriceServicePricesByAddresses" query={query} />
    </MethodCard>
  );
}

function ResultPanel({
  testId,
  query,
}: {
  testId: string;
  query: ReturnType<typeof useEnigmaPriceServicePricesByAddresses>;
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
    return <ResultNote testId={`${testId}-idle`}>Enter token addresses and read prices.</ResultNote>;
  }

  if (Object.keys(query.data).length === 0) {
    return <ResultNote testId={`${testId}-empty`}>No prices returned.</ResultNote>;
  }

  return <JsonResult testId={`${testId}-data`} value={query.data} />;
}
