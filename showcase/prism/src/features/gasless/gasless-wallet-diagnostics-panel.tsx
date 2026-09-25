"use client";

import { CopyAction, DetailRow, DetailSection } from "@/components/detail-list";
import { Field } from "@/components/field";
import { Panel, PanelHeader } from "@/components/panel";
import { Pill } from "@/components/pill";
import { Numeric } from "@/components/value";
import { useFundingAccounts } from "@/features/accounts/account-provider";
import { shortenAddress } from "@/lib/format";
import { SymmioSupportedChainId } from "@symmio/trading-core";
import {
  useGaslessWalletAddress,
  useGaslessWalletCreationFee,
  useGaslessWalletNonce,
  useSymmioConfig,
  useWalletAccount,
} from "@symmio/trading-react";
import { formatUnits, zeroAddress } from "viem";

interface Props {
  walletIdText: string;
  walletId: bigint | undefined;
  onWalletIdChange: (value: string) => void;
}

/** Deterministic wallet identity, deployment cost and replay stream diagnostics. */
export function GaslessWalletDiagnosticsPanel({ walletIdText, walletId, onWalletIdChange }: Props) {
  const { address: owner } = useWalletAccount();
  const account = useFundingAccounts().selected.lowcaps;
  const config = useSymmioConfig();
  const enabled = Boolean(owner && walletId !== undefined);
  const parameters = {
    owner: owner ?? zeroAddress,
    walletId: walletId ?? 0n,
    chainId: SymmioSupportedChainId.ARBITRUM,
  } as const;

  const address = useGaslessWalletAddress({
    ...parameters,
    query: { enabled, staleTime: Infinity },
  });
  const creationFee = useGaslessWalletCreationFee({
    ...parameters,
    query: { enabled, refetchInterval: 15_000 },
  });
  const nonce = useGaslessWalletNonce({
    ...parameters,
    account: account?.address ?? zeroAddress,
    query: { enabled: enabled && Boolean(account), refetchInterval: 10_000 },
  });
  const collateralDecimals = config.getChainConfig(SymmioSupportedChainId.ARBITRUM).addresses.collateralDecimals;

  return (
    <Panel>
      <PanelHeader
        eyebrow="Wallet lane"
        title="Deterministic wallet identity"
        actions={
          <Pill dot color={walletId === undefined ? "var(--short-500)" : "var(--long-500)"}>
            {walletId === undefined ? "invalid id" : `wallet ${walletId}`}
          </Pill>
        }
      />
      <div className="grid gap-5 p-4 lg:grid-cols-[minmax(220px,0.65fr)_minmax(0,1.35fr)]">
        <div className="flex flex-col gap-3">
          <p className="text-sm leading-relaxed text-fg-2">
            One owner may use many independent wallet lanes. The selected id controls the deposit and advanced-call
            panels below, including their address, balance and replay nonce.
          </p>
          <Field
            label="Gasless wallet id"
            value={walletIdText}
            onChange={(event) => onWalletIdChange(event.target.value)}
            inputMode="numeric"
            invalid={walletId === undefined}
            footnote={walletId === undefined ? "Use a uint256 whole number." : "Wallet 0 is the default lane."}
          />
        </div>

        <DetailSection title="On-chain identity" note="Arbitrum staging">
          <DetailRow
            label="Wallet address"
            value={<span className="font-mono text-sm text-fg-1">{shortenAddress(address.data)}</span>}
            action={address.data ? <CopyAction value={address.data} label="gasless wallet address" /> : undefined}
            isLoading={address.isLoading}
          />
          <DetailRow
            label="Creation fee"
            value={<Numeric size="sm">{formatCollateral(creationFee.data, collateralDecimals)}</Numeric>}
            sub={creationFee.data === 0n ? "no creation fee due" : "charged once on first deployment"}
            isLoading={creationFee.isLoading}
          />
          <DetailRow
            label="Signer account"
            value={<span className="font-mono text-sm text-fg-1">{shortenAddress(account?.address)}</span>}
            sub="selected low-cap sub-account"
          />
          <DetailRow
            label="Consumed nonce"
            value={<Numeric size="sm">{nonce.data?.toString() ?? "—"}</Numeric>}
            sub={nonce.data === undefined ? "select an account" : `next execution reads ${nonce.data + 1n} fresh`}
            isLoading={nonce.isLoading}
          />
        </DetailSection>
      </div>
      {address.error || creationFee.error || nonce.error ? (
        <p className="border-t border-line-subtle px-4 py-3 text-sm text-short">
          {(address.error ?? creationFee.error ?? nonce.error)?.message}
        </p>
      ) : null}
    </Panel>
  );
}

function formatCollateral(value: bigint | undefined, decimals: number): string {
  if (value === undefined) return "—";
  const amount = Number(formatUnits(value, decimals));
  return `${amount.toLocaleString(undefined, { maximumFractionDigits: 6 })} collateral`;
}
