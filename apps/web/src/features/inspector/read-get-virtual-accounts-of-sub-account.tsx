"use client";

import { AddressTag } from "@/components/address-tag";
import { BoolBadge } from "@/components/bool-badge";
import { Field } from "@/components/field";
import { ResultError, ResultNote } from "@/components/result";
import { TableSkeleton } from "@/components/skeletons";
import { useMarkets, useVirtualAccountsOfSubAccount } from "@symmio/trading-react";
import { Badge } from "@symmio/ui/components/badge";
import { Button } from "@symmio/ui/components/button";
import { Input } from "@symmio/ui/components/input";
import { Spinner } from "@symmio/ui/components/spinner";
import { useMemo, useState } from "react";
import { isAddress } from "viem";
import { MethodCard } from "./method-card";
import { SubAccountField } from "./subaccount-field";
import { labelForIsolation } from "./virtual-account-isolation";

/** The AccountLayer's page size when `limit` is left out. */
const DEFAULT_LIMIT = "200";

/**
 * Caps the result table at five rows: the uppercase header (36px) plus five
 * 41px rows. Anything beyond that scrolls under the sticky header.
 */
const MAX_ROWS_HEIGHT = "max-h-[241px]";

/**
 * Card for `getVirtualAccountsOfSubAccount`: a subaccount's Virtual Accounts
 * with their details — market, isolation type, existence — in one AccountLayer
 * call, where the addresses read needs a second call per VA. `offset` and
 * `limit` page past the default 200; the count card says how many there are.
 */
export function ReadGetVirtualAccountsOfSubAccount() {
  const [input, setInput] = useState<string>("");
  const [offsetText, setOffsetText] = useState<string>("");
  const [limitText, setLimitText] = useState<string>("");
  const validSubAccount = isAddress(input) ? input : undefined;
  const offset = parseIndex(offsetText);
  const limit = parseIndex(limitText);
  const ready = validSubAccount !== undefined && offset !== null && limit !== null;

  const query = useVirtualAccountsOfSubAccount({
    subAccount: validSubAccount,
    offset: offset ?? undefined,
    limit: limit ?? undefined,
    query: { enabled: false },
  });

  return (
    <MethodCard
      testId="method-getVirtualAccountsOfSubAccount"
      name="getVirtualAccountsOfSubAccount"
      mutability="view"
      description="List a subaccount's Virtual Accounts (VAs) with their market, isolation type and status in one call."
      wide
    >
      <SubAccountField
        idPrefix="va-details-subaccount"
        label="subAccount (subaccount address)"
        value={input}
        onValueChange={setInput}
        invalid={input.length > 0 && !validSubAccount}
      />

      <div className="grid grid-cols-2 gap-3">
        <Field label="offset" htmlFor="va-details-offset" hint="Optional. Defaults to 0.">
          <Input
            id="va-details-offset"
            value={offsetText}
            onChange={(event) => setOffsetText(event.target.value)}
            inputMode="numeric"
            placeholder="0"
            className="font-mono"
            aria-invalid={offset === null}
            data-testid="input-va-details-offset"
          />
        </Field>
        <Field label="limit" htmlFor="va-details-limit" hint={`Optional. Defaults to ${DEFAULT_LIMIT}.`}>
          <Input
            id="va-details-limit"
            value={limitText}
            onChange={(event) => setLimitText(event.target.value)}
            inputMode="numeric"
            placeholder={DEFAULT_LIMIT}
            className="font-mono"
            aria-invalid={limit === null}
            data-testid="input-va-details-limit"
          />
        </Field>
      </div>

      <Button
        type="button"
        size="sm"
        disabled={!ready || query.isFetching}
        onClick={() => void query.refetch()}
        data-testid="button-read-va-details"
      >
        {query.isFetching ? (
          <>
            <Spinner className="size-4" /> Reading…
          </>
        ) : (
          "Read"
        )}
      </Button>

      <ResultPanel testId="result-getVirtualAccountsOfSubAccount" query={query} />
    </MethodCard>
  );
}

/**
 * Parse an optional pagination field.
 *
 * @returns `undefined` when blank (the contract default applies), `null` when
 *   the text is not a non-negative integer.
 */
function parseIndex(text: string): bigint | null | undefined {
  const trimmed = text.trim();
  if (trimmed.length === 0) return undefined;
  return /^[0-9]+$/.test(trimmed) ? BigInt(trimmed) : null;
}

function ResultPanel({ testId, query }: { testId: string; query: ReturnType<typeof useVirtualAccountsOfSubAccount> }) {
  const markets = useMarkets();
  /** Market symbols by `symbolId`, so a row names its market instead of only its id. */
  const symbols = useMemo(
    () => new Map((markets.data ?? []).map((market) => [String(market.symbolId), market.symbol || market.name])),
    [markets.data],
  );

  if (query.isLoading) {
    return <TableSkeleton rows={4} columns={4} alignEndFrom={3} testId={`${testId}-loading`} />;
  }
  if (query.error) {
    return <ResultError testId={`${testId}-error`} kind={query.error.kind} message={query.error.message} />;
  }
  if (!query.data) {
    return <ResultNote testId={`${testId}-idle`}>Run the read to see the subaccount’s virtual accounts.</ResultNote>;
  }
  if (query.data.length === 0) {
    return <ResultNote testId={`${testId}-empty`}>No virtual accounts in this range.</ResultNote>;
  }
  return (
    <div data-testid={`${testId}-data`} className="border-border/70 overflow-hidden rounded-xl border">
      <div className={`${MAX_ROWS_HEIGHT} overflow-auto`}>
        <table className="w-full border-collapse text-sm">
          <thead className="bg-card sticky top-0 z-10">
            <tr className="bg-muted/40 text-muted-foreground text-left text-xs font-medium tracking-wide uppercase">
              <th className="px-3 py-2.5">Virtual account</th>
              <th className="px-3 py-2.5">Market</th>
              <th className="px-3 py-2.5">Isolation</th>
              <th className="px-3 py-2.5 text-right">Exists</th>
            </tr>
          </thead>
          <tbody>
            {query.data.map((va) => (
              <tr
                key={va.accountAddress}
                data-account-address={va.accountAddress}
                className="border-border/60 hover:bg-muted/30 border-t transition-colors"
              >
                <td className="px-3 py-2.5">
                  <AddressTag address={va.accountAddress} />
                </td>
                <td className="px-3 py-2.5">
                  <span className="text-foreground">{symbols.get(va.symbolId.toString()) ?? "—"}</span>{" "}
                  <span className="text-muted-foreground font-mono text-xs">#{va.symbolId.toString()}</span>
                </td>
                <td className="px-3 py-2.5">
                  <Badge variant="secondary">{labelForIsolation(va.isolationType)}</Badge>
                </td>
                <td className="px-3 py-2.5 text-right">
                  <BoolBadge value={va.isExists} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
