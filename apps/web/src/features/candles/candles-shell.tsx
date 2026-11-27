"use client";

import { PageHeader } from "@/components/page-header";
import { useMockerConnection } from "@/features/wallet/mocker-connection";
import { MethodGroup } from "../inspector/method-group";
import { CandlesConsole } from "./candles-console";
import { LowcapCandlesConsole } from "./lowcap-candles-console";
import { LowcapConsole } from "./lowcap-console";

/**
 * Chart reference-exchange and price-service candles through the same SDK
 * hooks, with a separate DexScreener embed for pool-price comparison.
 */
export function CandlesShell() {
  const local = useMockerConnection()?.session;
  return (
    <section className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
      <PageHeader
        eyebrow="React SDK · Candles"
        title="Candles"
        description="Historical and live candles through the SDK: Binance for major markets and the price service for lowcaps. Compare lowcap pool prices with the separate DexScreener chart."
      />
      <MethodGroup label="Chart data" count={local ? 1 : 3} fullWidth>
        {!local && <CandlesConsole />}
        <LowcapCandlesConsole />
        {!local && <LowcapConsole />}
      </MethodGroup>
    </section>
  );
}
