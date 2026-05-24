import type { Address, PublicClient } from "viem";
import { hyperEvm } from "viem/chains";
import { describe, expect, it, vi } from "vitest";
import { getChainConfig } from "../../chains";
import { accountLayerReadActions } from "./actions";
import type { SubAccountDetail } from "./methods/get-user-sub-accounts";

const HYPEREVM_ID = hyperEvm.id;
const HYPEREVM_ACCOUNT_LAYER = getChainConfig(HYPEREVM_ID, "production").addresses.accountLayerAddress;
const USER: Address = "0x1111111111111111111111111111111111111111";

const SAMPLE_LIST: readonly SubAccountDetail[] = [];

describe("accountLayerReadActions", () => {
  it("binds the client to read functions; the consumer only passes domain params", async () => {
    const readContract = vi.fn().mockResolvedValue(SAMPLE_LIST);

    const client = { chain: { id: HYPEREVM_ID }, readContract } as unknown as PublicClient;

    const actions = accountLayerReadActions(client);
    const result = await actions.getUserSubAccounts({ user: USER });

    expect(result).toBe(SAMPLE_LIST);
    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: HYPEREVM_ACCOUNT_LAYER,
        functionName: "getUserSubAccounts",
        args: [USER, 0n, 200n],
      }),
    );
  });
});
