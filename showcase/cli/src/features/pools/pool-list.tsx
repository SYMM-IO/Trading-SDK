import type { ListingMarket, UserListingMarket } from "@symmio/trading-core";
import { Text } from "ink";
import { theme } from "../../config/theme.js";
import { Menu } from "../../ui/menu.js";
import { pad } from "../../ui/pad.js";
import { formatPoolRate, formatPoolUsd, poolChainLabel, poolStatusMeta } from "./pool-format.js";

export type PoolRow = ListingMarket | UserListingMarket;

interface Props {
  rows: readonly PoolRow[];
  index: number;
  setIndex: (index: number) => void;
  active: boolean;
  mine: boolean;
  maxVisible: number;
}

function isUserPool(row: PoolRow): row is UserListingMarket {
  return "userDeposit" in row;
}

/** Keyboard-navigable pool rows for the public catalog or the signed-in user. */
export function PoolList({ rows, index, setIndex, active, mine, maxVisible }: Props) {
  return (
    <>
      <Text color={theme.faint}>
        {mine
          ? `  ${pad("Pool", 12)}${pad("Deposit", 12, "right")}${pad("Revenue", 12, "right")}${pad("Share", 9, "right")}  Status`
          : `  ${pad("Pool", 12)}${pad("Chain", 10)}${pad("TVL", 12, "right")}${pad("APR", 9, "right")}  Status`}
      </Text>
      <Menu
        items={rows}
        index={index}
        setIndex={setIndex}
        active={active}
        maxVisible={maxVisible}
        emptyLabel={mine ? "No pools are associated with this account." : "No pools match this status."}
        renderItem={(row, selected) => {
          const status = poolStatusMeta(row.marketStatus);
          return (
            <Text>
              <Text color={selected ? theme.text : theme.muted} bold={selected}>
                {pad(row.tokenTicker || "Untitled", 12)}
              </Text>
              {mine && isUserPool(row) ? (
                <>
                  <Text color={theme.muted}>{pad(formatPoolUsd(row.userDeposit), 12, "right")}</Text>
                  <Text color={row.userRevenue != null && row.userRevenue > 0n ? theme.positive : theme.muted}>
                    {pad(formatPoolUsd(row.userRevenue), 12, "right")}
                  </Text>
                  <Text color={theme.faint}>{pad(`${row.userSharePercentage.toFixed(2)}%`, 9, "right")}</Text>
                </>
              ) : (
                <>
                  <Text color={theme.faint}>{pad(poolChainLabel(row.chainId), 10)}</Text>
                  <Text color={theme.muted}>{pad(formatPoolUsd(row.tvl), 12, "right")}</Text>
                  <Text color={row.apr != null && row.apr > 0n ? theme.positive : theme.faint}>
                    {pad(formatPoolRate(row.apr), 9, "right")}
                  </Text>
                </>
              )}
              <Text color={status.color}> {status.label}</Text>
            </Text>
          );
        }}
      />
    </>
  );
}
