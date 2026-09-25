import { Box, Text, useInput } from "ink";
import { useEffect } from "react";
import { glyph, theme } from "../../config/theme.js";
import { formatError } from "../../lib/error.js";
import { formatCountdown, shortAddress } from "../../lib/format.js";
import {
  useFinalizeTradingRevocation,
  useGrantTradingDelegation,
  useInitiateTradingRevocation,
  useTradingDelegation,
} from "../../sdk/use-delegation.js";
import { useSigner } from "../../sdk/use-signer.js";
import { useSubAccount } from "../../sdk/use-sub-accounts.js";
import { ErrorLine, LoadingLine } from "../../ui/feedback.js";
import { KeyValue } from "../../ui/kit.js";
import { Sheet } from "../../ui/sheet.js";
import { useToast } from "../toast.js";

/**
 * Enable one-tap trading by granting the chain-specific instant-trade selector
 * set in one wallet transaction.
 */
export function EnableTradingSheet({ active }: { active: boolean }) {
  const { sessionKeyAddress, sessionKeyExpiresAt } = useSigner();
  const { subAccount } = useSubAccount();
  const delegation = useTradingDelegation();
  const grant = useGrantTradingDelegation();
  const revoke = useInitiateTradingRevocation();
  const finalize = useFinalizeTradingRevocation();
  const toast = useToast();

  const sessionKeyUsable = Boolean(
    sessionKeyAddress && sessionKeyExpiresAt != null && sessionKeyExpiresAt > Date.now(),
  );
  const ready = Boolean(subAccount && sessionKeyUsable);

  useEffect(() => {
    if (grant.isSuccess) toast.push("success", "One-tap trading enabled");
  }, [grant.isSuccess, toast]);
  useEffect(() => {
    if (revoke.isSuccess) toast.push("info", "Trading-key revocation scheduled");
  }, [revoke.isSuccess, toast]);
  useEffect(() => {
    if (finalize.isSuccess) toast.push("success", "Revoked delegation schedule cleaned up");
  }, [finalize.isSuccess, toast]);

  useInput(
    (input, key) => {
      if (key.return && ready && delegation.needsFinalize && !finalize.isPending) finalize.mutate();
      else if (key.return && ready && !delegation.isActive && !delegation.isRevoking && !grant.isPending)
        grant.mutate();
      else if (input === "x" && delegation.isActive && !delegation.isRevoking && !revoke.isPending) revoke.mutate();
    },
    { isActive: active },
  );

  return (
    <Sheet title="One-tap trading" subtitle="session key delegation">
      <Box flexDirection="column">
        <KeyValue label="Sub-account" value={subAccount ? shortAddress(subAccount) : "— select one first"} />
        <KeyValue
          label="Session key"
          value={sessionKeyAddress ? shortAddress(sessionKeyAddress) : "— connect a signer"}
        />
        {sessionKeyExpiresAt != null && (
          <KeyValue
            label="Key expiry"
            value={
              sessionKeyExpiresAt > Date.now()
                ? formatCountdown(BigInt(Math.floor(sessionKeyExpiresAt / 1000)))
                : "expired"
            }
            dim
          />
        )}
      </Box>

      <Box flexDirection="column" marginTop={1}>
        <Text color={delegation.isActive ? theme.positive : theme.faint}>
          {delegation.isActive ? glyph.check : glyph.dot} Active selectors {delegation.activeCount}/
          {delegation.requiredCount || "—"}
        </Text>
        {delegation.revocationEta != null && (
          <Text color={delegation.needsFinalize ? theme.warning : theme.info}>
            {delegation.needsFinalize
              ? `${glyph.dot} Revoked · cleanup ready`
              : `${glyph.dot} Revoking in ${formatCountdown(delegation.revocationEta)} · key remains active until then`}
          </Text>
        )}
      </Box>

      <Box marginTop={1} flexDirection="column">
        {delegation.needsFinalize ? (
          finalize.isPending ? (
            <LoadingLine label="Finalizing revocation cleanup…" />
          ) : (
            <Text
              backgroundColor={theme.primary}
              color={theme.onAccent}
              bold
            >{` ${glyph.caret} Finalize cleanup  ⏎ `}</Text>
          )
        ) : delegation.isRevoking ? (
          <Text color={theme.warning}>Revocation is scheduled. Authority remains live until the displayed ETA.</Text>
        ) : delegation.isActive ? (
          <Text color={theme.positive}>
            {glyph.check} Enabled — instant trades sign with your session key. <Text color={theme.faint}>x revoke</Text>
          </Text>
        ) : !ready ? (
          <Text color={theme.warning}>
            {sessionKeyAddress && !sessionKeyUsable
              ? "The local session key expired. Reconnect the wallet to rotate it."
              : "Connect a signing wallet and select a sub-account to enable."}
          </Text>
        ) : grant.isPending ? (
          <LoadingLine label="Granting delegation (approve in your wallet)…" />
        ) : (
          <Text backgroundColor={theme.primary} color={theme.onAccent} bold>
            {` ${glyph.caret} Grant delegation  ⏎ `}
          </Text>
        )}
        {(delegation.error ?? grant.error ?? revoke.error ?? finalize.error) != null && (
          <ErrorLine message={formatError(delegation.error ?? grant.error ?? revoke.error ?? finalize.error)} />
        )}
      </Box>
      <Box marginTop={1}>
        <Text color={theme.faint}>
          One wallet signature authorizes only the required trade actions until the local key expires (at most 1 year).
        </Text>
      </Box>
    </Sheet>
  );
}
