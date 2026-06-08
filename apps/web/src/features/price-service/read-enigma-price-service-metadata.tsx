"use client";

import { ResultError, ResultNote } from "@/components/result";
import { useEnigmaPriceServiceMetadata } from "@symm-frontier/react";
import { Button } from "@symm-frontier/ui/components/button";
import { Spinner } from "@symm-frontier/ui/components/spinner";
import { useState } from "react";
import { MethodCard } from "../inspector/method-card";
import { JsonResult } from "./json-result";
import { PriceServiceSymbolMultiSelect } from "./price-service-symbol-multi-select";

export function ReadEnigmaPriceServiceMetadata() {
  const [addresses, setAddresses] = useState<string[]>([]);
  const query = useEnigmaPriceServiceMetadata({ addresses, query: { enabled: false } });

  return (
    <MethodCard
      testId="method-getEnigmaPriceServiceMetadata"
      name="getEnigmaPriceServiceMetadata"
      mutability="view"
      description="Fetch token metadata by address array. The UI converts comma-separated input into an array for the hook."
      wide
    >
      <PriceServiceSymbolMultiSelect
        idPrefix="input-enigma-price-service-metadata-addresses"
        value={addresses}
        onValueChange={setAddresses}
        hint="Select symbols from price-service symbols info or paste comma-separated token addresses. The hook receives an array."
      />

      <Button
        type="button"
        size="sm"
        disabled={addresses.length === 0 || query.isFetching}
        onClick={() => void query.refetch()}
        data-testid="button-read-enigma-price-service-metadata"
      >
        {query.isFetching ? (
          <>
            <Spinner className="size-4" /> Reading...
          </>
        ) : (
          "Read metadata"
        )}
      </Button>

      <ResultPanel testId="result-getEnigmaPriceServiceMetadata" query={query} />
    </MethodCard>
  );
}

function ResultPanel({ testId, query }: { testId: string; query: ReturnType<typeof useEnigmaPriceServiceMetadata> }) {
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
    return <ResultNote testId={`${testId}-idle`}>Enter token addresses and read metadata.</ResultNote>;
  }

  if (Object.keys(query.data).length === 0) {
    return <ResultNote testId={`${testId}-empty`}>No metadata returned.</ResultNote>;
  }

  return <JsonResult testId={`${testId}-data`} value={query.data} />;
}
