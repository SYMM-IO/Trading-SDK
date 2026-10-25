"use client";

import { Badge } from "@symmio/ui/components/badge";
import { Button } from "@symmio/ui/components/button";
import { Popover, PopoverContent, PopoverTrigger } from "@symmio/ui/components/popover";
import { useState } from "react";
import { FieldInput } from "./field-inputs";
import { deploymentAddress, emptyValue, type DeploymentAddresses, type DraftValue, type FormDraft } from "./form-draft";
import type { FieldKind, FieldSpec } from "./read-catalog";

const KIND_LABELS: Record<FieldKind, string> = {
  address: "address",
  "address-list": "address list",
  "hash-list": "tx hash list",
  "id-list": "id list",
  "market-list": "market list",
  "enum-list": "one or more",
  enum: "one of",
  time: "unix seconds",
  integer: "integer",
  text: "text",
};

interface Props {
  title: "Filters" | "Params";
  /** The card's DOM id. Every input id is namespaced by it, since each read's card sits on the one page. */
  cardId: string;
  /** The read's fields of this section, in catalog order. */
  fields: readonly FieldSpec[];
  draft: FormDraft;
  /** Per-field reasons the last Run was refused, when it was. */
  errors?: Readonly<Record<string, string>>;
  onValueChange: (key: string, value: DraftValue) => void;
  onAdd: (key: string) => void;
  onRemove: (key: string) => void;
  deployment?: DeploymentAddresses;
}

/**
 * One section of the form: a row per field on it, each removable unless the
 * hook requires it, and an "Add" menu of the section's fields that are not on
 * it yet, each with what the SDK does without it. A removed field is not sent.
 */
export function FilterBuilder({
  title,
  cardId,
  fields,
  draft,
  errors,
  onValueChange,
  onAdd,
  onRemove,
  deployment,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const section = title.toLowerCase();
  const active = draft.fields
    .map((key) => fields.find((field) => field.key === key))
    .filter((field): field is FieldSpec => field !== undefined);
  const available = fields.filter((field) => !draft.fields.includes(field.key));

  if (fields.length === 0) return null;

  return (
    <div className="flex flex-col gap-3" data-testid={`subgraph-${section}`}>
      <div className="text-muted-foreground text-xs font-medium tracking-[0.18em] uppercase">{title}</div>

      {active.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          {title === "Filters" ? "No filters: every row the subgraph holds." : "No params: SDK defaults."}
        </p>
      ) : null}

      {active.map((field) => {
        const error = errors?.[field.key];
        const idPrefix = `${cardId}-field-${field.key}`;
        return (
          <div
            key={field.key}
            data-testid={idPrefix}
            className="border-border/60 flex flex-col gap-2 rounded-lg border px-3 py-2.5"
          >
            <div className="flex items-center gap-2">
              <label htmlFor={idPrefix} className="font-mono text-sm font-medium">
                {field.key}
              </label>
              <span className="text-muted-foreground text-xs">{KIND_LABELS[field.kind]}</span>
              {field.required ? <Badge variant="secondary">required</Badge> : null}
              {field.required ? null : (
                <Button
                  type="button"
                  size="xs"
                  variant="ghost"
                  className="ml-auto size-6 px-0"
                  aria-label={`Remove ${field.key}`}
                  data-testid={`${idPrefix}-remove`}
                  onClick={() => onRemove(field.key)}
                >
                  ✕
                </Button>
              )}
            </div>
            <FieldInput
              field={field}
              value={draft.values[field.key] ?? emptyValue(field)}
              onChange={(value) => onValueChange(field.key, value)}
              idPrefix={idPrefix}
              invalid={error !== undefined}
              deploymentAddress={deploymentAddress(field, deployment)}
            />
            {field.hint ? <p className="text-muted-foreground text-xs leading-5">{field.hint}</p> : null}
            {error ? (
              <p className="text-destructive text-xs" data-testid={`${idPrefix}-error`}>
                {error}
              </p>
            ) : null}
          </div>
        );
      })}

      {available.length > 0 ? (
        <Popover open={menuOpen} onOpenChange={setMenuOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="self-start"
              data-testid={`subgraph-add-${section === "filters" ? "filter" : "param"}`}
            >
              + Add {title === "Filters" ? "filter" : "param"}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="flex w-72 flex-col gap-0.5 p-1">
            {available.map((field) => (
              <button
                key={field.key}
                type="button"
                data-testid={`subgraph-add-${field.key}`}
                className="hover:bg-accent focus-visible:bg-accent flex flex-col items-start rounded-md px-2 py-1.5 text-left outline-none"
                onClick={() => {
                  onAdd(field.key);
                  setMenuOpen(false);
                }}
              >
                <span className="font-mono text-sm">{field.key}</span>
                <span className="text-muted-foreground text-xs">
                  {KIND_LABELS[field.kind]}
                  {field.defaultHint ? ` · default ${field.defaultHint}` : ""}
                </span>
              </button>
            ))}
          </PopoverContent>
        </Popover>
      ) : null}
    </div>
  );
}
