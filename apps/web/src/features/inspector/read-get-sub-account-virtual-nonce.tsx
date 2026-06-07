"use client";

import { ResultError, ResultNote } from "@/components/result";
import { Stat } from "@/components/stat";
import { useSubAccountVirtualNonce } from "@symm-frontier/react";
import { Button } from "@symm-frontier/ui/components/button";
import { Spinner } from "@symm-frontier/ui/components/spinner";
import { useState } from "react";
import type { Address } from "viem";
import { isAddress } from "viem";
import { MethodCard } from "./method-card";
import { SubAccountField } from "./subaccount-field";

export function ReadGetSubAccountVirtualNonce() {
  const [input, setInput] = useState<string>("");
  const validAddress = isAddress(input) ? (input as Address) : undefined;

  const query = useSubAccountVirtualNonce({ subAccount: validAddress });

  return (
    <MethodCard
      testId="method-getSubAccountVirtualNonce"
      name="getSubAccountVirtualNonce"
      mutability="view"
      description="Read a subaccount's Virtual Account nonce (seeds the next VA address)."
    >
      <SubAccountField
        idPrefix="nonce-subaccount"
        label="subAccount (address)"
        value={input}
        onValueChange={setInput}
        invalid={input.length > 0 && !validAddress}
      />

      <Button
        type="button"
        size="sm"
        disabled={!validAddress || query.isFetching}
        onClick={() => void query.refetch()}
        data-testid="button-read-nonce"
      >
        {query.isFetching ? (
          <>
            <Spinner className="size-4" /> Reading…
          </>
        ) : (
          "Read"
        )}
      </Button>

      <ResultPanel testId="result-getSubAccountVirtualNonce" query={query} />
    </MethodCard>
  );
}

function ResultPanel({ testId, query }: { testId: string; query: ReturnType<typeof useSubAccountVirtualNonce> }) {
  if (query.isLoading) {
    return (
      <ResultNote testId={`${testId}-loading`} loading>
        Loading…
      </ResultNote>
    );
  }
  if (query.error) {
    return <ResultError testId={`${testId}-error`} kind={query.error.kind} message={query.error.message} />;
  }
  if (query.data === undefined) {
    return <ResultNote testId={`${testId}-idle`}>Enter a subaccount address and read.</ResultNote>;
  }
  return (
    <div data-testid={`${testId}-data`}>
      <Stat label="Virtual nonce" value={String(query.data)} />
    </div>
  );
}
