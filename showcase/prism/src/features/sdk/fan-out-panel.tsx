"use client";

import { MicroLabel, Panel, PanelHeader } from "@/components/panel";
import type { ReactNode } from "react";
import { CodeBlock } from "./code-block";
import { FAN_OUT_EXAMPLE } from "./integration-code";

/**
 * How one screen reads two solvers at once.
 *
 * Three mechanisms, because there are genuinely three problems: a fetch that
 * must run N times, a socket that must be open N times, and a chain the wallet
 * is not currently on. Nothing here is an SDK feature Prism invented — the
 * first two are ordinary React composition over the SDK's option factories, and
 * the third is the provider doing what it documents.
 */
export function FanOutPanel() {
  return (
    <Panel>
      <PanelHeader eyebrow="The multi-solver mechanics" title="How the fan-out works" />

      <div className="flex flex-col">
        <Mechanism
          index={1}
          title="One read, every deployment"
          file="src/features/data/use-deployment-queries.ts"
          symbol="useDeploymentQueries(buildOptions, { scope })"
        >
          <p>
            A React hook cannot be called in a loop, so <Mono>useMarkets()</Mono> can only ever ask one solver. The SDK
            ships a <Mono>getXQueryOptions(config, {"{ chainId, solverId }"})</Mono> factory beside every typed hook,
            and those are plain objects — mapping <Mono>DEPLOYMENTS</Mono> through one and handing the array to
            TanStack’s <Mono>useQueries</Mono> runs the same read against every deployment in a single hook call.
          </p>
          <p>
            The results cannot collide in cache: every SDK query key already carries <Mono>chainId</Mono>,{" "}
            <Mono>solverId</Mono> and <Mono>config.getChainConfigKey(chainId)</Mono>, a hash of that chain’s resolved
            config. A deployment that throws is reported in <Mono>failures</Mono> and contributes no rows, so one solver
            being down never blanks the other’s data.
          </p>
          <CodeBlock
            code={FAN_OUT_EXAMPLE}
            file="src/features/markets/use-merged-markets.ts"
            caption="verbatim"
            className="mt-1"
          />
        </Mechanism>

        <Mechanism
          index={2}
          title="One subscriber component per deployment"
          file="src/features/prices/price-provider.tsx"
          symbol="usePrices({ chainId, solverId }) · useNotifications({ account, chainId, solverId })"
        >
          <p>
            A WebSocket subscription is not a query, so it has no options object to fan out. The pattern instead is a
            component per deployment: <Mono>PriceProvider</Mono> renders one <Mono>DeploymentPriceFeed</Mono> for each
            row of <Mono>DEPLOYMENTS</Mono>, each calling <Mono>usePrices</Mono> with its own pair, and merges their
            ticks into a map keyed by market family. Consumers read <Mono>priceOf(family, name)</Mono> and never learn
            that one feed is Binance USD-M and the other is the Enigma price service.
          </p>
          <p>
            The transport-health cards on this page use the same shape, and so does every notification stream — the
            subscription is per <Mono>{"{ account, chainId, solverId }"}</Mono>, and the SDK pools sockets per resolved
            config, so several mounts against one endpoint cost one connection.
          </p>
        </Mechanism>

        <Mechanism
          index={3}
          title="Cross-chain reads with the wallet parked anywhere"
          file="src/config/wagmi.ts"
          symbol="SymmioProvider → getClient → getPublicClient(wagmiConfig, { chainId })"
        >
          <p>
            Base and HyperEVM are read side by side on every screen, and the wallet is on at most one of them.{" "}
            <Mono>SymmioProvider</Mono> builds the SDK config with a <Mono>getClient</Mono> that defers to{" "}
            <Mono>getPublicClient(wagmiConfig, {"{ chainId }"})</Mono>, and Prism’s wagmi config carries a transport for
            both chains — so a read names its chain and resolves, wherever the wallet sits.
          </p>
          <p>
            Writes are the honest exception. Signing happens through the connected wallet, so a trade on the other chain
            needs a network switch first, and the ticket says so instead of failing at signature time.
          </p>
        </Mechanism>
      </div>
    </Panel>
  );
}

interface MechanismProps {
  index: number;
  title: string;
  /** Repo-relative file this mechanism actually lives in. */
  file: string;
  /** The SDK or app symbol at its centre. */
  symbol: string;
  children: ReactNode;
}

/** One numbered mechanism: what it solves, where it lives, and the call that does it. */
function Mechanism({ index, title, file, symbol, children }: MechanismProps) {
  return (
    <section className="grid grid-cols-[28px_minmax(0,1fr)] gap-x-3 border-b border-line-subtle px-4 py-4 last:border-b-0">
      <span className="tnum mt-[3px] flex size-7 items-center justify-center rounded-full border border-accent-bd bg-accent-bg text-sm font-semibold text-accent">
        {index}
      </span>

      <div className="flex min-w-0 flex-col gap-2">
        <div className="flex min-w-0 flex-col gap-1">
          <h3 className="font-display text-md font-semibold text-fg-0">{title}</h3>
          <span className="font-mono text-2xs break-all text-accent/80">{symbol}</span>
        </div>

        <div className="flex flex-col gap-2 text-sm leading-relaxed text-fg-2 [&_p]:m-0">{children}</div>

        <div className="flex items-center gap-2 pt-0.5">
          <MicroLabel>lives in</MicroLabel>
          <span className="rounded-sm border border-line-subtle bg-bg-2 px-1.5 py-[2px] font-mono text-2xs break-all text-fg-2">
            {file}
          </span>
        </div>
      </div>
    </section>
  );
}

interface MonoProps {
  children: ReactNode;
}

/** Inline code inside prose. */
function Mono({ children }: MonoProps) {
  return <code className="font-mono text-xs text-fg-0">{children}</code>;
}
