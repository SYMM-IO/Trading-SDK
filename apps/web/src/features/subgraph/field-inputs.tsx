"use client";

import { PartyAField } from "@/features/inspector/party-a-field";
import { SubAccountField } from "@/features/inspector/subaccount-field";
import { VirtualAccountField } from "@/features/inspector/virtual-account-field";
import { useMarkets } from "@symmio/trading-react";
import { Button } from "@symmio/ui/components/button";
import { DateTimePicker } from "@symmio/ui/components/date-time-picker";
import { Input } from "@symmio/ui/components/input";
import { MarketSelect, type MarketSelectItem } from "@symmio/ui/components/market-select";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@symmio/ui/components/select";
import { cn } from "@symmio/ui/lib/utils";
import { useMemo, useState } from "react";
import { isAddress } from "viem";
import { parseListItem, type DraftValue } from "./form-draft";
import { appendItems, ListInput } from "./list-input";
import type { FieldSpec } from "./read-catalog";

interface Props {
  field: FieldSpec;
  value: DraftValue;
  onChange: (value: DraftValue) => void;
  /** Namespaces the input ids and `data-testid`s. */
  idPrefix: string;
  invalid?: boolean;
  /** For `source`: this deployment's address of the contract the entity is indexed from, offered in one click. */
  deploymentAddress?: string;
}

/** The input for one field, picked by its kind. Hands back draft text; parsing happens on Run. */
export function FieldInput({ field, value, onChange, idPrefix, invalid, deploymentAddress }: Props) {
  const text = typeof value === "string" ? value : "";
  const items = Array.isArray(value) ? value : [];

  switch (field.kind) {
    case "address":
      return (
        <div className="flex gap-2">
          <Input
            id={idPrefix}
            data-testid={`${idPrefix}-input`}
            value={text}
            onChange={(event) => onChange(event.target.value)}
            placeholder="0x…"
            className="font-mono"
            aria-invalid={invalid}
          />
          {deploymentAddress ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 shrink-0"
              disabled={text.toLowerCase() === deploymentAddress.toLowerCase()}
              onClick={() => onChange(deploymentAddress)}
              data-testid={`${idPrefix}-this-deployment`}
            >
              This deployment
            </Button>
          ) : null}
        </div>
      );
    case "address-list":
      return (
        <ListInput testId={idPrefix} items={items} onItemsChange={onChange}>
          <AddressAdder
            field={field}
            idPrefix={idPrefix}
            items={items}
            onAdd={(added) => onChange(appendItems(items, added))}
          />
        </ListInput>
      );
    case "hash-list":
    case "id-list":
      return (
        <ListInput testId={idPrefix} items={items} onItemsChange={onChange}>
          <TextAdder field={field} idPrefix={idPrefix} onAdd={(added) => onChange(appendItems(items, added))} />
        </ListInput>
      );
    case "market-list":
      return <MarketListInput idPrefix={idPrefix} items={items} onChange={onChange} />;
    case "enum-list":
      return (
        <div className="flex flex-wrap gap-1.5" data-testid={`${idPrefix}-options`} aria-invalid={invalid}>
          {field.options?.map((option) => {
            const on = items.includes(option.value);
            return (
              <Button
                key={option.value}
                type="button"
                size="xs"
                variant={on ? "default" : "outline"}
                aria-pressed={on}
                className="font-mono"
                data-testid={`${idPrefix}-option-${option.value}`}
                onClick={() => onChange(on ? items.filter((item) => item !== option.value) : [...items, option.value])}
              >
                {option.label}
              </Button>
            );
          })}
        </div>
      );
    case "enum":
      return (
        <Select value={text} onValueChange={onChange}>
          <SelectTrigger id={idPrefix} data-testid={`${idPrefix}-select`} aria-invalid={invalid}>
            <SelectValue placeholder={field.defaultHint ? `${field.defaultHint} (default)` : "Pick one"} />
          </SelectTrigger>
          <SelectContent>
            {field.options?.map((option) => (
              <SelectItem key={option.value} value={option.value} data-testid={`${idPrefix}-option-${option.value}`}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    case "time":
      return (
        <div className="flex flex-col gap-1">
          <DateTimePicker
            idPrefix={idPrefix}
            value={text}
            onValueChange={onChange}
            date={/^\d+$/.test(text) ? new Date(Number(text) * 1000) : undefined}
            onDateChange={(date) => onChange(String(Math.floor(date.getTime() / 1000)))}
            placeholder={`unix seconds · ${field.defaultHint ?? "unset"}`}
            invalid={invalid}
            mono
            inputMode="numeric"
          />
          {/^\d+$/.test(text) ? (
            <span className="text-muted-foreground font-mono text-xs">
              {new Date(Number(text) * 1000).toISOString()}
            </span>
          ) : null}
        </div>
      );
    default:
      return (
        <Input
          id={idPrefix}
          data-testid={`${idPrefix}-input`}
          value={text}
          onChange={(event) => onChange(event.target.value)}
          placeholder={field.defaultHint ? `${field.defaultHint} (default)` : undefined}
          inputMode={field.kind === "integer" ? "numeric" : undefined}
          className={cn(field.kind !== "text" && "font-mono")}
          aria-invalid={invalid}
        />
      );
  }
}

/**
 * Paste box for hashes and ids. Several entries can be pasted at once, split on
 * spaces, commas or new lines; the valid ones join the list and any invalid ones
 * stay in the box with the reason.
 */
function TextAdder({
  field,
  idPrefix,
  onAdd,
}: {
  field: FieldSpec;
  idPrefix: string;
  onAdd: (items: readonly string[]) => void;
}) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string>();

  function add() {
    const entries = text.split(/[\s,]+/).filter(Boolean);
    const added: string[] = [];
    const rejected: string[] = [];
    let reason: string | undefined;
    for (const entry of entries) {
      const parsed = parseListItem(field, entry);
      if ("item" in parsed) added.push(parsed.item);
      else {
        rejected.push(entry);
        reason = parsed.error;
      }
    }
    if (added.length > 0) onAdd(added);
    setText(rejected.join(" "));
    setError(reason ? `${rejected.join(", ")}: ${reason}` : undefined);
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex gap-2">
        <Input
          id={idPrefix}
          data-testid={`${idPrefix}-input`}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            add();
          }}
          placeholder={field.kind === "hash-list" ? "0x… (Enter to add)" : "e.g. 7334 (Enter to add)"}
          inputMode={field.kind === "id-list" ? "numeric" : undefined}
          className="font-mono"
          aria-invalid={error !== undefined}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 shrink-0"
          disabled={text.trim() === ""}
          onClick={add}
          data-testid={`${idPrefix}-add`}
        >
          Add
        </Button>
      </div>
      {error ? <span className="text-destructive text-xs">{error}</span> : null}
    </div>
  );
}

/**
 * Address entry for an `address-list`: the account picker the field names
 * (subaccounts, VAs, or both), or a paste box. A picked or fully pasted address
 * joins the list, the same draft-then-append flow the open-positions batch card uses.
 */
function AddressAdder({
  field,
  idPrefix,
  items,
  onAdd,
}: {
  field: FieldSpec;
  idPrefix: string;
  items: readonly string[];
  onAdd: (items: readonly string[]) => void;
}) {
  const [draft, setDraft] = useState("");

  function onDraftChange(value: string) {
    if (isAddress(value)) {
      onAdd([value]);
      setDraft("");
      return;
    }
    setDraft(value);
  }

  const shared = {
    idPrefix,
    label: "Pick or paste an account",
    value: draft,
    onValueChange: onDraftChange,
    invalid: draft.length > 0 && !isAddress(draft),
  };

  switch (field.picker) {
    case "party-a":
      return <PartyAField {...shared} selectedAddresses={items} />;
    case "sub-account":
      return <SubAccountField {...shared} />;
    case "virtual-account":
      return <VirtualAccountField {...shared} />;
    default:
      return <TextAdder field={field} idPrefix={idPrefix} onAdd={onAdd} />;
  }
}

/** Markets by id from the connected solver; chips show the symbol beside the id. */
function MarketListInput({
  idPrefix,
  items,
  onChange,
}: {
  idPrefix: string;
  items: readonly string[];
  onChange: (items: readonly string[]) => void;
}) {
  const marketsQuery = useMarkets();
  const markets = useMemo(() => marketsQuery.data ?? [], [marketsQuery.data]);
  const marketItems = useMemo<MarketSelectItem[]>(
    () =>
      markets.map((market) => {
        const id = String(market.symbolId);
        return {
          id,
          label: market.symbol || market.name || `Market ${id}`,
          meta: `ID ${id}`,
          searchText: [id, market.symbol, market.name].filter(Boolean).join(" "),
        };
      }),
    [markets],
  );
  const labels = useMemo(
    () => new Map(markets.map((market) => [String(market.symbolId), market.symbol || market.name])),
    [markets],
  );

  return (
    <ListInput
      testId={idPrefix}
      items={items}
      onItemsChange={onChange}
      renderItem={(item) => (labels.get(item) ? `${item} · ${labels.get(item)}` : item)}
    >
      <div className="flex flex-col gap-2 sm:flex-row">
        <MarketSelect
          idPrefix={`${idPrefix}-market`}
          value=""
          items={marketItems}
          onValueChange={(id) => {
            if (id) onChange(appendItems(items, [id]));
          }}
          placeholder={marketsQuery.isLoading ? "Loading markets..." : "Add a market..."}
          disabled={marketsQuery.isLoading}
          searchPlaceholder="Search symbol, name, or ID..."
          emptyLabel="The solver lists no markets."
          emptyResultsLabel="No markets match this search."
          className="sm:flex-1"
        />
        <TextAdder
          field={{ key: "marketIds", kind: "market-list", section: "filter" }}
          idPrefix={`${idPrefix}-id`}
          onAdd={(added) => onChange(appendItems(items, added))}
        />
      </div>
    </ListInput>
  );
}
