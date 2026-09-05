import { PriceServiceShell } from "@/features/price-service/price-service-shell";

export const metadata = {
  title: "Price Service · Symmio",
  description:
    "Read and stream mark prices from the Enigma or Binance price provider, plus Enigma metadata, symbols info, and health, via the React SDK.",
};

export default function PriceServicePage() {
  return <PriceServiceShell />;
}
