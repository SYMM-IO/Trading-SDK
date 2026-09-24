"use client";

import { AddressTag } from "@/components/address-tag";
import { DataList, DataRow } from "@/components/data-list";
import { ResultNote, ResultSuccess } from "@/components/result";
import { GaslessFailureNote } from "@/features/gasless/gasless-failure-note";
import {
  useGaslessWalletAssignments,
  useGaslessWalletAssignmentScope,
} from "@/features/gasless/gasless-wallet-assignments";
import { useGaslessTokenBalance } from "@/features/gasless/use-gasless-token-balance";
import { parseGaslessWalletIdText, WalletIdField } from "@/features/gasless/wallet-id-field";
import { formatUsd } from "@/lib/format";
import { encodeSubAccountHookMetadata } from "@/lib/subaccount-metadata";
import {
  SubAccountIsolationType,
  useGaslessDepositPolicy,
  useSettleGaslessDepositNewAccount,
  useSymmioChainId,
  useSymmioConfig,
} from "@symmio/trading-react";
import { Button } from "@symmio/ui/components/button";
import { Spinner } from "@symmio/ui/components/spinner";
import { useEffect } from "react";
import type { Address } from "viem";

/** Name given to the sub-account the settlement creates. */
const NEW_ACCOUNT_NAME = "Main";

interface Props {
  owner: Address;
  /** Called once the settlement lands, so the wizard can re-read the sub-account list and select the new one. */
  onSettled: () => void;
}

/**
 * The zero-gas entry ramp: fund a deterministic GaslessWallet address, then have
 * the relayer sweep it into a brand-new sub-account.
 *
 * This is the only route that works for a wallet holding no native token at all.
 * `createSubAccounts` and `approve` are both ordinary transactions, so a wallet
 * with no gas can never take them — but the settlement is executed and paid for
 * by the relayer, and the fee comes out of the deposit itself. It therefore
 * covers the account step and the collateral step in one move.
 *
 * Everything on screen is scaled by the **policy's** collateral token and
 * decimals rather than the chain config's: the GaslessLayer names the token it
 * sweeps, and a deployment whose gasless collateral differs from the configured
 * one would otherwise be shown at the wrong scale.
 */
export function SetupColdStart({ owner, onSettled }: Props) {
  const chainId = useSymmioChainId();
  const chainConfig = useSymmioConfig().getChainConfig(chainId);
  const { affiliatesAddress } = chainConfig.addresses;
  /**
   * The AccountLayer rejects an inactive affiliate, and the affiliate's
   * `onAccountCreation` hook decodes this blob — which is what binds the
   * chain's solver as PartyB for the new account.
   */
  const partyBToBind = chainConfig.solvers[chainConfig.defaultSolverId]?.address;

  const { assignments, setAssignment } = useGaslessWalletAssignments(useGaslessWalletAssignmentScope());
  const walletId = parseGaslessWalletIdText(assignments.deposit);

  const policy = useGaslessDepositPolicy({
    owner,
    walletId: walletId ?? 0n,
    query: { enabled: walletId !== null },
  });
  const observed = useGaslessTokenBalance({
    token: policy.data?.collateralTokenAddress,
    holder: policy.data?.depositAddress,
    refetchInterval: 5_000,
  });
  const settle = useSettleGaslessDepositNewAccount();

  useEffect(() => {
    if (settle.isSuccess) onSettled();
  }, [settle.isSuccess, onSettled]);

  /**
   * The deposit API's acceptance estimate deducts the deposit fee only, so for a
   * wallet that is not deployed yet the credited amount it quotes is short by
   * the whole creation fee. Blocking beats crediting an amount no screen here
   * can predict.
   */
  const creationFeeBlocks = (policy.data?.walletCreationFee ?? 0n) > 0n;
  const funded =
    policy.data !== undefined && observed.data !== undefined && observed.data >= policy.data.settlementMinimum;
  const canSettle = walletId !== null && funded && !creationFeeBlocks;

  return (
    <div className="flex flex-col gap-4" data-testid="setup-cold-start">
      {walletId === null ? (
        <ResultNote testId="setup-cold-start-invalid-wallet-id">
          Enter a wallet id below to derive its deposit address.
        </ResultNote>
      ) : policy.isPending ? (
        <ResultNote loading testId="setup-cold-start-loading">
          Reading deposit policy…
        </ResultNote>
      ) : policy.error ? (
        <GaslessFailureNote error={policy.error} testId="setup-cold-start-error" />
      ) : policy.data ? (
        <>
          <ResultNote testId="setup-cold-start-instructions">
            Send USDC to the address below — from an exchange, a bridge, or another wallet — then settle it. The balance
            is polled every few seconds; everything sitting there settles together and the flat fee comes off the top.
          </ResultNote>

          <DataList>
            {/* `AddressTag` carries its own copy control, so no `copyValue` here. */}
            <DataRow label="Send USDC to" value={<AddressTag address={policy.data.depositAddress} />} />
            <DataRow label="Token" value={<AddressTag address={policy.data.collateralTokenAddress} />} />
            <DataRow
              label="Settlement minimum"
              value={`${formatUsd(policy.data.settlementMinimum, policy.data.collateralDecimals)} USDC`}
              mono
            />
            <DataRow
              label="Deposit fee"
              value={`${formatUsd(policy.data.depositFee, policy.data.collateralDecimals)} USDC`}
              mono
            />
            <DataRow
              label="Observed so far"
              value={
                observed.data !== undefined ? `${formatUsd(observed.data, policy.data.collateralDecimals)} USDC` : "…"
              }
              mono
            />
          </DataList>

          {creationFeeBlocks ? (
            <ResultNote testId="setup-cold-start-creation-fee-block">
              This wallet is not deployed yet and its creation fee is{" "}
              <span className="font-mono">
                {formatUsd(policy.data.walletCreationFee, policy.data.collateralDecimals)} USDC
              </span>
              . The service quotes the deposit fee only, so the credited amount would be wrong by at least that much —
              settlement stays blocked here until it quotes the creation fee too. Use a wallet id that is already
              deployed.
            </ResultNote>
          ) : null}

          <Button
            type="button"
            size="lg"
            className="w-full"
            disabled={!canSettle || settle.isPending}
            onClick={() => {
              if (walletId === null) return;
              settle.mutate({
                owner,
                walletId,
                affiliate: affiliatesAddress,
                accountData: {
                  name: NEW_ACCOUNT_NAME,
                  metadata: encodeSubAccountHookMetadata({ partyBToBind }),
                  isolationType: SubAccountIsolationType.MARKET_DIRECTION,
                  singleVAMode: true,
                },
              });
            }}
            data-testid="button-setup-cold-start-settle"
          >
            {settle.isPending ? <Spinner className="size-4" /> : null}
            {settle.isPending
              ? "Settling…"
              : funded
                ? "Create a funded sub-account"
                : "Waiting for the deposit to arrive"}
          </Button>

          {settle.error ? (
            <GaslessFailureNote error={settle.error} testId="setup-cold-start-settle-error" />
          ) : settle.isSuccess ? (
            <ResultSuccess testId="setup-cold-start-settle-success">
              <span className="text-foreground">
                Sub-account created and funded — no native gas was spent. Request{" "}
                <span className="font-mono text-xs">{settle.data.accepted.requestId}</span>.
              </span>
            </ResultSuccess>
          ) : null}
        </>
      ) : null}

      {/*
        Last, and deliberately so: wallet `0` is the right answer for a cold
        start, and the address above is the instruction the reader came for. The
        knob still has to be reachable, because funding one id and settling
        another is not recoverable from this screen.
      */}
      <div className="border-border/60 border-t pt-4">
        <WalletIdField
          id="setup-cold-start-wallet-id"
          value={assignments.deposit}
          onChange={(next) => {
            setAssignment("deposit", next);
            settle.reset();
          }}
          label="Depositing to a different gasless wallet?"
          hint="Remembered in this browser for this owner and deployment, so the id you funded is the id you settle."
          testId="input-setup-cold-start-wallet-id"
        />
      </div>
    </div>
  );
}
