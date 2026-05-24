import type { Account, Address, Chain, Hash, Transport, WalletClient } from "viem";
import { hyperEvm } from "viem/chains";
import { describe, expect, it, vi } from "vitest";
import { getChainConfig } from "../../chains";
import { accountLayerWriteActions } from "./actions";

const HYPEREVM_ID = hyperEvm.id;
const HYPEREVM_ACCOUNT_LAYER = getChainConfig(HYPEREVM_ID, "production").addresses.accountLayerAddress;
const USER: Address = "0x1111111111111111111111111111111111111111";
const SUB_ACCOUNT: Address = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const TX_HASH: Hash = "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef";

describe("accountLayerWriteActions", () => {
  it("binds the client to write functions; the consumer only passes domain params", async () => {
    const writeContract = vi.fn().mockResolvedValue(TX_HASH);

    const account = { address: USER, type: "json-rpc" } as Account;
    const client = { chain: { id: HYPEREVM_ID } as Chain, account, writeContract } as unknown as WalletClient<
      Transport,
      Chain,
      Account
    >;

    const actions = accountLayerWriteActions(client);
    const hash = await actions.editAccountName({ account: SUB_ACCOUNT, name: "Main" });

    expect(hash).toBe(TX_HASH);
    expect(writeContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: HYPEREVM_ACCOUNT_LAYER,
        functionName: "editAccountName",
        args: [SUB_ACCOUNT, "Main"],
      }),
    );
  });
});
