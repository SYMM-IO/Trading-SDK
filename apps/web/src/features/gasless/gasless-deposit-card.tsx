"use client";

import { AddressTag } from "@/components/address-tag";
import { DataList, DataRow } from "@/components/data-list";
import { ResultError, ResultNote, ResultSuccess } from "@/components/result";
import {
  SubAccountIsolationType,
  useCollateralBalance,
  useGaslessDepositPolicy,
  useSettleGaslessDepositNewAccount,
  useSymmioChainId,
  useWalletAccount,
} from "@symmio/trading-react";
import { Button } from "@symmio/ui/components/button";
import { Spinner } from "@symmio/ui/components/spinner";
import { zeroAddress } from "viem";
import { GaslessCard } from "./gasless-card";
import { storeGaslessRequest } from "./gasless-request-storage";

/**
 * Deposit-onboarding card: the connected wallet's deterministic deposit
 * address, its live collateral balance against the settlement minimum, and the
 * new-account settlement submit. The whole observed balance settles together.
 */
export function GaslessDepositCard() {
  const { address, isConnected } = useWalletAccount();
  const chainId = useSymmioChainId();

  const policy = useGaslessDepositPolicy({
    owner: address ?? zeroAddress,
    query: { enabled: Boolean(address) },
  });
  const observed = useCollateralBalance({
    owner: policy.data?.depositAddress ?? zeroAddress,
    query: { enabled: Boolean(policy.data), refetchInterval: 5_000 },
  });
  const settle = useSettleGaslessDepositNewAccount();

  const canSettle =
    Boolean(address) &&
    policy.data !== undefined &&
    observed.data !== undefined &&
    observed.data >= policy.data.settlementMinimum;

  return (
    <GaslessCard
      testId="gasless-deposit"
      method="getGaslessDepositPolicy"
      description="Cold-start onboarding: bridge collateral to the deterministic deposit address, then settle it into a new wallet-owned sub-account — the relayer pays every step's gas."
      wide
    >
      {!isConnected ? (
        <ResultNote testId="gasless-deposit-disconnected">Connect a wallet to derive its deposit address.</ResultNote>
      ) : policy.isPending ? (
        <ResultNote loading testId="gasless-deposit-loading">
          Reading deposit policy…
        </ResultNote>
      ) : policy.error ? (
        <ResultError kind={policy.error.kind} message={policy.error.message} testId="gasless-deposit-error" />
      ) : policy.data ? (
        <>
          <DataList>
            <DataRow label="Deposit address" value={<AddressTag address={policy.data.depositAddress} />} />
            <DataRow label="Collateral token" value={<AddressTag address={policy.data.collateralTokenAddress} />} />
            <DataRow label="Flat fee (raw)" value={policy.data.depositFee.toString()} mono />
            <DataRow label="Settlement minimum (raw)" value={policy.data.settlementMinimum.toString()} mono />
            <DataRow
              label="Observed balance (raw)"
              value={observed.data !== undefined ? observed.data.toString() : "…"}
              mono
            />
          </DataList>

          <ResultNote>
            Send only the configured collateral token to this address. Everything at the address settles together, and
            the flat fee comes off the top.
          </ResultNote>

          <Button
            type="button"
            size="sm"
            disabled={!canSettle || settle.isPending}
            onClick={() => {
              if (!address) return;
              settle.mutate(
                {
                  wallet: address,
                  affiliate: zeroAddress,
                  accountData: {
                    name: "Main",
                    isolationType: SubAccountIsolationType.MARKET_DIRECTION,
                    singleVAMode: true,
                  },
                },
                {
                  onSuccess: ({ accepted }) => {
                    storeGaslessRequest(chainId, {
                      requestId: accepted.requestId,
                      service: "deposits",
                      protocolInstance: "",
                      operationType: "settleDepositToNewAccount",
                      at: Date.now(),
                    });
                  },
                },
              );
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
            <ResultError kind={settle.error.kind} message={settle.error.message} testId="gasless-settle-error" />
          ) : settle.isSuccess ? (
            <ResultSuccess testId="gasless-settle-result">
              Settlement confirmed — request <span className="font-mono text-xs">{settle.data.accepted.requestId}</span>{" "}
              (credited {settle.data.accepted.creditedAmount.toString()} raw). The hook waited for the relayer to land
              it, so the sub-account is readable now.
            </ResultSuccess>
          ) : null}
        </>
      ) : null}
    </GaslessCard>
  );
}
