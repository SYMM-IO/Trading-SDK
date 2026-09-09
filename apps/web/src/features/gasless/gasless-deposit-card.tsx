"use client";

import { AddressTag } from "@/components/address-tag";
import { DataList, DataRow } from "@/components/data-list";
import { ResultError, ResultNote, ResultSuccess } from "@/components/result";
import { formatUsd } from "@/lib/format";
import { encodeSubAccountHookMetadata } from "@/lib/subaccount-metadata";
import {
  SubAccountIsolationType,
  SymmioRequestError,
  useCollateralBalance,
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
import { storeGaslessRequest } from "./gasless-request-storage";

/** Name of the subaccount the settlement creates, and the referral code recorded for it. */
const NEW_ACCOUNT_NAME = "Main";

/**
 * The gateway explains a rejection in the response body (`detail.code`,
 * `detail.details.revert_selector`, …) — `error.message` carries only the HTTP
 * status, which turns every distinct failure into the same unhelpful line.
 * Render the body verbatim so a rejection is diagnosable from the UI.
 */
function gatewayDetailOf(error: unknown): string | undefined {
  if (!(error instanceof SymmioRequestError) || error.kind !== "api") return undefined;
  const body = error.responseData;
  if (body === null || body === undefined) return undefined;
  return typeof body === "string" ? body : JSON.stringify(body, null, 2);
}

/**
 * Deposit-onboarding card: the connected wallet's deterministic deposit
 * address, its live collateral balance against the settlement minimum, and the
 * new-account settlement submit. The whole observed balance settles together.
 */
export function GaslessDepositCard() {
  const { address, isConnected } = useWalletAccount();
  const chainId = useSymmioChainId();
  const chainConfig = useSymmioConfig().getChainConfig(chainId);
  const { affiliatesAddress, collateralDecimals } = chainConfig.addresses;
  /**
   * The settlement creates the subaccount under the chain's affiliate, and the
   * AccountLayer rejects an affiliate that is not ACTIVE — the zero address
   * never is, so it reverts with `AffiliateNotActive()` in the gateway's
   * simulation. The affiliate's `onAccountCreation` hook then decodes the
   * metadata, which is why the blob binds the chain's solver as PartyB.
   */
  const partyBToBind = chainConfig.solvers[chainConfig.defaultSolverId]?.address;

  const policy = useGaslessDepositPolicy({
    owner: address ?? zeroAddress,
    query: { enabled: Boolean(address) },
  });
  const observed = useCollateralBalance({
    owner: policy.data?.depositAddress ?? zeroAddress,
    query: { enabled: Boolean(policy.data), refetchInterval: 5_000 },
  });
  const settle = useSettleGaslessDepositNewAccount();

  const gatewayDetail = gatewayDetailOf(settle.error);
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
            <DataRow label="Deposit fee" value={`${formatUsd(policy.data.depositFee, collateralDecimals)} USDC`} mono />
            <DataRow
              label="Minimum deposit"
              value={`${formatUsd(policy.data.minimumDeposit, collateralDecimals)} USDC`}
              mono
            />
            <DataRow
              label="Settlement minimum"
              value={`${formatUsd(policy.data.settlementMinimum, collateralDecimals)} USDC`}
              mono
            />
            <DataRow
              label="Observed balance"
              value={observed.data !== undefined ? `${formatUsd(observed.data, collateralDecimals)} USDC` : "…"}
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
                  affiliate: affiliatesAddress,
                  accountData: {
                    name: NEW_ACCOUNT_NAME,
                    metadata: encodeSubAccountHookMetadata({ partyBToBind }),
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
            <ResultError
              kind={settle.error.kind}
              message={
                <>
                  {settle.error.message}
                  {gatewayDetail ? (
                    <pre className="mt-2 max-h-64 overflow-auto font-mono text-[0.7rem] whitespace-pre-wrap">
                      {gatewayDetail}
                    </pre>
                  ) : null}
                </>
              }
              testId="gasless-settle-error"
            />
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
