import type { CreateConfigParameters, SymmioGaslessConfig } from "@symmio/trading-core";

const ARBITRUM_CHAIN_ID = 42161;

/** The deployment facts from MOCKER's admin config response. */
export interface MockerConfig {
  chainId: typeof ARBITRUM_CHAIN_ID;
  rpcUrl: string;
  symmioConfig: CreateConfigParameters["symmioConfig"] &
    Record<
      typeof ARBITRUM_CHAIN_ID,
      NonNullable<CreateConfigParameters["symmioConfig"][number]> & {
        gasless: SymmioGaslessConfig;
      }
    >;
}

function parseServiceUrl(value: unknown): URL | undefined {
  if (typeof value !== "string") return undefined;
  try {
    return new URL(value);
  } catch {
    return undefined;
  }
}

/** Reject incomplete deployments and mixed hosts before wagmi or the SDK starts. */
export function parseMockerConfig(payload: unknown, panelUrl?: string): MockerConfig {
  const input = payload as Partial<MockerConfig> | null;
  const rpc = parseServiceUrl(input?.rpcUrl);
  const chain = input?.symmioConfig?.[ARBITRUM_CHAIN_ID];
  if (!rpc || !chain || input?.chainId !== ARBITRUM_CHAIN_ID) {
    throw new Error("MOCKER must advertise its Arbitrum RPC and SDK configuration.");
  }

  const host = panelUrl ? new URL(panelUrl).hostname : rpc.hostname;
  const solver = chain.solvers?.enigma;
  const httpUrls = [
    input.rpcUrl,
    solver?.url,
    solver?.notifications?.searchUrl,
    solver?.tpsl?.url,
    chain.priceService?.url,
    ...(Array.isArray(chain.muon?.urls) && chain.muon.urls.length ? chain.muon.urls : [undefined]),
    chain.subgraphs?.analytics,
    chain.subgraphs?.events,
    chain.listing?.url,
    chain.inventory?.url,
    chain.gasless?.url,
    chain.gasless?.statusStream?.origin ?? chain.gasless?.url,
  ];
  const socketUrls = [solver?.notifications?.url, solver?.tpsl?.wsUrl, chain.priceService?.wsUrl];
  const addresses = [
    chain.addresses?.symmioAddress,
    chain.addresses?.accountLayerAddress,
    chain.addresses?.instantLayerAddress,
    chain.addresses?.collateralAddress,
    chain.addresses?.affiliatesAddress,
    solver?.address,
    solver?.tpsl?.cohWalletAddress,
    chain.gasless?.gaslessLayerAddress,
  ];
  if (
    !httpUrls.every((value) => {
      const url = parseServiceUrl(value);
      return url?.hostname === host && (url.protocol === "http:" || url.protocol === "https:");
    }) ||
    !socketUrls.every((value) => {
      const url = parseServiceUrl(value);
      return url?.hostname === host && (url.protocol === "ws:" || url.protocol === "wss:");
    }) ||
    !addresses.every((address) => typeof address === "string" && /^0x[0-9a-f]{40}$/i.test(address)) ||
    solver?.notifications?.protocol !== "enigma" ||
    typeof solver.notifications.channel !== "string" ||
    typeof solver?.tpsl?.appName !== "string" ||
    chain.priceService?.type !== "enigma" ||
    typeof chain.gasless?.protocolInstance !== "string"
  ) {
    throw new Error("MOCKER must advertise complete SDK settings on its own host, including a local TP/SL handler.");
  }

  return { chainId: ARBITRUM_CHAIN_ID, rpcUrl: rpc.href, symmioConfig: { [ARBITRUM_CHAIN_ID]: chain } };
}

/** Load the deployment before Next initializes its client-side config. */
export async function fetchMockerConfig(panelUrl: string): Promise<MockerConfig | undefined> {
  const url = new URL("/admin/config/sdk", panelUrl);
  const response = await fetch(url, { signal: AbortSignal.timeout(1_500) }).catch(() => undefined);
  if (!response) return undefined;
  if (!response.ok) throw new Error(`MOCKER config at ${url} returned HTTP ${response.status}.`);
  return parseMockerConfig(await response.json(), panelUrl);
}
