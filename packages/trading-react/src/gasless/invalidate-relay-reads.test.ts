import {
  getCollateralBalanceQueryKey,
  getGaslessDepositPolicyQueryKey,
  getGaslessWalletCreationFeeQueryKey,
  getGaslessWalletNonceQueryKey,
  getUserSubAccountsQueryKey,
} from "@symmio/trading-core";
import { QueryClient, type QueryKey } from "@tanstack/react-query";
import { arbitrum } from "viem/chains";
import { describe, expect, it } from "vitest";
import { invalidateDepositSettlementReads, invalidateGaslessWalletExecuteReads } from "./invalidate-relay-reads";

const CHAIN = arbitrum.id;
const CONFIG_KEY = "config-key";
const SCOPE = { configKey: CONFIG_KEY };
const OWNER = "0x1111111111111111111111111111111111111111" as const;
const OTHER_OWNER = "0x2222222222222222222222222222222222222222" as const;
const SUB_ACCOUNT = "0x3333333333333333333333333333333333333333" as const;
const DEPOSIT_ADDRESS = "0x5555555555555555555555555555555555555555" as const;

/** Seed a query client with one cached entry per key, all fresh. */
function seeded(keys: readonly QueryKey[]): QueryClient {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  for (const key of keys) queryClient.setQueryData(key, 0n);
  return queryClient;
}

function isInvalidated(queryClient: QueryClient, key: QueryKey): boolean | undefined {
  return queryClient.getQueryState(key)?.isInvalidated;
}

describe("invalidateGaslessWalletExecuteReads", () => {
  const wallet0Nonce = getGaslessWalletNonceQueryKey({
    chainId: CHAIN,
    owner: OWNER,
    account: SUB_ACCOUNT,
    configKey: CONFIG_KEY,
  });
  const wallet2Nonce = getGaslessWalletNonceQueryKey({
    chainId: CHAIN,
    owner: OWNER,
    walletId: 2n,
    account: SUB_ACCOUNT,
    configKey: CONFIG_KEY,
  });
  const ownerSignedNonce = getGaslessWalletNonceQueryKey({
    chainId: CHAIN,
    owner: OWNER,
    account: OWNER,
    configKey: CONFIG_KEY,
  });

  it("invalidates the nonce under the signer account, on every wallet id — not the owner's own stream", () => {
    const queryClient = seeded([wallet0Nonce, wallet2Nonce, ownerSignedNonce]);

    invalidateGaslessWalletExecuteReads(queryClient, SCOPE, { owner: OWNER, signerAccount: SUB_ACCOUNT });

    expect(isInvalidated(queryClient, wallet0Nonce)).toBe(true);
    expect(isInvalidated(queryClient, wallet2Nonce)).toBe(true);
    /** The operation consumed the sub-account's nonce; the owner-signed stream did not move. */
    expect(isInvalidated(queryClient, ownerSignedNonce)).toBe(false);
  });

  it("falls back to the owner as the signer account when none was passed", () => {
    const queryClient = seeded([wallet0Nonce, ownerSignedNonce]);

    invalidateGaslessWalletExecuteReads(queryClient, SCOPE, { owner: OWNER });

    expect(isInvalidated(queryClient, ownerSignedNonce)).toBe(true);
    expect(isInvalidated(queryClient, wallet0Nonce)).toBe(false);
  });

  it("narrows the nonce to one wallet id when the action names it", () => {
    const queryClient = seeded([wallet0Nonce, wallet2Nonce]);

    invalidateGaslessWalletExecuteReads(queryClient, SCOPE, { owner: OWNER, walletId: 2n, signerAccount: SUB_ACCOUNT });

    expect(isInvalidated(queryClient, wallet2Nonce)).toBe(true);
    expect(isInvalidated(queryClient, wallet0Nonce)).toBe(false);
  });

  it("invalidates the owner's deposit policy and creation fee on every wallet id, leaving other owners alone", () => {
    const policy0 = getGaslessDepositPolicyQueryKey({ chainId: CHAIN, owner: OWNER, configKey: CONFIG_KEY });
    const policy1 = getGaslessDepositPolicyQueryKey({
      chainId: CHAIN,
      owner: OWNER,
      walletId: 1n,
      configKey: CONFIG_KEY,
    });
    const fee1 = getGaslessWalletCreationFeeQueryKey({
      chainId: CHAIN,
      owner: OWNER,
      walletId: 1n,
      configKey: CONFIG_KEY,
    });
    const otherPolicy = getGaslessDepositPolicyQueryKey({ chainId: CHAIN, owner: OTHER_OWNER, configKey: CONFIG_KEY });
    const otherFee = getGaslessWalletCreationFeeQueryKey({ chainId: CHAIN, owner: OTHER_OWNER, configKey: CONFIG_KEY });
    const queryClient = seeded([policy0, policy1, fee1, otherPolicy, otherFee]);

    invalidateGaslessWalletExecuteReads(queryClient, SCOPE, { owner: OWNER, signerAccount: SUB_ACCOUNT });

    expect(isInvalidated(queryClient, policy0)).toBe(true);
    expect(isInvalidated(queryClient, policy1)).toBe(true);
    expect(isInvalidated(queryClient, fee1)).toBe(true);
    expect(isInvalidated(queryClient, otherPolicy)).toBe(false);
    expect(isInvalidated(queryClient, otherFee)).toBe(false);
  });

  it("never reaches reads of another chain config", () => {
    const foreign = getGaslessWalletCreationFeeQueryKey({ chainId: CHAIN, owner: OWNER, configKey: "other-config" });
    const queryClient = seeded([foreign]);

    invalidateGaslessWalletExecuteReads(queryClient, SCOPE, { owner: OWNER });

    expect(isInvalidated(queryClient, foreign)).toBe(false);
  });
});

describe("invalidateDepositSettlementReads", () => {
  const policy = getGaslessDepositPolicyQueryKey({ chainId: CHAIN, owner: OWNER, walletId: 1n, configKey: CONFIG_KEY });
  const fee = getGaslessWalletCreationFeeQueryKey({ chainId: CHAIN, owner: OWNER, configKey: CONFIG_KEY });
  const otherPolicy = getGaslessDepositPolicyQueryKey({ chainId: CHAIN, owner: OTHER_OWNER, configKey: CONFIG_KEY });
  const swept = getCollateralBalanceQueryKey({ chainId: CHAIN, owner: DEPOSIT_ADDRESS, configKey: CONFIG_KEY });
  const subAccounts = getUserSubAccountsQueryKey({ chainId: CHAIN, user: OWNER, configKey: CONFIG_KEY });

  it("invalidates the owner's deposit policy and creation fee after a top-up, but not the sub-account lists", () => {
    const queryClient = seeded([policy, fee, otherPolicy, swept, subAccounts]);

    invalidateDepositSettlementReads(queryClient, SCOPE, { depositAddress: DEPOSIT_ADDRESS, owner: OWNER });

    expect(isInvalidated(queryClient, policy)).toBe(true);
    expect(isInvalidated(queryClient, fee)).toBe(true);
    expect(isInvalidated(queryClient, swept)).toBe(true);
    expect(isInvalidated(queryClient, otherPolicy)).toBe(false);
    expect(isInvalidated(queryClient, subAccounts)).toBe(false);
  });

  it("also refreshes the owner's sub-account lists after a new-account settlement", () => {
    const queryClient = seeded([policy, fee, subAccounts]);

    invalidateDepositSettlementReads(queryClient, SCOPE, {
      depositAddress: DEPOSIT_ADDRESS,
      owner: OWNER,
      newAccount: true,
    });

    expect(isInvalidated(queryClient, subAccounts)).toBe(true);
    expect(isInvalidated(queryClient, policy)).toBe(true);
    expect(isInvalidated(queryClient, fee)).toBe(true);
  });

  it("narrows the settled wallet's policy and creation fee to the id the service reported", () => {
    const otherWalletPolicy = getGaslessDepositPolicyQueryKey({
      chainId: CHAIN,
      owner: OWNER,
      walletId: 2n,
      configKey: CONFIG_KEY,
    });
    const queryClient = seeded([policy, otherWalletPolicy, fee]);

    invalidateDepositSettlementReads(queryClient, SCOPE, {
      depositAddress: DEPOSIT_ADDRESS,
      owner: OWNER,
      walletId: 1n,
    });

    expect(isInvalidated(queryClient, policy)).toBe(true);
    /** Each wallet id has its own balance and creation fee — a settlement of one says nothing about another. */
    expect(isInvalidated(queryClient, otherWalletPolicy)).toBe(false);
  });

  it("widens the swept-balance invalidation to the chain when the deposit address is malformed", () => {
    const elsewhere = getCollateralBalanceQueryKey({ chainId: CHAIN, owner: OTHER_OWNER, configKey: CONFIG_KEY });
    const queryClient = seeded([swept, elsewhere]);

    invalidateDepositSettlementReads(queryClient, SCOPE, { depositAddress: "not-an-address", owner: OWNER });

    expect(isInvalidated(queryClient, swept)).toBe(true);
    expect(isInvalidated(queryClient, elsewhere)).toBe(true);
  });
});
