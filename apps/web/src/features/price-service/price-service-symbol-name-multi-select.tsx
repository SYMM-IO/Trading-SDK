"use client";

import { Field } from "@/components/field";
import { ResultError } from "@/components/result";
import { useEnigmaPriceServiceSymbolsInfo } from "@theoldvarorg/react";
import { Button } from "@theoldvarorg/ui/components/button";
import { Combobox, type ComboboxItem } from "@theoldvarorg/ui/components/combobox";
import { Spinner } from "@theoldvarorg/ui/components/spinner";
import { useMemo } from "react";
import { parseAddressList } from "./price-service-utils";

interface Props {
  idPrefix: string;
  value: readonly string[];
  onValueChange: (names: string[]) => void;
  hint?: string;
}

/** Multi-select symbol-name picker backed by the Enigma price-service symbols endpoint. */
export function PriceServiceSymbolNameMultiSelect({ idPrefix, value, onValueChange, hint }: Props) {
  const symbolsQuery = useEnigmaPriceServiceSymbolsInfo({ query: { staleTime: 60_000 } });
  const selected = useMemo(() => new Set(value.map((name) => name.toLowerCase())), [value]);
  const items = useMemo(() => {
    const symbols = [...(symbolsQuery.data ?? [])].sort((a, b) => a.name.localeCompare(b.name));
    return symbols.map(
      (symbol): ComboboxItem => ({
        id: symbol.name,
        title: symbol.name,
        description: symbol.status,
        meta: symbol.address,
        selected: selected.has(symbol.name.toLowerCase()),
      }),
    );
  }, [selected, symbolsQuery.data]);

  function handleTypedValue(nextValue: string) {
    onValueChange(parseAddressList(nextValue));
  }

  function handleSelect(item: ComboboxItem) {
    const exists = selected.has(item.id.toLowerCase());
    onValueChange(exists ? value.filter((name) => name.toLowerCase() !== item.id.toLowerCase()) : [...value, item.id]);
  }

  return (
    <Field
      label="symbol names"
      htmlFor={`${idPrefix}-field`}
      hint={hint ?? "Search symbols from price-service symbols info or paste comma-separated names."}
      action={
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={symbolsQuery.isFetching}
          onClick={() => void symbolsQuery.refetch()}
        >
          {symbolsQuery.isFetching ? <Spinner className="size-4" /> : "Reload"}
        </Button>
      }
    >
      <Combobox
        idPrefix={idPrefix}
        value={value.join(",")}
        onValueChange={handleTypedValue}
        onSelect={handleSelect}
        items={items}
        mode="multiple"
        searchable
        mono
        placeholder={symbolsQuery.isLoading ? "Loading price-service symbols..." : "Search or paste symbol names..."}
        searchPlaceholder="Search symbol name..."
        emptyLabel={symbolsQuery.isLoading ? "Loading symbols..." : "No symbols loaded."}
        emptyResultsLabel="No symbols match this search."
        selectedLabel="Selected name"
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
