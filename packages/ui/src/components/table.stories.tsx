import type { Meta, StoryObj } from "@storybook/react";
import { Badge } from "./badge";
import { Table, TableBody, TableCell, TableEmpty, TableHead, TableHeader, TableRow } from "./table";

const meta = {
  title: "UI/Table",
  component: Table,
  parameters: { layout: "padded" },
} satisfies Meta<typeof Table>;

export default meta;

type Story = StoryObj<typeof meta>;

const ROWS = [
  { symbol: "BTCUSDT", status: "Enabled", leverage: 100 },
  { symbol: "ETHUSDT", status: "Enabled", leverage: 50 },
  { symbol: "SOLUSDT", status: "Close only", leverage: 25 },
];

export const Default: Story = {
  render: () => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Symbol</TableHead>
          <TableHead>Status</TableHead>
          <TableHead align="end">Max leverage</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {ROWS.map((row) => (
          <TableRow key={row.symbol}>
            <TableCell className="font-mono font-medium">{row.symbol}</TableCell>
            <TableCell>
              <Badge variant={row.status === "Enabled" ? "positive" : "warning"}>{row.status}</Badge>
            </TableCell>
            <TableCell align="end" className="font-mono">
              {row.leverage}×
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  ),
};

export const Empty: Story = {
  render: () => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Symbol</TableHead>
          <TableHead>Status</TableHead>
          <TableHead align="end">Max leverage</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableEmpty colSpan={3}>No markets match these filters.</TableEmpty>
      </TableBody>
    </Table>
  ),
};
