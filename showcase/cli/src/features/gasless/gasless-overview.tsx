import type { GaslessDepositSubmitReceipt } from "@symmio/trading-core";
import { Box, Text, useInput } from "ink";
import { useEffect, useState } from "react";
import { glyph, theme } from "../../config/theme.js";
import { shortAddress } from "../../lib/format.js";
import {
  getGaslessReplay,
  useGaslessAccountData,
  useReplayGaslessDeposit,
  useSettleGaslessDeposit,
} from "../../sdk/use-gasless.js";
import { useSigner } from "../../sdk/use-signer.js";
import { useSubAccount } from "../../sdk/use-sub-accounts.js";
import { ErrorLine, LoadingLine } from "../../ui/feedback.js";
import { KeyValue, Panel } from "../../ui/kit.js";
import { useToast } from "../toast.js";
import { gaslessFailureCode, gaslessFailureMessage } from "./gasless-error.js";
import { formatGaslessToken } from "./gasless-format.js";

interface Props {
  active: boolean;
  walletId: bigint;
  onAccepted: (receipt: GaslessDepositSubmitReceipt) => void;
}

/** Deterministic wallet, nonce, live funding balance, policy, and guarded settlement. */
export function GaslessOverview({ active, walletId, onAccepted }: Props) {
  const { address: owner } = useSigner();
  const { subAccount, subAccountName } = useSubAccount();
  const toast = useToast();
  const data = useGaslessAccountData({ enabled: true, owner, payer: subAccount, walletId });
  const settle = useSettleGaslessDeposit({ onAccepted });
  const replay = useReplayGaslessDeposit({ onAccepted });
  const { reset: resetSettlement } = settle;
  const { reset: resetReplay } = replay;
  const [armed, setArmed] = useState(false);
  const policy = data.policy.data;
  const observed = data.depositBalance.data;
  const funded = policy !== undefined && observed !== undefined && observed >= policy.settlementMinimum;
  const canSettle = Boolean(owner && subAccount && funded && !settle.isPending);

  useEffect(() => {
    setArmed(false);
    resetSettlement();
    resetReplay();
  }, [walletId, owner, subAccount, resetSettlement, resetReplay]);

  useEffect(() => {
    if (!armed) return;
    const timeout = setTimeout(() => setArmed(false), 8_000);
    return () => clearTimeout(timeout);
  }, [armed]);

  useInput(
    (input) => {
      if (input === "r") {
        data.refetch();
        return;
      }
      if (input === "u" && settle.error && getGaslessReplay(settle.error)?.service === "deposits") {
        replay.mutate(settle.error);
        return;
      }
      if (input !== "s" || !canSettle || !owner || !subAccount) return;
      if (!armed) {
        setArmed(true);
        toast.push("info", "Settlement armed — press s again to sweep the full deposit balance");
        return;
      }
      setArmed(false);
      settle.mutate({ owner, walletId, subAccount });
    },
    { isActive: active },
  );

  const error = data.wallet.error ?? data.policy.error ?? data.nonce.error ?? data.depositBalance.error;

  if (!owner) {
    return (
      <Panel title="Gasless wallet" focused={active} flexGrow={1}>
        <Text color={theme.muted}>Connect or inspect a wallet to derive its deterministic gasless wallet.</Text>
      </Panel>
    );
  }

  return (
    <Box flexDirection="column" gap={1} flexGrow={1}>
      <Box flexDirection="row" gap={1}>
        <Panel title={`Wallet ${walletId.toString()}`} focused={active} flexGrow={1}>
          {data.wallet.isPending || data.policy.isPending ? (
            <LoadingLine label="Reading GaslessLayer state…" />
          ) : (
            <Box flexDirection="column">
              <KeyValue label="Owner" value={shortAddress(owner)} />
              <KeyValue label="Wallet address" value={data.wallet.data ?? "—"} />
              <KeyValue label="Nonce account" value={shortAddress(subAccount ?? owner)} />
              <KeyValue label="Consumed nonce" value={data.nonce.data?.toString() ?? "—"} />
              <KeyValue
                label="Creation fee"
                value={formatGaslessToken(policy?.walletCreationFee, policy?.collateralDecimals ?? 0)}
                color={policy?.walletCreationFee === 0n ? theme.positive : theme.warning}
              />
            </Box>
          )}
        </Panel>

        <Panel title="Deposit policy" flexGrow={1}>
          {policy ? (
            <Box flexDirection="column">
              <KeyValue label="Deposit address" value={policy.depositAddress} />
              <KeyValue label="Collateral token" value={policy.collateralTokenAddress} />
              <KeyValue
                label="Observed balance"
                value={formatGaslessToken(observed, policy.collateralDecimals)}
                color={funded ? theme.positive : theme.warning}
              />
              <KeyValue label="Deposit fee" value={formatGaslessToken(policy.depositFee, policy.collateralDecimals)} />
              <KeyValue
                label="Service minimum"
                value={formatGaslessToken(policy.minimumDeposit, policy.collateralDecimals)}
              />
              <KeyValue
                label="Settlement minimum"
                value={formatGaslessToken(policy.settlementMinimum, policy.collateralDecimals)}
              />
            </Box>
          ) : data.policy.error ? (
            <Text color={theme.warning}>Deposit policy unavailable.</Text>
          ) : (
            <LoadingLine label="Reading deposit policy…" />
          )}
        </Panel>
      </Box>

      <Panel title="Settle into existing account">
        <Text color={theme.muted}>
          The settlement sweeps the wallet's entire collateral balance into {subAccountName ?? "the selected account"}
          {subAccount ? ` (${shortAddress(subAccount)})` : ""}. Send only the policy token shown above.
        </Text>
        <Box marginTop={1} justifyContent="space-between">
          <Text color={canSettle ? (armed ? theme.warning : theme.primaryBright) : theme.faint} bold={canSettle}>
            {glyph.caret}{" "}
            {settle.isPending
              ? "Submitting settlement…"
              : armed
                ? "Press s again to confirm full sweep"
                : "s settle funded wallet"}
          </Text>
          <Text color={theme.faint}>r refresh</Text>
        </Box>
        {!subAccount && <Text color={theme.warning}>Select an existing sub-account first.</Text>}
        {policy && observed !== undefined && !funded && (
          <Text color={theme.warning}>
            Deposit needs {formatGaslessToken(policy.settlementMinimum - observed, policy.collateralDecimals)} more.
          </Text>
        )}
      </Panel>

      {error != null && <ErrorLine message={gaslessFailureMessage(error)} />}
      {(settle.error != null || replay.error != null) && (
        <Box flexDirection="column">
          <ErrorLine message={gaslessFailureMessage(replay.error ?? settle.error)} />
          <Text color={theme.faint}>
            {gaslessFailureCode(replay.error ?? settle.error) ?? "unknown"}
            {settle.error && getGaslessReplay(settle.error)?.service === "deposits"
              ? replay.isPending
                ? " · replaying the exact signed submit…"
                : " · u replay exact submit; never start a new settlement"
              : ""}
          </Text>
        </Box>
      )}
    </Box>
  );
}
