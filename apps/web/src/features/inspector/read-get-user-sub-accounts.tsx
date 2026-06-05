"use client";

import { AddressTag } from "@/components/address-tag";
import { BoolBadge } from "@/components/bool-badge";
import { Field } from "@/components/field";
import { ResultError, ResultNote } from "@/components/result";
import { TableSkeleton } from "@/components/skeletons";
import { useUserSubAccounts, useWalletAccount } from "@symm-frontier/react";
import { Badge } from "@symm-frontier/ui/components/badge";
import { Button } from "@symm-frontier/ui/components/button";
import { Input } from "@symm-frontier/ui/components/input";
import { Spinner } from "@symm-frontier/ui/components/spinner";
import { shortenAddress } from "@symm-frontier/utils";
import { useState } from "react";
import type { Address } from "viem";
import { isAddress } from "viem";
import { MethodCard } from "./method-card";

export function ReadGetUserSubAccounts() {
  const { address } = useWalletAccount();
  const [input, setInput] = useState<string>("");

  const candidate = (input || address || "") as string;
  const validAddress = isAddress(candidate) ? (candidate as Address) : undefined;

  const query = useUserSubAccounts({ user: validAddress });

  return (
    <MethodCard
      testId="method-getUserSubAccounts"
      name="getUserSubAccounts"
      mutability="view"
      description="List a user's subaccounts on AccountLayer."
      wide
    >
      <Field
        label="user (address)"
        htmlFor="input-user-address"
        hint={
          validAddress
            ? `Reading subaccounts for ${shortenAddress(validAddress)}.`
            : "Enter a valid address (defaults to connected wallet)."
        }
      >
        <Input
          id="input-user-address"
          data-testid="input-user-address"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={address ?? "0x…"}
          className="font-mono"
          aria-invalid={candidate.length > 0 && !validAddress}
        />
      </Field>

      <Button
        type="button"
        size="sm"
        disabled={!validAddress || query.isFetching}
        onClick={() => void query.refetch()}
        data-testid="button-read-subaccounts"
      >
        {query.isFetching ? (
          <>
            <Spinner className="size-4" /> Reading…
          </>
        ) : (
          "Read"
        )}
      </Button>

      <ResultPanel testId="result-getUserSubAccounts" query={query} />
    </MethodCard>
  );
}

function ResultPanel({ testId, query }: { testId: string; query: ReturnType<typeof useUserSubAccounts> }) {
  if (query.isLoading) {
    return <TableSkeleton rows={4} columns={4} alignEndFrom={3} testId={`${testId}-loading`} />;
  }
  if (query.error) {
    return <ResultError testId={`${testId}-error`} kind={query.error.kind} message={query.error.message} />;
  }
  if (!query.data) {
    return <ResultNote testId={`${testId}-idle`}>Run the read to see subaccounts.</ResultNote>;
  }
  if (query.data.length === 0) {
    return <ResultNote testId={`${testId}-empty`}>No subaccounts found for this address.</ResultNote>;
  }
  return (
    <div data-testid={`${testId}-data`} className="border-border/70 overflow-hidden rounded-xl border">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-muted/40 text-muted-foreground text-left text-xs font-medium tracking-wide uppercase">
              <th className="px-3 py-2.5">Account</th>
              <th className="px-3 py-2.5">Name</th>
              <th className="px-3 py-2.5">Isolation</th>
              <th className="px-3 py-2.5 text-right">Exists</th>
            </tr>
          </thead>
          <tbody>
            {query.data.map((sub) => (
              <tr
                key={sub.accountAddress}
                data-account-address={sub.accountAddress}
                className="border-border/60 hover:bg-muted/30 border-t transition-colors"
              >
                <td className="px-3 py-2.5">
                  <AddressTag address={sub.accountAddress} />
                </td>
                <td className="text-foreground px-3 py-2.5">
                  {sub.name || <span className="text-muted-foreground">—</span>}
                </td>
                <td className="px-3 py-2.5">
                  <Badge variant="secondary">{String(sub.isolationType)}</Badge>
                </td>
                <td className="px-3 py-2.5 text-right">
                  <BoolBadge value={sub.isExists} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
