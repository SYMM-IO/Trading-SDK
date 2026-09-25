import { Box, Text, useInput } from "ink";
import { useEffect, useState } from "react";
import { glyph, theme } from "../../config/theme.js";
import { formatUsd } from "../../lib/format.js";
import { parseAmount } from "../../lib/parse-amount.js";
import { isCrossMarginIsolation } from "../../lib/sub-account.js";
import { useAllocate, useDeallocate } from "../../sdk/mutations.js";
import { useAvailableBalance, useBalanceInfo } from "../../sdk/use-balances.js";
import { useSubAccount } from "../../sdk/use-sub-accounts.js";
import { Field, Segmented } from "../../ui/controls.js";
import { ErrorLine, LoadingLine } from "../../ui/feedback.js";
import { KeyValue } from "../../ui/kit.js";
import { Sheet } from "../../ui/sheet.js";
import { useAppState } from "../app-state.js";
import { useFormNav } from "../form-nav.js";
import { useToast } from "../toast.js";

const MODE_OPTIONS = [
  { key: "allocate", label: "Allocate" },
  { key: "deallocate", label: "Deallocate" },
] as const;

/** Move collateral between available and the classic (allocated) margin pool. */
export function AllocateSheet({ active }: { active: boolean }) {
  const { subAccount, subAccountDetail } = useSubAccount();
  const { closeOverlay } = useAppState();
  const toast = useToast();
  const allocate = useAllocate();
  const deallocate = useDeallocate();
  const available = useAvailableBalance(subAccount);
  const info = useBalanceInfo(subAccount);

  const [mode, setMode] = useState<"allocate" | "deallocate">("allocate");
  const [amount, setAmount] = useState("");
  const { row } = useFormNav(3, active, (current) => current === 1);

  const parsed = parseAmount(amount, 18);
  const allocated = info.data?.allocatedBalance ?? 0n;
  const sourceBalance = mode === "allocate" ? available.data : info.data?.allocatedBalance;
  const sourceError = mode === "allocate" ? available.error : info.error;
  const sourceUnavailable = sourceBalance == null || sourceError != null;
  const exceedsBalance = parsed != null && sourceBalance != null && parsed > sourceBalance;
  const activeMutation = mode === "allocate" ? allocate : deallocate;
  const busy = activeMutation.isPending;
  const isCrossMargin = isCrossMarginIsolation(subAccountDetail?.isolationType);

  useEffect(() => {
    if (allocate.isSuccess || deallocate.isSuccess) {
      toast.push("success", mode === "allocate" ? "Allocated" : "Deallocated");
      closeOverlay();
    }
  }, [allocate.isSuccess, deallocate.isSuccess, toast, closeOverlay, mode]);

  function submit() {
    if (!subAccount || parsed == null || sourceUnavailable || exceedsBalance || busy) return;
    if (mode === "allocate") allocate.mutate({ account: subAccount, amount: parsed });
    else deallocate.mutate({ account: subAccount, amount: parsed });
  }

  useInput(
    (_input, key) => {
      if (row === 0 && (key.leftArrow || key.rightArrow))
        setMode((current) => (current === "allocate" ? "deallocate" : "allocate"));
      else if (row === 2 && key.return) submit();
    },
    { isActive: active },
  );

  return (
    <Sheet title="Allocate" subtitle="available ↔ margin pool">
      <Box flexDirection="column">
        <KeyValue label="Available" value={formatUsd(available.data ?? 0n)} color={theme.positive} />
        <KeyValue label="Allocated" value={formatUsd(allocated)} />
      </Box>
      <Box flexDirection="column" gap={1} marginTop={1}>
        <Box>
          <Box width={13}>
            <Text color={row === 0 ? theme.primaryBright : theme.muted}>Action</Text>
          </Box>
          <Text color={row === 0 ? theme.borderFocus : theme.faint}>{row === 0 ? glyph.caret : " "} </Text>
          <Segmented options={MODE_OPTIONS} value={mode} focused={row === 0} onChange={setMode} />
        </Box>
        <Field
          label="Amount"
          value={amount}
          onChange={setAmount}
          focused={row === 1}
          suffix="USD"
          invalid={exceedsBalance}
          hint={
            sourceUnavailable
              ? "loading source balance…"
              : exceedsBalance
                ? `exceeds ${mode === "allocate" ? "available" : "allocated"} balance`
                : undefined
          }
        />
        <Box marginTop={1} flexDirection="column">
          {busy ? (
            <LoadingLine label={mode === "deallocate" ? "Deallocating (Muon signature)…" : "Allocating…"} />
          ) : (
            <Text
              backgroundColor={parsed != null && !sourceUnavailable && !exceedsBalance ? theme.primary : undefined}
              color={
                parsed != null && !sourceUnavailable && !exceedsBalance
                  ? theme.onAccent
                  : row === 2
                    ? theme.primaryBright
                    : theme.faint
              }
              bold
            >
              {row === 2 ? `${glyph.caret} ` : "  "}
              {` ${mode === "allocate" ? "Allocate" : "Deallocate"} `}
              {row === 2 ? " ⏎" : ""}
            </Text>
          )}
          <Text color={theme.faint}>
            {isCrossMargin
              ? "This CUSTOM account trades cross-margin from its Allocated balance."
              : "VA-isolated trades spend Available; classic allocation is normally unnecessary."}
          </Text>
          {(sourceError ?? activeMutation.error) != null && (
            <ErrorLine message={((sourceError ?? activeMutation.error) as Error).message} />
          )}
        </Box>
      </Box>
    </Sheet>
  );
}
