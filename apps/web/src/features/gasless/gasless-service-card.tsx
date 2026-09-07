"use client";

import { AddressTag } from "@/components/address-tag";
import { DataList, DataRow } from "@/components/data-list";
import { ResultNote } from "@/components/result";
import { useSupportsGaslessService, useSymmioChainId, useSymmioConfig } from "@symmio/trading-react";
import { GaslessCard } from "./gasless-card";

/**
 * Availability card: whether the connected chain carries a usable gasless
 * service, and the resolved config block when it does.
 */
export function GaslessServiceCard() {
  const config = useSymmioConfig({});
  const chainId = useSymmioChainId();
  const supported = useSupportsGaslessService();
  const chain = config.getChainConfig(chainId);

  return (
    <GaslessCard
      testId="gasless-service"
      method="supportsGaslessService"
      description="Chain-level availability gate. A chain must carry a gasless config block and run perps-core (0.8.6) contracts; hide gasless UI where this is false."
    >
      {supported && chain.gasless ? (
        <DataList>
          <DataRow label="Service base" value={chain.gasless.url} mono />
          <DataRow label="Protocol instance" value={chain.gasless.protocolInstance ?? "(proxy-managed)"} mono />
          <DataRow label="GaslessLayer" value={<AddressTag address={chain.gasless.gaslessLayerAddress} />} />
          <DataRow label="Execution mode" value={chain.gasless.execution?.mode ?? "wallet"} mono />
        </DataList>
      ) : (
        <ResultNote>
          This chain has no gasless relayer configured. This app wires one for Arbitrum only, as a complete deployment
          profile in <code>src/config/symmio.ts</code> — switch to Arbitrum, or add a <code>gasless</code> block for
          another chain there. The config panel can switch <code>execution.mode</code> on a chain that already has a
          relayer, but it cannot add the endpoint.
        </ResultNote>
      )}
    </GaslessCard>
  );
}
