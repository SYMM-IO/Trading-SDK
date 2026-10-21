import type { Account, PublicClient } from "viem";
import { createSiweMessage } from "viem/siwe";
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

const LISTING_URL = getChainConfig(SymmioSupportedChainId.ARBITRUM).listing?.url;
const SIGNATURE = `0x${"ab".repeat(65)}`;

const SIWE_PARAMS = {
  domain: "app.example.com",
  address: TEST_USER,
  uri: "https://app.example.com",
  version: "1",
  chainId: 42161,
  issuedAt: "2026-08-24T00:00:00.000Z",
  nonce: "0xabcdefabcdefabcdefabcdefabcdefab",
  statement: "Sign in to Pools",
};

const SIWE_MESSAGE = createSiweMessage({ ...SIWE_PARAMS, version: "1", issuedAt: new Date(SIWE_PARAMS.issuedAt) });

/** Build a config whose wallet client exposes a `signMessage` spy. */
function makeConfigWithSigner() {
  const signMessage = vi.fn().mockResolvedValue(SIGNATURE);
  const account = { address: TEST_USER, type: "json-rpc" } as Account;
  const walletClient = {
    account,
    chain: { id: SymmioSupportedChainId.ARBITRUM },
    signMessage,
  } as unknown as SymmioWalletClient;

  const config = createConfig({
    symmioConfig: { [SymmioSupportedChainId.ARBITRUM]: { addresses: { affiliatesAddress: TEST_AFFILIATE_ADDRESS } } },
    getClient: () => ({}) as PublicClient,
    getWalletClient: async () => walletClient,
  });

  return { config, account, signMessage };
}

describe("authenticateListing", () => {
  it("rejects an expired prefetched challenge before signing or exchanging tokens", async () => {
    const { config, signMessage } = makeConfigWithSigner();
    const expirationTime = "2020-01-01T00:00:00.000Z";
    const params = { ...SIWE_PARAMS, expirationTime };
    const message = createSiweMessage({
      ...params,
      version: "1",
      issuedAt: new Date(params.issuedAt),
      expirationTime: new Date(expirationTime),
    });
    await expect(
      authenticateListing(config, {
        chainId: 42161,
        domain: params.domain,
        uri: params.uri,
        signInMessage: { message, params },
      }),
    ).rejects.toMatchObject({ code: "LISTING_CHALLENGE_EXPIRED" });
    expect(signMessage).not.toHaveBeenCalled();
    expect(loginV2AuthLoginPost).not.toHaveBeenCalled();
  });
  beforeEach(() => {
    getSignInMessageV2AuthSignInMessageGet.mockReset();
    loginV2AuthLoginPost.mockReset();
  });

  it("uses a prefetched challenge without fetching a second nonce", async () => {
    const { config, signMessage } = makeConfigWithSigner();
    loginV2AuthLoginPost.mockResolvedValue({ data: { accessToken: "TOKEN", tokenType: "bearer" } });
    await authenticateListing(config, {
      chainId: 42161,
      domain: SIWE_PARAMS.domain,
      uri: SIWE_PARAMS.uri,
      signInMessage: { message: SIWE_MESSAGE, params: SIWE_PARAMS },
    });
    expect(getSignInMessageV2AuthSignInMessageGet).not.toHaveBeenCalled();
    expect(signMessage).toHaveBeenCalledWith(expect.objectContaining({ message: SIWE_MESSAGE }));
  });

  it.each([
    { address: "0x0000000000000000000000000000000000000001" },
    { domain: "other.example" },
    { uri: "https://other.example" },
  ])("rejects a stale prefetched challenge before prompting the wallet: %o", async (changes) => {
    const { config, signMessage } = makeConfigWithSigner();
    await expect(
      authenticateListing(config, {
        chainId: 42161,
        domain: SIWE_PARAMS.domain,
        uri: SIWE_PARAMS.uri,
        signInMessage: { message: SIWE_MESSAGE, params: { ...SIWE_PARAMS, ...changes } },
      }),
    ).rejects.toMatchObject({ code: "LISTING_CHALLENGE_MISMATCH" });
    expect(signMessage).not.toHaveBeenCalled();
    expect(loginV2AuthLoginPost).not.toHaveBeenCalled();
  });

  it("runs the full SIWE flow: fetch, sign, then login for a bearer token", async () => {
    const { config, account, signMessage } = makeConfigWithSigner();
    getSignInMessageV2AuthSignInMessageGet.mockResolvedValue({
      data: { message: SIWE_MESSAGE, params: SIWE_PARAMS },
    });
    loginV2AuthLoginPost.mockResolvedValue({ data: { accessToken: "TOKEN123", tokenType: "bearer" } });

    const token = await authenticateListing(config, {
      domain: "app.example.com",
      uri: "https://app.example.com",
      statement: "Sign in to Pools",
    });

    expect(signMessage).toHaveBeenCalledWith({ account, message: SIWE_MESSAGE });
    expect(loginV2AuthLoginPost).toHaveBeenCalledWith(
      {
        message: {
          domain: "app.example.com",
          address: TEST_USER,
          uri: "https://app.example.com",
          version: "1",
          chainId: 42161,
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
