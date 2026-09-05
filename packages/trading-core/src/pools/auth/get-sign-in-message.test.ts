import { beforeEach, describe, expect, it, vi } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../core/chains";
import { SymmError } from "../../shared/errors/symm-error";
import { mockConfig, TEST_USER } from "../../shared/test/mock-config";

const getSignInMessageV2AuthSignInMessageGet = vi.hoisted(() => vi.fn());

vi.mock("../types/generated/listing-backend", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../types/generated/listing-backend")>();
  return {
    ...actual,
    getSignInMessageV2AuthSignInMessageGet,
  };
});

import { getListingSignInMessage } from "./get-sign-in-message";

const LISTING_URL = getChainConfig(SymmioSupportedChainId.HYPER_EVM).listing?.url;

describe("getListingSignInMessage", () => {
  beforeEach(() => {
    getSignInMessageV2AuthSignInMessageGet.mockReset();
  });

  it("forwards the params to the enigma listing backend and normalizes the response", async () => {
    const { config } = mockConfig();
    getSignInMessageV2AuthSignInMessageGet.mockResolvedValue({
      data: {
        message: "SIWE-STRING",
        params: {
          domain: "app.example.com",
          address: TEST_USER,
          uri: "https://app.example.com",
          version: "1",
          chainId: 999,
          issuedAt: "2026-08-24T00:00:00.000Z",
          nonce: "0xabcdefabcdefabcdefabcdefabcdefab",
          statement: "Sign in to Pools",
        },
      },
    });

    const signIn = await getListingSignInMessage(config, {
      address: TEST_USER,
      domain: "app.example.com",
      uri: "https://app.example.com",
      statement: "Sign in to Pools",
    });

    expect(getSignInMessageV2AuthSignInMessageGet).toHaveBeenCalledWith(
      {
        address: TEST_USER,
        domain: "app.example.com",
        uri: "https://app.example.com",
        statement: "Sign in to Pools",
      },
      expect.objectContaining({ baseURL: LISTING_URL }),
    );
    expect(signIn).toEqual({
      message: "SIWE-STRING",
      params: {
        domain: "app.example.com",
        address: TEST_USER,
        uri: "https://app.example.com",
        version: "1",
        chainId: 999,
        issuedAt: "2026-08-24T00:00:00.000Z",
        nonce: "0xabcdefabcdefabcdefabcdefabcdefab",
        statement: "Sign in to Pools",
      },
    });
  });

  it("throws LISTING_NOT_CONFIGURED when the chain has no listing backend", async () => {
    const { config } = mockConfig();

    await expect(
      getListingSignInMessage(config, {
        chainId: SymmioSupportedChainId.BASE,
        address: TEST_USER,
        domain: "app.example.com",
        uri: "https://app.example.com",
      }),
    ).rejects.toBeInstanceOf(SymmError);
    await expect(
      getListingSignInMessage(config, {
        chainId: SymmioSupportedChainId.BASE,
        address: TEST_USER,
        domain: "app.example.com",
        uri: "https://app.example.com",
      }),
    ).rejects.toMatchObject({ code: "LISTING_NOT_CONFIGURED" });
    expect(getSignInMessageV2AuthSignInMessageGet).not.toHaveBeenCalled();
  });
});
