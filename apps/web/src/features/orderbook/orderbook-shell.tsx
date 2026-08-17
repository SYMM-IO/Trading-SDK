import { PageHeader } from "@/components/page-header";
import { MethodGroup } from "../inspector/method-group";
import { OrderbookConsole } from "./orderbook-console";

/**
 * Orderbook page: the SDK's depth slice driving the design system's ladder.
 *
 * The point of the card is that none of the three pieces knows about the
 * others — the source speaks Binance, the hook speaks React, and `<OrderBook />`
 * speaks nothing but rows. The panels beside the ladder read from the same book
 * through plain functions, which is the argument for shipping depth rather than
 * a widget.
 */
export function OrderbookShell() {
  return (
    <section className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
      <PageHeader
        eyebrow="React SDK · Orderbook"
        title="Orderbook"
        description="A continuously synchronized order book from a pluggable OrderbookSource. Binance USD-M futures backs the majors here. The SDK buffers, snapshots and verifies that every update chains onto the last, rebuilding from a fresh snapshot when one does not — so the ladder is never quietly wrong."
      />
      <MethodGroup label="Market depth" count={1} fullWidth>
        <OrderbookConsole />
      </MethodGroup>
    </section>
  );
}
