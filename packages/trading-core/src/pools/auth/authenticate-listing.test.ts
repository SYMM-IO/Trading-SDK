import type { Account, PublicClient } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../core/chains";
import { createConfig, type SymmioWalletClient } from "../../core/config";
import { TEST_AFFILIATE_ADDRESS, TEST_USER } from "../../shared/test/mock-config";

const getSignInMessageV2AuthSignInMessageGet = vi.hoisted(() => vi.fn());
const loginV2AuthLoginPost = vi.hoisted(() => vi.fn());

vi.mock("../types/generated/listing-backend", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../types/generated/listing-backend")>();
  return {
    ...actual,
    getSignInMessageV2AuthSignInMessageGet,
    loginV2AuthLoginPost,
  };
});

import { authenticateListing } from "./authenticate-listing";

const LISTING_URL = getChainConfig(SymmioSupportedChainId.HYPER_EVM).listing?.url;
const SIGNATURE = `0x${"ab".repeat(65)}`;

const SIWE_PARAMS = {
  domain: "app.example.com",
  address: TEST_USER,
  uri: "https://app.example.com",
  version: "1",
  chainId: 999,
  issuedAt: "2026-08-24T00:00:00.000Z",
  nonce: "0xabcdefabcdefabcdefabcdefabcdefab",
  statement: "Sign in to Pools",
};

/** Build a config whose wallet client exposes a `signMessage` spy. */
function makeConfigWithSigner() {
  const signMessage = vi.fn().mockResolvedValue(SIGNATURE);
  const account = { address: TEST_USER, type: "json-rpc" } as Account;
  const walletClient = {
    account,
    chain: { id: SymmioSupportedChainId.HYPER_EVM },
    signMessage,
  } as unknown as SymmioWalletClient;

  const config = createConfig({
    symmioConfig: { [SymmioSupportedChainId.HYPER_EVM]: { addresses: { affiliatesAddress: TEST_AFFILIATE_ADDRESS } } },
    getClient: () => ({}) as PublicClient,
    getWalletClient: async () => walletClient,
  });

  return { config, account, signMessage };
}

describe("authenticateListing", () => {
  beforeEach(() => {
    getSignInMessageV2AuthSignInMessageGet.mockReset();
    loginV2AuthLoginPost.mockReset();
  });

  it("runs the full SIWE flow: fetch, sign, then login for a bearer token", async () => {
    const { config, account, signMessage } = makeConfigWithSigner();
    getSignInMessageV2AuthSignInMessageGet.mockResolvedValue({
      data: { message: "SIWE-STRING", params: SIWE_PARAMS },
    });
    loginV2AuthLoginPost.mockResolvedValue({ data: { accessToken: "TOKEN123", tokenType: "bearer" } });

    const token = await authenticateListing(config, {
      domain: "app.example.com",
      uri: "https://app.example.com",
      statement: "Sign in to Pools",
    });

    expect(signMessage).toHaveBeenCalledWith({ account, message: "SIWE-STRING" });
    expect(loginV2AuthLoginPost).toHaveBeenCalledWith(
      {
        message: {
          domain: "app.example.com",
          address: TEST_USER,
          uri: "https://app.example.com",
          version: "1",
          chainId: 999,
          issuedAt: "2026-08-24T00:00:00.000Z",
          nonce: "0xabcdefabcdefabcdefabcdefabcdefab",
          statement: "Sign in to Pools",
        },
        signature: SIGNATURE,
      },
      expect.objectContaining({ baseURL: LISTING_URL }),
    );
    expect(token).toEqual({ accessToken: "TOKEN123", tokenType: "bearer" });
  });
});
