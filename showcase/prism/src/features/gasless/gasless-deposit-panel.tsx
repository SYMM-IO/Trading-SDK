"use client";

import { Button } from "@/components/button";
import { CopyAction, DetailRow, DetailSection } from "@/components/detail-list";
import { Field } from "@/components/field";
import { Panel, PanelHeader } from "@/components/panel";
import { Pill } from "@/components/pill";
import { useToast } from "@/components/toast";
import { Numeric } from "@/components/value";
import {
  getGaslessUnconfirmedSubmit,
  SubAccountIsolationType,
  SymmioSupportedChainId,
  type GaslessAcceptedRequest,
  type GaslessUnconfirmedSubmit,
} from "@symmio/trading-core";
import {
  useGaslessDepositPolicy,
  useSettleGaslessDepositExistingAccount,
  useSettleGaslessDepositNewAccount,
  useSymmioConfig,
  useWalletAccount,
} from "@symmio/trading-react";
import { useEffect, useState } from "react";
import { erc20Abi, formatUnits, zeroAddress } from "viem";
import { useReadContract } from "wagmi";
import { useFundingAccounts } from "../accounts/account-provider";
import { AccountSelector } from "../accounts/account-selector";
import { encodeSubAccountHookMetadata } from "./sub-account-metadata";

interface Props {
  walletId: bigint | undefined;
  onAccepted: (request: GaslessAcceptedRequest) => void;
  onUnconfirmed: (submit: GaslessUnconfirmedSubmit) => void;
}

/** Deposit-address onboarding and settlement into an existing or new sub-account. */
export function GaslessDepositPanel({ walletId, onAccepted, onUnconfirmed }: Props) {
  const { address: owner } = useWalletAccount();
  const { selected } = useFundingAccounts();
  const account = selected.lowcaps;
  const [destination, setDestination] = useState<"existing" | "new">("existing");
  const [accountName, setAccountName] = useState("Gasless account");
  const toast = useToast();
  const config = useSymmioConfig();

  useEffect(() => {
    if (!account) setDestination("new");
  }, [account]);

  const policy = useGaslessDepositPolicy({
    owner: owner ?? zeroAddress,
    walletId: walletId ?? 0n,
    chainId: SymmioSupportedChainId.ARBITRUM,
    query: { enabled: Boolean(owner && walletId !== undefined) },
  });

  const balance = useReadContract({
    address: policy.data?.collateralTokenAddress,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: policy.data ? [policy.data.depositAddress] : undefined,
    chainId: SymmioSupportedChainId.ARBITRUM,
    query: { enabled: Boolean(policy.data), refetchInterval: 10_000 },
  });

  const settleExisting = useSettleGaslessDepositExistingAccount({ onAccepted, abortOnUnmount: false });
  const settleNew = useSettleGaslessDepositNewAccount({ onAccepted, abortOnUnmount: false });
  const settling = settleExisting.isPending || settleNew.isPending;
  const relayPhase = settleExisting.isPending ? settleExisting.relay.phase : settleNew.relay.phase;

  const observed = balance.data;
  const enough = Boolean(policy.data && observed !== undefined && observed >= policy.data.settlementMinimum);

  async function settleDeposit() {
    if (!owner || walletId === undefined) return;
    if (destination === "existing" && !account) return;
    if (destination === "new" && accountName.trim().length === 0) return;
    const toastId = toast.push({
      title: "Settlement submitted",
      body: "The relay will sweep the deposit address and confirm the on-chain credit.",
      tone: "pending",
    });
    try {
      const result =
        destination === "existing" && account
          ? await settleExisting.mutateAsync({
              owner,
              walletId,
              subAccount: account.address,
              chainId: SymmioSupportedChainId.ARBITRUM,
            })
          : await settleNew.mutateAsync({
              owner,
              walletId,
              affiliate: config.getChainConfig(SymmioSupportedChainId.ARBITRUM).addresses.affiliatesAddress,
              accountData: {
                name: accountName.trim(),
                isolationType: SubAccountIsolationType.MARKET_DIRECTION,
                singleVAMode: true,
                metadata: encodeSubAccountHookMetadata(
                  config.getSolver({ chainId: SymmioSupportedChainId.ARBITRUM, solverId: "enigma" }).address,
                ),
              },
              chainId: SymmioSupportedChainId.ARBITRUM,
            });
      toast.update(toastId, {
        title: "Deposit settled",
        body: `Request ${result.accepted.requestId} is confirmed.`,
        tone: "long",
      });
      void balance.refetch();
    } catch (error) {
      const pending = getGaslessUnconfirmedSubmit(error);
      if (pending) onUnconfirmed(pending);
      const unconfirmed = isConfirmationTimeout(error);
      toast.update(toastId, {
        title: pending
          ? "Settlement outcome uncertain"
          : unconfirmed
            ? "Settlement still running"
            : "Settlement failed",
        body: pending
          ? "The exact signed submit is saved in Recovery. Do not repeat this settlement."
          : error instanceof Error
            ? error.message
            : String(error),
        tone: pending || unconfirmed ? "warn" : "error",
      });
    }
  }

  const decimals = policy.data?.collateralDecimals ?? 6;

  return (
    <Panel>
      <PanelHeader
        eyebrow="Step 1"
        title="Fund without native gas"
        actions={
          <Pill dot color={settling ? "var(--accent)" : enough ? "var(--long-500)" : "var(--fg-3)"}>
            {settling ? relayPhase : enough ? "ready to settle" : "awaiting funds"}
          </Pill>
        }
      />
      <div className="flex flex-col gap-5 p-4">
        <p className="text-sm leading-relaxed text-fg-2">
          Send only the listed collateral token to this deterministic address. Each wallet id creates a separate deposit
          lane; settlement sweeps that lane’s full balance into the selected account.
        </p>

        <div className="grid grid-cols-2 gap-1 rounded-md border border-line bg-bg-2 p-1">
          <Button
            type="button"
            size="sm"
            variant={destination === "existing" ? "primary" : "ghost"}
            disabled={!account}
            onClick={() => setDestination("existing")}
          >
            Existing account
          </Button>
          <Button
            type="button"
            size="sm"
            variant={destination === "new" ? "primary" : "ghost"}
            onClick={() => setDestination("new")}
          >
            Create new account
          </Button>
        </div>

        {destination === "existing" ? (
          <div className="flex justify-end">
            <AccountSelector family="lowcaps" />
          </div>
        ) : (
          <Field
            label="New account name"
            value={accountName}
            onChange={(event) => setAccountName(event.target.value)}
            maxLength={64}
            invalid={accountName.trim().length === 0}
            footnote="Creates a market-direction isolated account and credits it in the same relayed transaction."
          />
        )}

        {policy.error ? (
          <p className="rounded-md border border-short/30 bg-short-bg px-3 py-2 text-sm text-short">
            {policy.error.message}
          </p>
        ) : (
          <DetailSection title="Deposit policy" note="Arbitrum staging">
            <DetailRow
              label="Deposit address"
              value={
                <span className="max-w-[28ch] truncate font-mono text-sm text-fg-1">
                  {policy.data?.depositAddress ?? "—"}
                </span>
              }
              action={
                policy.data ? (
                  <CopyAction value={policy.data.depositAddress} label="gasless deposit address" />
                ) : undefined
              }
              isLoading={policy.isLoading}
            />
            <DetailRow
              label="Collateral token"
              value={<span className="font-mono text-sm text-fg-1">{policy.data?.collateralTokenAddress ?? "—"}</span>}
              action={
                policy.data ? (
                  <CopyAction value={policy.data.collateralTokenAddress} label="collateral token" />
                ) : undefined
              }
              isLoading={policy.isLoading}
            />
            <DetailRow
              label="Observed balance"
              value={
                <Numeric size="sm" tone={enough ? "long" : "default"}>
                  {formatToken(observed, decimals)}
                </Numeric>
              }
              sub="refreshes every 10 seconds"
              isLoading={balance.isLoading}
            />
            <DetailRow
              label="Settlement minimum"
              value={<Numeric size="sm">{formatToken(policy.data?.settlementMinimum, decimals)}</Numeric>}
              sub="fees included"
              isLoading={policy.isLoading}
            />
            <DetailRow
              label="Deposit fee"
              value={<Numeric size="sm">{formatToken(policy.data?.depositFee, decimals)}</Numeric>}
              isLoading={policy.isLoading}
            />
            <DetailRow
              label="Wallet creation fee"
              value={<Numeric size="sm">{formatToken(policy.data?.walletCreationFee, decimals)}</Numeric>}
              sub={policy.data?.walletCreationFee === 0n ? "wallet already deployed" : "one time"}
              isLoading={policy.isLoading}
            />
          </DetailSection>
        )}

        <Button
          type="button"
          variant="primary"
          size="lg"
          loading={settling}
          disabled={
            !owner ||
            walletId === undefined ||
            !enough ||
            (destination === "existing" ? !account : accountName.trim().length === 0)
          }
          onClick={() => void settleDeposit()}
        >
          {!enough
            ? "Fund the deposit address first"
            : destination === "new"
              ? "Create and fund account"
              : !account
                ? "Select an account"
                : "Settle into selected account"}
        </Button>
      </div>
    </Panel>
  );
}

function formatToken(value: bigint | undefined, decimals: number): string {
  if (value === undefined) return "—";
  return `${Number(formatUnits(value, decimals)).toLocaleString(undefined, { maximumFractionDigits: 6 })} USDC`;
}

function isConfirmationTimeout(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code;
  return code === "GASLESS_TERMINAL_TIMEOUT" || code === "GASLESS_BROADCAST_TIMEOUT";
}
