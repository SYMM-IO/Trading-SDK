import { describe, expect, it } from "vitest";
import type { SignInMessageResponseSchema, Token } from "../types/generated/listing-backend";
import { toCustomSiweMessage, toListingAuthToken, toListingSignInMessage } from "./to-siwe";
import type { ListingSiweParams } from "./types";

const SAMPLE_PARAMS: ListingSiweParams = {
  domain: "app.example.com",
  address: "0x1111111111111111111111111111111111111111",
  uri: "https://app.example.com",
  version: "1",
  chainId: 999,
  issuedAt: "2026-08-24T00:00:00.000Z",
  nonce: "0xabcdefabcdefabcdefabcdefabcdefab",
  statement: "Sign in to Pools",
};

describe("toListingSignInMessage", () => {
  it("copies the message and maps every params field", () => {
    const raw: SignInMessageResponseSchema = {
      message: "SIWE-STRING",
      params: { ...SAMPLE_PARAMS },
    };

    expect(toListingSignInMessage(raw)).toEqual({
      message: "SIWE-STRING",
      params: SAMPLE_PARAMS,
    });
  });
});

describe("toCustomSiweMessage", () => {
  it("rebuilds the login payload from the normalized params", () => {
    expect(toCustomSiweMessage(SAMPLE_PARAMS)).toEqual({
      domain: "app.example.com",
      address: "0x1111111111111111111111111111111111111111",
      uri: "https://app.example.com",
      version: "1",
      chainId: 999,
      issuedAt: "2026-08-24T00:00:00.000Z",
      nonce: "0xabcdefabcdefabcdefabcdefabcdefab",
      statement: "Sign in to Pools",
    });
  });
});

describe("toListingAuthToken", () => {
  it("maps the access token and token type", () => {
    const raw: Token = { accessToken: "TOKEN123", tokenType: "bearer" };

    expect(toListingAuthToken(raw)).toEqual({ accessToken: "TOKEN123", tokenType: "bearer" });
  });
});
