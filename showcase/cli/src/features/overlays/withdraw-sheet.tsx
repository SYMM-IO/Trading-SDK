import { core18ToCollateral, type WithdrawRequest } from "@symmio/trading-core";
import { Box, Text, useInput } from "ink";
import { useEffect, useState } from "react";
import { glyph, theme } from "../../config/theme.js";
import { formatCountdown, formatUsd } from "../../lib/format.js";
import { parseAmount } from "../../lib/parse-amount.js";
import { collateralDecimals } from "../../sdk/chain.js";
import { useCancelWithdraw, useFinalizeWithdraw, useWithdrawAuto } from "../../sdk/mutations.js";
import { useTradingBalance } from "../../sdk/use-balances.js";
import { useSdkScope } from "../../sdk/use-sdk-scope.js";
import { useSigner } from "../../sdk/use-signer.js";
import { useSubAccount } from "../../sdk/use-sub-accounts.js";
import { usePendingWithdraws } from "../../sdk/use-withdraw.js";
import { Field } from "../../ui/controls.js";
import { ErrorLine, LoadingLine } from "../../ui/feedback.js";
import { Divider, KeyValue } from "../../ui/kit.js";
import { Sheet } from "../../ui/sheet.js";
import { useFormNav } from "../form-nav.js";
import { useToast } from "../toast.js";

function requestAmount(request: WithdrawRequest): bigint {
  return request.parts.reduce((sum, part) => sum + part.amount, 0n);
}

/** Request-based withdraw: initiate, then finalize or cancel after cooldown. */
export function WithdrawSheet({ active }: { active: boolean }) {
  const { config, chainId } = useSdkScope();
  const { address } = useSigner();
  const { subAccount } = useSubAccount();
  const toast = useToast();
  const decimals = collateralDecimals(config, chainId);

  const pending = usePendingWithdraws(subAccount);
  const balance = useTradingBalance(subAccount);
  const initiate = useWithdrawAuto();
  const finalize = useFinalizeWithdraw();
  const cancel = useCancelWithdraw();

  const [amount, setAmount] = useState("");
  const requests = pending.data ?? [];
  const rowCount = 2 + requests.length;
  const { row } = useFormNav(rowCount, active, (current) => current === 0);
  const parsed = parseAmount(amount, decimals);
  const maxAmount = core18ToCollateral(balance.data ?? 0n, decimals, { rounding: "down" });
  const exceedsBalance = parsed != null && parsed > maxAmount;

  useEffect(() => {
    if (initiate.isSuccess) {
      toast.push("success", "Withdraw requested — starts cooldown");
      setAmount("");
    }
  }, [initiate.isSuccess, toast]);
  useEffect(() => {
    if (finalize.isSuccess) toast.push("success", "Withdraw finalized");
  }, [finalize.isSuccess, toast]);
  useEffect(() => {
    if (cancel.isSuccess) toast.push("info", "Withdraw canceled");
  }, [cancel.isSuccess, toast]);

  function onInitiate() {
    if (!subAccount || !address || parsed == null || exceedsBalance || initiate.isPending) return;
    initiate.mutate({ account: subAccount, amount: parsed, receiver: address });
  }

  useInput(
    (input, key) => {
      if (row === 1 && key.return) onInitiate();
      else if (row >= 2) {
        const request = requests[row - 2];
        if (!request || !subAccount) return;
        const matured = Date.now() >= Number(request.cooldownEndTime) * 1000;
        if (key.return && matured) finalize.mutate({ user: subAccount, requestId: request.id });
        else if (input === "x") cancel.mutate({ account: subAccount, requestId: request.id });
      }
    },
    { isActive: active },
  );

  const error = initiate.error ?? finalize.error ?? cancel.error;

  return (
    <Sheet title="Withdraw" subtitle="sub-account → wallet">
      <KeyValue
        label={balance.isCrossMargin ? "Allocated withdrawable" : "Available withdrawable"}
        value={formatUsd(balance.data ?? 0n)}
      />
      <Box marginTop={1}>
        <Field
          label="Amount"
          value={amount}
          onChange={setAmount}
          focused={row === 0}
          suffix="USDC"
          placeholder="0.00"
          invalid={exceedsBalance}
          hint={exceedsBalance ? "exceeds withdrawable balance" : undefined}
        />
      </Box>
      <Box marginTop={1}>
        {initiate.isPending ? (
          <LoadingLine label="Requesting withdraw…" />
        ) : (
          <Text
            backgroundColor={parsed != null && !exceedsBalance ? theme.primary : undefined}
            color={parsed != null && !exceedsBalance ? theme.onAccent : row === 1 ? theme.primaryBright : theme.faint}
            bold
          >
            {row === 1 ? `${glyph.caret} ` : "  "}
            {" Request withdraw "}
            {row === 1 ? " ⏎" : ""}
          </Text>
        )}
      </Box>

      <Box marginTop={1} flexDirection="column">
        <Divider width={54} />
        <Text color={theme.muted}>Pending requests</Text>
        {pending.isLoading ? (
          <LoadingLine label="Loading…" />
        ) : requests.length === 0 ? (
          <Text color={theme.faint}>None.</Text>
        ) : (
          requests.map((request, index) => {
            const selected = row - 2 === index;
            const matured = Date.now() >= Number(request.cooldownEndTime) * 1000;
            return (
              <Box key={String(request.id)} justifyContent="space-between" width={54}>
                <Text color={selected ? theme.primaryBright : theme.faint}>
                  {selected ? `${glyph.caret} ` : "  "}
                  <Text color={selected ? theme.text : theme.muted}>#{String(request.id)} </Text>
                  {formatUsd(requestAmount(request), decimals)}
                </Text>
                {matured ? (
                  <Text color={theme.positive}>{selected ? "⏎ finalize · x cancel" : "ready"}</Text>
                ) : (
                  <Text color={theme.warning}>{formatCountdown(request.cooldownEndTime)}</Text>
                )}
              </Box>
            );
          })
        )}
      </Box>
      {error != null && (
        <Box marginTop={1}>
          <ErrorLine message={(error as Error).message} />
        </Box>
      )}
    </Sheet>
  );
}
