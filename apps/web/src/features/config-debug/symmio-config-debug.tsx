"use client";

import { AddressTag } from "@/components/address-tag";
import { DataList, DataRow } from "@/components/data-list";
import { PageHeader } from "@/components/page-header";
import { ConfigPanel } from "@/features/config/config-panel";
import { useSymmioOverrides } from "@/features/config/symmio-overrides-store";
import { useSymmioChainId, useSymmioConfig } from "@symm-frontier/react";
import { Badge } from "@symm-frontier/ui/components/badge";
import { Button } from "@symm-frontier/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@symm-frontier/ui/components/card";
import { useState, type ReactNode } from "react";

function ConfigGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card size="sm" className="animate-enter-up">
      <CardHeader>
        <CardTitle className="text-muted-foreground text-xs font-medium tracking-[0.18em] uppercase">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <DataList>{children}</DataList>
      </CardContent>
    </Card>
  );
}

export function SymmioConfigDebug() {
  const config = useSymmioConfig();
  const chainId = useSymmioChainId();
  const { overrideCount } = useSymmioOverrides();
  const [editing, setEditing] = useState(false);

  let chainConfig: ReturnType<typeof config.getChainConfig> | null;
  try {
    chainConfig = config.getChainConfig(chainId);
  } catch {
    chainConfig = null;
  }

  return (
    <section className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
      <PageHeader
        eyebrow="Runtime · Symmio Core"
        title="Resolved SYMMIO Config"
        description="Verifies that the web app initializes Wagmi and the Symmio core provider, then reads the resolved chain config from core."
        actions={
          <Button onClick={() => setEditing(true)}>
            Edit config
            {overrideCount > 0 ? (
              <span className="bg-primary-foreground/20 ml-0.5 rounded-full px-1.5 py-px font-mono text-[11px] font-semibold">
                {overrideCount}
              </span>
            ) : null}
          </Button>
        }
      />

      <ConfigPanel open={editing} onOpenChange={setEditing} />

      {!chainConfig ? (
        <Card className="animate-enter-up">
          <CardContent className="py-2">
            <p className="text-muted-foreground text-sm">
              Connected chain <span className="text-foreground font-mono">{chainId}</span> is not a supported SYMMIO
              chain.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <ConfigGroup title="Runtime">
              <DataRow label="Chain ID" value={<Badge variant="info">{chainConfig.chainId}</Badge>} />
              <DataRow label="Solver" value={chainConfig.solver.name} />
              <DataRow label="Solver address" value={<AddressTag address={chainConfig.solver.address} chars={6} />} />
            </ConfigGroup>

            <ConfigGroup title="Addresses">
              <DataRow label="Symmio" value={<AddressTag address={chainConfig.addresses.symmioAddress} chars={6} />} />
              <DataRow
                label="Instant Layer"
                value={<AddressTag address={chainConfig.addresses.instantLayerAddress} chars={6} />}
              />
              <DataRow
                label="Account Layer"
                value={<AddressTag address={chainConfig.addresses.accountLayerAddress} chars={6} />}
              />
              <DataRow
                label="Affiliates"
                value={<AddressTag address={chainConfig.addresses.affiliatesAddress} chars={6} />}
              />
              <DataRow
                label="Collateral"
                value={<AddressTag address={chainConfig.addresses.collateralAddress} chars={6} />}
              />
              <DataRow label="Collateral decimals" mono value={chainConfig.addresses.collateralDecimals} />
            </ConfigGroup>
          </div>

          <ConfigGroup title="Subgraphs">
            <DataRow
              label="Analytics"
              mono
              value={<span className="truncate">{chainConfig.subgraphs.analytics}</span>}
              copyValue={chainConfig.subgraphs.analytics}
            />
          </ConfigGroup>
        </>
      )}
    </section>
  );
}
