import { OrderbookShell } from "@/features/orderbook/orderbook-shell";

export const metadata = {
  title: "Orderbook · Symmio",
  description: "Stream a synchronized order book from a pluggable OrderbookSource via the React SDK.",
};

export default function OrderbookPage() {
  return <OrderbookShell />;
}
