import type { Meta, StoryObj } from "@storybook/react";
import { useMemo, useState } from "react";
import { Badge } from "./badge";
import { DataTable, type DataTableColumn, type DataTableProps } from "./data-table";
import { Input } from "./input";

interface SymbolRow {
  name: string;
  status: "TRADING" | "SETTLING";
  address: string;
}

const SYMBOLS: SymbolRow[] = [
  { name: "BELKA_SFLOW", status: "TRADING", address: "4df1wZoygsynEZ6Xmpcoabr" },
  { name: "GIGA_SFLOW", status: "TRADING", address: "63LfDmNb3MQ8mw9MtZ2To9b" },
  { name: "GITLAWB_SFLOW", status: "SETTLING", address: "0x5F980Dcfc4c0fa3911554cf" },
  { name: "DIO_SFLOW", status: "TRADING", address: "BiDB55p4G3n1fGhwKFpxsok" },
  { name: "OVPP_SFLOW", status: "SETTLING", address: "0x8C0d3ADCF8Ce094E1aE437" },
  { name: "MEMEOTHY_SFLOW", status: "TRADING", address: "DLVeaDvdc159gpxrBXkCKXA" },
  { name: "ZEN_SFLOW", status: "TRADING", address: "0xf43eB8De897Fbc7F250248" },
  { name: "ABOND_SFLOW", status: "SETTLING", address: "0x34294AfABCbaFfc616ac66" },
];

/** Three numbered copies of the catalog — enough rows to scroll behind a five-row cap. */
const MANY_SYMBOLS: SymbolRow[] = [1, 2, 3].flatMap((batch) =>
  SYMBOLS.map((symbol) => ({ ...symbol, name: `${symbol.name}_${batch}` })),
);

const COLUMNS: DataTableColumn<SymbolRow>[] = [
  { id: "name", header: "Name", cell: (s) => s.name, sortAccessor: (s) => s.name, cellClassName: "font-mono" },
  {
    id: "status",
    header: "Status",
    cell: (s) => <Badge variant={s.status === "TRADING" ? "positive" : "secondary"}>{s.status}</Badge>,
    sortAccessor: (s) => s.status,
  },
  {
    id: "address",
    header: "Address",
    cell: (s) => s.address,
    sortAccessor: (s) => s.address,
    cellClassName: "text-muted-foreground max-w-96 truncate font-mono",
  },
];

/** Concrete instantiation so Storybook can infer the generic row type. */
function SymbolsDataTable(props: DataTableProps<SymbolRow>) {
  return <DataTable {...props} />;
}

const meta = {
  title: "UI/DataTable",
  component: SymbolsDataTable,
  parameters: { layout: "padded" },
  args: {
    columns: COLUMNS,
    data: SYMBOLS,
    getRowId: (s: SymbolRow) => `${s.address}-${s.name}`,
    initialSort: { columnId: "name", direction: "asc" },
    defaultPageSize: 5,
    testId: "symbols",
  },
} satisfies Meta<typeof SymbolsDataTable>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Expandable: Story = {
  name: "With expandable rows",
  args: {
    renderExpanded: (s: SymbolRow) => (
      <div className="grid gap-1 px-4 py-3 text-sm">
        <div className="text-muted-foreground text-xs tracking-wide uppercase">Details</div>
        <div>
          Full address: <span className="font-mono">{s.address}</span>
        </div>
        <div>
          Status: <Badge variant={s.status === "TRADING" ? "positive" : "secondary"}>{s.status}</Badge>
        </div>
      </div>
    ),
    defaultExpandedRowIds: [`${SYMBOLS[0]!.address}-${SYMBOLS[0]!.name}`],
  },
};

export const Scrollable: Story = {
  name: "Capped to five rows",
  args: {
    data: MANY_SYMBOLS,
    hidePagination: true,
    maxVisibleRows: 5,
  },
};

export const WithSearchToolbar: Story = {
  name: "With a search toolbar",
  render: (args) => {
    const Demo = () => {
      const [search, setSearch] = useState("");
      const filtered = useMemo(() => {
        const term = search.trim().toLowerCase();
        if (!term) return SYMBOLS;
        return SYMBOLS.filter((s) => s.name.toLowerCase().includes(term) || s.address.toLowerCase().includes(term));
      }, [search]);
      return (
        <SymbolsDataTable
          {...args}
          data={filtered}
          totalCount={SYMBOLS.length}
          emptyMessage="No symbols match your search."
          toolbar={
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name or address…"
              aria-label="Search symbols"
            />
          }
        />
      );
    };
    return <Demo />;
  },
};
