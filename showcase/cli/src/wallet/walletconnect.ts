import type { Address, EIP1193Provider } from "viem";

/**
 * A connected WalletConnect session: the EIP-1193 provider (used as a viem
 * `custom` transport) and the paired account. Kept in its own module so the
 * heavy `@walletconnect/ethereum-provider` dependency is only pulled in when
 * the operator actually chooses the QR path.
 */
export interface WalletConnectSession {
  provider: EIP1193Provider;
  address: Address;
  switchChain: (chainId: number) => Promise<void>;
  disconnect: () => Promise<void>;
}

interface ConnectParameters {
  projectId: string;
  chainIds: readonly number[];
  rpcMap: Record<number, string>;
  /** Relay endpoint; overridable to route around a geo-blocked default. */
  relayUrl: string;
  /** Called with the pairing URI so the caller can render a terminal QR. */
  onUri: (uri: string) => void;
}

/**
 * The relay must be reachable before WalletConnect can mint a pairing URI, so
 * "no URI within this window" is a reliable stand-in for "relay unreachable".
 * The relay geo-blocks some regions (closing with code 3000, "Country is
 * blocked"); the provider only reports that through its internal logger, which
 * we silence, so this timeout is how the failure reaches the user.
 */
const RELAY_TIMEOUT_MS = 12_000;
const RELAY_UNREACHABLE =
  "Could not reach the WalletConnect relay. It blocks some regions (socket code 3000, 'Country is blocked'). Sign with SYMMIO_PRIVATE_KEY instead, or set SYMMIO_WALLETCONNECT_RELAY_URL / use a VPN.";

/** Open a WalletConnect session, resolving once a wallet approves the pairing. */
export async function connectWalletConnect(parameters: ConnectParameters): Promise<WalletConnectSession> {
  const { EthereumProvider } = await import("@walletconnect/ethereum-provider");

  const provider = await EthereumProvider.init({
    projectId: parameters.projectId,
    relayUrl: parameters.relayUrl,
    // The provider logs to stdout via pino, which would shred the TUI render.
    logger: "silent",
    chains: [parameters.chainIds[0]!],
    optionalChains: [...parameters.chainIds],
    showQrModal: false,
    rpcMap: parameters.rpcMap,
    // Writes can target either configured deployment. The resolver switches
    // immediately before creating the viem wallet client.
    methods: [
      "eth_sendTransaction",
      "personal_sign",
      "eth_signTypedData",
      "eth_signTypedData_v4",
      "wallet_switchEthereumChain",
      "wallet_addEthereumChain",
    ],
    events: ["chainChanged", "accountsChanged"],
    metadata: {
      name: "SYMMIO Frontier Terminal",
      description: "Trade SYMMIO perps from your terminal.",
      url: "https://symm.io",
      icons: ["https://symm.io/favicon.ico"],
    },
  });

  let sawUri = false;
  provider.on("display_uri", (uri) => {
    sawUri = true;
    parameters.onUri(uri);
  });
  // Swallow late relay/session errors on the provider itself so they don't
  // bubble as unhandled rejections (the process guard is the final backstop).
  provider.on("error" as never, () => undefined);

  const connecting = provider.connect();
  let relayTimer: NodeJS.Timeout | undefined;
  const relayWatch = new Promise<never>((_resolve, reject) => {
    relayTimer = setTimeout(() => {
      // A URI means the relay answered; only a silent relay is a failure here.
      if (!sawUri) reject(new Error(RELAY_UNREACHABLE));
    }, RELAY_TIMEOUT_MS);
  });

  try {
    await Promise.race([connecting, relayWatch]);
  } catch (error) {
    // The abandoned connect can still reject later; keep it from going unhandled.
    void connecting.catch(() => undefined);
    throw error;
  } finally {
    clearTimeout(relayTimer);
  }

  const account = await resolveAccount(provider);
  if (!account) {
    await provider.disconnect().catch(() => undefined);
    throw new Error(
      "Wallet paired but returned no EVM account. Select an account in your wallet, then reconnect — or sign with SYMMIO_PRIVATE_KEY instead.",
    );
  }

  return {
    provider: provider as unknown as EIP1193Provider,
    address: account,
    async switchChain(chainId) {
      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: `0x${chainId.toString(16)}` }],
      });
    },
    disconnect: () => provider.disconnect(),
  };
}

/** WalletConnect exposes the paired account inconsistently right after connect;
 * read it from every source (getter → `eth_accounts` → CAIP session parse) with
 * a short retry in case it populates a tick later. */
async function resolveAccount(provider: {
  accounts?: readonly string[];
  request: (args: { method: string }) => Promise<unknown>;
  session?: { namespaces?: Record<string, { accounts?: string[] }> };
}): Promise<Address | undefined> {
  const readOnce = async (): Promise<Address | undefined> => {
    if (provider.accounts && provider.accounts.length > 0) return provider.accounts[0] as Address;
    try {
      const requested = (await provider.request({ method: "eth_accounts" })) as string[] | undefined;
      if (requested && requested.length > 0) return requested[0] as Address;
    } catch {
      /* wallet may not answer eth_accounts — fall through */
    }
    const caip = provider.session?.namespaces?.eip155?.accounts ?? [];
    const parsed = caip.map((entry) => entry.split(":").pop()).find(Boolean);
    return parsed as Address | undefined;
  };

  let account = await readOnce();
  for (let attempt = 0; attempt < 5 && !account; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 200));
    account = await readOnce();
  }
  return account;
}
