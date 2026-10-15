import type { Address } from "viem";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockConfig } from "../../../shared/test/mock-config";
import { PositionType } from "../../../symmio-contracts/symmio/types";
import { instantCloseBulk } from "../instant-close-bulk/instant-close-bulk";
import { instantCloseBulkAuto, type InstantCloseBulkAutoOrder } from "./instant-close-bulk-auto";

vi.mock("../instant-close-bulk/instant-close-bulk", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../instant-close-bulk/instant-close-bulk")>()),
  instantCloseBulk: vi.fn().mockResolvedValue({ count: 1, success: true }),
}));

vi.mock("../prepare-instant-close-params/prepare-instant-close-params", () => ({
  prepareInstantCloseParams: vi.fn(async (_config: unknown, intent: InstantCloseBulkAutoOrder) => ({
    partyA: intent.partyA,
    order: { quoteId: intent.quoteId, closePrice: 1n, quantityToClose: 1n },
    salt: intent.salt,
    deadline: intent.deadline,
  })),
}));

const VIRTUAL_ACCOUNT: Address = "0x00000000000000000000000000000000000000aa";
const SESSION_KEY: Address = "0x0000000000000000000000000000000000005e55";

const ORDER: InstantCloseBulkAutoOrder = {
  partyA: VIRTUAL_ACCOUNT,
  market: { id: 1 },
  positionType: PositionType.LONG,
  quoteId: 42n,
  quantityToClose: "1",
  slippage: 1,
};

describe("instantCloseBulkAuto", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it.each([true, false, undefined])(
    "forwards preflightDelegation %s to instantCloseBulk",
    async (preflightDelegation) => {
      const { config } = mockConfig();

      await instantCloseBulkAuto(config, { from: SESSION_KEY, orders: [ORDER], preflightDelegation });

      expect(instantCloseBulk).toHaveBeenCalledWith(
        config,
        expect.objectContaining({ from: SESSION_KEY, preflightDelegation }),
      );
    },
  );
});
