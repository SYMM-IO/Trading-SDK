import { Box, Text } from "ink";
import qrcode from "qrcode-terminal";
import { useState } from "react";
import { useDeployment } from "../../config/deployment-context.js";
import { getWalletConnectProjectId } from "../../config/environment.js";
import { glyph, theme } from "../../config/theme.js";
import { shortAddress } from "../../lib/format.js";
import { useSigner } from "../../sdk/use-signer.js";
import { ErrorLine } from "../../ui/feedback.js";
import { KeyValue } from "../../ui/kit.js";
import { Menu } from "../../ui/menu.js";
import { Sheet } from "../../ui/sheet.js";
import { walletHub } from "../../wallet/wallet-hub.js";
import { useAppState } from "../app-state.js";
import { useToast } from "../toast.js";

interface WalletAction {
  key: "wc" | "disconnect";
  label: string;
}

/** Wallet overlay: shows the active signer and offers WalletConnect / disconnect. */
export function WalletSheet({ active }: { active: boolean }) {
  const signer = useSigner();
  const { closeOverlay } = useAppState();
  const toast = useToast();
  const projectId = getWalletConnectProjectId();
  const { deployment, environment } = useDeployment();

  const [qr, setQr] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [index, setIndex] = useState(0);

  const actions: WalletAction[] = [];
  if (projectId) actions.push({ key: "wc", label: "Connect via WalletConnect" });
  if (signer.kind === "walletconnect") actions.push({ key: "disconnect", label: "Disconnect WalletConnect" });

  async function onSelect(action: WalletAction) {
    if (action.key === "wc" && projectId) {
      setConnecting(true);
      setError(null);
      setQr(null);
      try {
        await walletHub.connectWalletConnect(projectId, (uri) =>
          qrcode.generate(uri, { small: true }, (code) => setQr(code)),
        );
        toast.push("success", "Wallet connected");
        closeOverlay();
      } catch (caught) {
        setConnecting(false);
        setError(caught instanceof Error ? caught.message : "WalletConnect failed");
      }
    } else if (action.key === "disconnect") {
      await walletHub.disconnect();
      toast.push("info", "Wallet disconnected");
      closeOverlay();
    }
  }

  return (
    <Sheet
      title="Wallet"
      subtitle={`${deployment.label} ${environment === "staging" ? "staging" : "production"} · chain ${deployment.chainId}`}
    >
      <Box flexDirection="column">
        <KeyValue
          label="Signer"
          value={signer.canSign ? signer.label : signer.kind === "readonly" ? "read-only" : "none"}
        />
        <KeyValue label="Address" value={signer.address ? shortAddress(signer.address) : "—"} />
        {signer.sessionKeyAddress != null && (
          <KeyValue label="Session key" value={shortAddress(signer.sessionKeyAddress)} dim />
        )}
      </Box>

      {connecting && qr != null && (
        <Box flexDirection="column" marginTop={1}>
          <Text color={theme.muted}>Scan with your mobile wallet:</Text>
          <Text>{qr}</Text>
        </Box>
      )}
      {connecting && qr == null && (
        <Box marginTop={1}>
          <Text color={theme.warning}>{glyph.dot} Opening WalletConnect…</Text>
        </Box>
      )}
      {(error ?? signer.error) != null && (
        <Box marginTop={1}>
          <ErrorLine message={(error ?? signer.error) as string} />
        </Box>
      )}

      <Box marginTop={1} flexDirection="column">
        {actions.length > 0 ? (
          <Menu
            items={actions}
            index={index}
            setIndex={setIndex}
            active={active && !connecting}
            onSelect={onSelect}
            renderItem={(action, selected) => <Text color={selected ? theme.text : theme.muted}>{action.label}</Text>}
          />
        ) : (
          <Text color={theme.faint}>
            Set SYMMIO_PRIVATE_KEY for a hot signer, or SYMMIO_WALLETCONNECT_PROJECT_ID to pair a mobile wallet.
          </Text>
        )}
      </Box>
      {projectId != null && (
        <Box marginTop={1}>
          <Text color={theme.faint}>
            WalletConnect will request {deployment.label}. For an unattended terminal, set SYMMIO_PRIVATE_KEY in
            .env.local and protect that file.
          </Text>
        </Box>
      )}
    </Sheet>
  );
}
