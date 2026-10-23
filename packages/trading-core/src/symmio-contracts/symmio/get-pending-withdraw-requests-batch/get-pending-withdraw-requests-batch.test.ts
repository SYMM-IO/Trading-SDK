import { describe, expect, it } from "vitest";
import { mockConfig } from "../../../shared/test/mock-config";
import { getPendingWithdrawRequestsBatch } from "./get-pending-withdraw-requests-batch";
import { getPendingWithdrawRequestsBatchQueryKey, getPendingWithdrawRequestsBatchQueryOptions } from "./query";
const A = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const B = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const UPPER_A = "0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
describe("complete pending-withdrawal batches", () => {
  it("scans sparse pages through the last ID for each deduplicated user", async () => {
    const { config, readContract } = mockConfig();
    readContract.mockImplementation(async ({ functionName, args }) => {
      if (functionName === "getLastWithdrawRequestId") return args[0] === A ? 401n : 0n;
      return args[1] === 401n ? [{ id: 401n }] : [];
    });
    const result = await getPendingWithdrawRequestsBatch(config, { users: [B, UPPER_A, A] });
    expect(result).toEqual([
      { user: A, requests: [{ id: 401n }] },
      { user: B, requests: [] },
    ]);
    expect(readContract).toHaveBeenCalledTimes(5);
    expect(readContract).toHaveBeenCalledWith(expect.objectContaining({ args: [A, 201n, 200n] }));
    expect(readContract).toHaveBeenCalledWith(expect.objectContaining({ args: [A, 401n, 1n] }));
  });
  it("rejects an invalid user before reading the chain", async () => {
    const { config, readContract } = mockConfig();
    await expect(getPendingWithdrawRequestsBatch(config, { users: ["0x1234"] })).rejects.toMatchObject({
      code: "INVALID_WITHDRAW_USER",
    });
    expect(readContract).not.toHaveBeenCalled();
  });
  it("does not read for an empty scope", async () => {
    const { config, readContract } = mockConfig();
    await expect(getPendingWithdrawRequestsBatch(config, { users: [] })).resolves.toEqual([]);
    expect(readContract).not.toHaveBeenCalled();
  });
  it("rejects a failed page instead of publishing a partial list", async () => {
    const { config, readContract } = mockConfig();
    readContract.mockImplementation(async ({ functionName, args }) => {
      if (functionName === "getLastWithdrawRequestId") return 201n;
      if (args[1] === 201n) throw new Error("RPC unavailable");
      return [{ id: 1n }];
    });
    await expect(getPendingWithdrawRequestsBatch(config, { users: [A] })).rejects.toThrow("RPC unavailable");
  });
  it.each([0n, -1n, 201n])("rejects page size %s", async (pageSize) => {
    const { config, readContract } = mockConfig();
    await expect(getPendingWithdrawRequestsBatch(config, { users: [A], pageSize })).rejects.toMatchObject({
      code: "INVALID_WITHDRAW_PAGE_SIZE",
    });
    expect(readContract).not.toHaveBeenCalled();
  });
  it("preserves custom page boundaries", async () => {
    const { config, readContract } = mockConfig();
    readContract.mockImplementation(async ({ functionName }) =>
      functionName === "getLastWithdrawRequestId" ? 3n : [],
    );
    await getPendingWithdrawRequestsBatch(config, { users: [A], pageSize: 2n });
    expect(readContract).toHaveBeenCalledWith(expect.objectContaining({ args: [A, 1n, 2n] }));
    expect(readContract).toHaveBeenCalledWith(expect.objectContaining({ args: [A, 3n, 1n] }));
  });
  it("canonicalizes equivalent query scopes and preserves deployment isolation", () => {
    const { config } = mockConfig();
    expect(getPendingWithdrawRequestsBatchQueryKey({ users: [B, A, UPPER_A] })).toEqual(
      getPendingWithdrawRequestsBatchQueryKey({ users: [A, B], pageSize: 200n }),
    );
    const key = getPendingWithdrawRequestsBatchQueryOptions(config, { users: [A] }).queryKey;
    expect(key).toEqual(getPendingWithdrawRequestsBatchQueryKey({ users: [A], configKey: config.getChainConfigKey() }));
    expect(getPendingWithdrawRequestsBatchQueryOptions(config, { users: [] }).enabled).toBe(false);
  });
});
