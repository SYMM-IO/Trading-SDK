import { custom, numberToHex, type Account, type EIP1193RequestFn, type Transport } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { hyperEvm, mainnet } from "viem/chains";
import { describe, expect, it, vi, type Mock } from "vitest";
import { createConfig as createWagmiConfig, type Config as WagmiConfig } from "wagmi";
import { connect } from "wagmi/actions";
import { mock } from "wagmi/connectors";
import { TEST_EOA } from "../test/test-utils";
import { createSessionKeyWalletClientResolver } from "./create-session-key-wallet-client-resolver";

/**
 * Anvil deterministic test account #1 — a key that is deliberately NOT the one
 * behind {@link TEST_EOA}, so "the session key" and "the connected wallet" are
 * two distinguishable signers. Public, never used on a real chain.
 */
const SESSION_PRIVATE_KEY = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d" as const;
const sessionAccount: Account = privateKeyToAccount(SESSION_PRIVATE_KEY);

/** An EIP-1193 provider stub that records the RPC methods it was asked for. */
interface RequestSpy {
  /** The provider `request` function to hand to viem's `custom` transport. */
  request: Mock;
  /** Methods this provider was asked for, in call order. */
  methods: string[];
}

/**
 * Build a provider stub that answers `eth_chainId` with HyperEVM and records
 * every method it receives. Which spy sees the traffic is how these tests tell
 * the wagmi-configured transport apart from any other one.
 */
function createRequestSpy(): RequestSpy {
  const methods: string[] = [];
  const request = vi.fn(async ({ method }: { method: string }) => {
    methods.push(method);
    return numberToHex(hyperEvm.id);
  });

  return { request, methods };
}

/**
 * Wrap a {@link RequestSpy} as a viem transport.
 *
 * The spy cannot be written as viem's overloaded `EIP1193RequestFn`, so it is
 * cast at the single point it enters viem; it is still exercised through the
 * real transport pipeline.
 */
function toTransport(spy: RequestSpy): Transport {
  return custom({ request: spy.request as unknown as EIP1193RequestFn });
}

/**
 * Build a wagmi config whose transport is a spy rather than an HTTP endpoint.
 * Every RPC the resolved client makes lands on that spy, which is what proves
 * the session-key client inherited the host's configured transport instead of
 * silently falling back to viem's public `http()` default.
 *
 * @param options.connected - `false` registers no connector, so wagmi has no
 *   wallet to resolve.
 */
async function createSpyWagmiConfig(options: { connected?: boolean } = {}): Promise<{
  wagmiConfig: WagmiConfig;
  wagmiTransport: RequestSpy;
}> {
  const wagmiTransport = createRequestSpy();
  const connectors = options.connected === false ? [] : [mock({ accounts: [TEST_EOA] })];
  const wagmiConfig = createWagmiConfig({
    chains: [hyperEvm],
    transports: { [hyperEvm.id]: toTransport(wagmiTransport) },
    connectors,
    multiInjectedProviderDiscovery: false,
  });

  if (options.connected !== false) await connect(wagmiConfig, { connector: wagmiConfig.connectors[0]! });

  return { wagmiConfig, wagmiTransport };
}

describe("createSessionKeyWalletClientResolver", () => {
  it("routes a `from` that matches the loaded session key to the session-key account", async () => {
    const { wagmiConfig } = await createSpyWagmiConfig();
    const resolveWalletClient = createSessionKeyWalletClientResolver({
      wagmiConfig,
      getSessionAccount: () => sessionAccount,
    });

    const client = await resolveWalletClient({ chainId: hyperEvm.id, from: sessionAccount.address });

    expect(client.account.address).toBe(sessionAccount.address);
    expect(client.chain.id).toBe(hyperEvm.id);
  });

  it("matches `from` against the session key case-insensitively", async () => {
    const { wagmiConfig } = await createSpyWagmiConfig();
    const resolveWalletClient = createSessionKeyWalletClientResolver({
      wagmiConfig,
      getSessionAccount: () => sessionAccount,
    });

    const client = await resolveWalletClient({
      chainId: hyperEvm.id,
      from: sessionAccount.address.toLowerCase() as `0x${string}`,
    });

    expect(client.account.address).toBe(sessionAccount.address);
  });

  it("reads the session account on every call, so loading a key later needs no new resolver", async () => {
    const { wagmiConfig } = await createSpyWagmiConfig();
    let loaded: Account | null = null;
    const resolveWalletClient = createSessionKeyWalletClientResolver({
      wagmiConfig,
      getSessionAccount: () => loaded,
    });

    const beforeLoad = await resolveWalletClient({ chainId: hyperEvm.id });
    expect(beforeLoad.account.address).toBe(TEST_EOA);

    loaded = sessionAccount;
    const afterLoad = await resolveWalletClient({ chainId: hyperEvm.id, from: sessionAccount.address });
    expect(afterLoad.account.address).toBe(sessionAccount.address);
  });

  it("binds the session-key client to wagmi's configured transport, not a bare http() default", async () => {
    const { wagmiConfig, wagmiTransport } = await createSpyWagmiConfig();
    const resolveWalletClient = createSessionKeyWalletClientResolver({
      wagmiConfig,
      getSessionAccount: () => sessionAccount,
    });

    const client = await resolveWalletClient({ chainId: hyperEvm.id, from: sessionAccount.address });
    const chainId = await client.getChainId();

    expect(wagmiTransport.methods).toContain("eth_chainId");
    expect(chainId).toBe(hyperEvm.id);
  });

  it("prefers the `transport` override over wagmi's transport", async () => {
    const { wagmiConfig, wagmiTransport } = await createSpyWagmiConfig();
    const overrideSpy = createRequestSpy();
    const transport = vi.fn(() => toTransport(overrideSpy));
    const resolveWalletClient = createSessionKeyWalletClientResolver({
      wagmiConfig,
      getSessionAccount: () => sessionAccount,
      transport,
    });

    const client = await resolveWalletClient({ chainId: hyperEvm.id, from: sessionAccount.address });
    await client.getChainId();

    expect(transport).toHaveBeenCalledWith(hyperEvm.id);
    expect(overrideSpy.methods).toContain("eth_chainId");
    expect(wagmiTransport.request).not.toHaveBeenCalled();
  });

  it("throws UNSUPPORTED_CHAIN when the wagmi config knows no such chain", async () => {
    const { wagmiConfig } = await createSpyWagmiConfig();
    const resolveWalletClient = createSessionKeyWalletClientResolver({
      wagmiConfig,
      getSessionAccount: () => sessionAccount,
    });

    await expect(resolveWalletClient({ chainId: mainnet.id, from: sessionAccount.address })).rejects.toMatchObject({
      kind: "config",
      code: "UNSUPPORTED_CHAIN",
    });
  });

  it("falls through to the connected wallet for an owner `from`", async () => {
    const { wagmiConfig } = await createSpyWagmiConfig();
    const resolveWalletClient = createSessionKeyWalletClientResolver({
      wagmiConfig,
      getSessionAccount: () => sessionAccount,
    });

    const client = await resolveWalletClient({ chainId: hyperEvm.id, from: TEST_EOA });

    expect(client.account.address).toBe(TEST_EOA);
  });

  it("returns the connected wallet when no `from` is requested", async () => {
    const { wagmiConfig } = await createSpyWagmiConfig();
    const resolveWalletClient = createSessionKeyWalletClientResolver({
      wagmiConfig,
      getSessionAccount: () => sessionAccount,
    });

    const client = await resolveWalletClient({ chainId: hyperEvm.id });

    expect(client.account.address).toBe(TEST_EOA);
  });

  it("throws SESSION_SIGNER_UNAVAILABLE, naming `from`, when it matches neither signer", async () => {
    const { wagmiConfig } = await createSpyWagmiConfig();
    const resolveWalletClient = createSessionKeyWalletClientResolver({
      wagmiConfig,
      getSessionAccount: () => null,
    });
    const unknownSigner = "0x000000000000000000000000000000000000dEaD" as const;

    const rejection = resolveWalletClient({ chainId: hyperEvm.id, from: unknownSigner });

    await expect(rejection).rejects.toMatchObject({ kind: "config", code: "SESSION_SIGNER_UNAVAILABLE" });
    await expect(rejection).rejects.toThrow(unknownSigner);
  });

  it("throws NO_WALLET_CONNECTED when the fallback path finds no connected wallet", async () => {
    const { wagmiConfig } = await createSpyWagmiConfig({ connected: false });
    const resolveWalletClient = createSessionKeyWalletClientResolver({
      wagmiConfig,
      getSessionAccount: () => null,
    });

    await expect(resolveWalletClient({ chainId: hyperEvm.id })).rejects.toMatchObject({
      kind: "config",
      code: "NO_WALLET_CONNECTED",
    });
  });
});
