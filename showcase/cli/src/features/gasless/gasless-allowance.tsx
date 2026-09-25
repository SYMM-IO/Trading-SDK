import { Box, Text, useInput } from "ink";
import { useEffect, useState } from "react";
import { parseUnits } from "viem";
import { glyph, theme } from "../../config/theme.js";
import { formatDateTime, formatToken, shortAddress } from "../../lib/format.js";
import { useAvailableBalance, useBalanceInfo } from "../../sdk/use-balances.js";
import { useApproveGaslessAllowance, useGaslessAccountData } from "../../sdk/use-gasless.js";
import { useSigner } from "../../sdk/use-signer.js";
import { useSubAccount } from "../../sdk/use-sub-accounts.js";
import { Field } from "../../ui/controls.js";
import { ErrorLine, LoadingLine, SuccessLine } from "../../ui/feedback.js";
import { KeyValue, Panel } from "../../ui/kit.js";
import { useFormNav } from "../form-nav.js";
import { useToast } from "../toast.js";
import { gaslessFailureMessage } from "./gasless-error.js";
import { formatGaslessAllowance } from "./gasless-format.js";

interface Props {
  active: boolean;
  walletId: bigint;
}

const DEFAULT_APPROVAL = "50";

function parseApproval(value: string): bigint | null {
  try {
    const amount = parseUnits(value.trim(), 18);
    return amount > 0n ? amount : null;
  } catch {
    return null;
  }
}

/** Operational-fee budget and payer balance, with a bounded wallet-paid approval action. */
export function GaslessAllowance({ active, walletId }: Props) {
  const { address: owner, canSign } = useSigner();
  const { subAccount, subAccountName } = useSubAccount();
  const toast = useToast();
  const data = useGaslessAccountData({ enabled: true, owner, payer: subAccount, walletId });
  const freeBalance = useAvailableBalance(subAccount);
  const balanceInfo = useBalanceInfo(subAccount);
  const approve = useApproveGaslessAllowance();
  const { reset: resetApproval } = approve;
  const [amount, setAmount] = useState(DEFAULT_APPROVAL);
  const [armed, setArmed] = useState(false);
  const { row } = useFormNav(2, active, (current) => current === 0);
  const parsed = parseApproval(amount);
  const allowance = data.allowance.data;
  const payerBalance = (freeBalance.data ?? 0n) + (balanceInfo.data?.allocatedBalance ?? 0n);
  const canApprove = Boolean(subAccount && canSign && parsed !== null && !approve.isPending);

  useEffect(() => {
    setArmed(false);
    resetApproval();
  }, [subAccount, resetApproval]);

  useEffect(() => {
    if (!armed) return;
    const timeout = setTimeout(() => setArmed(false), 8_000);
    return () => clearTimeout(timeout);
  }, [armed]);

  useEffect(() => {
    if (!approve.isSuccess) return;
    setArmed(false);
    toast.push("success", "Operational-fee allowance confirmed on-chain");
  }, [approve.isSuccess, toast]);

  function submitApproval(): void {
    if (!canApprove || !subAccount || parsed === null) return;
    if (!armed) {
      setArmed(true);
      toast.push("info", `Approval armed — ${amount} Core units for the configured GaslessLayer`);
      return;
    }
    setArmed(false);
    approve.mutate({ account: subAccount, amount: parsed });
  }

  useInput(
    (input, key) => {
      if (row === 1 && key.return) submitApproval();
      if (row !== 0 && input === "r") data.refetch();
    },
    { isActive: active },
  );

  function onAmountChange(next: string): void {
    setAmount(next);
    setArmed(false);
    approve.reset();
  }

  return (
    <Box flexDirection="row" gap={1} flexGrow={1}>
      <Panel title="Payer state" flexGrow={1}>
        {!subAccount ? (
          <Text color={theme.warning}>Select a sub-account to inspect its fee budget.</Text>
        ) : data.allowance.isPending ? (
          <LoadingLine label="Reading operational-fee allowance…" />
        ) : (
          <Box flexDirection="column">
            <KeyValue label="Payer" value={`${subAccountName ?? "sub-account"} · ${shortAddress(subAccount)}`} />
            <KeyValue label="Core balance" value={`${formatToken(payerBalance, 18)} Core`} />
            <KeyValue label="Allowance" value={formatGaslessAllowance(allowance?.allowance)} />
            <KeyValue label="Pending reduction" value={formatGaslessAllowance(allowance?.pendingAllowance)} />
            <KeyValue
              label="Reduction ready"
              value={allowance?.reductionReadyAt ? formatDateTime(allowance.reductionReadyAt) : "none"}
            />
            <KeyValue label="Fee multiplier" value={allowance ? `${allowance.feeMultiplier.toString()} bps` : "—"} />
          </Box>
        )}
        <Box marginTop={1}>
          <Text color={theme.faint}>
            Allowance is a cap, not funds. Charges consume it, including an uncapped 2^256 − 1 approval.
          </Text>
        </Box>
      </Panel>

      <Panel title="Approve bounded budget" focused={active} width={45}>
        <Field
          label="Budget"
          value={amount}
          onChange={onAmountChange}
          onSubmit={submitApproval}
          focused={row === 0}
          suffix="Core-18"
          placeholder={DEFAULT_APPROVAL}
          hint="18-decimal Core units. Replaces the current allowance; reductions may be timelocked."
          invalid={parsed === null}
        />
        <Box marginTop={1}>
          {approve.isPending ? (
            <LoadingLine label="Simulating, signing, and confirming…" />
          ) : (
            <Text color={canApprove ? (armed ? theme.warning : theme.primaryBright) : theme.faint} bold={canApprove}>
              {row === 1 ? `${glyph.caret} ` : "  "}
              {armed ? "Confirm approval" : "Approve allowance"} {row === 1 ? "⏎" : ""}
            </Text>
          )}
        </Box>
        {!canSign && <Text color={theme.warning}>A signing wallet is required. Read-only mode cannot approve.</Text>}
        <Box marginTop={1}>
          <Text color={theme.faint}>This onboarding approval is wallet-paid and waits for a successful receipt.</Text>
        </Box>
        {approve.isSuccess && <SuccessLine message="Allowance updated." />}
        {approve.error != null && <ErrorLine message={gaslessFailureMessage(approve.error)} />}
        {data.allowance.error != null && <ErrorLine message={gaslessFailureMessage(data.allowance.error)} />}
      </Panel>
    </Box>
  );
}
