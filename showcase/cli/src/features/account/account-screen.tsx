import { Box, Text, useStdout } from "ink";
import { useState } from "react";
import { glyph, theme } from "../../config/theme.js";
import { formatUsd } from "../../lib/format.js";
import { isCrossMarginIsolation } from "../../lib/sub-account.js";
import { collateralDecimals } from "../../sdk/chain.js";
import { useAvailableBalance, useBalanceInfo } from "../../sdk/use-balances.js";
import { useCollateralBalance } from "../../sdk/use-collateral.js";
import { useTradingDelegation } from "../../sdk/use-delegation.js";
import { useSdkScope } from "../../sdk/use-sdk-scope.js";
import { useSigner } from "../../sdk/use-signer.js";
import { useSubAccount } from "../../sdk/use-sub-accounts.js";
import { usePendingWithdraws } from "../../sdk/use-withdraw.js";
import { Empty } from "../../ui/feedback.js";
import { Divider, KeyValue, Panel, Stat } from "../../ui/kit.js";
import { Menu } from "../../ui/menu.js";
import { useAppState, type Overlay } from "../app-state.js";

interface AccountAction {
  key: string;
  label: string;
  hint: string;
  overlay: Overlay;
}

const ACTIONS: readonly AccountAction[] = [
  { key: "deposit", label: "Deposit collateral", hint: "wallet → sub-account", overlay: { kind: "deposit" } },
  { key: "allocate", label: "Allocate / deallocate", hint: "available ↔ margin pool", overlay: { kind: "allocate" } },
  { key: "withdraw", label: "Withdraw", hint: "request → cooldown → finalize", overlay: { kind: "withdraw" } },
  { key: "subaccount", label: "Sub-account", hint: "create / rename / switch", overlay: { kind: "subaccount" } },
  { key: "enable", label: "One-tap trading", hint: "session key + delegation", overlay: { kind: "enable-trading" } },
];

/** Portfolio dashboard + collateral action launcher. */
export function AccountScreen({ active }: { active: boolean }) {
  const { stdout } = useStdout();
  const { address, label } = useSigner();
  const { subAccount, subAccountName, subAccountDetail } = useSubAccount();
  const { openOverlay } = useAppState();
  const [index, setIndex] = useState(0);
  const wide = (stdout?.columns ?? 120) >= 100;

  if (!address) {
    return (
      <Panel title="Account" focused={active} flexGrow={1}>
        <Empty title="No wallet connected" hint="Press w to connect a signing wallet or set SYMMIO_PRIVATE_KEY." />
      </Panel>
    );
  }

  return (
    <Box flexDirection={wide ? "row" : "column"} gap={1} flexGrow={1}>
      <Portfolio
        subAccount={subAccount}
        owner={address}
        walletLabel={label}
        subAccountName={subAccountName}
        isCrossMargin={isCrossMarginIsolation(subAccountDetail?.isolationType)}
      />
      <Panel title="Actions" focused={active} width={wide ? 42 : undefined}>
        <Menu
          items={ACTIONS}
          index={index}
          setIndex={setIndex}
          active={active}
          onSelect={(action) => openOverlay(action.overlay)}
          renderItem={(action, selected) => (
            <Text color={selected ? theme.text : theme.muted} bold={selected}>
              {action.label}
            </Text>
          )}
        />
        <Box marginTop={1} flexDirection="column">
          <Text color={theme.faint}>{ACTIONS[index]?.hint}</Text>
          <Text color={theme.faint}>↑↓ move {glyph.dot} ⏎ open</Text>
        </Box>
        <TradingStatus subAccount={subAccount} />
      </Panel>
    </Box>
  );
}

function Portfolio({
  subAccount,
  owner,
  walletLabel,
  subAccountName,
  isCrossMargin,
}: {
  subAccount?: `0x${string}`;
  owner: `0x${string}`;
  walletLabel: string;
  subAccountName?: string;
  isCrossMargin: boolean;
}) {
  const { config, chainId } = useSdkScope();
  const available = useAvailableBalance(subAccount);
  const info = useBalanceInfo(subAccount);
  const wallet = useCollateralBalance(owner);
  const decimals = collateralDecimals(config, chainId);

  const availableRaw = available.data ?? 0n;
  const allocated = info.data?.allocatedBalance ?? 0n;
  const locked = (info.data?.lockedCVA ?? 0n) + (info.data?.lockedLF ?? 0n) + (info.data?.lockedPartyAMM ?? 0n);
  const accountTotal = availableRaw + allocated;

  return (
    <Panel title="Portfolio" flexGrow={1}>
      <Box marginBottom={1}>
        <Stat label="Account value" value={formatUsd(accountTotal)} color={theme.primaryBright} minWidth={22} />
        <Stat label="Wallet balance" value={formatUsd(wallet.data ?? 0n, decimals)} hint={walletLabel} />
      </Box>
      <Divider width={44} />
      <Box flexDirection="column" marginTop={1}>
        <KeyValue
          label={isCrossMargin ? "Available (unallocated)" : "Available (tradable)"}
          value={formatUsd(availableRaw)}
          color={isCrossMargin ? undefined : theme.positive}
        />
        <KeyValue
          label={isCrossMargin ? "Allocated (tradable)" : "Allocated (classic)"}
          value={formatUsd(allocated)}
          color={isCrossMargin ? theme.positive : undefined}
        />
        <KeyValue label="Locked margin" value={formatUsd(locked)} dim />
      </Box>
      {subAccount != null && (
        <Box marginTop={1} flexDirection="column">
          <Divider width={44} />
          <Box marginTop={1}>
            <KeyValue label="Sub-account" value={subAccountName ?? "—"} />
          </Box>
        </Box>
      )}
    </Panel>
  );
}

function TradingStatus({ subAccount }: { subAccount?: `0x${string}` }) {
  const { sessionKeyAddress } = useSigner();
  const delegation = useTradingDelegation();
  const pending = usePendingWithdraws(subAccount);

  const enabled = Boolean(sessionKeyAddress) && delegation.isActive;
  const pendingCount = pending.data?.length ?? 0;

  return (
    <Box flexDirection="column" marginTop={1}>
      <Divider width={32} />
      <Box marginTop={1}>
        <Text color={enabled ? theme.positive : theme.warning}>
          {enabled ? glyph.check : glyph.dot} {enabled ? "One-tap trading enabled" : "One-tap trading off"}
        </Text>
      </Box>
      {pendingCount > 0 && (
        <Text color={theme.info}>
          {glyph.bullet} {pendingCount} pending withdraw{pendingCount > 1 ? "s" : ""}
        </Text>
      )}
    </Box>
  );
}
