import { Box, Text } from "ink";
import { useDeployment } from "../config/deployment-context.js";
import { glyph, theme } from "../config/theme.js";
import { shortAddress } from "../lib/format.js";
import { useLivePrices } from "../sdk/use-prices.js";
import { useSigner } from "../sdk/use-signer.js";
import { useSubAccount } from "../sdk/use-sub-accounts.js";
import { Brand } from "../ui/brand.js";
import { Tabs } from "../ui/tabs.js";
import { TABS, useAppState } from "./app-state.js";

/** The top chrome: brand, tab rail, and the live connection cluster. */
export function TopBar() {
  const { tab, setTab, overlay } = useAppState();
  const signer = useSigner();
  const { deployment, environment } = useDeployment();
  const { subAccountName } = useSubAccount();
  const { status } = useLivePrices();

  const live = status === "open";
  const environmentLabel = `${deployment.label} ${environment === "staging" ? "STAGE" : "PROD"}`;

  return (
    <Box flexDirection="column">
      <Box justifyContent="space-between" paddingX={1} flexWrap="wrap">
        <Brand />
        <Box>
          <Text color={live ? theme.positive : theme.warning}>{live ? glyph.live : glyph.idle}</Text>
          <Text color={theme.muted}> {environmentLabel}</Text>
          <Text color={theme.faint}>/{deployment.solverLabel}</Text>
          <Text color={theme.faint}> {glyph.dot} </Text>
          {signer.address ? (
            <Text color={theme.text}>
              {shortAddress(signer.address)}
              <Text color={theme.faint}> ({signer.label})</Text>
            </Text>
          ) : (
            <Text color={theme.warning}>no wallet</Text>
          )}
          {subAccountName != null && (
            <Text>
              <Text color={theme.faint}> {glyph.dot} </Text>
              <Text color={theme.primaryBright}>{subAccountName}</Text>
            </Text>
          )}
        </Box>
      </Box>
      <Box paddingX={1} marginTop={1}>
        <Tabs tabs={TABS} active={tab} onSelect={overlay ? undefined : (key) => setTab(key as typeof tab)} />
      </Box>
    </Box>
  );
}
