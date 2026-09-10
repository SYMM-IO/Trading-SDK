"use client";

import { AddressTag } from "@/components/address-tag";
import { DataList, DataRow } from "@/components/data-list";
import { Field } from "@/components/field";
import { ResultError, ResultNote, ResultSuccess } from "@/components/result";
import { formatUsd } from "@/lib/format";
import {
  SymmioRequestError,
  useCollateralBalance,
  useGaslessWalletAddress,
  useGaslessWalletExecute,
  useSymmioChainId,
  useSymmioConfig,
  useWalletAccount,
  type GaslessWalletCall,
} from "@symmio/trading-react";
import { Button } from "@symmio/ui/components/button";
import { Input } from "@symmio/ui/components/input";
import { Spinner } from "@symmio/ui/components/spinner";
import { Textarea } from "@symmio/ui/components/textarea";
import { useState } from "react";
import { erc20Abi, isAddress, parseUnits, zeroAddress, type Address, type Hex } from "viem";
import { SubAccountPicker } from "../inspector/subaccount-picker";
import { GaslessCard } from "./gasless-card";
import { storeGaslessRequest } from "./gasless-request-storage";
import { useSessionKeySigning } from "./gasless-write-mode-store";

/** Which of the two call forms the builder composes. */
type CallForm = "transfer" | "raw";

/** Calldata is `0x` plus whole bytes — a selector alone is four bytes. */
const HEX_CALLDATA = /^0x([0-9a-fA-F]{2})*$/;

/**
 * The gateway explains a rejection in the response body (`detail.code`,
 * `detail.details.revert_selector`, …) — `error.message` carries only the HTTP
 * status, which turns every distinct failure into the same unhelpful line.
 */
function gatewayDetailOf(error: unknown): string | undefined {
  if (!(error instanceof SymmioRequestError) || error.kind !== "api") return undefined;
  const body = error.responseData;
  if (body === null || body === undefined) return undefined;
  return typeof body === "string" ? body : JSON.stringify(body, null, 2);
}

/**
 * Arbitrary-call card: build a batch and run it from the connected wallet's
 * deterministic gasless wallet. The two forms exercise both halves of the
 * `GaslessWalletCall` union — the ERC-20 transfer builds an
 * `{ abi, functionName, args }` call the SDK encodes, raw mode passes calldata
 * straight through.
 *
 * The wallet's own balance does not pay the fee: the GaslessLayer prices the
 * operation from the inner selectors and charges the SYMMIO account, so a
 * missing allowance surfaces here as a gateway rejection, not as a local error.
 */
export function GaslessWalletExecuteCard() {
  const { address, isConnected } = useWalletAccount();
  const chainId = useSymmioChainId();
  const { collateralAddress, collateralDecimals } = useSymmioConfig().getChainConfig(chainId).addresses;

  const sessionKey = useSessionKeySigning();

  const [signerAccount, setSignerAccount] = useState<{ subAccount?: Address; name?: string }>({});
  const [form, setForm] = useState<CallForm>("transfer");
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [target, setTarget] = useState("");
  const [calldata, setCalldata] = useState("");
  const [operationType, setOperationType] = useState("");

  /**
   * The wallet is derived from the owner either way — `ownerOf(signerAccount)`
   * is this same address — so the panel keeps reading it for the connected
   * wallet and lets `signerAccount` decide authority and billing only.
   */
  const wallet = useGaslessWalletAddress({ owner: address ?? zeroAddress, query: { enabled: Boolean(address) } });
  const parked = useCollateralBalance({
    owner: wallet.data,
    query: { enabled: Boolean(wallet.data), refetchInterval: 5_000 },
  });
  const execute = useGaslessWalletExecute();

  /** `null` while the inputs cannot yet describe a batch. */
  const calls = buildCalls();

  function buildCalls(): readonly GaslessWalletCall[] | null {
    if (form === "transfer") {
      if (!isAddress(recipient) || amount.trim().length === 0) return null;
      let units: bigint;
      try {
        units = parseUnits(amount, collateralDecimals);
      } catch {
        return null;
      }
      if (units <= 0n) return null;
      return [
        { target: collateralAddress, abi: erc20Abi, functionName: "transfer", args: [recipient as Address, units] },
      ];
    }
    if (!isAddress(target) || !HEX_CALLDATA.test(calldata)) return null;
    return [{ target: target as Address, data: calldata as Hex }];
  }

  /** Only route `from` to the key when it is loaded and the user asked for it. */
  const signingKey = sessionKey.enabled ? sessionKey.sessionKeyAddress : undefined;
  /** A delegate signer needs an account to hold its delegation; an EOA cannot. */
  const needsSignerAccount = signingKey !== undefined && signerAccount.subAccount === undefined;

  const gatewayDetail = gatewayDetailOf(execute.error);

  return (
    <GaslessCard
      testId="gasless-wallet-execute"
      method="gaslessWalletExecute"
      description="Run any contract call from the deterministic gasless wallet — an atomic batch of arbitrary calls, with the relayer paying the native gas."
      wide
    >
      {!isConnected ? (
        <ResultNote testId="gasless-wallet-execute-disconnected">
          Connect a wallet to derive its gasless wallet.
        </ResultNote>
      ) : wallet.isPending ? (
        <ResultNote loading testId="gasless-wallet-execute-loading">
          Reading the gasless wallet address…
        </ResultNote>
      ) : wallet.error ? (
        <ResultError kind={wallet.error.kind} message={wallet.error.message} testId="gasless-wallet-execute-error" />
      ) : wallet.data ? (
        <>
          <DataList>
            <DataRow label="Gasless wallet" value={<AddressTag address={wallet.data} />} />
            <DataRow
              label="Parked collateral"
              value={parked.data !== undefined ? `${formatUsd(parked.data, collateralDecimals)} USDC` : "…"}
              mono
            />
          </DataList>

          <SubAccountPicker
            idPrefix="input-gasless-execute-signer-account"
            selected={signerAccount}
            onSelect={(next) => {
              setSignerAccount(next);
              execute.reset();
            }}
            accountLabel="signerAccount (sub-account)"
            accountEmptyHint="Optional for an owner-signed call; required to sign with a session key, and the account the fee is billed to."
            selectedHintLabel="Signer account"
          />

          <Field label="Call form" hint="Both forms are entries in the same batch; the SDK encodes the ABI one.">
            <div className="flex gap-2">
              {(
                [
                  ["transfer", "ERC-20 transfer"],
                  ["raw", "Raw calldata"],
                ] as const
              ).map(([option, label]) => (
                <Button
                  key={option}
                  type="button"
                  size="sm"
                  variant={form === option ? "default" : "outline"}
                  onClick={() => setForm(option)}
                  data-testid={`button-gasless-call-form-${option}`}
                >
                  {label}
                </Button>
              ))}
            </div>
          </Field>

          {form === "transfer" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Recipient" htmlFor="gasless-execute-recipient" hint="Where the parked collateral goes.">
                <Input
                  id="gasless-execute-recipient"
                  value={recipient}
                  onChange={(event) => setRecipient(event.target.value)}
                  placeholder="0x…"
                  className="font-mono"
                  data-testid="input-gasless-execute-recipient"
                />
              </Field>
              <Field label="Amount (USDC)" htmlFor="gasless-execute-amount" hint="Decimal, not raw units.">
                <Input
                  id="gasless-execute-amount"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  placeholder="10.5"
                  className="font-mono"
                  data-testid="input-gasless-execute-amount"
                />
              </Field>
            </div>
          ) : (
            <>
              <Field
                label="Target"
                htmlFor="gasless-execute-target"
                hint="Any contract — nothing here is allow-listed."
              >
                <Input
                  id="gasless-execute-target"
                  value={target}
                  onChange={(event) => setTarget(event.target.value)}
                  placeholder="0x…"
                  className="font-mono"
                  data-testid="input-gasless-execute-target"
                />
              </Field>
              <Field
                label="Calldata"
                htmlFor="gasless-execute-calldata"
                hint="Encode it yourself (viem's encodeFunctionData) and paste the hex."
              >
                <Textarea
                  id="gasless-execute-calldata"
                  value={calldata}
                  onChange={(event) => setCalldata(event.target.value)}
                  placeholder="0xa9059cbb…"
                  rows={4}
                  className="font-mono text-xs"
                  data-testid="input-gasless-execute-calldata"
                />
              </Field>
            </>
          )}

          <Field
            label="Operation type"
            htmlFor="gasless-execute-operation-type"
            hint="Optional label stored with the request. Fees are not keyed from it."
          >
            <Input
              id="gasless-execute-operation-type"
              value={operationType}
              onChange={(event) => setOperationType(event.target.value)}
              placeholder="gaslessqWalletExecute"
              className="font-mono"
              data-testid="input-gasless-execute-operation-type"
            />
          </Field>

          <ResultNote>
            The fee is billed to <code>signerAccount</code>, not to the collateral parked here. Left blank it defaults
            to your wallet address, which holds no SYMMIO collateral — so pick a funded sub-account and grant its
            operational-fee allowance above. The batch is atomic, so a reverted call costs nothing but time.
          </ResultNote>

          {needsSignerAccount ? (
            <ResultNote testId="gasless-wallet-execute-needs-signer-account">
              Signing with the session key needs a sub-account: a delegation can only be granted on an account the
              AccountLayer knows an owner for, never on a plain wallet address.
            </ResultNote>
          ) : null}

          <Button
            type="button"
            size="sm"
            disabled={calls === null || needsSignerAccount || execute.isPending}
            onClick={() => {
              if (calls === null) return;
              execute.mutate(
                {
                  calls,
                  ...(signerAccount.subAccount ? { signerAccount: signerAccount.subAccount } : {}),
                  ...(signingKey ? { from: signingKey } : {}),
                  ...(operationType.trim().length > 0 ? { operationType: operationType.trim() } : {}),
                },
                {
                  onSuccess: ({ accepted }) => {
                    storeGaslessRequest(chainId, {
                      requestId: accepted.requestId,
                      service: "operations",
                      protocolInstance: "",
                      operationType: operationType.trim() || "gaslessqWalletExecute",
                      at: Date.now(),
                    });
                  },
                },
              );
            }}
            data-testid="button-gasless-wallet-execute"
          >
            {execute.isPending ? (
              <>
                <Spinner className="size-4" /> {execute.relay.phase === "idle" ? "Signing…" : execute.relay.phase}
              </>
            ) : (
              "Execute from the wallet"
            )}
          </Button>

          {execute.error ? (
            <ResultError
              kind={execute.error.kind}
              message={
                <>
                  {execute.error.message}
                  {gatewayDetail ? (
                    <pre className="mt-2 max-h-64 overflow-auto font-mono text-[0.7rem] whitespace-pre-wrap">
                      {gatewayDetail}
                    </pre>
                  ) : null}
                </>
              }
              testId="gasless-wallet-execute-submit-error"
            />
          ) : execute.isSuccess ? (
            <ResultSuccess testId="gasless-wallet-execute-result">
              Executed — request <span className="font-mono text-xs">{execute.data.accepted.requestId}</span>
              {execute.data.confirmed?.txHash ? (
                <>
                  {" "}
                  in <span className="font-mono text-xs">{execute.data.confirmed.txHash}</span>
                </>
              ) : null}
              . The hook waited for the relayer to land it.
            </ResultSuccess>
          ) : null}
        </>
      ) : null}
    </GaslessCard>
  );
}
