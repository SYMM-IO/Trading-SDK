/** One real file from this repo, excerpted for the integration walkthrough. */
export interface IntegrationFile {
  /** Repo-relative path — the file a reader can diff this against. */
  path: string;
  /** What this file contributes to the wiring, in one line. */
  role: string;
  /** Source, verbatim. Every removal is marked inline with an elision comment. */
  code: string;
}

/**
 * The complete SYMMIO wiring of a two-solver app.
 *
 * These excerpts are copied out of the repository, not paraphrased: doc
 * comments are elided and every elision is marked inline, so a reader can open
 * the named file and diff it line for line. That check is the point — a
 * walkthrough nobody can verify is marketing.
 */
export const INTEGRATION_FILES: readonly IntegrationFile[] = [
  {
    path: "src/config/symmio.ts",
    role: "Everything Prism tells the SDK. Two affiliate addresses, one per chain.",
    code: `import { SymmioSupportedChainId, type CreateConfigParameters } from "@symmio/trading-core";

/* … doc comment elided … */
export const symmioChains: CreateConfigParameters["symmioConfig"] = {
  [SymmioSupportedChainId.BASE]: {
    addresses: { affiliatesAddress: "0x45Eecd7B4f442388ACD90467E423A5CAAC3a9C3f" },
  },
  [SymmioSupportedChainId.HYPER_EVM]: {
    addresses: { affiliatesAddress: "0xBcB033C9154401fA000a1Ae60843f79f45741b7c" },
  },
};
`,
  },
  {
    path: "src/app/providers.tsx",
    role: "One provider. It builds one immutable Config holding every chain and every solver.",
    code: `"use client";

import { symmioChains } from "@/config/symmio";
import { wagmiConfig } from "@/config/wagmi";
import { ModeProvider } from "@/features/mode/mode-provider";
import { SymmioProvider } from "@symmio/trading-react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useState } from "react";
import { WagmiProvider } from "wagmi";

/* … doc comment elided … */
export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 10_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <SymmioProvider symmioConfig={symmioChains}>
          <ModeProvider>{children}</ModeProvider>
        </SymmioProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
`,
  },
  {
    path: "src/config/deployments.ts",
    role: "The multi-solver part. Two fields per row are the SDK's; the rest is Prism's branding.",
    code: `import { SymmioSupportedChainId, type SymmioSolverKind } from "@symmio/trading-core";

/* … MarketFamily / PrismMode / Deployment declarations elided … */

export const DEPLOYMENTS: readonly Deployment[] = [
  {
    family: "majors",
    chainId: SymmioSupportedChainId.BASE,
    solverId: "rasa",
    label: "Majors",
    solverName: "Rasa",
    solverTag: "majors-v2",
    chainName: "Base",
    chainColorVar: "--chain-base",
    tone: "mj",
    blurb: "Deep-liquidity perps on listed assets — BTC, ETH, SOL — priced off Binance USD-M futures.",
  },
  {
    family: "lowcaps",
    chainId: SymmioSupportedChainId.HYPER_EVM,
    solverId: "enigma",
    label: "Lowcaps",
    solverName: "Enigma",
    solverTag: "lowcap-v0",
    chainName: "HyperEVM",
    chainColorVar: "--chain-hyperevm",
    tone: "lc",
    blurb: "Microcap and memecoin perps with no exchange listing, priced from their own liquidity pools.",
  },
] as const;

/* … getDeployment / getDeploymentByChainId / deploymentsForMode / FAMILY_PALETTE elided … */
`,
  },
];

/**
 * The fan-out primitive, verbatim from its real call site in
 * `src/features/markets/use-merged-markets.ts`.
 *
 * Shown beside the wiring because it is the other half of the answer: the
 * provider makes both solvers reachable, and this is how one read reaches both
 * of them in a single hook call.
 */
export const FAN_OUT_EXAMPLE = `const { results, isLoading, isFetching, failures } = useDeploymentQueries<Market[]>(
  (config, deployment) => ({
    ...getMarketsQueryOptions(config, {
      chainId: deployment.chainId,
      solverId: deployment.solverId,
    }),
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
  }),
  { scope: options.scope },
);
`;
