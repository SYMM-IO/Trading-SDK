"use client";

import { AddressTag } from "@/components/address-tag";
import { DataList, DataRow } from "@/components/data-list";
import { ResultNote, ResultSuccess } from "@/components/result";
import { formatUsd } from "@/lib/format";
import { encodeSubAccountHookMetadata } from "@/lib/subaccount-metadata";
import type { GaslessDepositSubmitReceipt } from "@symmio/trading-core";
import {
  SubAccountIsolationType,
  useGaslessDepositPolicy,
  useSettleGaslessDepositNewAccount,
  useSymmioChainId,
  useSymmioConfig,
  useWalletAccount,
} from "@symmio/trading-react";
import { Button } from "@symmio/ui/components/button";
import { Spinner } from "@symmio/ui/components/spinner";
import { zeroAddress } from "viem";
import { GaslessCard } from "./gasless-card";
import { GaslessFailureNote } from "./gasless-failure-note";
import { storeGaslessRequest } from "./gasless-request-storage";
import { useGaslessWalletAssignments, useGaslessWalletAssignmentScope } from "./gasless-wallet-assignments";
import { useGaslessTokenBalance } from "./use-gasless-token-balance";
import { parseGaslessWalletIdText, WalletIdCollisionNote, WalletIdField } from "./wallet-id-field";

/** Name of the subaccount the settlement creates, and the referral code recorded for it. */
const NEW_ACCOUNT_NAME = "Main";

/**
 * The settlement that was accepted for a different wallet than the one it was
 * submitted for. The SDK raises this *after* acceptance — the request exists and
 * must be reconciled by its id, so the receipt travels on the error.
 */
function walletMismatchReceipt(error: unknown): GaslessDepositSubmitReceipt | null {
  if (typeof error !== "object" || error === null) return null;
  const { code, responseData } = error as { code?: string; responseData?: unknown };
  if (code !== "GASLESS_DEPOSIT_WALLET_MISMATCH") return null;
  return (responseData as GaslessDepositSubmitReceipt | undefined) ?? null;
}

/**
 * Deposit-onboarding card: the deterministic deposit address of one of the
 * connected wallet's GaslessWallets, its live collateral balance against the
 * settlement minimum, and the new-account settlement submit.
 *
 * Everything on screen is scaled by the **policy's** collateral token and
 * decimals, not the chain config's: the GaslessLayer sweeps the token it names
 * itself, and the whole observed balance of the selected wallet settles
 * together.
 */
export function GaslessDepositCard() {
  const { address, isConnected } = useWalletAccount();
  const chainId = useSymmioChainId();
  const chainConfig = useSymmioConfig().getChainConfig(chainId);
  const { affiliatesAddress } = chainConfig.addresses;
  /**
   * The settlement creates the subaccount under the chain's affiliate, and the
   * AccountLayer rejects an affiliate that is not ACTIVE — the zero address
   * never is, so it reverts with `AffiliateNotActive()` in the gateway's
   * simulation. The affiliate's `onAccountCreation` hook then decodes the
   * metadata, which is why the blob binds the chain's solver as PartyB.
   */
  const partyBToBind = chainConfig.solvers[chainConfig.defaultSolverId]?.address;

  const { assignments, setAssignment } = useGaslessWalletAssignments(useGaslessWalletAssignmentScope());
  const walletId = parseGaslessWalletIdText(assignments.deposit);
  const executeWalletId = parseGaslessWalletIdText(assignments.execute);
  const collides = walletId !== null && walletId === executeWalletId;

  const policy = useGaslessDepositPolicy({
    owner: address ?? zeroAddress,
    walletId: walletId ?? 0n,
    query: { enabled: Boolean(address) && walletId !== null },
  });
  const observed = useGaslessTokenBalance({
    token: policy.data?.collateralTokenAddress,
    holder: policy.data?.depositAddress,
    refetchInterval: 5_000,
  });
  /**
   * Persist at acceptance, not at confirmation: the `202` is the only moment
   * the request id is guaranteed to exist, and a reload during the wait would
   * otherwise lose the only handle on a workflow that keeps running.
   */
  const settle = useSettleGaslessDepositNewAccount({
    onAccepted: (accepted) => {
      storeGaslessRequest(chainId, {
        requestId: accepted.requestId,
        service: "deposits",
        protocolInstance: accepted.protocolInstance ?? "",
        operationType: accepted.operationType ?? "settleDepositToNewAccount",
        owner: accepted.owner,
        walletIds: accepted.walletIds.map((id) => id.toString()),
        idempotencyKey: accepted.idempotencyKey,
        at: Date.now(),
      });
    },
  });

  /**
   * The acceptance estimate deducts the deposit fee only (vendor doc: the
   * deposit API "subtracts the deposit fee only, while the current contract can
   * also charge for first deployment of a wallet"). Until a nonzero creation
   * fee has a quote handoff, settling this wallet would credit an amount no
   * screen here can predict — so the flow is blocked rather than guessed.
   */
  const creationFeeBlocks = (policy.data?.walletCreationFee ?? 0n) > 0n;
  const mismatch = walletMismatchReceipt(settle.error);

  const canSettle =
    Boolean(address) &&
    walletId !== null &&
    policy.data !== undefined &&
    observed.data !== undefined &&
    observed.data >= policy.data.settlementMinimum &&
    !creationFeeBlocks;

  return (
    <GaslessCard
      testId="gasless-deposit"
      method="getGaslessDepositPolicy"
      description="Cold-start onboarding: bridge collateral to the deterministic deposit address of one of your gasless wallets, then settle it into a new wallet-owned sub-account — the relayer pays every step's gas."
      wide
    >
      {!isConnected ? (
        <ResultNote testId="gasless-deposit-disconnected">Connect a wallet to derive its deposit address.</ResultNote>
      ) : (
        <>
          <WalletIdField
            id="gasless-deposit-wallet-id"
            value={assignments.deposit}
            onChange={(next) => {
              setAssignment("deposit", next);
              settle.reset();
            }}
            label="walletId (deposit)"
            hint="Remembered in this browser for this owner and deployment, so the id you funded is the id you settle."
            testId="input-gasless-deposit-wallet-id"
          />

          {collides ? (
            <WalletIdCollisionNote walletId={assignments.deposit} testId="gasless-deposit-collision" />
          ) : null}

          {walletId === null ? (
            <ResultNote testId="gasless-deposit-invalid-wallet-id">
              Enter a wallet id to derive its deposit address.
            </ResultNote>
          ) : policy.isPending ? (
            <ResultNote loading testId="gasless-deposit-loading">
              Reading deposit policy…
            </ResultNote>
          ) : policy.error ? (
            <GaslessFailureNote error={policy.error} testId="gasless-deposit-error" />
          ) : policy.data ? (
            <>
              <DataList>
                <DataRow label="Deposit address" value={<AddressTag address={policy.data.depositAddress} />} />
                <DataRow label="Collateral token" value={<AddressTag address={policy.data.collateralTokenAddress} />} />
                <DataRow
                  label="Deposit fee"
                  value={`${formatUsd(policy.data.depositFee, policy.data.collateralDecimals)} USDC`}
                  mono
                />
                <DataRow
                  label="Wallet creation fee"
                  value={`${formatUsd(policy.data.walletCreationFee, policy.data.collateralDecimals)} USDC`}
                  mono
                />
                <DataRow
                  label="Minimum deposit"
                  value={`${formatUsd(policy.data.minimumDeposit, policy.data.collateralDecimals)} USDC`}
                  mono
                />
                <DataRow
                  label="Settlement minimum"
                  value={`${formatUsd(policy.data.settlementMinimum, policy.data.collateralDecimals)} USDC`}
                  mono
                />
                <DataRow
                  label="Observed balance"
                  value={
                    observed.data !== undefined
                      ? `${formatUsd(observed.data, policy.data.collateralDecimals)} USDC`
                      : "…"
                  }
                  mono
                />
              </DataList>

              <ResultNote>
                Send only this policy’s collateral token to this address. Everything at the address settles together,
                and the flat fee comes off the top.
              </ResultNote>

              {creationFeeBlocks ? (
                <ResultNote testId="gasless-deposit-creation-fee-block">
                  This wallet is not deployed yet and its creation fee is{" "}
                  <span className="font-mono">
                    {formatUsd(policy.data.walletCreationFee, policy.data.collateralDecimals)} USDC
                  </span>
                  . The deposit service’s acceptance estimate deducts the deposit fee only, so the credited amount it
                  quotes would be wrong by at least that much — settlement stays blocked here until the service quotes
                  the creation fee too. Use a wallet id that is already deployed, or deploy this one with a wallet
                  execute first.
                </ResultNote>
              ) : null}

              <Button
                type="button"
                size="sm"
                disabled={!canSettle || settle.isPending}
                onClick={() => {
                  if (!address || walletId === null) return;
                  settle.mutate({
                    owner: address,
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
                data-testid="button-gasless-settle-new-account"
              >
                {settle.isPending ? (
                  <>
                    <Spinner className="size-4" /> Settling…
                  </>
                ) : (
                  "Settle into a new sub-account"
                )}
              </Button>

              {settle.error ? (
                <GaslessFailureNote
                  error={settle.error}
                  testId="gasless-settle-error"
                  label={mismatch ? "wallet-mismatch" : undefined}
                  headline={
                    mismatch
                      ? "The service accepted this settlement for a different wallet than the one it was submitted for. It is already queued — reconcile it by its request id before funding or settling anything else."
                      : undefined
                  }
                >
                  {mismatch ? (
                    <span>
                      Request <span className="font-mono text-xs">{mismatch.requestId}</span> — accepted for wallet{" "}
                      <span className="font-mono">{mismatch.walletId.toString()}</span> at{" "}
                      <span className="font-mono text-xs">{mismatch.depositAddress}</span>, submitted for wallet{" "}
                      <span className="font-mono">{walletId?.toString()}</span>.
                    </span>
                  ) : null}
                </GaslessFailureNote>
              ) : settle.isSuccess ? (
                <ResultSuccess testId="gasless-settle-result">
                  Settlement confirmed for wallet{" "}
                  <span className="font-mono">{settle.data.accepted.walletId.toString()}</span> — request{" "}
                  <span className="font-mono text-xs">{settle.data.accepted.requestId}</span>. Quoted credit (estimate){" "}
                  <span className="font-mono">
                    {settle.data.accepted.creditedAmount === null
                      ? "unreported"
                      : `${formatUsd(settle.data.accepted.creditedAmount, policy.data.collateralDecimals)} USDC`}
                  </span>{" "}
                  — the service estimates it at acceptance with the deposit fee deducted, so the settled credit can
                  differ. The hook waited for the relayer to land it, so the sub-account is readable now.
                </ResultSuccess>
              ) : null}
            </>
          ) : null}
        </>
      )}
    </GaslessCard>
  );
}
