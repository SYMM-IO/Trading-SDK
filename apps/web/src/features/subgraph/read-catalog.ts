import {
  BalanceHistoryFilter,
  MarginTransferType,
  PositionType,
  QuoteCloseType,
  QuoteEventType,
  QuoteStatus,
  SubAccountIsolationType,
} from "@symmio/trading-core";
import type {
  UseBalanceHistoryParameters,
  UseFundingIndexCheckpointsParameters,
  UseLiquidationDetailsParameters,
  UseMarginTransfersParameters,
  UseQuoteEventsByTypeParameters,
  UseQuoteFundingSettlementsParameters,
  UseQuoteHistoryParameters,
  UseQuotesFundingParameters,
  UseSubgraphQuotesParameters,
  UseTransferHistoryParameters,
} from "@symmio/trading-react";

/** How a field is entered on the form, and how its draft text becomes a hook parameter. */
export type FieldKind =
  | "address"
  | "address-list"
  | "hash-list"
  | "id-list"
  | "market-list"
  | "enum-list"
  | "enum"
  | "time"
  | "integer"
  | "text";

export interface FieldOption {
  value: string;
  label: string;
}

/** One filter or param of a read. `key` is the hook parameter it fills. */
export interface FieldSpec<TKey extends string = string> {
  key: TKey;
  kind: FieldKind;
  /** Filters narrow the rows (the subgraph `where`); params page and sort them. */
  section: "filter" | "param";
  /** Pinned on the form: the hook needs it, so it cannot be removed. */
  required?: boolean;
  /** What the SDK does when the field is left out, shown in the add menu and as the placeholder. */
  defaultHint?: string;
  /** One line under the input. */
  hint?: string;
  /** Choices for `enum` and `enum-list`. */
  options?: readonly FieldOption[];
  /** The enum's values are numbers (`SubAccountIsolationType`), not strings. */
  numeric?: boolean;
  /** `integer` / `id-list` values are sent as `bigint` (quote ids). */
  bigint?: boolean;
  /** Each id is sent as `{ quoteId }` — the shape `useQuotesFunding` takes. */
  wrapAsQuote?: boolean;
  /** The account picker an `address-list` offers next to paste. */
  picker?: "party-a" | "sub-account" | "virtual-account";
  /**
   * For `source`: the contract the subgraph indexes this entity from, which the
   * form offers as "this deployment". Most entities come from the Symmio diamond;
   * margin transfers come from the Account Layer. @default "symmio"
   */
  contract?: DeploymentContract;
}

/** A deployment contract an indexed entity's `source` can name. */
export type DeploymentContract = "symmio" | "account-layer";

/** How a result column renders its value. */
export type CellKind = "wei" | "collateral" | "int" | "address" | "tx" | "time" | "bool" | "badge" | "text";

export interface ColumnSpec {
  key: string;
  kind: CellKind;
  /** Header text; defaults to `key`. */
  label?: string;
  /** Reverse map for a numeric enum (`PositionType`), so the cell shows `LONG` instead of `0`. */
  enumLabels?: Readonly<Record<number, string>>;
}

export type ReadGroup = "Balance" | "Margin & liquidation" | "Quotes" | "Funding";

export const READ_GROUPS: readonly ReadGroup[] = ["Balance", "Margin & liquidation", "Quotes", "Funding"];

export type ReadId =
  | "getBalanceHistory"
  | "getTransferHistory"
  | "getMarginTransfers"
  | "getLiquidationDetails"
  | "getQuoteHistory"
  | "getSubgraphQuotes"
  | "getQuoteEventsByType"
  | "getQuoteFunding"
  | "getQuoteFundingSettlements"
  | "getFundingIndexCheckpoints";

export interface ReadSpec<TKey extends string = string> {
  id: ReadId;
  group: ReadGroup;
  /** The `@symmio/trading-react` hook the page calls. */
  hook: string;
  summary: string;
  /** Which configured subgraph endpoint the read queries. */
  subgraph: "analytics" | "events";
  fields: readonly FieldSpec<TKey>[];
  columns: readonly ColumnSpec[];
  /** Row field used as the table's row id. */
  rowId: string;
  /** The SDK page size when `first` is left out; `undefined` when the read does not page. */
  defaultPageSize?: number;
  /** The read pages by `orderBy: "id"` + `idGt` as well as by `skip`. */
  cursor?: boolean;
  /** The read returns `hasMore`; otherwise a full page is the only hint that more exist. */
  reportsHasMore?: boolean;
}

/** Keys a read's fields may use: the parameters of its hook. */
type ParameterKey<TParameters> = Extract<keyof TParameters, string>;

/** Type-check a read's field keys against its hook's parameters, then widen it into the catalog. */
function defineRead<TParameters>(spec: ReadSpec<ParameterKey<TParameters>>): ReadSpec {
  return spec;
}

/** String-enum values as options, in declaration order. */
function stringEnumOptions(values: Record<string, string>): FieldOption[] {
  return Object.values(values).map((value) => ({ value, label: value }));
}

/** Numeric-enum values as options, labelled by member name. */
function numericEnumOptions(values: Record<string, string | number>): FieldOption[] {
  return Object.entries(values)
    .filter((entry): entry is [string, number] => typeof entry[1] === "number")
    .map(([label, value]) => ({ value: String(value), label }));
}

const ORDER_DIRECTION_OPTIONS: FieldOption[] = [
  { value: "desc", label: "desc" },
  { value: "asc", label: "asc" },
];

const ORDER_BY_OPTIONS: FieldOption[] = [
  { value: "timestamp", label: "timestamp" },
  { value: "id", label: "id" },
];

/** `source` scopes a read to one deployment; the form fills in this deployment's Symmio diamond. */
const SOURCE = {
  key: "source",
  kind: "address",
  section: "filter",
  defaultHint: "any deployment",
  hint: "The deployment's diamond address. Leave the field out to match every deployment the subgraph indexes.",
} as const satisfies FieldSpec;

const START_TIME = { key: "startTime", kind: "time", section: "filter", defaultHint: "no lower bound" } as const;
const END_TIME = { key: "endTime", kind: "time", section: "filter", defaultHint: "no upper bound" } as const;

/** Paging and sort shared by the reads built on `SubgraphPageParameters`. */
const CURSOR_PAGE_PARAMS = [
  { key: "first", kind: "integer", section: "param", defaultHint: "1000" },
  { key: "skip", kind: "integer", section: "param", defaultHint: "0" },
  { key: "orderBy", kind: "enum", section: "param", defaultHint: "timestamp", options: ORDER_BY_OPTIONS },
  { key: "orderDirection", kind: "enum", section: "param", defaultHint: "desc", options: ORDER_DIRECTION_OPTIONS },
  {
    key: "idGt",
    kind: "text",
    section: "param",
    defaultHint: "no cursor",
    hint: "Rows whose id sorts after this one. The SDK then sorts by id ascending unless orderBy / orderDirection is set, and rejects any other sort.",
  },
] as const satisfies readonly FieldSpec[];

/** Paging and sort of the older reads, which take a page size, an offset and a direction only. */
function offsetPageParams(defaultPageSize: number) {
  return [
    { key: "first", kind: "integer", section: "param", defaultHint: String(defaultPageSize) },
    { key: "skip", kind: "integer", section: "param", defaultHint: "0" },
    { key: "orderDirection", kind: "enum", section: "param", defaultHint: "desc", options: ORDER_DIRECTION_OPTIONS },
  ] as const satisfies readonly FieldSpec[];
}

/** Every subgraph read the page offers, grouped and ordered as the SDK docs list them. */
export const READ_CATALOG: readonly ReadSpec[] = [
  defineRead<UseBalanceHistoryParameters>({
    id: "getBalanceHistory",
    group: "Balance",
    hook: "useBalanceHistory",
    summary: "Settled deposits and withdrawals of one or more SubAccounts.",
    subgraph: "analytics",
    fields: [
      { key: "accounts", kind: "address-list", section: "filter", required: true, picker: "sub-account" },
      {
        key: "filter",
        kind: "enum",
        section: "filter",
        defaultHint: BalanceHistoryFilter.All,
        options: stringEnumOptions(BalanceHistoryFilter),
      },
      {
        key: "internalTransfers",
        kind: "enum",
        section: "filter",
        defaultHint: "exclude",
        options: stringEnumOptions({ exclude: "exclude", only: "only", include: "include" }),
      },
      { ...START_TIME, defaultHint: "0" },
      { ...END_TIME, defaultHint: "2000000000" },
      ...offsetPageParams(1000),
    ],
    columns: [
      { key: "type", kind: "badge" },
      { key: "amount", kind: "collateral" },
      { key: "account", kind: "address" },
      { key: "isInternalTransfer", kind: "bool", label: "internal" },
      { key: "marginTransferType", kind: "text" },
      { key: "timestamp", kind: "time" },
      { key: "transaction", kind: "tx" },
    ],
    rowId: "id",
    defaultPageSize: 1000,
  }),
  defineRead<UseTransferHistoryParameters>({
    id: "getTransferHistory",
    group: "Balance",
    hook: "useTransferHistory",
    summary: "Internal transfers between SYMMIO accounts, from the events subgraph.",
    subgraph: "events",
    fields: [
      { key: "accounts", kind: "address-list", section: "filter", required: true, picker: "party-a" },
      {
        key: "direction",
        kind: "enum",
        section: "filter",
        defaultHint: "all",
        options: stringEnumOptions({ all: "all", outgoing: "outgoing", incoming: "incoming" }),
      },
      { ...START_TIME, defaultHint: "0" },
      { ...END_TIME, defaultHint: "2000000000" },
      ...offsetPageParams(1000),
    ],
    columns: [
      { key: "direction", kind: "badge" },
      { key: "from", kind: "address" },
      { key: "to", kind: "address" },
      { key: "amount", kind: "wei" },
      { key: "timestamp", kind: "time" },
      { key: "transaction", kind: "tx" },
    ],
    rowId: "id",
    defaultPageSize: 1000,
  }),
  defineRead<UseMarginTransfersParameters>({
    id: "getMarginTransfers",
    group: "Margin & liquidation",
    hook: "useMarginTransfers",
    summary: "Margin moved between a SubAccount and its Virtual Accounts.",
    subgraph: "analytics",
    fields: [
      {
        key: "types",
        kind: "enum-list",
        section: "filter",
        defaultHint: "every type",
        options: stringEnumOptions(MarginTransferType),
      },
      { key: "transactions", kind: "hash-list", section: "filter", defaultHint: "any transaction" },
      {
        key: "virtualAccounts",
        kind: "address-list",
        section: "filter",
        defaultHint: "any account",
        picker: "virtual-account",
      },
      {
        key: "subAccounts",
        kind: "address-list",
        section: "filter",
        defaultHint: "any account",
        picker: "sub-account",
      },
      {
        ...SOURCE,
        contract: "account-layer",
        hint: "Margin transfers are indexed from the Account Layer, so their source is its address, not the Symmio diamond. Leave the field out to match every deployment.",
      },
      START_TIME,
      END_TIME,
      ...CURSOR_PAGE_PARAMS,
    ],
    columns: [
      { key: "type", kind: "badge" },
      { key: "virtualAccount", kind: "address" },
      { key: "subAccount", kind: "address" },
      { key: "amount", kind: "wei" },
      { key: "timestamp", kind: "time" },
      { key: "transaction", kind: "tx" },
    ],
    rowId: "id",
    defaultPageSize: 1000,
    cursor: true,
    reportsHasMore: true,
  }),
  defineRead<UseLiquidationDetailsParameters>({
    id: "getLiquidationDetails",
    group: "Margin & liquidation",
    hook: "useLiquidationDetails",
    summary: "One row per PartyA liquidation, with its locked and paid CVA/LF.",
    subgraph: "analytics",
    fields: [
      { key: "partyAs", kind: "address-list", section: "filter", defaultHint: "any account", picker: "party-a" },
      SOURCE,
      START_TIME,
      END_TIME,
      ...CURSOR_PAGE_PARAMS,
    ],
    columns: [
      { key: "partyA", kind: "address" },
      { key: "liquidationId", kind: "int" },
      { key: "liquidationType", kind: "int" },
      { key: "upnl", kind: "wei" },
      { key: "deficit", kind: "wei" },
      { key: "liquidationFee", kind: "wei" },
      { key: "settled", kind: "bool" },
      { key: "fullyLiquidated", kind: "bool" },
      { key: "liquidationTimestamp", kind: "time" },
    ],
    rowId: "id",
    defaultPageSize: 1000,
    cursor: true,
    reportsHasMore: true,
  }),
  defineRead<UseQuoteHistoryParameters>({
    id: "getQuoteHistory",
    group: "Quotes",
    hook: "useQuoteHistory",
    summary: "Close and liquidation events, each with its own metadata snapshot.",
    subgraph: "analytics",
    fields: [
      {
        key: "subAccounts",
        kind: "address-list",
        section: "filter",
        defaultHint: "any account",
        picker: "sub-account",
      },
      {
        key: "isolationType",
        kind: "enum",
        section: "filter",
        defaultHint: "any",
        options: numericEnumOptions(SubAccountIsolationType),
        numeric: true,
      },
      SOURCE,
      { key: "marketIds", kind: "market-list", section: "filter", defaultHint: "any market" },
      {
        key: "closeType",
        kind: "enum",
        section: "filter",
        defaultHint: QuoteCloseType.All,
        options: stringEnumOptions(QuoteCloseType),
      },
      { ...START_TIME, defaultHint: "0" },
      { ...END_TIME, defaultHint: "2000000000" },
      ...offsetPageParams(50),
    ],
    columns: [
      { key: "closeEventType", kind: "badge" },
      { key: "quoteId", kind: "int" },
      { key: "symbol", kind: "text" },
      { key: "positionType", kind: "badge", enumLabels: PositionType },
      { key: "closedAmount", kind: "wei" },
      { key: "avgClosedPrice", kind: "wei" },
      { key: "partyA", kind: "address" },
      { key: "closedAt", kind: "time" },
      { key: "transaction", kind: "tx" },
    ],
    rowId: "eventId",
    defaultPageSize: 50,
  }),
  defineRead<UseSubgraphQuotesParameters>({
    id: "getSubgraphQuotes",
    group: "Quotes",
    hook: "useSubgraphQuotes",
    summary: "Quote entities as the subgraph indexed them, including settled funding totals.",
    subgraph: "analytics",
    fields: [
      { key: "quoteIds", kind: "id-list", section: "filter", defaultHint: "any quote", bigint: true },
      { key: "partyAs", kind: "address-list", section: "filter", defaultHint: "any account", picker: "party-a" },
      SOURCE,
      ...CURSOR_PAGE_PARAMS,
    ],
    columns: [
      { key: "quoteId", kind: "int" },
      { key: "quoteStatus", kind: "badge", enumLabels: QuoteStatus },
      { key: "symbol", kind: "text" },
      { key: "positionType", kind: "badge", enumLabels: PositionType },
      { key: "quantity", kind: "wei" },
      { key: "openedPrice", kind: "wei" },
      { key: "partyA", kind: "address" },
      { key: "timestamp", kind: "time" },
    ],
    rowId: "id",
    defaultPageSize: 1000,
    cursor: true,
    reportsHasMore: true,
  }),
  defineRead<UseQuoteEventsByTypeParameters>({
    id: "getQuoteEventsByType",
    group: "Quotes",
    hook: "useQuoteEventsByType",
    summary: "One quote's open-price and funding events.",
    subgraph: "analytics",
    fields: [
      { key: "quoteId", kind: "integer", section: "filter", required: true, bigint: true },
      {
        key: "types",
        kind: "enum-list",
        section: "filter",
        required: true,
        options: stringEnumOptions(QuoteEventType),
        hint: "The React hook reads the price and funding event types only.",
      },
      SOURCE,
      ...offsetPageParams(50),
    ],
    columns: [
      { key: "type", kind: "badge" },
      { key: "quoteId", kind: "int" },
      { key: "newPrice", kind: "wei" },
      { key: "prevPrice", kind: "wei" },
      { key: "fundingPaid", kind: "wei" },
      { key: "fundingReceived", kind: "wei" },
      { key: "rate", kind: "wei" },
      { key: "timestamp", kind: "time" },
      { key: "transaction", kind: "tx" },
    ],
    rowId: "eventId",
    defaultPageSize: 50,
    reportsHasMore: true,
  }),
  defineRead<UseQuotesFundingParameters>({
    id: "getQuoteFunding",
    group: "Funding",
    hook: "useQuotesFunding",
    summary: "Settled funding paid and received per quote, summed across the list.",
    subgraph: "analytics",
    fields: [
      {
        key: "quotes",
        kind: "id-list",
        section: "filter",
        required: true,
        bigint: true,
        wrapAsQuote: true,
        hint: "Quote ids. The hook takes quote rows, so each id is sent as { quoteId }.",
      },
      SOURCE,
    ],
    columns: [
      { key: "quoteId", kind: "int" },
      { key: "paid", kind: "wei" },
      { key: "received", kind: "wei" },
      { key: "netReceived", kind: "wei" },
    ],
    rowId: "quoteId",
  }),
  defineRead<UseQuoteFundingSettlementsParameters>({
    id: "getQuoteFundingSettlements",
    group: "Funding",
    hook: "useQuoteFundingSettlements",
    summary: "One row per funding settlement on a quote.",
    subgraph: "analytics",
    fields: [
      { key: "quoteIds", kind: "id-list", section: "filter", defaultHint: "any quote", bigint: true },
      { key: "partyAs", kind: "address-list", section: "filter", defaultHint: "any account", picker: "party-a" },
      SOURCE,
      START_TIME,
      END_TIME,
      ...CURSOR_PAGE_PARAMS,
    ],
    columns: [
      { key: "quoteId", kind: "int" },
      { key: "trigger", kind: "badge" },
      { key: "paidByPartyA", kind: "wei" },
      { key: "receivedByPartyA", kind: "wei" },
      { key: "signedAmount", kind: "wei" },
      { key: "partyA", kind: "address" },
      { key: "timestamp", kind: "time" },
      { key: "transaction", kind: "tx" },
    ],
    rowId: "id",
    defaultPageSize: 1000,
    cursor: true,
    reportsHasMore: true,
  }),
  defineRead<UseFundingIndexCheckpointsParameters>({
    id: "getFundingIndexCheckpoints",
    group: "Funding",
    hook: "useFundingIndexCheckpoints",
    summary: "Funding-index snapshots per market and PartyB.",
    subgraph: "analytics",
    fields: [
      { key: "marketIds", kind: "market-list", section: "filter", defaultHint: "any market" },
      { key: "partyBs", kind: "address-list", section: "filter", defaultHint: "any solver" },
      SOURCE,
      START_TIME,
      END_TIME,
      ...CURSOR_PAGE_PARAMS,
    ],
    columns: [
      { key: "symbolId", kind: "int", label: "market" },
      { key: "eventType", kind: "badge" },
      { key: "partyB", kind: "address" },
      { key: "currentLongRate", kind: "wei" },
      { key: "currentShortRate", kind: "wei" },
      { key: "accumulatedLongRate", kind: "wei" },
      { key: "accumulatedShortRate", kind: "wei" },
      { key: "timestamp", kind: "time" },
      { key: "transaction", kind: "tx" },
    ],
    rowId: "id",
    defaultPageSize: 1000,
    cursor: true,
    reportsHasMore: true,
  }),
];

/** The read a `?read=` value names, or `undefined` when it names none. */
export function findRead(id: string | null | undefined): ReadSpec | undefined {
  return READ_CATALOG.find((read) => read.id === id);
}

/** The DOM id of a read's card on the page — its search anchor, and the `#hash` a link to it carries. */
export function readCardId(read: Pick<ReadSpec, "id">): string {
  return `subgraph-${read.id}`;
}
