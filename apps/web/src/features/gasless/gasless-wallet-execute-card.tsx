"use client";

import { AddressTag } from "@/components/address-tag";
import { DataList, DataRow } from "@/components/data-list";
import { Field } from "@/components/field";
import { ResultNote, ResultSuccess } from "@/components/result";
import { formatUsd } from "@/lib/format";
import {
  useCollateralBalance,
  useGaslessWalletAddress,
  useGaslessWalletCreationFee,
  useGaslessWalletExecute,
  useGaslessWalletNonce,
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
import { GaslessFailureNote } from "./gasless-failure-note";
import { storeGaslessRequest } from "./gasless-request-storage";
import { useGaslessWalletAssignments, useGaslessWalletAssignmentScope } from "./gasless-wallet-assignments";
import { useSessionKeyWriteMode } from "./gasless-write-mode-store";
import { parseGaslessWalletIdText, WalletIdCollisionNote, WalletIdField } from "./wallet-id-field";

/** Which of the two call forms the builder composes. */
type CallForm = "transfer" | "raw";

/** The card's key into the per-card session-key store. */
const METHOD = "gaslessWalletExecute";

/** Calldata is `0x` plus whole bytes — a selector alone is four bytes. */
const HEX_CALLDATA = /^0x([0-9a-fA-F]{2})*$/;

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

  const sessionKey = useSessionKeyWriteMode(METHOD);

  const [signerAccount, setSignerAccount] = useState<{ subAccount?: Address; name?: string }>({});
  const [form, setForm] = useState<CallForm>("transfer");
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [target, setTarget] = useState("");
  const [calldata, setCalldata] = useState("");
  const [operationType, setOperationType] = useState("");

  const { assignments, setAssignment } = useGaslessWalletAssignments(useGaslessWalletAssignmentScope());
  const walletId = parseGaslessWalletIdText(assignments.execute);
  const depositWalletId = parseGaslessWalletIdText(assignments.deposit);
  const collides = walletId !== null && walletId === depositWalletId;
  const walletReadsEnabled = Boolean(address) && walletId !== null;

  /**
   * The wallet is derived from the owner either way — `ownerOf(signerAccount)`
   * is this same address — so the panel keeps reading it for the connected
   * wallet and lets `signerAccount` decide authority and billing only.
   */
  const wallet = useGaslessWalletAddress({
    owner: address ?? zeroAddress,
    walletId: walletId ?? 0n,
    query: { enabled: walletReadsEnabled },
  });
  /**
   * Shown at the chain config's collateral scale, like every other figure on
   * this card (the parked balance, the transfer form). The fee is denominated
   * in the GaslessLayer's own collateral token — the deposit card reads that
   * token and its decimals from the policy — but mixing two scales inside one
   * card would read worse than assuming the deployment's token is the
   * configured one.
   */
  const creationFee = useGaslessWalletCreationFee({
    owner: address ?? zeroAddress,
    walletId: walletId ?? 0n,
    query: { enabled: walletReadsEnabled },
  });
  /**
   * The nonce stream is per `(walletId, signerAccount)`, and the signer account
   * is what the relay bills — so the row follows the picker, defaulting to the
   * owner exactly as the action does when no sub-account is chosen.
   */
  const nonceAccount = signerAccount.subAccount ?? address;
  const nonce = useGaslessWalletNonce({
    owner: address ?? zeroAddress,
    walletId: walletId ?? 0n,
    account: nonceAccount ?? zeroAddress,
    query: { enabled: walletReadsEnabled && Boolean(nonceAccount) },
  });
  const parked = useCollateralBalance({
    owner: wallet.data,
    query: { enabled: Boolean(wallet.data), refetchInterval: 5_000 },
  });
  /** Persist at acceptance so a reload mid-wait can still resume the workflow. */
  const execute = useGaslessWalletExecute({
    onAccepted: (accepted) => {
      storeGaslessRequest(chainId, {
        requestId: accepted.requestId,
        service: "operations",
        protocolInstance: accepted.protocolInstance ?? "",
        operationType: accepted.operationType ?? "gaslessqWalletExecute",
        owner: accepted.owner,
        walletIds: accepted.walletIds.map((id) => id.toString()),
        idempotencyKey: accepted.idempotencyKey,
        at: Date.now(),
      });
    },
  });

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

  /** Only route `from` to the key when it is loaded and this card's key toggle is on. */
  const signingKey = sessionKey.enabled ? sessionKey.sessionKeyAddress : undefined;
  /** A delegate signer needs an account to hold its delegation; an EOA cannot. */
  const needsSignerAccount = signingKey !== undefined && signerAccount.subAccount === undefined;

  /** A wallet with no code is deployed by its first operation, and that deployment is charged for. */
  const firstUse = (creationFee.data ?? 0n) > 0n;

  return (
    <GaslessCard
      testId="gasless-wallet-execute"
      method={METHOD}
      description="Run any contract call from the deterministic gasless wallet — an atomic batch of arbitrary calls, with the relayer paying the native gas."
      wide
      sessionKeyMethod={METHOD}
    >
      {!isConnected ? (
        <ResultNote testId="gasless-wallet-execute-disconnected">
          Connect a wallet to derive its gasless wallet.
        </ResultNote>
      ) : (
        <>
          <WalletIdField
            id="gasless-execute-wallet-id"
            value={assignments.execute}
            onChange={(next) => {
              setAssignment("execute", next);
              execute.reset();
            }}
            label="walletId (execute)"
            hint="Feeds the wallet address, the nonce stream and the relayed batch — all three must name the same id."
            testId="input-gasless-execute-wallet-id"
          />

          {collides ? (
            <WalletIdCollisionNote walletId={assignments.execute} testId="gasless-execute-collision" />
          ) : null}

          {walletId === null ? (
            <ResultNote testId="gasless-wallet-execute-invalid-wallet-id">
              Enter a wallet id to derive its gasless wallet.
            </ResultNote>
          ) : wallet.isPending ? (
            <ResultNote loading testId="gasless-wallet-execute-loading">
              Reading the gasless wallet address…
            </ResultNote>
          ) : wallet.error ? (
            <GaslessFailureNote error={wallet.error} testId="gasless-wallet-execute-error" />
          ) : wallet.data ? (
            <>
              <DataList>
                <DataRow label="Gasless wallet" value={<AddressTag address={wallet.data} />} />
                <DataRow
                  label="Parked collateral"
                  value={parked.data !== undefined ? `${formatUsd(parked.data, collateralDecimals)} USDC` : "…"}
                  mono
                />
                <DataRow
                  label="Wallet creation fee"
                  value={
                    creationFee.data !== undefined ? `${formatUsd(creationFee.data, collateralDecimals)} USDC` : "…"
                  }
                  mono
                />
                <DataRow label="Operation nonce" value={nonce.data !== undefined ? nonce.data.toString() : "…"} mono />
              </DataList>

              {firstUse ? (
                <ResultNote testId="gasless-wallet-execute-first-use">
                  Wallet <span className="font-mono">{walletId.toString()}</span> has no code yet: this operation
                  deploys it, and the one-time creation fee of{" "}
                  <span className="font-mono">{formatUsd(creationFee.data ?? 0n, collateralDecimals)} USDC</span> is
                  charged to the payer on top of the operational fee. Later operations on this id pay it no more.
                </ResultNote>
              ) : null}

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
                The fee is billed to <code>signerAccount</code>, not to the collateral parked here. Left blank it
                defaults to your wallet address, which holds no SYMMIO collateral — so pick a funded sub-account and
                grant its operational-fee allowance above. The batch is atomic, so a reverted call costs nothing but
                time.
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
                disabled={calls === null || walletId === null || needsSignerAccount || execute.isPending}
                onClick={() => {
                  if (calls === null || walletId === null) return;
                  execute.mutate({
                    calls,
                    walletId,
                    ...(signerAccount.subAccount ? { signerAccount: signerAccount.subAccount } : {}),
                    ...(signingKey ? { from: signingKey } : {}),
                    ...(operationType.trim().length > 0 ? { operationType: operationType.trim() } : {}),
                  });
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
                <GaslessFailureNote error={execute.error} testId="gasless-wallet-execute-submit-error" />
              ) : execute.isSuccess ? (
                <ResultSuccess testId="gasless-wallet-execute-result">
                  Executed from wallet{" "}
                  <span className="font-mono">{execute.data.accepted.walletIds[0]?.toString() ?? "0"}</span> — request{" "}
                  <span className="font-mono text-xs">{execute.data.accepted.requestId}</span>
                  {execute.data.confirmed?.txHash ? (
                    <>
                      {" "}
                      in <span className="font-mono text-xs">{execute.data.confirmed.txHash}</span>
                    </>
                  ) : null}
                  . Quoted fee{" "}
                  <span className="font-mono">
                    {execute.data.accepted.paidFee === null ? "unreported" : execute.data.accepted.paidFee.toString()}
                  </span>{" "}
                  — the raw figure the service reported at acceptance. The SDK passes it through unscaled and the
                  service does not state its unit, so it is shown undivided rather than guessed into USDC. It is a
                  quote, not proof of a charge: the fee is collected when the batch executes — reconcile it from the
                  payer’s Core balance and the receipt’s fee events. The hook waited for the relayer to land it.
                </ResultSuccess>
              ) : null}
            </>
          ) : null}
        </>
      )}
    </GaslessCard>
  );
}
