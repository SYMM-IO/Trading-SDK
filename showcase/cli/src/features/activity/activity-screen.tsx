import {
  BalanceChangeType,
  BalanceHistoryFilter,
  type BalanceHistoryRow,
  type TransferDirection,
  type TransferRow,
} from "@symmio/trading-core";
import { Box, Text, useInput, useStdout } from "ink";
import { useEffect, useState } from "react";
import { theme } from "../../config/theme.js";
import { formatError } from "../../lib/error.js";
import { formatDateTime, formatRelative, formatToken, shortAddress } from "../../lib/format.js";
import { collateralDecimals } from "../../sdk/chain.js";
import { ACTIVITY_PAGE_SIZE, useBalanceActivity, useTransferActivity } from "../../sdk/use-account-activity.js";
import { useSdkScope } from "../../sdk/use-sdk-scope.js";
import { useSubAccount } from "../../sdk/use-sub-accounts.js";
import { Empty, LoadingLine } from "../../ui/feedback.js";
import { KeyValue, Panel } from "../../ui/kit.js";
import { Menu } from "../../ui/menu.js";
import { pad } from "../../ui/pad.js";
import { HistoryScreen } from "../history/history-screen.js";

const VIEWS = ["trades", "balance", "transfers"] as const;
type ActivityView = (typeof VIEWS)[number];

/** Unified activity center for trade closes, collateral movement, and internal transfers. */
export function ActivityScreen({ active }: { active: boolean }) {
  const [view, setView] = useState<ActivityView>("trades");

  useInput(
    (input) => {
      if (input !== "v") return;
      const index = VIEWS.indexOf(view);
      setView(VIEWS[(index + 1) % VIEWS.length]!);
    },
    { isActive: active },
  );

  return (
    <Box flexDirection="column" flexGrow={1}>
      <Box marginBottom={1}>
        <Text color={theme.faint}>View </Text>
        {VIEWS.map((item) => (
          <Text
            key={item}
            color={item === view ? theme.onAccent : theme.muted}
            backgroundColor={item === view ? theme.primary : undefined}
            bold={item === view}
          >
            {` ${item} `}
          </Text>
        ))}
        <Text color={theme.faint}> v cycle</Text>
      </Box>
      {view === "trades" && <HistoryScreen active={active} />}
      {view === "balance" && <BalanceActivity active={active} />}
      {view === "transfers" && <TransferActivity active={active} />}
    </Box>
  );
}

function BalanceActivity({ active }: { active: boolean }) {
  const { stdout } = useStdout();
  const { config, chainId } = useSdkScope();
  const { subAccount } = useSubAccount();
  const [filter, setFilter] = useState(BalanceHistoryFilter.All);
  const [page, setPage] = useState(1);
  const [index, setIndex] = useState(0);
  const query = useBalanceActivity(filter, page);
  const rows = query.data?.rows ?? [];
  const selected = rows[index];
  const decimals = collateralDecimals(config, chainId);
  const wide = (stdout?.columns ?? 120) >= 108;

  useEffect(() => setIndex(0), [filter, page, subAccount]);
  useInput(
    (input) => {
      if (input === "f") {
        const filters = Object.values(BalanceHistoryFilter);
        setFilter(filters[(filters.indexOf(filter) + 1) % filters.length]!);
        setPage(1);
      } else if (input === "n" && rows.length === ACTIVITY_PAGE_SIZE) setPage((value) => value + 1);
      else if (input === "p" && page > 1) setPage((value) => value - 1);
      else if (input === "r") void query.refetch();
    },
    { isActive: active },
  );

  return (
    <Box flexDirection={wide ? "row" : "column"} gap={1} flexGrow={1}>
      <Panel
        title={`Collateral · ${filter}${page > 1 ? ` · page ${page}` : ""}`}
        focused={active}
        flexGrow={1}
        right={wide ? <Text color={theme.faint}>f filter · n/p page · r refresh</Text> : undefined}
      >
        {!subAccount ? (
          <Empty title="No sub-account selected" />
        ) : query.isLoading ? (
          <LoadingLine label="Loading collateral activity…" />
        ) : query.error != null ? (
          <Empty title="Activity unavailable" hint={formatError(query.error)} tone={theme.negative} />
        ) : rows.length === 0 ? (
          <Empty title="No collateral activity" hint={page > 1 ? "Press p for the previous page." : undefined} />
        ) : (
          <Box flexDirection="column">
            <Box marginLeft={2}>
              <Text color={theme.faint}>
                {pad("Type", 12)}
                {pad("Amount", 18, "right")}
                {pad("When", 12, "right")}
                {"  Tx"}
              </Text>
            </Box>
            <Menu
              items={rows}
              index={index}
              setIndex={setIndex}
              active={active}
              maxVisible={14}
              renderItem={(row, isSelected) => {
                const incoming = row.type === BalanceChangeType.Deposit;
                return (
                  <Text>
                    <Text color={incoming ? theme.positive : theme.warning}>{pad(row.type, 12)}</Text>
                    <Text color={isSelected ? theme.text : theme.muted}>
                      {pad(`${incoming ? "+" : "-"}${formatToken(row.amount, decimals)}`, 18, "right")}
                    </Text>
                    <Text color={theme.faint}>
                      {pad(formatRelative(row.timestamp), 12, "right")} {shortAddress(row.transaction)}
                    </Text>
                  </Text>
                );
              }}
            />
          </Box>
        )}
      </Panel>
      <BalanceDetail row={selected} decimals={decimals} wide={wide} />
    </Box>
  );
}

function BalanceDetail({ row, decimals, wide }: { row?: BalanceHistoryRow; decimals: number; wide: boolean }) {
  return (
    <Panel title="Movement detail" width={wide ? 40 : undefined}>
      {!row ? (
        <Text color={theme.faint}>Select a movement.</Text>
      ) : (
        <Box flexDirection="column">
          <KeyValue label="Type" value={row.type} />
          <KeyValue label="Amount" value={`${formatToken(row.amount, decimals)} USDC`} />
          <KeyValue label="Account" value={shortAddress(row.account)} />
          <KeyValue label="Settled" value={formatDateTime(row.timestamp)} />
          <KeyValue label="Transaction" value={shortAddress(row.transaction, 10, 8)} dim />
          <KeyValue label="Internal leg" value={row.isInternalTransfer ? (row.marginTransferType ?? "yes") : "no"} />
        </Box>
      )}
    </Panel>
  );
}

function TransferActivity({ active }: { active: boolean }) {
  const { stdout } = useStdout();
  const { subAccount } = useSubAccount();
  const [direction, setDirection] = useState<TransferDirection>("all");
  const [page, setPage] = useState(1);
  const [index, setIndex] = useState(0);
  const query = useTransferActivity(direction, page);
  const rows = query.data?.rows ?? [];
  const selected = rows[index];
  const wide = (stdout?.columns ?? 120) >= 108;

  useEffect(() => setIndex(0), [direction, page, subAccount]);
  useInput(
    (input) => {
      if (input === "f") {
        const directions: TransferDirection[] = ["all", "incoming", "outgoing"];
        setDirection(directions[(directions.indexOf(direction) + 1) % directions.length]!);
        setPage(1);
      } else if (input === "n" && rows.length === ACTIVITY_PAGE_SIZE) setPage((value) => value + 1);
      else if (input === "p" && page > 1) setPage((value) => value - 1);
      else if (input === "r") void query.refetch();
    },
    { isActive: active },
  );

  return (
    <Box flexDirection={wide ? "row" : "column"} gap={1} flexGrow={1}>
      <Panel
        title={`Transfers · ${direction}${page > 1 ? ` · page ${page}` : ""}`}
        focused={active}
        flexGrow={1}
        right={wide ? <Text color={theme.faint}>f direction · n/p page · r refresh</Text> : undefined}
      >
        {!subAccount ? (
          <Empty title="No sub-account selected" />
        ) : query.isLoading ? (
          <LoadingLine label="Loading transfers…" />
        ) : query.error != null ? (
          <Empty title="Transfers unavailable" hint={formatError(query.error)} tone={theme.negative} />
        ) : rows.length === 0 ? (
          <Empty title="No internal transfers" hint={page > 1 ? "Press p for the previous page." : undefined} />
        ) : (
          <Box flexDirection="column">
            <Box marginLeft={2}>
              <Text color={theme.faint}>
                {pad("Direction", 12)}
                {pad("Amount", 18, "right")}
                {pad("From", 14)}
                {"  To"}
              </Text>
            </Box>
            <Menu
              items={rows}
              index={index}
              setIndex={setIndex}
              active={active}
              maxVisible={14}
              renderItem={(row, isSelected) => (
                <Text>
                  <Text color={row.direction === "incoming" ? theme.positive : theme.warning}>
                    {pad(row.direction, 12)}
                  </Text>
                  <Text color={isSelected ? theme.text : theme.muted}>{pad(formatToken(row.amount), 18, "right")}</Text>
                  <Text color={theme.faint}>
                    {pad(shortAddress(row.from), 14)} {shortAddress(row.to)}
                  </Text>
                </Text>
              )}
            />
          </Box>
        )}
      </Panel>
      <TransferDetail row={selected} wide={wide} />
    </Box>
  );
}

function TransferDetail({ row, wide }: { row?: TransferRow; wide: boolean }) {
  return (
    <Panel title="Transfer detail" width={wide ? 40 : undefined}>
      {!row ? (
        <Text color={theme.faint}>Select a transfer.</Text>
      ) : (
        <Box flexDirection="column">
          <KeyValue label="Direction" value={row.direction} />
          <KeyValue label="Amount" value={`${formatToken(row.amount)} USDC`} />
          <KeyValue label="From" value={shortAddress(row.from)} />
          <KeyValue label="To" value={shortAddress(row.to)} />
          <KeyValue label="Settled" value={formatDateTime(row.timestamp)} />
          <KeyValue label="Transaction" value={shortAddress(row.transaction, 10, 8)} dim />
        </Box>
      )}
    </Panel>
  );
}
