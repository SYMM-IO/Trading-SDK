import type { Address } from "viem";
import { describe, expect, it } from "vitest";
import { SymmioSupportedChainId } from "../core/chains";
import { programDelegationReads, readFunctionNames } from "../shared/test/delegation-reads";
import { mockConfig } from "../shared/test/mock-config";
import { getCachedDelegatorAccount } from "./delegation-preflight";

const SUB_ACCOUNT: Address = "0x0000000000000000000000000000000000005ab1";
const VIRTUAL_ACCOUNT: Address = "0x00000000000000000000000000000000000000aa";
const CHAIN_ID = SymmioSupportedChainId.ARBITRUM;

describe("getCachedDelegatorAccount", () => {
  it("resolves a live virtual account to its parent sub-account", async () => {
    const { config, readContract } = mockConfig();
    programDelegationReads(readContract, { parents: { [VIRTUAL_ACCOUNT]: SUB_ACCOUNT } });

    await expect(getCachedDelegatorAccount(config, CHAIN_ID, VIRTUAL_ACCOUNT)).resolves.toBe(SUB_ACCOUNT);
  });

  it("keeps any other account as itself", async () => {
    const { config, readContract } = mockConfig();
    programDelegationReads(readContract);

    await expect(getCachedDelegatorAccount(config, CHAIN_ID, SUB_ACCOUNT)).resolves.toBe(SUB_ACCOUNT);
  });

  it("keeps a deleted virtual account as itself, as the InstantLayer does", async () => {
    const { config, readContract } = mockConfig();
    readContract.mockResolvedValue({
      accountAddress: VIRTUAL_ACCOUNT,
      parentAccount: SUB_ACCOUNT,
      isExists: false,
    });

    await expect(getCachedDelegatorAccount(config, CHAIN_ID, VIRTUAL_ACCOUNT)).resolves.toBe(VIRTUAL_ACCOUNT);
  });

  it("reads each account once per config, sharing an in-flight read", async () => {
    const { config, readContract } = mockConfig();
    programDelegationReads(readContract, { parents: { [VIRTUAL_ACCOUNT]: SUB_ACCOUNT } });

    await Promise.all([
      getCachedDelegatorAccount(config, CHAIN_ID, VIRTUAL_ACCOUNT),
      getCachedDelegatorAccount(config, CHAIN_ID, VIRTUAL_ACCOUNT.toUpperCase().replace("0X", "0x") as Address),
    ]);
    await getCachedDelegatorAccount(config, CHAIN_ID, VIRTUAL_ACCOUNT);

    expect(readFunctionNames(readContract)).toEqual(["getVirtualAccount"]);

    /** A second config starts its own cache. */
    const second = mockConfig();
    programDelegationReads(second.readContract, { parents: { [VIRTUAL_ACCOUNT]: SUB_ACCOUNT } });
    await getCachedDelegatorAccount(second.config, CHAIN_ID, VIRTUAL_ACCOUNT);
    expect(second.readContract).toHaveBeenCalledOnce();
  });

  it("drops a failed read so the next call reads again", async () => {
    const { config, readContract } = mockConfig();
    readContract.mockRejectedValueOnce(new Error("RPC unavailable"));
    programDelegationReads(readContract, { parents: { [VIRTUAL_ACCOUNT]: SUB_ACCOUNT } });

    await expect(getCachedDelegatorAccount(config, CHAIN_ID, VIRTUAL_ACCOUNT)).rejects.toThrowError("RPC unavailable");
    await expect(getCachedDelegatorAccount(config, CHAIN_ID, VIRTUAL_ACCOUNT)).resolves.toBe(SUB_ACCOUNT);
    expect(readContract).toHaveBeenCalledTimes(2);
  });
});
