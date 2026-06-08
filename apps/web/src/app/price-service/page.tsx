import { PriceServiceShell } from "@/features/price-service/price-service-shell";

export const metadata = {
  title: "Price Service · Symmio",
  description: "Read Enigma price-service prices, metadata, symbols info, and health via the React SDK.",
};

export default function PriceServicePage() {
  return <PriceServiceShell />;
}
