import type { Address, PublicClient } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SymmioSupportedChainId } from "../../core/chains";
import { createConfig } from "../../core/config";

/**
 * `getSubAccountQuotes` is an orchestrator: it fans out to the instant-open /
 * instant-close hedger reads, resolves the account set, reads on-chain positions
 * and pending quotes per account, hydrates the pending ids, and feeds the merged
 * result into the pure `reconcileQuotes`. These tests mock every dependency so we
 * assert the wiring this file owns — the parallel fetches, the per-account
 * fan-out, the null-filtering, and the exact shape passed into `reconcileQuotes`
 * — without touching the network or coupling to the merge logic (which is a
 * separate unit with its own behavior).
 */
const getInstantOpens = vi.hoisted(() => vi.fn());
const getInstantCloses = vi.hoisted(() => vi.fn());
const resolveQuoteAccounts = vi.hoisted(() => vi.fn());
const getPartyAOpenPositions = vi.hoisted(() => vi.fn());
const getPartyAPendingQuotes = vi.hoisted(() => vi.fn());
const getQuote = vi.hoisted(() => vi.fn());
const reconcileQuotes = vi.hoisted(() => vi.fn());

vi.mock("../../solvers/instant-open/get-instant-opens/get-instant-opens", () => ({ getInstantOpens }));
vi.mock("../../solvers/instant-close/get-instant-closes/get-instant-closes", () => ({ getInstantCloses }));
vi.mock("../resolve-quote-accounts", () => ({ resolveQuoteAccounts }));
vi.mock("../../symmio-contracts/symmio/actions/get-party-a-open-positions", () => ({ getPartyAOpenPositions }));
vi.mock("../../symmio-contracts/symmio/actions/get-party-a-pending-quotes", () => ({ getPartyAPendingQuotes }));
vi.mock("../../symmio-contracts/symmio/actions/get-quote", () => ({ getQuote }));
vi.mock("../reconcile-quotes", () => ({ reconcileQuotes }));

import { getSubAccountQuotes } from "./get-sub-account-quotes";

const CHAIN_ID = SymmioSupportedChainId.HYPER_EVM;
const SUB = "0x00000000000000000000000000000000000000a1" as Address;
const VA1 = "0x00000000000000000000000000000000000000b1" as Address;
const EXTRA = "0x00000000000000000000000000000000000000c1" as Address;
const BASE_URL = "https://custom-hedger.example.com";

/** Stub config — every dependency is mocked, so the client is never used. */
const config = createConfig({ getClient: () => ({}) as PublicClient });

/**
 * Opaque source rows. `reconcileQuotes` is mocked, so these only need stable
 * identities we can assert flow through the orchestrator in the right order; they
 * deliberately do not mirror the full on-chain `Quote` shape.
 */
const INSTANT_OPENS = [{ tag: "open-1", tempQuoteId: -1001 }];
const INSTANT_CLOSES = [{ tag: "close-1" }];
const VA_BY_TEMP = { [-1001]: VA1 };
const POS_SUB = { tag: "pos-sub" };
const POS_VA1_A = { tag: "pos-va1-a" };
const POS_VA1_B = { tag: "pos-va1-b" };
const Q1 = { tag: "quote-1" };
const Q3 = { tag: "quote-3" };
const RECONCILED = [{ tag: "reconciled-row" }];

/** A multi-account scenario: the subaccount plus one VA, each holding rows. */
const positionsByAccount: Record<string, unknown[]> = {
  [SUB]: [POS_SUB],
  [VA1]: [POS_VA1_A, POS_VA1_B],
};
const pendingIdsByAccount: Record<string, bigint[]> = {
  [SUB]: [1n],
  [VA1]: [2n, 3n],
};
/** Quote id `2n` resolves to `null` (no such quote) so we can assert filtering. */
const quoteById: Record<string, unknown> = { "1": Q1, "2": null, "3": Q3 };

describe("getSubAccountQuotes", () => {
  beforeEach(() => {
    getInstantOpens.mockReset().mockResolvedValue(INSTANT_OPENS);
    getInstantCloses.mockReset().mockResolvedValue(INSTANT_CLOSES);
    resolveQuoteAccounts.mockReset().mockResolvedValue({ accounts: [SUB, VA1], instantOpenVaByTempId: VA_BY_TEMP });
    getPartyAOpenPositions
      .mockReset()
      .mockImplementation((_c: unknown, { partyA }: { partyA: Address }) =>
        Promise.resolve(positionsByAccount[partyA] ?? []),
      );
    getPartyAPendingQuotes
      .mockReset()
      .mockImplementation((_c: unknown, { partyA }: { partyA: Address }) =>
        Promise.resolve(pendingIdsByAccount[partyA] ?? []),
      );
    getQuote
      .mockReset()
      .mockImplementation((_c: unknown, { quoteId }: { quoteId: bigint }) =>
        Promise.resolve(quoteById[quoteId.toString()] ?? null),
      );
    reconcileQuotes.mockReset().mockReturnValue({ quotes: RECONCILED, links: {} });
  });

  it("fetches the subaccount's instant opens and closes with the configured chain and base url", async () => {
    await getSubAccountQuotes(config, { chainId: CHAIN_ID, subAccount: SUB, baseUrl: BASE_URL });

    expect(getInstantOpens).toHaveBeenCalledWith(config, { chainId: CHAIN_ID, partyA: SUB, baseUrl: BASE_URL });
    expect(getInstantCloses).toHaveBeenCalledWith(config, { chainId: CHAIN_ID, partyA: SUB, baseUrl: BASE_URL });
  });

  it("fetches instant opens and closes before resolving the account set", async () => {
    await getSubAccountQuotes(config, { chainId: CHAIN_ID, subAccount: SUB });

    const opensOrder = getInstantOpens.mock.invocationCallOrder[0]!;
    const closesOrder = getInstantCloses.mock.invocationCallOrder[0]!;
    const resolveOrder = resolveQuoteAccounts.mock.invocationCallOrder[0]!;
    expect(Math.max(opensOrder, closesOrder)).toBeLessThan(resolveOrder);
  });

  it("resolves the account set from the subaccount, its instant opens, and the inclusion options", async () => {
    await getSubAccountQuotes(config, {
      chainId: CHAIN_ID,
      subAccount: SUB,
      includeVirtualAccounts: false,
      extraAccounts: [EXTRA],
    });

    expect(resolveQuoteAccounts).toHaveBeenCalledWith(config, {
      chainId: CHAIN_ID,
      subAccount: SUB,
      instantOpens: INSTANT_OPENS,
      includeVirtualAccounts: false,
      extraAccounts: [EXTRA],
    });
  });

  it("defaults includeVirtualAccounts to true and extraAccounts to [] when omitted", async () => {
    await getSubAccountQuotes(config, { chainId: CHAIN_ID, subAccount: SUB });

    expect(resolveQuoteAccounts).toHaveBeenCalledWith(
      config,
      expect.objectContaining({ includeVirtualAccounts: true, extraAccounts: [] }),
    );
  });

  it("reads open positions and pending quotes for every resolved account", async () => {
    await getSubAccountQuotes(config, { chainId: CHAIN_ID, subAccount: SUB });

    expect(getPartyAOpenPositions).toHaveBeenCalledTimes(2);
    expect(getPartyAPendingQuotes).toHaveBeenCalledTimes(2);
    for (const account of [SUB, VA1]) {
      expect(getPartyAOpenPositions).toHaveBeenCalledWith(config, { chainId: CHAIN_ID, partyA: account });
      expect(getPartyAPendingQuotes).toHaveBeenCalledWith(config, { chainId: CHAIN_ID, partyA: account });
    }
  });

  it("hydrates every pending quote id across all accounts via getQuote", async () => {
    await getSubAccountQuotes(config, { chainId: CHAIN_ID, subAccount: SUB });

    expect(getQuote).toHaveBeenCalledTimes(3);
    for (const quoteId of [1n, 2n, 3n]) {
      expect(getQuote).toHaveBeenCalledWith(config, { chainId: CHAIN_ID, quoteId });
    }
  });

  it("reconciles the positions and hydrated pending quotes flattened across accounts, dropping null hydrations", async () => {
    await getSubAccountQuotes(config, { chainId: CHAIN_ID, subAccount: SUB });

    expect(reconcileQuotes).toHaveBeenCalledWith({
      partyA: SUB,
      onchainPositions: [POS_SUB, POS_VA1_A, POS_VA1_B],
      onchainPendingQuotes: [Q1, Q3],
      instantOpens: INSTANT_OPENS,
      instantCloses: INSTANT_CLOSES,
      instantOpenVaByTempId: VA_BY_TEMP,
    });
  });

  it("returns reconcileQuotes' quotes alongside the resolved accounts", async () => {
    const result = await getSubAccountQuotes(config, { chainId: CHAIN_ID, subAccount: SUB });

    expect(result).toEqual({ quotes: RECONCILED, accounts: [SUB, VA1] });
  });

  it("resolves the account set before fanning out the per-account reads, and reads before reconciling", async () => {
    await getSubAccountQuotes(config, { chainId: CHAIN_ID, subAccount: SUB });

    const resolveOrder = resolveQuoteAccounts.mock.invocationCallOrder[0]!;
    const firstReadOrder = getPartyAOpenPositions.mock.invocationCallOrder[0]!;
    const reconcileOrder = reconcileQuotes.mock.invocationCallOrder[0]!;
    expect(resolveOrder).toBeLessThan(firstReadOrder);
    expect(firstReadOrder).toBeLessThan(reconcileOrder);
  });

  it("handles an account with no positions and no pending quotes", async () => {
    resolveQuoteAccounts.mockResolvedValue({ accounts: [SUB], instantOpenVaByTempId: {} });
    getPartyAOpenPositions.mockResolvedValue([]);
    getPartyAPendingQuotes.mockResolvedValue([]);
    getInstantOpens.mockResolvedValue([]);
    getInstantCloses.mockResolvedValue([]);

    const result = await getSubAccountQuotes(config, { chainId: CHAIN_ID, subAccount: SUB });

    expect(getQuote).not.toHaveBeenCalled();
    expect(reconcileQuotes).toHaveBeenCalledWith({
      partyA: SUB,
      onchainPositions: [],
      onchainPendingQuotes: [],
      instantOpens: [],
      instantCloses: [],
      instantOpenVaByTempId: {},
    });
    expect(result).toEqual({ quotes: RECONCILED, accounts: [SUB] });
  });

  it("forwards chainId and baseUrl through to the instant reads when both are omitted", async () => {
    await getSubAccountQuotes(config, { subAccount: SUB });

    expect(getInstantOpens).toHaveBeenCalledWith(config, { chainId: undefined, partyA: SUB, baseUrl: undefined });
    expect(getInstantCloses).toHaveBeenCalledWith(config, { chainId: undefined, partyA: SUB, baseUrl: undefined });
    expect(resolveQuoteAccounts).toHaveBeenCalledWith(config, expect.objectContaining({ chainId: undefined }));
  });

  it("rejects when the instant-open read fails", async () => {
    getInstantOpens.mockRejectedValue(new Error("hedger down"));

    await expect(getSubAccountQuotes(config, { chainId: CHAIN_ID, subAccount: SUB })).rejects.toThrow("hedger down");
    expect(reconcileQuotes).not.toHaveBeenCalled();
  });

  it("rejects when a per-account on-chain read fails", async () => {
    getPartyAOpenPositions.mockRejectedValue(new Error("rpc error"));

    await expect(getSubAccountQuotes(config, { chainId: CHAIN_ID, subAccount: SUB })).rejects.toThrow("rpc error");
    expect(reconcileQuotes).not.toHaveBeenCalled();
  });

  it("rejects when account resolution fails", async () => {
    resolveQuoteAccounts.mockRejectedValue(new Error("unsupported chain"));

    await expect(getSubAccountQuotes(config, { chainId: CHAIN_ID, subAccount: SUB })).rejects.toThrow(
      "unsupported chain",
    );
    expect(getPartyAOpenPositions).not.toHaveBeenCalled();
    expect(reconcileQuotes).not.toHaveBeenCalled();
  });

  it("rejects when a pending-quote hydration fails", async () => {
    getQuote.mockRejectedValue(new Error("quote read failed"));

    await expect(getSubAccountQuotes(config, { chainId: CHAIN_ID, subAccount: SUB })).rejects.toThrow(
      "quote read failed",
    );
    expect(reconcileQuotes).not.toHaveBeenCalled();
  });

  it("drops an account's pending quotes when every hydration resolves to null", async () => {
    getQuote.mockResolvedValue(null);

    await getSubAccountQuotes(config, { chainId: CHAIN_ID, subAccount: SUB });

    /** Non-empty input filtered down to empty — distinct from the never-hydrated case. */
    expect(getQuote).toHaveBeenCalledTimes(3);
    expect(reconcileQuotes).toHaveBeenCalledWith(expect.objectContaining({ onchainPendingQuotes: [] }));
  });

  it("preserves account order in the merged reads even when a later account resolves first", async () => {
    /**
     * Force the first account (SUB) to settle AFTER the second (VA1) so this proves
     * the account-indexed flatMap — not resolution timing — fixes the order.
     * `Promise.all` preserves input order regardless of when each promise settles,
     * so the merged list must stay [SUB rows…, VA1 rows…].
     */
    getPartyAOpenPositions.mockImplementation((_c: unknown, { partyA }: { partyA: Address }) => {
      const value = positionsByAccount[partyA] ?? [];
      return partyA === SUB ? new Promise((resolve) => setTimeout(() => resolve(value), 5)) : Promise.resolve(value);
    });

    await getSubAccountQuotes(config, { chainId: CHAIN_ID, subAccount: SUB });

    expect(reconcileQuotes).toHaveBeenCalledWith(
      expect.objectContaining({ onchainPositions: [POS_SUB, POS_VA1_A, POS_VA1_B] }),
    );
  });
});
