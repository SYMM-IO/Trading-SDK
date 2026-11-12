"use client";

import { Field } from "@/components/field";
import { Combobox } from "@symmio/ui/components/combobox";
import { DateTimePicker } from "@symmio/ui/components/date-time-picker";
import { formatRelativeTimestamp } from "@symmio/utils";
import { isAddress, type Address, type Hex } from "viem";
import { toDelegateeComboboxItems, type InstantLayerDelegateeSuggestion } from "./instant-layer-delegatees";
import { SelectorIcon, WalletIcon } from "./instant-layer-icons";
import { formatSelectorList, parseSelectorTokens, useSelectorComboboxItems } from "./instant-layer-selectors";

/** One delegate of a grant as its fields hold it, before it parses. */
export interface GrantDelegateDraft {
  delegatedSigner: string;
  selectorsInput: string;
  expiryTimestamp: string;
}

/** A {@link GrantDelegateDraft} that parses: who may sign, which selectors, until when. */
export interface GrantDelegate {
  delegatedSigner: Address;
  selectors: readonly Hex[];
  expiryTimestamp: bigint;
}

/** A delegate with every field still empty. */
export const EMPTY_GRANT_DELEGATE: GrantDelegateDraft = {
  delegatedSigner: "",
  selectorsInput: "",
  expiryTimestamp: "",
};

/**
 * Parse one delegate's fields.
 *
 * @param draft - The fields as typed.
 * @returns The delegate, or `undefined` while any field is empty or invalid.
 */
export function parseGrantDelegate(draft: GrantDelegateDraft): GrantDelegate | undefined {
  const selectors = parseSelectors(draft.selectorsInput);
  const expiryTimestamp = parseExpiryTimestamp(draft.expiryTimestamp);
  if (!isAddress(draft.delegatedSigner) || !selectors || !expiryTimestamp) return undefined;
  return { delegatedSigner: draft.delegatedSigner, selectors, expiryTimestamp };
}

interface Props {
  /** Prefix of every field id, so several delegates can share a page. */
  idPrefix: string;
  value: GrantDelegateDraft;
  onChange: (next: GrantDelegateDraft) => void;
  /** Known delegates the signer field offers. */
  suggestions: readonly InstantLayerDelegateeSuggestion[];
}

/**
 * The three fields of one delegation — `delegatedSigner`, `selectors` and
 * `expiryTimestamp` — with the delegatee and selector pickers and the expiry
 * quick-set chips.
 */
export function GrantDelegateFields({ idPrefix, value, onChange, suggestions }: Props) {
  const validSigner = isAddress(value.delegatedSigner) ? value.delegatedSigner : undefined;
  const selectors = parseSelectors(value.selectorsInput);
  const expiry = parseExpiryTimestamp(value.expiryTimestamp);
  const selectorItems = useSelectorComboboxItems(parseSelectorTokens(value.selectorsInput));

  return (
    <>
      <Field label="delegatedSigner" htmlFor={`${idPrefix}-signer-field`}>
        <Combobox
          idPrefix={`${idPrefix}-signer`}
          value={value.delegatedSigner}
          onValueChange={(delegatedSigner) => onChange({ ...value, delegatedSigner })}
          onSelect={(item) => onChange({ ...value, delegatedSigner: item.id })}
          items={toDelegateeComboboxItems(suggestions, validSigner)}
          placeholder="0x…"
          mono
          invalid={value.delegatedSigner.length > 0 && !validSigner}
          triggerIcon={<WalletIcon />}
          triggerLabel="Browse delegatees"
        />
      </Field>

      <Field
        label="selectors"
        htmlFor={`${idPrefix}-selectors-field`}
        hint="Comma or space separated bytes4 selectors, for example 0x12345678, 0xabcdef12."
      >
        <Combobox
          idPrefix={`${idPrefix}-selectors`}
          mode="multiple"
          value={value.selectorsInput}
          onValueChange={(selectorsInput) => onChange({ ...value, selectorsInput })}
          onSelect={(item) => {
            const picked = item.id.toLowerCase();
            const tokens = parseSelectorTokens(value.selectorsInput);
            const next = tokens.some((token) => token.toLowerCase() === picked)
              ? tokens.filter((token) => token.toLowerCase() !== picked)
              : [...tokens, item.id];
            onChange({ ...value, selectorsInput: formatSelectorList(next) });
          }}
          items={selectorItems}
          placeholder="0x12345678, 0xabcdef12"
          mono
          invalid={value.selectorsInput.length > 0 && !selectors}
          triggerIcon={<SelectorIcon />}
          triggerLabel="Browse selectors"
        />
      </Field>

      <Field
        label="expiryTimestamp"
        htmlFor={`${idPrefix}-expiry-field`}
        hint={expiry ? `Unix timestamp in seconds. ${formatExpiryTimestamp(expiry)}.` : "Unix timestamp in seconds."}
      >
        <DateTimePicker
          idPrefix={`${idPrefix}-expiry`}
          value={value.expiryTimestamp}
          onValueChange={(expiryTimestamp) => onChange({ ...value, expiryTimestamp })}
          date={expiry ? new Date(Number(expiry) * 1000) : undefined}
          onDateChange={(next) => onChange({ ...value, expiryTimestamp: Math.floor(next.getTime() / 1000).toString() })}
          placeholder="1767225600"
          inputMode="numeric"
          mono
          invalid={value.expiryTimestamp.length > 0 && !expiry}
          fromDate={startOfToday()}
          footer={
            <ExpiryPresets
              testIdPrefix={`button-${idPrefix}-expiry-preset`}
              onPick={(seconds) => onChange({ ...value, expiryTimestamp: seconds.toString() })}
            />
          }
        />
      </Field>
    </>
  );
}

const EXPIRY_PRESETS = [
  { label: "1 day", days: 1 },
  { label: "1 week", days: 7 },
  { label: "1 month", days: 30 },
  { label: "3 months", days: 90 },
] as const;

const SECONDS_PER_DAY = 86_400;

/** Quick-set chips that fill the expiry with "now + N days", in unix seconds. */
function ExpiryPresets({ testIdPrefix, onPick }: { testIdPrefix: string; onPick: (seconds: number) => void }) {
  return (
    <div className="space-y-2">
      <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Quick set</span>
      <div className="flex flex-wrap gap-1.5">
        {EXPIRY_PRESETS.map((preset) => (
          <button
            key={preset.label}
            type="button"
            data-testid={`${testIdPrefix}-${preset.days}`}
            onClick={() => onPick(Math.floor(Date.now() / 1000) + preset.days * SECONDS_PER_DAY)}
            className="border-border bg-background hover:bg-muted/60 focus-visible:ring-ring/40 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors outline-none focus-visible:ring-2"
          >
            {preset.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function parseSelectors(value: string): readonly Hex[] | undefined {
  const tokens = parseSelectorTokens(value);
  if (tokens.length === 0 || tokens.some((token) => !/^0x[0-9a-fA-F]{8}$/.test(token))) {
    return undefined;
  }
  return tokens as Hex[];
}

function parseExpiryTimestamp(value: string): bigint | undefined {
  const trimmed = value.trim();
  if (!/^[0-9]+$/.test(trimmed)) return undefined;
  const parsed = BigInt(trimmed);
  return parsed > 0n ? parsed : undefined;
}

function formatExpiryTimestamp(timestamp: bigint): string {
  return formatRelativeTimestamp(timestamp, {
    nowLabel: "expires now",
    formatFuture: (duration) => `expires in ${duration}`,
    formatPast: (duration) => `expired ${duration} ago`,
  });
}
