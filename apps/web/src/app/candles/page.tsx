import { CandlesShell } from "@/features/candles/candles-shell";

export const metadata = {
  title: "Candles · Symmio",
  description: "Load historical and live OHLCV bars from a pluggable CandleSource via the React SDK.",
};

export default function CandlesPage() {
  return <CandlesShell />;
}
