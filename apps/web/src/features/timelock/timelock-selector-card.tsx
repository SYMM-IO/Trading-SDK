"use client";

import { Field } from "@/components/field";
import { ResultError, ResultNote } from "@/components/result";
import { TxReceipt } from "@/components/tx-result";
import { useClearTimelocks, useSelectorTimelock, useSubAccount, useWalletAccount } from "@symmio/trading-react";
import { Button } from "@symmio/ui/components/button";
import { Input } from "@symmio/ui/components/input";
import { useState } from "react";
import { isAddressEqual, type Hex } from "viem";
import { recoveryTransactionHash, withTimelockAttemptLock } from "./timelock-recovery";
import type { TimelockContext } from "./use-timelock-context";

/** Low-level selector inspection and owner-controlled policy removal. */
export function TimelockSelectorCard({
  context,
  disabled,
  storageKey,
  saveRecovery,
  onBusyChange,
}: {
  context: TimelockContext;
  disabled: boolean;
  storageKey: string;
  saveRecovery: (value: string | null) => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const [selector, setSelector] = useState("");
  const [localError, setLocalError] = useState<string>();
  const valid = /^0x[\da-fA-F]{8}$/.test(selector);
  const account = context.policy.data!.rootAccount;
  const wallet = useWalletAccount();
  const root = useSubAccount({ account, chainId: context.chainId });
  const policy = useSelectorTimelock({
    account,
    selector: valid ? (selector as Hex) : "0x00000000",
    chainId: context.chainId,
    query: { enabled: valid, retry: false },
  });
  const clear = useClearTimelocks();
  const isOwner = Boolean(wallet.address && root.data?.owner && isAddressEqual(wallet.address, root.data.owner));

  return (
    <section className="border-border/70 flex flex-col gap-4 rounded-xl border p-4" data-testid="timelock-selector">
      <h3 className="text-sm font-medium">Inspect or clear a selector policy</h3>
      <Field
        label="Function selector"
        htmlFor="timelock-selector-input"
        hint="Four-byte selector, for example 0x12345678."
      >
        <Input
          id="timelock-selector-input"
          value={selector}
          onChange={(event) => setSelector(event.target.value.trim())}
        />
      </Field>
      {policy.data && valid ? (
        <ResultNote>
          Unlocker: {policy.data.unlocker} · delay: {policy.data.delay.toString()} seconds.
        </ResultNote>
      ) : null}
      {policy.error ? <ResultError message={policy.error.message} /> : null}
      <ResultNote>
        Changing a policy can invalidate schedules for the account. Clearing a protected policy may require its unlocker
        authorization or a matured schedule.
      </ResultNote>
      <Button
        variant="outline"
        disabled={
          disabled ||
          !valid ||
          !isOwner ||
          !wallet.isOnExpectedChain ||
          wallet.chainId !== context.chainId ||
          clear.isPending
        }
        onClick={async () => {
          if (!valid || !window.confirm("Clear this selector's policy? This can invalidate pending schedules.")) return;
          setLocalError(undefined);
          onBusyChange(true);
          let ownsRecord = false;
          try {
            await withTimelockAttemptLock(storageKey, async () => {
              saveRecovery(JSON.stringify({ kind: "clear-selector-policy", account, selector }));
              ownsRecord = true;
              context.acknowledgeIndexing(false);
              const result = await clear.mutateAsync({
                account,
                chainId: context.chainId,
                from: wallet.address,
                selectors: [selector as Hex],
              });
              if (result.receipt?.status === "success") saveRecovery(null);
              else
                saveRecovery(
                  JSON.stringify({ kind: "clear-selector-policy", account, selector, transactionHash: result.hash }),
                );
            });
          } catch (failure) {
            const hash = recoveryTransactionHash(failure);
            if (hash)
              saveRecovery(JSON.stringify({ kind: "clear-selector-policy", account, selector, transactionHash: hash }));
            else if (
              ownsRecord &&
              failure &&
              typeof failure === "object" &&
              "kind" in failure &&
              failure.kind === "user-rejected"
            )
              saveRecovery(null);
            setLocalError(failure instanceof Error ? failure.message : String(failure));
          } finally {
            onBusyChange(false);
          }
        }}
      >
        Clear selector policy
      </Button>
      {clear.error ? <ResultError message={clear.error.message} /> : null}
      {localError && !clear.error ? <ResultError message={localError} /> : null}
      {clear.data?.receipt ? (
        <TxReceipt
          hash={clear.data.hash}
          receipt={{ blockNumber: clear.data.receipt.blockNumber, status: clear.data.receipt.status }}
        />
      ) : null}
    </section>
  );
}
