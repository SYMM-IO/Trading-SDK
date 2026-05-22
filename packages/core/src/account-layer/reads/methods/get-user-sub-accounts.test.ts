import type { Address, PublicClient } from "viem";
import { hyperEvm } from "viem/chains";
import { describe, expect, it, vi } from "vitest";
import { accountLayerAbi } from "../../../abi/v0.8.5/account-layer";
import { getAccountLayerAddress } from "../../../chains/account-layer-addresses";
import { SymmError } from "../../../errors";
import { SubAccountIsolationType } from "../../types";
import { getUserSubAccounts, type SubAccountDetail } from "./get-user-sub-accounts";

const HYPEREVM_ID = hyperEvm.id;
const HYPEREVM_ACCOUNT_LAYER = getAccountLayerAddress(HYPEREVM_ID);
const USER: Address = "0x1111111111111111111111111111111111111111";
const OVERRIDE_ADDRESS: Address = "0x9999999999999999999999999999999999999999";

const SAMPLE: SubAccountDetail = {
  owner: USER,
  name: "First",
  metadata: "0x",
  isExists: true,
  singleVAMode: false,
  isolationType: SubAccountIsolationType.POSITION,
  affiliate: "0x0000000000000000000000000000000000000000",
  symmioCore: "0x57331038c21982116EE9b0906E4a5c5cB52dcE2e",
  accountAddress: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
};

function mockPublicClient(readResult: readonly SubAccountDetail[], chainId?: number) {
  const readContract = vi.fn().mockResolvedValue(readResult);

  return {
    client: { chain: chainId === undefined ? undefined : { id: chainId }, readContract } as unknown as PublicClient,
    readContract,
  };
}

describe("getUserSubAccounts", () => {
  it("calls readContract with the registered AccountLayer address for the client's chain", async () => {
    const { client, readContract } = mockPublicClient([SAMPLE], HYPEREVM_ID);

    const result = await getUserSubAccounts(client, { user: USER });

    expect(result).toEqual([SAMPLE]);
    expect(readContract).toHaveBeenCalledTimes(1);
    expect(readContract).toHaveBeenCalledWith({
      address: HYPEREVM_ACCOUNT_LAYER,
      abi: accountLayerAbi,
      functionName: "getUserSubAccounts",
      args: [USER, 0n, 200n],
    });
  });

  it("uses provided offset/limit overrides", async () => {
    const { client, readContract } = mockPublicClient([], HYPEREVM_ID);

    await getUserSubAccounts(client, { user: USER, offset: 10n, limit: 25n });

    expect(readContract).toHaveBeenCalledWith(expect.objectContaining({ args: [USER, 10n, 25n] }));
  });

  it("prefers an explicit accountLayerAddress over the chain registry", async () => {
    const { client, readContract } = mockPublicClient([], HYPEREVM_ID);

    await getUserSubAccounts(client, { user: USER, accountLayerAddress: OVERRIDE_ADDRESS });

    expect(readContract).toHaveBeenCalledWith(expect.objectContaining({ address: OVERRIDE_ADDRESS }));
  });

  it("falls back to the override when the client has no chain bound", async () => {
    const { client, readContract } = mockPublicClient([]);

    await getUserSubAccounts(client, { user: USER, accountLayerAddress: OVERRIDE_ADDRESS });

    expect(readContract).toHaveBeenCalledWith(expect.objectContaining({ address: OVERRIDE_ADDRESS }));
  });

  it("throws SymmError when neither chain nor override is provided", async () => {
    const { client } = mockPublicClient([]);

    await expect(getUserSubAccounts(client, { user: USER })).rejects.toBeInstanceOf(SymmError);
  });

  it("throws SymmError when the chain is not in the built-in registry and no override is given", async () => {
    const { client } = mockPublicClient([], 123456789);

    await expect(getUserSubAccounts(client, { user: USER })).rejects.toBeInstanceOf(SymmError);
  });
});
