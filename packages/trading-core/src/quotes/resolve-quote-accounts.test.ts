import { getAddress, type Address, type PublicClient } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SymmioSupportedChainId } from "../core/chains";
import { createConfig } from "../core/config";
import type { PendingInstantOpen } from "../solvers/instant-open/get-instant-opens/to-pending-instant-open";
import { VIRTUAL_ACCOUNT_ISOLATION_TYPE } from "../solvers/instant-open/shared/types";
import { OrderType, PositionType } from "../symmio-contracts/symmio/types";
import { resolveQuoteAccounts } from "./resolve-quote-accounts";

/**
 * `resolveQuoteAccounts` orchestrates two account-layer reads
 * (`getVirtualAccountsAddressesOfSubAccount` + `getPredictedNextVirtualAccount`)
 * and assembles a deduped, ordered, checksummed account set plus the
 * tempQuoteId → predicted-VA map. We mock both reads so we can assert the wiring
 * this file owns — the union order, the case-insensitive dedupe, the prediction
 * dedupe by (isolationType, symbolId), and the isolationTypeForSide forwarding —
 * while using the REAL `isolationTypeForSide` and viem's real `getAddress`.
 */
const getVirtualAccountsAddressesOfSubAccount = vi.hoisted(() => vi.fn());
const getPredictedNextVirtualAccount = vi.hoisted(() => vi.fn());
vi.mock("../symmio-contracts/account-layer/actions/get-virtual-accounts-addresses-of-sub-account", () => ({
  getVirtualAccountsAddressesOfSubAccount,
}));
vi.mock("../symmio-contracts/account-layer/actions/predict-next-virtual-account", () => ({
  getPredictedNextVirtualAccount,
}));

const CHAIN_ID = SymmioSupportedChainId.HYPER_EVM;
const SUB = "0x00000000000000000000000000000000000000a1" as Address;
const VA1 = "0x00000000000000000000000000000000000000b1" as Address;
const VA2 = "0x00000000000000000000000000000000000000b2" as Address;
const PREDICTED_1 = "0x00000000000000000000000000000000000000c1" as Address;
const PREDICTED_LONG_5 = "0x00000000000000000000000000000000000000c2" as Address;
const PREDICTED_LONG_9 = "0x00000000000000000000000000000000000000c3" as Address;
const PREDICTED_SHORT_5 = "0x00000000000000000000000000000000000000c4" as Address;
const EXTRA = "0x00000000000000000000000000000000000000d1" as Address;

/** Stub config — both reads are mocked, so the client is never touched. */
const config = createConfig({ getClient: () => ({}) as PublicClient });

/**
 * Build a `PendingInstantOpen` with only the fields `resolveQuoteAccounts`
 * reads (`tempQuoteId`, `marketId`, `positionType`); the rest are filler so the
 * shape type-checks without distracting the assertions.
 */
function makeOpen(overrides: Partial<PendingInstantOpen> = {}): PendingInstantOpen {
  return {
    tempQuoteId: -1,
    marketId: 1,
    positionType: PositionType.LONG,
    orderType: OrderType.LIMIT,
    partyA: SUB,
    requestedOpenPrice: "0",
    quantity: "0",
    cva: "0",
    lf: "0",
    partyAmm: "0",
    partyBmm: "0",
    ...overrides,
  };
}

describe("resolveQuoteAccounts", () => {
  beforeEach(() => {
    getVirtualAccountsAddressesOfSubAccount.mockReset().mockResolvedValue([]);
    getPredictedNextVirtualAccount.mockReset().mockResolvedValue(PREDICTED_1);
  });

  it("always puts the subaccount first in accounts", async () => {
    const { accounts } = await resolveQuoteAccounts(config, { chainId: CHAIN_ID, subAccount: SUB });

    expect(accounts[0]).toBe(getAddress(SUB));
  });

  it("unions existing VAs after the subaccount when includeVirtualAccounts defaults to true", async () => {
    getVirtualAccountsAddressesOfSubAccount.mockResolvedValue([VA1, VA2]);

    const { accounts } = await resolveQuoteAccounts(config, { chainId: CHAIN_ID, subAccount: SUB });

    expect(getVirtualAccountsAddressesOfSubAccount).toHaveBeenCalledWith(config, {
      chainId: CHAIN_ID,
      subAccount: SUB,
    });
    expect(accounts).toEqual([getAddress(SUB), getAddress(VA1), getAddress(VA2)]);
  });

  it("skips the VA read and omits VAs when includeVirtualAccounts is false", async () => {
    getVirtualAccountsAddressesOfSubAccount.mockResolvedValue([VA1]);

    const { accounts } = await resolveQuoteAccounts(config, {
      chainId: CHAIN_ID,
      subAccount: SUB,
      includeVirtualAccounts: false,
    });

    expect(getVirtualAccountsAddressesOfSubAccount).not.toHaveBeenCalled();
    expect(accounts).toEqual([getAddress(SUB)]);
  });

  it("dedupes predictions by (isolationType, symbolId) while still mapping every tempQuoteId", async () => {
    /**
     * The dedupe key is the full `(isolationType, symbolId)` pair, so we vary
     * BOTH dimensions:
     * - two LONG@5 opens share a key → one read, both temp ids map;
     * - a third LONG@9 differs only in market → a second read (pins symbolId in
     *   the key; a source that deduped on isolationType alone would collapse it);
     * - a fourth SHORT@5 differs only in side → a third read (pins isolationType).
     * Four opens, three distinct keys → exactly three reads.
     */
    getPredictedNextVirtualAccount.mockImplementation(
      (_c: unknown, { isolationType, symbolId }: { isolationType: number; symbolId: bigint }) => {
        if (isolationType === VIRTUAL_ACCOUNT_ISOLATION_TYPE.MARKET_SHORT) return Promise.resolve(PREDICTED_SHORT_5);
        return Promise.resolve(symbolId === 9n ? PREDICTED_LONG_9 : PREDICTED_LONG_5);
      },
    );

    const opens = [
      makeOpen({ tempQuoteId: -1001, marketId: 5, positionType: PositionType.LONG }),
      makeOpen({ tempQuoteId: -1002, marketId: 5, positionType: PositionType.LONG }),
      makeOpen({ tempQuoteId: -1003, marketId: 9, positionType: PositionType.LONG }),
      makeOpen({ tempQuoteId: -1004, marketId: 5, positionType: PositionType.SHORT }),
    ];

    const { instantOpenVaByTempId } = await resolveQuoteAccounts(config, {
      chainId: CHAIN_ID,
      subAccount: SUB,
      instantOpens: opens,
    });

    /** Four opens, three distinct (isolationType, symbolId) keys → three reads. */
    expect(getPredictedNextVirtualAccount).toHaveBeenCalledTimes(3);
    expect(instantOpenVaByTempId).toEqual({
      [-1001]: getAddress(PREDICTED_LONG_5),
      [-1002]: getAddress(PREDICTED_LONG_5),
      [-1003]: getAddress(PREDICTED_LONG_9),
      [-1004]: getAddress(PREDICTED_SHORT_5),
    });
  });

  it("forwards isolationTypeForSide and BigInt(marketId) to getPredictedNextVirtualAccount", async () => {
    const opens = [
      makeOpen({ tempQuoteId: -1, marketId: 5, positionType: PositionType.LONG }),
      makeOpen({ tempQuoteId: -2, marketId: 7, positionType: PositionType.SHORT }),
    ];

    await resolveQuoteAccounts(config, { chainId: CHAIN_ID, subAccount: SUB, instantOpens: opens });

    expect(getPredictedNextVirtualAccount).toHaveBeenCalledWith(config, {
      chainId: CHAIN_ID,
      subAccount: SUB,
      isolationType: VIRTUAL_ACCOUNT_ISOLATION_TYPE.MARKET_LONG,
      symbolId: 5n,
    });
    expect(getPredictedNextVirtualAccount).toHaveBeenCalledWith(config, {
      chainId: CHAIN_ID,
      subAccount: SUB,
      isolationType: VIRTUAL_ACCOUNT_ISOLATION_TYPE.MARKET_SHORT,
      symbolId: 7n,
    });
  });

  it("maps every tempQuoteId to the checksummed predicted VA address", async () => {
    /** Feed a lowercased predicted address and assert the map value is checksummed. */
    getPredictedNextVirtualAccount.mockResolvedValue(PREDICTED_1.toLowerCase());

    const { instantOpenVaByTempId } = await resolveQuoteAccounts(config, {
      chainId: CHAIN_ID,
      subAccount: SUB,
      instantOpens: [makeOpen({ tempQuoteId: -42 })],
    });

    expect(instantOpenVaByTempId[-42]).toBe(getAddress(PREDICTED_1));
  });

  it("unions extraAccounts last, after subaccount, VAs, and predicted VAs", async () => {
    getVirtualAccountsAddressesOfSubAccount.mockResolvedValue([VA1]);
    getPredictedNextVirtualAccount.mockResolvedValue(PREDICTED_1);

    const { accounts } = await resolveQuoteAccounts(config, {
      chainId: CHAIN_ID,
      subAccount: SUB,
      instantOpens: [makeOpen({ tempQuoteId: -1 })],
      extraAccounts: [EXTRA],
    });

    expect(accounts).toEqual([getAddress(SUB), getAddress(VA1), getAddress(PREDICTED_1), getAddress(EXTRA)]);
  });

  it("dedupes case-insensitively, returns checksummed addresses, and preserves union order", async () => {
    /**
     * The extra is a lowercased duplicate of an existing VA — it must collapse
     * into the single checksummed VA entry and not reappear at the tail.
     */
    getVirtualAccountsAddressesOfSubAccount.mockResolvedValue([VA1]);

    const { accounts } = await resolveQuoteAccounts(config, {
      chainId: CHAIN_ID,
      subAccount: SUB,
      extraAccounts: [VA1.toLowerCase() as Address],
    });

    expect(accounts).toEqual([getAddress(SUB), getAddress(VA1)]);
  });

  it("forwards chainId to both account-layer reads", async () => {
    getVirtualAccountsAddressesOfSubAccount.mockResolvedValue([]);

    await resolveQuoteAccounts(config, {
      chainId: CHAIN_ID,
      subAccount: SUB,
      instantOpens: [makeOpen({ tempQuoteId: -1 })],
    });

    expect(getVirtualAccountsAddressesOfSubAccount).toHaveBeenCalledWith(
      config,
      expect.objectContaining({ chainId: CHAIN_ID }),
    );
    expect(getPredictedNextVirtualAccount).toHaveBeenCalledWith(config, expect.objectContaining({ chainId: CHAIN_ID }));
  });

  it("propagates a rejected dependency read", async () => {
    getVirtualAccountsAddressesOfSubAccount.mockRejectedValue(new Error("unsupported chain"));

    await expect(resolveQuoteAccounts(config, { chainId: CHAIN_ID, subAccount: SUB })).rejects.toThrow(
      "unsupported chain",
    );
  });
});
