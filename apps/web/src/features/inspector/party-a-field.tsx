"use client";

import { Field } from "@/components/field";
import { ResultError, ResultNote } from "@/components/result";
import {
  useOnchainContractMarkets,
  useUserSubAccounts,
  useVirtualAccount,
  useVirtualAccountsAddressesOfSubAccount,
  useWalletAccount,
  VIRTUAL_ACCOUNT_ISOLATION_TYPE,
  type VirtualAccountIsolationType,
} from "@symmio/trading-react";
import { Input } from "@symmio/ui/components/input";
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "@symmio/ui/components/popover";
import { Skeleton } from "@symmio/ui/components/skeleton";
import { cn } from "@symmio/ui/lib/utils";
import { shortenAddress } from "@symmio/utils";
import { useMemo, useState, type ReactNode } from "react";
import type { Address } from "viem";

interface Props {
  /** Namespaces the field `id` and the picker's `data-testid`s. */
  idPrefix: string;
  label: ReactNode;
  value: string;
  onValueChange: (value: string) => void;
  hint?: ReactNode;
  placeholder?: string;
  invalid?: boolean;
  /** Owner whose subaccounts populate the picker. Defaults to the connected wallet. */
  owner?: Address;
  /**
   * Which rows are selectable as the field value. `"both"` (default) lets the
   * user pick the subaccount itself or any of its VAs — a true partyA. `"va"`
   * makes only Virtual Accounts selectable; subaccount rows become expandable
   * groups used purely to reach their VAs.
   */
  selectable?: "both" | "va";
}

type PartyAKind = "sub" | "va";

/**
 * Address field for a SYMMIO `partyA` — a subaccount or one of its virtual
 * accounts (lowcap). The picker lists the owner's subaccounts as expandable
 * groups; expanding a subaccount lazily loads its VA addresses so the user can
 * select the subaccount itself or any of its VAs. A pasted/typed address is
 * still accepted directly. Pass `selectable="va"` to restrict selection to
 * virtual accounts only (see {@link VirtualAccountField}).
 */
export function PartyAField({
  idPrefix,
  label,
  value,
  onValueChange,
  hint,
  placeholder = "0x…",
  invalid,
  owner,
  selectable = "both",
}: Props) {
  const { address } = useWalletAccount();
  const effectiveOwner = owner ?? address;
  const subsQuery = useUserSubAccounts({ user: effectiveOwner });

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());
  const [selected, setSelected] = useState<{ kind: PartyAKind; parent?: string } | null>(null);

  const term = search.trim().toLowerCase();
  const subs = useMemo(() => subsQuery.data ?? [], [subsQuery.data]);
  const filtered = useMemo(
    () => (term ? subs.filter((sub) => `${sub.name} ${sub.accountAddress}`.toLowerCase().includes(term)) : subs),
    [subs, term],
  );

  function selectValue(addr: string, kind: PartyAKind, parent?: string) {
    onValueChange(addr);
    setSelected({ kind, parent });
    setOpen(false);
    setSearch("");
  }

  function toggle(addr: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(addr)) next.delete(addr);
      else next.add(addr);
      return next;
    });
  }

  const listState = getListState(subsQuery);

  return (
    <Field label={label} htmlFor={`${idPrefix}-account`} hint={hint}>
      <div className="space-y-2">
        <Popover
          open={open}
          onOpenChange={(next) => {
            setOpen(next);
            if (!next) setSearch("");
          }}
        >
          <PopoverAnchor asChild>
            <div className="relative">
              <Input
                id={`${idPrefix}-account`}
                data-testid={`${idPrefix}-account`}
                value={value}
                onChange={(event) => {
                  onValueChange(event.target.value);
                  setSelected(null);
                }}
                placeholder={placeholder}
                className="pr-10 font-mono"
                aria-invalid={invalid}
              />
              <PopoverTrigger asChild>
                <button
                  type="button"
                  data-testid={`${idPrefix}-browse`}
                  aria-label="Browse subaccounts and virtual accounts"
                  aria-expanded={open}
                  className="text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:ring-ring/40 absolute top-1/2 right-1.5 inline-flex size-6 -translate-y-1/2 items-center justify-center rounded-md transition-colors outline-none focus-visible:ring-2"
                >
                  <LayersIcon />
                </button>
              </PopoverTrigger>
            </div>
          </PopoverAnchor>

          <PopoverContent
            align="start"
            sideOffset={6}
            className="w-(--radix-popover-trigger-width) overflow-hidden p-0"
            data-testid={`${idPrefix}-picker`}
          >
            <div className="border-border/70 flex items-center gap-2 border-b px-3">
              <SearchIcon className="text-muted-foreground size-4 shrink-0" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search subaccounts…"
                aria-label="Search subaccounts"
                data-testid={`${idPrefix}-search`}
                className="placeholder:text-muted-foreground/70 h-10 w-full bg-transparent text-sm outline-none"
              />
            </div>

            {listState === "loading" ? (
              <GroupSkeleton testId={`${idPrefix}-list-loading`} />
            ) : listState !== "ready" ? (
              <div
                data-testid={`${idPrefix}-list-${listState}`}
                className="text-muted-foreground px-3 py-6 text-center text-sm"
              >
                <SubsListMessage idPrefix={idPrefix} query={subsQuery} />
              </div>
            ) : filtered.length === 0 ? (
              <div
                data-testid={`${idPrefix}-list-no-results`}
                className="text-muted-foreground px-3 py-6 text-center text-sm"
              >
                No matching subaccounts.
              </div>
            ) : (
              <div data-testid={`${idPrefix}-list`} className="max-h-72 overflow-y-auto p-1">
                {filtered.map((sub) => (
                  <SubAccountGroup
                    key={sub.accountAddress}
                    idPrefix={idPrefix}
                    name={sub.name || "Unnamed"}
                    subAccount={sub.accountAddress}
                    value={value}
                    search={term}
                    selectable={selectable}
                    expanded={expanded.has(sub.accountAddress)}
                    onToggle={() => toggle(sub.accountAddress)}
                    onSelect={selectValue}
                  />
                ))}
              </div>
            )}
          </PopoverContent>
        </Popover>

        {selected ? (
          <p
            data-testid={`${idPrefix}-selected-kind`}
            className="text-muted-foreground flex items-center gap-1.5 text-xs"
          >
            <KindTag kind={selected.kind} />
            <span>
              {selected.kind === "va" ? "Virtual Account" : "SubAccount"}
              {selected.parent ? (
                <>
                  {" · under "}
                  <span className="text-foreground">{selected.parent}</span>
                </>
              ) : null}
            </span>
          </p>
        ) : null}
      </div>
    </Field>
  );
}

function SubAccountGroup({
  idPrefix,
  name,
  subAccount,
  value,
  search,
  selectable,
  expanded,
  onToggle,
  onSelect,
}: {
  idPrefix: string;
  name: string;
  subAccount: Address;
  value: string;
  search: string;
  selectable: "both" | "va";
  expanded: boolean;
  onToggle: () => void;
  onSelect: (addr: string, kind: PartyAKind, parent?: string) => void;
}) {
  const normalizedValue = value.trim().toLowerCase();
  const subSelected = subAccount.toLowerCase() === normalizedValue;
  const subSelectable = selectable === "both";

  const vaQuery = useVirtualAccountsAddressesOfSubAccount({ subAccount, query: { enabled: expanded } });
  const vas = useMemo(() => vaQuery.data ?? [], [vaQuery.data]);
  const visibleVas = useMemo(
    () => (search ? vas.filter((va) => va.toLowerCase().includes(search)) : vas),
    [vas, search],
  );

  return (
    <div>
      <div className="flex items-stretch gap-1">
        <button
          type="button"
          data-testid={subSelectable ? `${idPrefix}-sub-select` : `${idPrefix}-sub-expand`}
          data-sub-address={subAccount}
          aria-expanded={subSelectable ? undefined : expanded}
          onClick={subSelectable ? () => onSelect(subAccount, "sub", name) : onToggle}
          className="hover:bg-muted/60 focus-visible:bg-muted/60 flex min-w-0 flex-1 items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left transition-colors outline-none"
        >
          <span className="flex min-w-0 items-center gap-2">
            <KindTag kind="sub" />
            <span className="min-w-0">
              <span className="text-foreground block truncate text-sm font-medium">{name}</span>
              <span className="text-muted-foreground mt-0.5 block font-mono text-xs">{shortenAddress(subAccount)}</span>
            </span>
          </span>
          {subSelectable && subSelected ? <CheckIcon className="text-primary size-4 shrink-0" /> : null}
        </button>

        <button
          type="button"
          data-testid={`${idPrefix}-sub-toggle`}
          aria-label={expanded ? `Hide virtual accounts of ${name}` : `Show virtual accounts of ${name}`}
          aria-expanded={expanded}
          onClick={onToggle}
          className="text-muted-foreground hover:text-foreground hover:bg-muted/60 focus-visible:ring-ring/40 inline-flex w-8 shrink-0 items-center justify-center rounded-lg transition-colors outline-none focus-visible:ring-2"
        >
          <ChevronIcon className={cn("size-4 transition-transform duration-200", expanded && "rotate-90")} />
        </button>
      </div>

      {expanded ? (
        <div className="border-border/60 mt-0.5 ml-4 border-l pl-2">
          {vaQuery.isLoading ? (
            <VaSkeleton testId={`${idPrefix}-va-loading`} />
          ) : vaQuery.error ? (
            <p className="text-destructive px-2.5 py-2 text-xs">{vaQuery.error.message}</p>
          ) : vas.length === 0 ? (
            <p className="text-muted-foreground px-2.5 py-2 text-xs">
              {selectable === "va" ? (
                "No virtual accounts for this subaccount."
              ) : (
                <>
                  No virtual accounts — select the subaccount itself as <span className="text-foreground">partyA</span>.
                </>
              )}
            </p>
          ) : visibleVas.length === 0 ? (
            <p className="text-muted-foreground px-2.5 py-2 text-xs">No VAs match this search.</p>
          ) : (
            visibleVas.map((va, index) => (
              <VaRow
                key={va}
                idPrefix={idPrefix}
                index={index}
                va={va}
                parentName={name}
                selected={va.toLowerCase() === normalizedValue}
                onSelect={onSelect}
              />
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}

/**
 * One VA row in the picker. Reads the VA's `(symbolId, isolationType)` via
 * {@link useVirtualAccount} (cached forever — fixed at creation) and resolves
 * the symbol name through {@link useOnchainContractMarkets}. The trailing
 * label reads `<market> · <Long|Short|Market|Position>`; falls back to
 * `symbol N` while the markets list is loading and `(loading)` while the
 * detail is in flight.
 */
function VaRow({
  idPrefix,
  index,
  va,
  parentName,
  selected,
  onSelect,
}: {
  idPrefix: string;
  index: number;
  va: Address;
  parentName: string;
  selected: boolean;
  onSelect: (addr: string, kind: PartyAKind, parent?: string) => void;
}) {
  const detail = useVirtualAccount({ account: va });
  const markets = useOnchainContractMarkets({
    start: 0n,
    size: 1000n,
    query: { staleTime: Infinity, gcTime: Infinity },
  });
  const market = useMemo(
    () => (detail.data && markets.data ? markets.data.find((m) => m.symbolId === detail.data!.symbolId) : undefined),
    [detail.data, markets.data],
  );
  const detailLabel = detail.data
    ? `${market ? market.name : `symbol ${detail.data.symbolId.toString()}`} · ${labelForIsolation(detail.data.isolationType)}`
    : detail.isLoading
      ? "(loading)"
      : "";

  return (
    <button
      type="button"
      data-testid={`${idPrefix}-va-select`}
      data-va-address={va}
      onClick={() => onSelect(va, "va", parentName)}
      className="hover:bg-muted/60 focus-visible:bg-muted/60 flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left transition-colors outline-none"
    >
      <span className="flex min-w-0 items-baseline gap-2 leading-none">
        <KindTag kind="va" />
        <span className="text-muted-foreground shrink-0 text-xs">#{index + 1}</span>
        <span className="text-foreground truncate font-mono text-xs">{shortenAddress(va)}</span>
        {detailLabel ? (
          <span className="text-muted-foreground shrink-0 truncate font-mono text-xs">{detailLabel}</span>
        ) : null}
      </span>
      {selected ? <CheckIcon className="text-primary size-4 shrink-0" /> : null}
    </button>
  );
}

/** Short user-facing label for a VA's isolation enum. */
function labelForIsolation(isolation: VirtualAccountIsolationType): string {
  switch (isolation) {
    case VIRTUAL_ACCOUNT_ISOLATION_TYPE.MARKET_LONG:
      return "Long";
    case VIRTUAL_ACCOUNT_ISOLATION_TYPE.MARKET_SHORT:
      return "Short";
    case VIRTUAL_ACCOUNT_ISOLATION_TYPE.MARKET:
      return "Market";
    case VIRTUAL_ACCOUNT_ISOLATION_TYPE.POSITION:
      return "Position";
    default:
      return "—";
  }
}

function KindTag({ kind }: { kind: PartyAKind }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wider uppercase",
        kind === "va" ? "bg-info/10 text-info" : "bg-muted text-muted-foreground",
      )}
    >
      {kind === "va" ? "VA" : "Sub"}
    </span>
  );
}

function getListState(query: ReturnType<typeof useUserSubAccounts>) {
  if (query.isLoading) return "loading" as const;
  if (query.error) return "error" as const;
  if (!query.data) return "idle" as const;
  if (query.data.length === 0) return "empty" as const;
  return "ready" as const;
}

function SubsListMessage({ idPrefix, query }: { idPrefix: string; query: ReturnType<typeof useUserSubAccounts> }) {
  if (query.error) {
    return <ResultError testId={`${idPrefix}-list-error-msg`} kind={query.error.kind} message={query.error.message} />;
  }
  if (!query.data) {
    return <ResultNote testId={`${idPrefix}-list-idle-msg`}>Connect a wallet or enter a user address.</ResultNote>;
  }
  return <ResultNote testId={`${idPrefix}-list-empty-msg`}>No subaccounts found for this address.</ResultNote>;
}

function GroupSkeleton({ testId }: { testId: string }) {
  return (
    <div data-testid={testId} aria-busy="true" aria-label="Loading subaccounts" className="space-y-1 p-1">
      {["r0", "r1", "r2"].map((row) => (
        <div key={row} className="flex items-center justify-between gap-3 px-2.5 py-2">
          <span className="min-w-0 space-y-2">
            <Skeleton className="bg-muted-foreground/20 h-4 w-36" />
            <Skeleton className="bg-muted-foreground/15 h-3 w-24" />
          </span>
          <Skeleton className="bg-muted-foreground/15 size-4" />
        </div>
      ))}
    </div>
  );
}

function VaSkeleton({ testId }: { testId: string }) {
  return (
    <div data-testid={testId} aria-busy="true" className="space-y-1.5 px-2.5 py-2">
      {["v0", "v1"].map((row) => (
        <Skeleton key={row} className="bg-muted-foreground/15 h-3 w-28" />
      ))}
    </div>
  );
}

function LayersIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="size-4" aria-hidden>
      <path d="M8 2 14 5 8 8 2 5 8 2Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path
        d="M2.5 8 8 10.75 13.5 8M2.5 10.75 8 13.5l5.5-2.75"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className} aria-hidden>
      <circle cx="7" cy="7" r="4.25" stroke="currentColor" strokeWidth="1.6" />
      <path d="m10.5 10.5 3 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className} aria-hidden>
      <path d="m6 4 4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className} aria-hidden>
      <path d="m3.5 8.5 3 3 6-7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
