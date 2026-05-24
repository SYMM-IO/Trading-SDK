import type { Account, Address, Chain, Hash, Transport, WalletClient } from "viem";
import { hyperEvm } from "viem/chains";
import { describe, expect, it, vi } from "vitest";
import { accountLayerAbi } from "../../../abi/v0.8.5/account-layer";
import { getChainConfig } from "../../../chains";
import { SymmError } from "../../../errors";
import { editAccountName } from "./edit-account-name";

const HYPEREVM_ID = hyperEvm.id;
const HYPEREVM_ACCOUNT_LAYER = getChainConfig(HYPEREVM_ID, "production").addresses.accountLayerAddress;
const SUB_ACCOUNT: Address = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const OWNER_EOA: Address = "0x1111111111111111111111111111111111111111";
const OVERRIDE_ADDRESS: Address = "0x9999999999999999999999999999999999999999";
const TX_HASH: Hash = "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef";

function mockWalletClient(chainId: number) {
  const writeContract = vi.fn().mockResolvedValue(TX_HASH);
  const account = { address: OWNER_EOA, type: "json-rpc" } as Account;
  return {
    client: {
      chain: { id: chainId } as Chain,
      account,
      writeContract,
    } as unknown as WalletClient<Transport, Chain, Account>,
    writeContract,
  };
}

describe("editAccountName", () => {
  it("calls writeContract with the registered AccountLayer address and proxies the hash", async () => {
    const { client, writeContract } = mockWalletClient(HYPEREVM_ID);

    const hash = await editAccountName(client, {
      account: SUB_ACCOUNT,
      name: "Main",
    });

    expect(hash).toBe(TX_HASH);
    expect(writeContract).toHaveBeenCalledTimes(1);
    expect(writeContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: HYPEREVM_ACCOUNT_LAYER,
        abi: accountLayerAbi,
        functionName: "editAccountName",
        args: [SUB_ACCOUNT, "Main"],
      }),
    );
  });

  it("prefers an explicit accountLayerAddress over the chain registry", async () => {
    const { client, writeContract } = mockWalletClient(HYPEREVM_ID);

    await editAccountName(client, {
      account: SUB_ACCOUNT,
      name: "Override",
      accountLayerAddress: OVERRIDE_ADDRESS,
    });

    expect(writeContract).toHaveBeenCalledWith(expect.objectContaining({ address: OVERRIDE_ADDRESS }));
  });

  it("throws SymmError when the chain is not in the built-in registry and no override is given", async () => {
    const { client } = mockWalletClient(123456789);

    await expect(editAccountName(client, { account: SUB_ACCOUNT, name: "Anything" })).rejects.toBeInstanceOf(SymmError);
  });

  it("delegates to viem's writeContract — chain and signer are read from the client by viem", async () => {
    const { client, writeContract } = mockWalletClient(HYPEREVM_ID);

    await editAccountName(client, { account: SUB_ACCOUNT, name: "Main" });

    // We do not duplicate `chain` / `account` into the call; viem pulls them
    // from `client.chain` / `client.account` on its own. Asserting only the
    // domain-shaped fields keeps this test resilient to viem internals.
    const [callArgs] = writeContract.mock.calls[0] ?? [];
    expect(callArgs).toMatchObject({
      address: HYPEREVM_ACCOUNT_LAYER,
      functionName: "editAccountName",
      args: [SUB_ACCOUNT, "Main"],
    });
  });
});
