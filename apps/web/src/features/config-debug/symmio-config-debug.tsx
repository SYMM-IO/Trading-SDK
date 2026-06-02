"use client";

import { useSymmioChainId, useSymmioConfig } from "@symm-frontier/react";
import { Badge } from "@symm-frontier/ui/components/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@symm-frontier/ui/components/card";

function ConfigRow({ label, value }: { label: string; value?: string | number }) {
  return (
    <div className="border-border/60 flex items-start justify-between gap-4 border-b py-3 last:border-b-0">
      <dt className="text-muted-foreground shrink-0 text-sm font-medium">{label}</dt>
      <dd className="text-foreground max-w-[70%] text-right font-mono text-sm break-all">
        {value ?? "Not configured"}
      </dd>
    </div>
  );
}

function ConfigGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <dl>{children}</dl>
      </CardContent>
    </Card>
  );
}

export function SymmioConfigDebug() {
  const config = useSymmioConfig();
  const chainId = useSymmioChainId();

  let chainConfig: ReturnType<typeof config.getChainConfig> | null;
  try {
    chainConfig = config.getChainConfig(chainId);
  } catch {
    chainConfig = null;
  }

  if (!chainConfig) {
    return <p className="text-muted-foreground p-6">Connected chain {chainId} is not a supported SYMMIO chain.</p>;
  }

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-10">
      <header className="flex flex-col gap-3">
        <Badge variant="outline" className="self-start">
          Symmio Core
        </Badge>
        <h1 className="text-foreground text-3xl font-semibold tracking-tight sm:text-4xl">Resolved VibeCaps Config</h1>
        <p className="text-muted-foreground max-w-2xl text-sm leading-6">
          This page verifies that the web app initializes Wagmi and the Symmio core provider, then reads the resolved
          chain config from core.
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <ConfigGroup title="Runtime">
          <ConfigRow label="Chain ID" value={chainConfig.chainId} />
          <ConfigRow label="Solver" value={`${chainConfig.solver.name} (${chainConfig.solver.address})`} />
        </ConfigGroup>

        <ConfigGroup title="Addresses">
          <ConfigRow label="Symmio" value={chainConfig.addresses.symmioAddress} />
          <ConfigRow label="Instant Layer" value={chainConfig.addresses.instantLayerAddress} />
          <ConfigRow label="Account Layer" value={chainConfig.addresses.accountLayerAddress} />
          <ConfigRow label="Affiliates" value={chainConfig.addresses.affiliatesAddress} />
          <ConfigRow label="Collateral" value={chainConfig.addresses.collateralAddress} />
          <ConfigRow label="Collateral Decimals" value={chainConfig.addresses.collateralDecimals} />
        </ConfigGroup>
      </div>

      <ConfigGroup title="Subgraphs">
        <ConfigRow label="Analytics" value={chainConfig.subgraphs.analytics} />
      </ConfigGroup>
    </section>
  );
}
