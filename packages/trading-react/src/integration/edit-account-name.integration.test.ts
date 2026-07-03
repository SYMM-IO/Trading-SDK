import { createConfig, editAccountName, getUserSubAccounts, type SymmioWalletClient } from "@symmio/trading-core";
import { createPublicClient, createWalletClient, http, type PublicClient } from "viem";
import { mnemonicToAccount, privateKeyToAccount } from "viem/accounts";
import { hyperEvm } from "viem/chains";
import { describe, expect, it } from "vitest";
import { loadIntegrationEnv } from "./load-env";

loadIntegrationEnv();

/**
 * Layer B integration test — broadcasts a real `editAccountName` transaction
 * on HyperEVM using credentials from the repo-root `.env` file.
 *
 * Skipped automatically when neither `E2E_SEED_PHRASE` nor
 * `SYMM_TEST_PRIVATE_KEY` is set, so the default test run requires zero
 * credentials.
 *
 * This test deliberately bypasses the React layer (no wagmi, no hooks). It
 * drives `core` directly with a viem `WalletClient` wired into a `Config` via
 * the resolver — the same shape `@symmio/trading-react` builds from wagmi.
 */

const HYPER_EVM_RPC = "https://rpc.hyperliquid.xyz/evm";
const SEED = process.env.E2E_SEED_PHRASE;
const RAW_KEY = process.env.SYMM_TEST_PRIVATE_KEY;

const account =
  RAW_KEY && /^0x[0-9a-fA-F]{64}$/.test(RAW_KEY)
    ? privateKeyToAccount(RAW_KEY as `0x${string}`)
    : SEED
      ? mnemonicToAccount(SEED)
      : undefined;

const maybe = account ? describe : describe.skip;

maybe("editAccountName — integration (real broadcast on HyperEVM)", () => {
  it("renames the signer's first subaccount and observes the new name on chain", async () => {
    if (!account) throw new Error("unreachable");

    const publicClient = createPublicClient({
      chain: hyperEvm,
      transport: http(HYPER_EVM_RPC),
    });

    const walletClient = createWalletClient({
      chain: hyperEvm,
      account,
      transport: http(HYPER_EVM_RPC),
    });

    const config = createConfig({
      getClient: () => publicClient as PublicClient,
      getWalletClient: async () => walletClient as unknown as SymmioWalletClient,
    });

    const subs = await getUserSubAccounts(config, { user: account.address });

    const first = subs[0];
    if (!first) {
      console.warn("[integration] signer has no subaccounts; nothing to rename");
      return;
    }

    const newName = `SDK-${Date.now()}`;
    const hash = await editAccountName(config, {
      account: first.accountAddress,
      name: newName,
    });
    expect(hash).toMatch(/^0x[0-9a-f]{64}$/i);

    const receipt = await publicClient.waitForTransactionReceipt({ hash, confirmations: 1 });
    expect(receipt.status).toBe("success");

    const refreshed = await getUserSubAccounts(config, { user: account.address });
    const updated = refreshed.find((sub) => sub.accountAddress === first.accountAddress);
    expect(updated?.name).toBe(newName);
  });
});
