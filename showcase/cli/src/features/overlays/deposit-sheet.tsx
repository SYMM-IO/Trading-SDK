import { Box, Text, useInput } from "ink";
import { useEffect, useState } from "react";
import { glyph, theme } from "../../config/theme.js";
import { formatUsd } from "../../lib/format.js";
import { parseAmount } from "../../lib/parse-amount.js";
import { isCrossMarginIsolation } from "../../lib/sub-account.js";
import { collateralDecimals } from "../../sdk/chain.js";
import { useApproveCollateral, useDeposit, useDepositAndAllocate } from "../../sdk/mutations.js";
import { useCollateralAllowance, useCollateralBalance } from "../../sdk/use-collateral.js";
import { useSdkScope } from "../../sdk/use-sdk-scope.js";
import { useSigner } from "../../sdk/use-signer.js";
import { useSubAccount } from "../../sdk/use-sub-accounts.js";
import { Field, Segmented } from "../../ui/controls.js";
import { ErrorLine, LoadingLine } from "../../ui/feedback.js";
import { KeyValue } from "../../ui/kit.js";
import { Sheet } from "../../ui/sheet.js";
import { useAppState } from "../app-state.js";
import { useFormNav } from "../form-nav.js";
import { useToast } from "../toast.js";

const DEST_OPTIONS = [
  { key: "available", label: "Available" },
  { key: "margin", label: "Margin pool" },
] as const;

/** Deposit collateral: approve the core once, then deposit (± allocate). */
export function DepositSheet({ active }: { active: boolean }) {
  const { config, chainId } = useSdkScope();
  const { address } = useSigner();
  const { subAccount, subAccountDetail } = useSubAccount();
  const { closeOverlay } = useAppState();
  const toast = useToast();
  const decimals = collateralDecimals(config, chainId);

  const wallet = useCollateralBalance(address);
  const allowance = useCollateralAllowance(address);
  const approve = useApproveCollateral();
  const deposit = useDeposit();
  const depositAndAllocate = useDepositAndAllocate();

  const [amount, setAmount] = useState("");
  const [dest, setDest] = useState<"available" | "margin">("available");
  const isCrossMargin = isCrossMarginIsolation(subAccountDetail?.isolationType);

  useEffect(() => {
    setDest(isCrossMargin ? "margin" : "available");
  }, [isCrossMargin, subAccount]);

  const { row } = useFormNav(3, active, (current) => current === 0);
  const parsed = parseAmount(amount, decimals);
  const balanceUnavailable = wallet.data == null || wallet.error != null;
  const exceedsBalance = parsed != null && wallet.data != null && parsed > wallet.data;
  const allowanceRaw = allowance.data ?? 0n;
  const needsApproval = parsed != null && allowanceRaw < parsed;
  const allocate = dest === "margin";
  const busy = approve.isPending || deposit.isPending || depositAndAllocate.isPending;

  useEffect(() => {
    if (approve.isSuccess) toast.push("success", "Collateral approved");
  }, [approve.isSuccess, toast]);
  useEffect(() => {
    if (deposit.isSuccess || depositAndAllocate.isSuccess) {
      toast.push("success", "Deposit submitted");
      closeOverlay();
    }
  }, [deposit.isSuccess, depositAndAllocate.isSuccess, toast, closeOverlay]);

  function onPrimary() {
    if (!subAccount || parsed == null || balanceUnavailable || exceedsBalance || busy) return;
    if (needsApproval) {
      approve.mutate({ amount: parsed });
      return;
    }
    const mutation = allocate ? depositAndAllocate : deposit;
    mutation.mutate({ account: subAccount, amount: parsed });
  }

  useInput(
    (_input, key) => {
      if (row === 1 && (key.leftArrow || key.rightArrow)) setDest(dest === "available" ? "margin" : "available");
      else if (row === 2 && key.return) onPrimary();
    },
    { isActive: active },
  );

  const label = needsApproval ? "Approve exact amount" : allocate ? "Deposit + allocate" : "Deposit";
  const error = wallet.error ?? allowance.error ?? approve.error ?? deposit.error ?? depositAndAllocate.error;
  const canSubmit = parsed != null && !balanceUnavailable && !exceedsBalance;

  return (
    <Sheet title="Deposit" subtitle={isCrossMargin ? "wallet → allocated cross-margin" : "wallet → available balance"}>
      <KeyValue label="Wallet balance" value={formatUsd(wallet.data ?? 0n, decimals)} />
      <Box marginTop={1} flexDirection="column" gap={1}>
        <Field
          label="Amount"
          value={amount}
          onChange={setAmount}
          focused={row === 0}
          placeholder="0.00"
          suffix="USDC"
          invalid={exceedsBalance}
          hint={balanceUnavailable ? "loading wallet balance…" : exceedsBalance ? "exceeds wallet balance" : undefined}
        />
        <Box>
          <Box width={13}>
            <Text color={row === 1 ? theme.primaryBright : theme.muted}>Destination</Text>
          </Box>
          <Text color={row === 1 ? theme.borderFocus : theme.faint}>{row === 1 ? glyph.caret : " "} </Text>
          <Segmented options={DEST_OPTIONS} value={dest} focused={row === 1} onChange={setDest} />
        </Box>
        <Box marginTop={1} flexDirection="column">
          {busy ? (
            <LoadingLine label={`${label} (approve in your wallet)…`} />
          ) : (
            <Text
              backgroundColor={canSubmit ? theme.primary : undefined}
              color={canSubmit ? theme.onAccent : row === 2 ? theme.primaryBright : theme.faint}
              bold
            >
              {row === 2 ? `${glyph.caret} ` : "  "}
              {` ${label} `}
              {row === 2 ? " ⏎" : ""}
            </Text>
          )}
          {needsApproval && !busy && (
            <Text color={theme.faint}>Only this amount is approved; deposit is a second transaction.</Text>
          )}
          {!needsApproval && !busy && (
            <Text color={theme.faint}>
              {isCrossMargin
                ? "CUSTOM accounts trade from allocated margin; keep Margin pool selected."
                : "VA-isolated accounts trade from Available; allocation is usually unnecessary."}
            </Text>
          )}
          {error != null && <ErrorLine message={(error as Error).message} />}
        </Box>
      </Box>
    </Sheet>
  );
}
