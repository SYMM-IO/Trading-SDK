import { scanSdkUsage } from "@/features/sdk/scan-sdk-usage";
import { SdkScreen } from "@/features/sdk/sdk-screen";

export const metadata = {
  title: "Prism — two solvers, one order book",
  description:
    "How a multi-solver perpetuals DEX is wired on the SYMMIO SDK: the live resolved config, the capability gates, and the fan-out that reads two chains at once.",
};

/**
 * The SDK screen.
 *
 * A server component on purpose: the coverage tally is produced by reading this
 * app's own source and the SDK's export barrels with `node:fs`, which can only
 * happen on the server. Everything below it is client-side, because everything
 * below it is live.
 */
export default async function Page() {
  const coverage = await scanSdkUsage();
  return <SdkScreen coverage={coverage} />;
}
