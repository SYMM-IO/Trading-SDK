import type { UnifiedQuote } from "@symmio/trading-core";
import { Box, Text, useInput } from "ink";
import { useEffect, useState } from "react";
import { glyph, theme } from "../../config/theme.js";
import { formatUsd } from "../../lib/format.js";
import { parseAmount } from "../../lib/parse-amount.js";
import { useAddMargin, useRemoveMargin } from "../../sdk/mutations.js";
import { useAvailableBalance } from "../../sdk/use-balances.js";
import { useMarketLookup } from "../../sdk/use-markets.js";
import { useSubAccount } from "../../sdk/use-sub-accounts.js";
import { useVirtualAccountMargin } from "../../sdk/use-va-margin.js";
import { Field, Segmented } from "../../ui/controls.js";
import { ErrorLine, LoadingLine } from "../../ui/feedback.js";
import { KeyValue } from "../../ui/kit.js";
import { Sheet } from "../../ui/sheet.js";
import { useAppState } from "../app-state.js";
import { useFormNav } from "../form-nav.js";
import { useToast } from "../toast.js";

const MODE_OPTIONS = [
  { key: "add", label: "Add" },
  { key: "remove", label: "Remove" },
] as const;

/** Add or remove margin on a position's Virtual Account. */
export function MarginSheet({ active, quote }: { active: boolean; quote: UnifiedQuote }) {
  const { byId } = useMarketLookup();
  const { subAccount } = useSubAccount();
  const { closeOverlay } = useAppState();
  const toast = useToast();
  const add = useAddMargin();
  const remove = useRemoveMargin();

  const meta = byId.get(String(quote.symbolId));
  const [mode, setMode] = useState<"add" | "remove">("add");
  const [amount, setAmount] = useState("");
  const { row } = useFormNav(3, active, (current) => current === 1);
  const virtualAccount = quote.vaAddress ?? quote.partyA;
  const balance = useAvailableBalance(subAccount);
  const vaMargin = useVirtualAccountMargin(virtualAccount, active && mode === "remove");

  const parsed = parseAmount(amount, 18);
  const sourceBalance = mode === "add" ? (balance.error == null ? balance.data : undefined) : vaMargin.removableBalance;
  const sourceLoading = mode === "add" ? balance.isLoading : vaMargin.isLoading;
  const sourceError = mode === "add" ? balance.error : vaMargin.error;
  const exceedsBalance = parsed != null && sourceBalance != null && parsed > sourceBalance;
  const activeMutation = mode === "add" ? add : remove;
  const busy = activeMutation.isPending;
  const canSubmit = parsed != null && sourceBalance != null && sourceError == null && !exceedsBalance && !busy;

  useEffect(() => {
    if (add.isSuccess || remove.isSuccess) {
      toast.push("success", "Margin updated");
      closeOverlay();
    }
  }, [add.isSuccess, remove.isSuccess, toast, closeOverlay]);

  function submit() {
    if (!canSubmit || parsed == null) return;
    if (mode === "add") add.mutate({ virtualAccount, amount: parsed });
    else remove.mutate({ virtualAccount, amount: parsed });
  }

  useInput(
    (_input, key) => {
      if (row === 0 && (key.leftArrow || key.rightArrow)) setMode((current) => (current === "add" ? "remove" : "add"));
      else if (row === 2 && key.return) submit();
    },
    { isActive: active },
  );

  return (
    <Sheet title={`Margin ${glyph.dot} ${meta?.symbol ?? ""}`} subtitle="position virtual account">
      <Box flexDirection="column">
        <KeyValue
          label="Current margin"
          value={vaMargin.allocatedBalance == null ? "—" : formatUsd(vaMargin.allocatedBalance)}
        />
        <KeyValue
          label={mode === "add" ? "Available" : "Removable"}
          value={sourceBalance == null ? "—" : formatUsd(sourceBalance)}
          dim
        />
        {sourceLoading && <LoadingLine label={mode === "add" ? "Checking account balance…" : "Checking VA margin…"} />}
        {sourceError != null && <ErrorLine message={(sourceError as Error).message} />}
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
            exceedsBalance
              ? `exceeds ${mode === "add" ? "available balance" : "safe removable balance"}`
              : parsed != null && sourceBalance == null
                ? `${mode === "add" ? "available balance" : "removable balance"} unavailable`
                : undefined
          }
        />

        <Box marginTop={1} flexDirection="column">
          {busy ? (
            <LoadingLine label={mode === "remove" ? "Removing (fetching Muon signature)…" : "Adding margin…"} />
          ) : (
            <Text
              backgroundColor={canSubmit ? theme.primary : undefined}
              color={canSubmit ? theme.onAccent : row === 2 ? theme.primaryBright : theme.faint}
              bold
            >
              {row === 2 ? `${glyph.caret} ` : "  "}
              {` ${mode === "add" ? "Add margin" : "Remove margin"} `}
              {row === 2 ? " ⏎" : ""}
            </Text>
          )}
          {mode === "remove" && (
            <Text color={theme.faint}>Maximum covers the full VA; submit refreshes Muon and honors the cooldown.</Text>
          )}
          {activeMutation.error != null && <ErrorLine message={(activeMutation.error as Error).message} />}
        </Box>
      </Box>
    </Sheet>
  );
}
