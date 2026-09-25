import { Box, Text, useInput, useStdout } from "ink";
import { useDeployment } from "../../config/deployment-context.js";
import { glyph, theme } from "../../config/theme.js";
import { formatError } from "../../lib/error.js";
import { shortAddress } from "../../lib/format.js";
import { isolationLabel } from "../../lib/sub-account.js";
import { useCapabilities } from "../../sdk/use-capabilities.js";
import { useNotificationsFeed } from "../../sdk/use-notifications.js";
import { useLivePrices } from "../../sdk/use-prices.js";
import { useSdkScope } from "../../sdk/use-sdk-scope.js";
import { useSigner } from "../../sdk/use-signer.js";
import { useSubAccount } from "../../sdk/use-sub-accounts.js";
import { useSystemHealth } from "../../sdk/use-system-health.js";
import { Divider, KeyValue, Panel, Stat } from "../../ui/kit.js";

function endpointHost(value: string): string {
  try {
    return new URL(value).host;
  } catch {
    return value;
  }
}

function healthLabel(value: boolean | undefined, loading: boolean, error: unknown): string {
  if (loading) return "checking";
  if (error != null) return "unavailable";
  return value === false ? "not ready" : "healthy";
}

function healthColor(value: boolean | undefined, loading: boolean, error: unknown): string {
  if (error != null || value === false) return theme.negative;
  return loading ? theme.warning : theme.positive;
}

/** Runtime configuration, capability matrix, endpoint health, and stream diagnostics. */
export function SystemScreen({ active }: { active: boolean }) {
  const { stdout } = useStdout();
  const { config, chainId, solverId } = useSdkScope();
  const { deployment, environment } = useDeployment();
  const signer = useSigner();
  const { subAccount, subAccountDetail } = useSubAccount();
  const capabilities = useCapabilities();
  const health = useSystemHealth();
  const prices = useLivePrices();
  const notifications = useNotificationsFeed();

  const chain = config.getChainConfig(chainId);
  const solver = config.getSolver({ chainId, solverId });
  const priceService = solver.priceService ?? chain.priceService;
  const wide = (stdout?.columns ?? 120) >= 108;

  useInput(
    (input) => {
      if (input === "r") {
        void health.rpc.refetch();
        void health.price.refetch();
        if (solver.id === "rasa") void health.solverReady.refetch();
      }
    },
    { isActive: active },
  );

  return (
    <Box flexDirection={wide ? "row" : "column"} gap={1} flexGrow={1}>
      <Panel title="Runtime" focused={active} flexGrow={1}>
        <Box marginBottom={1}>
          <Stat label="Chain" value={deployment.label} hint={String(chainId)} minWidth={18} />
          <Stat label="Product" value={deployment.product} />
          <Stat label="Contracts" value={`v${chain.contractsVersion}`} />
        </Box>
        <Box flexDirection="column">
          <KeyValue label="Environment" value={environment === "staging" ? "Staging" : "Production"} />
          <KeyValue label="Solver" value={`${solver.name} (${solver.id})`} />
          <KeyValue label="Solver API" value={endpointHost(solver.url)} dim />
          <KeyValue label="Price source" value={`${priceService.type} · ${endpointHost(priceService.url)}`} dim />
          <KeyValue label="Analytics" value={endpointHost(chain.subgraphs.analytics)} dim />
          <KeyValue label="Events" value={endpointHost(chain.subgraphs.events)} dim />
          <KeyValue label="Core" value={shortAddress(chain.addresses.symmioAddress)} dim />
          <KeyValue label="Instant Layer" value={shortAddress(chain.addresses.instantLayerAddress)} dim />
        </Box>

        <Box marginTop={1} flexDirection="column">
          <Divider width={52} />
          <Text color={theme.muted}>Active identity</Text>
          <KeyValue
            label="Signer"
            value={signer.address ? `${shortAddress(signer.address)} · ${signer.label}` : "none"}
          />
          <KeyValue
            label="Session key"
            value={signer.sessionKeyAddress ? shortAddress(signer.sessionKeyAddress) : "none"}
          />
          <KeyValue label="Sub-account" value={subAccount ? shortAddress(subAccount) : "none"} />
          <KeyValue label="Isolation" value={subAccountDetail ? isolationLabel(subAccountDetail.isolationType) : "—"} />
        </Box>
      </Panel>

      <Panel title="Capabilities & health" width={wide ? 46 : undefined}>
        <Box flexDirection="column">
          <Capability label="Instant market orders" enabled />
          <Capability label="Limit orders" enabled={capabilities.limitOrder} />
          <Capability label="Grouped close" enabled={capabilities.groupClose} />
          <Capability label="TP / SL" enabled={capabilities.tpSl} />
          <Capability label="Pools / listings" enabled={capabilities.listingService} />
          <Capability label="Inventory" enabled={capabilities.inventory} />
          <Capability label="Gasless relayer" enabled={capabilities.gasless} />
        </Box>

        <Box marginTop={1} flexDirection="column">
          <Divider width={38} />
          <HealthRow
            label="RPC"
            value={health.rpc.data != null}
            loading={health.rpc.isLoading}
            error={health.rpc.error}
            hint={health.rpc.data != null ? `block ${health.rpc.data}` : undefined}
          />
          <HealthRow
            label={`${health.priceProvider} prices`}
            value={health.price.data}
            loading={health.price.isLoading}
            error={health.price.error}
          />
          {solver.id === "rasa" && (
            <HealthRow
              label="Solver readiness"
              value={health.solverReady.data}
              loading={health.solverReady.isLoading}
              error={health.solverReady.error}
            />
          )}
          <KeyValue
            label="Price stream"
            value={prices.status}
            color={prices.status === "open" ? theme.positive : theme.warning}
          />
          <KeyValue
            label="Order stream"
            value={notifications.status}
            color={notifications.status === "open" ? theme.positive : theme.warning}
          />
        </Box>

        <Box marginTop={1} flexDirection="column">
          <Text color={theme.faint}>r refresh endpoint probes</Text>
          {health.rpc.error != null && <Text color={theme.negative}>{formatError(health.rpc.error)}</Text>}
          {health.price.error != null && <Text color={theme.negative}>{formatError(health.price.error)}</Text>}
        </Box>
      </Panel>
    </Box>
  );
}

function Capability({ label, enabled }: { label: string; enabled: boolean }) {
  return (
    <Text color={enabled ? theme.positive : theme.faint}>
      {enabled ? glyph.check : glyph.dot} {label}
    </Text>
  );
}

function HealthRow({
  label,
  value,
  loading,
  error,
  hint,
}: {
  label: string;
  value: boolean | undefined;
  loading: boolean;
  error: unknown;
  hint?: string;
}) {
  return (
    <KeyValue
      label={label}
      value={`${healthLabel(value, loading, error)}${hint ? ` · ${hint}` : ""}`}
      color={healthColor(value, loading, error)}
    />
  );
}
