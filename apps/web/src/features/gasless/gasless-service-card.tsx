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
      description="Chain-level availability gate. A chain must carry a gasless config block and run perps-core (0.8.6) contracts; hide gasless UI where this is false. The browser reaches the gateway directly and anonymously — no API key ships in the bundle."
    >
      {supported && chain.gasless ? (
        <DataList>
          <DataRow label="Gateway" value={chain.gasless.url} mono copyValue={chain.gasless.url} />
          <DataRow label="Protocol instance" value={chain.gasless.protocolInstance ?? "(pinned by the url)"} mono />
          <DataRow label="GaslessLayer" value={<AddressTag address={chain.gasless.gaslessLayerAddress} />} />
          <DataRow label="Execution mode" value={chain.gasless.execution?.mode ?? "wallet"} mono />
          <DataRow
            label="Status stream"
            value={chain.gasless.statusStream?.enabled ? "enabled (WebSocket, polling fallback)" : "off (polling)"}
          />
          <DataRow label="Auth" value={chain.gasless.apiKey ? "partner key (Bearer)" : "anonymous (no API key)"} />
        </DataList>
      ) : (
        <ResultNote>
          This chain has no gasless relayer configured. This app wires one for Arbitrum only, as a complete deployment
          profile in <code>src/config/symmio-presets.ts</code> — apply the Staging preset, or add a deployment for
          another chain there. A chain is paired with its relayer through its InstantLayer address, so the config panel
          can switch <code>execution.mode</code> and move a chain between deployments, but the endpoint itself always
          comes from code — it is re-applied on every load and every Apply, and never read back from storage.
        </ResultNote>
      )}
    </GaslessCard>
  );
}
