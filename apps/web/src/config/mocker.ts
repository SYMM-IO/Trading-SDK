import type { SymmioProviderProps } from "@symmio/trading-react";
import { createWalletClient, getAddress, http, isAddress, zeroAddress } from "viem";
import { arbitrum } from "viem/chains";
import { createConfig, type Config } from "wagmi";
import { connect } from "wagmi/actions";
import { mock } from "wagmi/connectors";
import { IS_E2E_MODE } from "./environment";

export const MOCKER_URL = process.env.NEXT_PUBLIC_MOCKER_URL || "http://localhost:4600";
export const MOCKER_AVAILABLE = process.env.NODE_ENV === "development" && !IS_E2E_MODE;
const configuredAccount = process.env.NEXT_PUBLIC_MOCKER_ACCOUNT;

type Overrides = NonNullable<SymmioProviderProps["symmioConfig"]>;

export interface MockerSession {
  wagmi: Config;
  overrides: Overrides;
  rpcUrl: string;
  account: string;
}

/** Loopback spellings are interchangeable in the config published by MOCKER. */
function hostName(url: URL) {
  return ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ? "localhost" : url.hostname;
}

export function readMockerConfig(body: unknown, baseUrl: string): { overrides: Overrides; rpcUrl: string } {
  const data = body as { chainId?: number; rpcUrl?: string; symmioConfig?: Overrides } | null;
  const chain = data?.symmioConfig?.[arbitrum.id];
  const solver = chain?.solvers?.enigma;
  const addresses = chain?.addresses;
  if (
    data?.chainId !== arbitrum.id ||
    !chain ||
    !solver ||
    !addresses ||
    !data.rpcUrl ||
    ![
      addresses.symmioAddress,
      addresses.instantLayerAddress,
      addresses.accountLayerAddress,
      addresses.collateralAddress,
      solver.address,
      chain.gasless?.gaslessLayerAddress,
    ].every((a) => a && isAddress(a) && a !== zeroAddress) ||
    !addresses.affiliatesAddress ||
    !isAddress(addresses.affiliatesAddress) ||
    !chain.muon?.urls?.length ||
    !chain.gasless?.protocolInstance ||
    typeof chain.gasless.statusStream?.enabled !== "boolean" ||
    solver.notifications?.protocol !== "enigma" ||
    !solver.notifications.channel ||
    chain.priceService?.type !== "enigma" ||
    solver.priceService?.type !== "enigma"
  ) {
    throw new Error("MOCKER returned an incomplete Arbitrum configuration.");
  }
  const host = hostName(new URL(baseUrl));
  const check = (value: string | undefined, socket = false) => {
    if (!value) return false;
    const url = new URL(value);
    return (
      hostName(url) === host &&
      (socket ? ["ws:", "wss:"] : ["http:", "https:"]).includes(url.protocol) &&
      !url.username &&
      !url.password
    );
  };
  const httpUrls = [
    data.rpcUrl,
    solver.url,
    solver.notifications.searchUrl,
    solver.priceService.url,
    solver.tpsl?.url,
    chain.priceService.url,
    chain.listing?.url,
    chain.inventory?.url,
    chain.subgraphs?.analytics,
    chain.subgraphs?.events,
    chain.gasless.url,
    ...chain.muon.urls,
  ];
  const sockets = [solver.notifications.url, solver.tpsl?.wsUrl, solver.priceService.wsUrl, chain.priceService.wsUrl];
  if (
    !httpUrls.every((url) => check(url)) ||
    !sockets.every((url) => check(url, true)) ||
    (chain.gasless.statusStream?.origin && !check(chain.gasless.statusStream.origin))
  ) {
    throw new Error("MOCKER must supply local endpoints for all services.");
  }
  return { overrides: { [arbitrum.id]: chain }, rpcUrl: data.rpcUrl };
}

export async function connectMocker(signal: AbortSignal, previousAccount?: string): Promise<MockerSession> {
  const requestSignal = AbortSignal.any([signal, AbortSignal.timeout(8000)]);
  const response = await fetch(new URL("/admin/config/sdk", MOCKER_URL), {
    signal: requestSignal,
    cache: "no-store",
    credentials: "omit",
    redirect: "error",
  });
  if (!response.ok) throw new Error(`MOCKER returned HTTP ${response.status}.`);
  const { overrides, rpcUrl } = readMockerConfig(await response.json(), MOCKER_URL);
  const chain = { ...arbitrum, rpcUrls: { default: { http: [rpcUrl] } } };
  const reader = createWalletClient({
    chain,
    transport: http(rpcUrl, { retryCount: 0, fetchOptions: { signal: requestSignal } }),
  });
  if ((await reader.getChainId()) !== chain.id) throw new Error("The MOCKER RPC reports a different chain.");
  const accounts = configuredAccount ? [configuredAccount] : await reader.getAddresses();
  const selected = previousAccount
    ? accounts.find((account) => account.toLowerCase() === previousAccount.toLowerCase())
    : accounts[0];
  if (!selected || !isAddress(selected)) {
    throw new Error(
      previousAccount ? "The saved MOCKER wallet is no longer available." : "MOCKER has no valid test wallet.",
    );
  }
  const account = getAddress(selected);
  const connector = mock({ accounts: [account] });
  const wagmi = createConfig({
    chains: [chain],
    connectors: [connector],
    transports: { [chain.id]: http(rpcUrl, { batch: { wait: 16 } }) },
    multiInjectedProviderDiscovery: false,
    storage: null,
  });
  await connect(wagmi, { connector: wagmi.connectors[0]!, chainId: chain.id });
  requestSignal.throwIfAborted();
  return { wagmi, overrides, rpcUrl, account };
}
