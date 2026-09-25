"use client";

import { Button } from "@/components/button";
import { DetailRow, DetailSection } from "@/components/detail-list";
import { Field } from "@/components/field";
import { Panel, PanelHeader } from "@/components/panel";
import { Pill } from "@/components/pill";
import { useToast } from "@/components/toast";
import { Numeric } from "@/components/value";
import { useFundingAccounts } from "@/features/accounts/account-provider";
import { useSessionKey } from "@/features/session-key/use-session-key";
import { DELEGATION_TTL_SECONDS } from "@/features/wallet/use-trading-delegation";
import {
  getGaslessUnconfirmedSubmit,
  SymmioSupportedChainId,
  type GaslessAcceptedRequest,
  type GaslessUnconfirmedSubmit,
  type GaslessWalletCall,
} from "@symmio/trading-core";
import {
  useAreDelegationsActive,
  useGaslessWalletExecute,
  useGaslessWalletExecuteSelectors,
  useGrantDelegation,
  useWalletAccount,
} from "@symmio/trading-react";
import { useMemo, useState } from "react";
import { isAddress, isHex, size, zeroAddress, type Address, type Hex } from "viem";

interface Props {
  walletId: bigint | undefined;
  onAccepted: (request: GaslessAcceptedRequest) => void;
  onUnconfirmed: (submit: GaslessUnconfirmedSubmit) => void;
}

/** Advanced arbitrary contract call executed from the deterministic GaslessWallet. */
export function GaslessWalletCallPanel({ walletId, onAccepted, onUnconfirmed }: Props) {
  const { address: owner } = useWalletAccount();
  const account = useFundingAccounts().selected.lowcaps;
  const session = useSessionKey();
  const toast = useToast();
  const [target, setTarget] = useState("");
  const [data, setData] = useState("0x");

  const validTarget = isAddress(target);
  const validData = isHex(data) && size(data as Hex) >= 4;
  const calls = useMemo<readonly GaslessWalletCall[] | undefined>(
    () => (validTarget && validData ? [{ target: target as Address, data: data as Hex }] : undefined),
    [validTarget, validData, target, data],
  );
  const selectors = useGaslessWalletExecuteSelectors({ calls });
  const enabled = Boolean(account && session.address && selectors.length > 0);
  const delegation = useAreDelegationsActive({
    account: { addr: account?.address ?? zeroAddress, isPartyB: false },
    delegate: session.address ?? zeroAddress,
    selectors,
    chainId: SymmioSupportedChainId.ARBITRUM,
    query: { enabled },
  });
  const grant = useGrantDelegation();

  const execute = useGaslessWalletExecute({ onAccepted, abortOnUnmount: false });

  async function grantCallAuthority() {
    if (!account || !session.address || selectors.length === 0) return;
    const toastId = toast.push({
      title: "Authorise wallet call",
      body: `Granting ${selectors.length} selector${selectors.length === 1 ? "" : "s"} to this browser session key.`,
      tone: "pending",
    });
    try {
      await grant.mutateAsync({
        account: { addr: account.address, isPartyB: false },
        delegatedSigner: session.address,
        selectors,
        expiryTimestamp: BigInt(Math.floor(Date.now() / 1000) + DELEGATION_TTL_SECONDS),
        chainId: SymmioSupportedChainId.ARBITRUM,
      });
      toast.update(toastId, { title: "Call authority granted", tone: "long" });
    } catch (error) {
      toast.update(toastId, {
        title: "Authorisation failed",
        body: error instanceof Error ? error.message : String(error),
        tone: "error",
      });
    }
  }

  async function executeCall() {
    if (!calls || !account || !session.address || !owner || walletId === undefined) return;
    const toastId = toast.push({
      title: "Wallet call queued",
      body: "Signed locally by the session key; waiting for relay confirmation.",
      tone: "pending",
    });
    try {
      const result = await execute.mutateAsync({
        owner,
        walletId,
        from: session.address,
        signerAccount: account.address,
        calls,
        operationType: "prismWalletCall",
        chainId: SymmioSupportedChainId.ARBITRUM,
      });
      toast.update(toastId, {
        title: "Wallet call confirmed",
        body: `Request ${result.accepted.requestId} succeeded.`,
        tone: "long",
      });
    } catch (error) {
      const pending = getGaslessUnconfirmedSubmit(error);
      if (pending) onUnconfirmed(pending);
      const unconfirmed = isConfirmationTimeout(error);
      toast.update(toastId, {
        title: pending
          ? "Wallet call outcome uncertain"
          : unconfirmed
            ? "Wallet call still running"
            : "Wallet call failed",
        body: pending
          ? "The exact signed submit is saved in Recovery. Do not sign this call again."
          : error instanceof Error
            ? error.message
            : String(error),
        tone: pending || unconfirmed ? "warn" : "error",
      });
    }
  }

  return (
    <Panel>
      <PanelHeader
        eyebrow="Advanced"
        title="Arbitrary wallet call"
        actions={
          <Pill dot color={delegation.allActive ? "var(--long-500)" : "var(--warn-500)"}>
            {execute.isPending ? execute.relay.phase : delegation.allActive ? "authorised" : "needs delegation"}
          </Pill>
        }
      />
      <div className="flex flex-col gap-5 p-4">
        <p className="text-sm leading-relaxed text-fg-2">
          Execute raw calldata from the selected deterministic wallet. The SDK derives the inner selector, requires a
          matching session-key delegation, signs locally, and relays the atomic call without native gas.
        </p>

        <Field
          label="Target contract"
          value={target}
          onChange={(event) => setTarget(event.target.value)}
          placeholder="0x…"
          invalid={target.length > 0 && !validTarget}
          inputClassName="text-sm"
          footnote={walletId === undefined ? "Select a valid wallet lane above." : `Executes from wallet ${walletId}.`}
        />
        <Field
          label="Calldata"
          value={data}
          onChange={(event) => setData(event.target.value)}
          placeholder="0x12345678…"
          invalid={data.length > 2 && !validData}
          inputClassName="text-sm"
          footnote="At least a 4-byte function selector. Review target and calldata before signing."
        />

        <DetailSection title="Preflight">
          <DetailRow
            label="Required selectors"
            value={<Numeric size="sm">{selectors.length || "—"}</Numeric>}
            sub={selectors.join(" · ") || "enter valid calldata"}
          />
          <DetailRow
            label="Session-key authority"
            value={
              <Numeric size="sm" tone={delegation.allActive ? "long" : "warn"}>
                {delegation.allActive ? "ready" : `${delegation.missing.length} missing`}
              </Numeric>
            }
            isLoading={delegation.isLoading}
          />
        </DetailSection>

        <div className="grid gap-2 sm:grid-cols-2">
          <Button
            type="button"
            variant="secondary"
            loading={grant.isPending}
            disabled={!enabled || delegation.allActive}
            onClick={() => void grantCallAuthority()}
          >
            Authorise selectors
          </Button>
          <Button
            type="button"
            variant="primary"
            loading={execute.isPending}
            disabled={
              !owner || !account || !session.address || !calls || walletId === undefined || !delegation.allActive
            }
            onClick={() => void executeCall()}
          >
            Execute gasless call
          </Button>
        </div>
      </div>
    </Panel>
  );
}

function isConfirmationTimeout(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code;
  return code === "GASLESS_TERMINAL_TIMEOUT" || code === "GASLESS_BROADCAST_TIMEOUT";
}
