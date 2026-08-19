import { PageHeader } from "@/components/page-header";
import { MethodGroup } from "../inspector/method-group";
import { CandlesConsole } from "./candles-console";
import { LowcapConsole } from "./lowcap-console";

/**
 * Candles page: the SDK's chart-data slice driving a real charting library, and
 * the answer for the markets it cannot cover.
 *
 * The point of the first card is the seam — `useCandles` and `useCandleStream`
 * return plain bars, and the library on the other side is interchangeable. The
 * second card is the other half of the story: a lowcap has no reference-exchange
 * listing to pull bars from, so the SDK hands over the pool it trades in and
 * DexScreener draws the chart.
 */
export function CandlesShell() {
  return (
    <section className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
      <PageHeader
        eyebrow="React SDK · Candles"
        title="Candles"
        description="Historical and live OHLCV bars from a pluggable CandleSource. Binance USD-M futures backs the majors here; the SDK returns plain bars, so any charting library can render them — this page uses lightweight-charts. Lowcaps have no such listing, so they chart from their liquidity pool instead."
      />
      <MethodGroup label="Chart data" count={2} fullWidth>
        <CandlesConsole />
        <LowcapConsole />
      </MethodGroup>
    </section>
  );
}
