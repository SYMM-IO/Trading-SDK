"use client";

import { Button } from "@/components/button";
import { DetailRow, DetailSection } from "@/components/detail-list";
import { Field } from "@/components/field";
import { Panel, PanelHeader } from "@/components/panel";
import { Pill } from "@/components/pill";
import { useToast } from "@/components/toast";
import { Numeric } from "@/components/value";
import { getDeployment } from "@/config/deployments";
import { useChainGate } from "@/features/wallet/use-chain-gate";
import { formatDate, formatUsd, fromWei } from "@/lib/format";
import { SymmioSupportedChainId } from "@symmio/trading-core";
import { useAccountBalanceOf, useApproveOperationalFee, useOperationalFeeAllowance } from "@symmio/trading-react";
import { useMemo, useState } from "react";
import { parseUnits, zeroAddress } from "viem";
import { useFundingAccounts } from "../accounts/account-provider";

/** Bounded operational-fee approval for the selected low-cap account. */
export function GaslessFeePanel() {
  const account = useFundingAccounts().selected.lowcaps;
  const [budget, setBudget] = useState("5");
  const toast = useToast();
  const gate = useChainGate(getDeployment("lowcaps"));
  const amount = useMemo(() => parseCoreAmount(budget), [budget]);

  const allowance = useOperationalFeeAllowance({
    payer: account?.address ?? zeroAddress,
    chainId: SymmioSupportedChainId.ARBITRUM,
    query: { enabled: Boolean(account) },
  });
  const balance = useAccountBalanceOf({
    account: account?.address,
    chainId: SymmioSupportedChainId.ARBITRUM,
    query: { enabled: Boolean(account) },
  });
  const approve = useApproveOperationalFee();

  async function approveBudget() {
    if (!account || amount === undefined) return;
    if (!gate.ready) {
      await gate.switchToDeployment();
      return;
    }
    const toastId = toast.push({
      title: "Approve fee budget",
      body: "Confirm the bounded operational-fee allowance in your wallet.",
      tone: "pending",
    });
    try {
      await approve.mutateAsync({
        account: account.address,
        amounts: [amount],
        chainId: SymmioSupportedChainId.ARBITRUM,
        gasless: false,
      });
      toast.update(toastId, {
        title: "Fee budget approved",
        body: `${budget} USDC is now the maximum the gasless charger may draw.`,
        tone: "long",
      });
    } catch (error) {
      toast.update(toastId, {
        title: "Approval failed",
        body: error instanceof Error ? error.message : String(error),
        tone: "error",
      });
    }
  }

  const current = allowance.data?.allowance ?? 0n;

  return (
    <Panel>
      <PanelHeader
        eyebrow="Step 2"
        title="Operational fee budget"
        actions={
          <Pill dot color={current > 0n ? "var(--long-500)" : "var(--warn-500)"}>
            {current > 0n ? "approved" : "approval needed"}
          </Pill>
        }
      />
      <div className="flex flex-col gap-5 p-4">
        <p className="text-sm leading-relaxed text-fg-2">
          Relayed operations charge the selected account’s Core balance. The allowance caps those charges; it is not
          spendable collateral. Keep the budget bounded and top it up deliberately.
        </p>

        <DetailSection title="Selected account" note="18-decimal Core units">
          <DetailRow
            label="Core balance"
            value={<Numeric size="sm">{formatUsd(fromWei(balance.data), { exact: true, maxDecimals: 4 })}</Numeric>}
            isLoading={balance.isLoading}
          />
          <DetailRow
            label="Remaining allowance"
            value={
              <Numeric size="sm" tone={current > 0n ? "long" : "warn"}>
                {formatUsd(fromWei(current), { exact: true, maxDecimals: 4 })}
              </Numeric>
            }
            isLoading={allowance.isLoading}
          />
          <DetailRow
            label="Fee multiplier"
            value={<Numeric size="sm">{formatMultiplier(allowance.data?.feeMultiplier)}</Numeric>}
          />
          {allowance.data?.reductionReadyAt && allowance.data.reductionReadyAt > 0n ? (
            <DetailRow
              label="Pending reduction"
              value={
                <Numeric size="sm">{formatUsd(fromWei(allowance.data.pendingAllowance), { exact: true })}</Numeric>
              }
              sub={`effective ${formatDate(Number(allowance.data.reductionReadyAt))}`}
            />
          ) : null}
        </DetailSection>

        <Field
          label="New bounded budget"
          value={budget}
          onChange={(event) => setBudget(event.target.value)}
          inputMode="decimal"
          adornment={<span className="font-mono text-sm text-fg-2">USDC</span>}
          invalid={amount === undefined}
          footnote="This replaces the current allowance. The bootstrap approval uses a normal wallet transaction."
        />

        <Button
          type="button"
          variant="primary"
          loading={approve.isPending || gate.isSwitching}
          disabled={!account || amount === undefined}
          onClick={() => void approveBudget()}
        >
          {!account
            ? "Select a low-cap account first"
            : gate.needsSwitch
              ? `Switch to ${gate.targetName}`
              : "Approve fee budget"}
        </Button>
        {gate.error ? <p className="text-2xs text-short">{gate.error.message}</p> : null}
      </div>
    </Panel>
  );
}

function parseCoreAmount(value: string): bigint | undefined {
  try {
    const amount = parseUnits(value, 18);
    return amount >= 0n ? amount : undefined;
  } catch {
    return undefined;
  }
}

function formatMultiplier(value: bigint | undefined): string {
  if (value === undefined) return "—";
  return `${(Number(value) / 10_000).toFixed(2)}×`;
}
