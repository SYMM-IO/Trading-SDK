"use client";

import { Field } from "@/components/field";
import { ResultError } from "@/components/result";
import { useEnigmaPriceServiceSymbolsInfo } from "@symm-frontier/react";
import { Combobox, type ComboboxItem } from "@symm-frontier/ui/components/combobox";
import { useMemo } from "react";
import { parseAddressList } from "./price-service-utils";

interface Props {
  idPrefix: string;
  value: readonly string[];
  onValueChange: (addresses: string[]) => void;
  hint?: string;
}

/** Multi-select token address picker backed by the Enigma price-service symbols endpoint. */
export function PriceServiceSymbolMultiSelect({ idPrefix, value, onValueChange, hint }: Props) {
  const symbolsQuery = useEnigmaPriceServiceSymbolsInfo({ query: { staleTime: 60_000 } });
  const selected = useMemo(() => new Set(value.map((address) => address.toLowerCase())), [value]);
  const items = useMemo(() => {
    const symbols = [...(symbolsQuery.data ?? [])].sort((a, b) => a.name.localeCompare(b.name));
    return symbols.map(
      (symbol): ComboboxItem => ({
        id: symbol.address,
        title: symbol.name,
        description: symbol.status,
        meta: symbol.address,
        selected: selected.has(symbol.address.toLowerCase()),
      }),
    );
  }, [selected, symbolsQuery.data]);

  function handleTypedValue(nextValue: string) {
    onValueChange(parseAddressList(nextValue));
  }

  function handleSelect(item: ComboboxItem) {
    const exists = selected.has(item.id.toLowerCase());
    onValueChange(
      exists ? value.filter((address) => address.toLowerCase() !== item.id.toLowerCase()) : [...value, item.id],
    );
  }

  return (
    <Field
      label="token addresses"
      htmlFor={`${idPrefix}-field`}
      hint={hint ?? "Search symbols from price-service symbols info or paste comma-separated token addresses."}
    >
      <Combobox
        idPrefix={idPrefix}
        value={value.join(",")}
        onValueChange={handleTypedValue}
        onSelect={handleSelect}
        items={items}
        mode="multiple"
        searchable
        onReload={() => void symbolsQuery.refetch()}
        reloadPending={symbolsQuery.isFetching}
        reloadLabel="Reload symbols"
        mono
        placeholder={symbolsQuery.isLoading ? "Loading price-service symbols..." : "Search or paste token addresses..."}
        searchPlaceholder="Search symbol or address..."
        emptyLabel={symbolsQuery.isLoading ? "Loading symbols..." : "No symbols loaded."}
        emptyResultsLabel="No symbols match this search."
        selectedLabel="Selected token"
      />

      {symbolsQuery.error ? (
        <ResultError
          kind={symbolsQuery.error.kind}
          message={symbolsQuery.error.message}
          testId={`${idPrefix}-symbols-error`}
        />
      ) : null}

      <p className="text-muted-foreground text-xs">
        {value.length} selected{symbolsQuery.data ? ` · ${symbolsQuery.data.length} symbols loaded` : ""}
      </p>
    </Field>
  );
}
