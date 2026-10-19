import { BaseError, ContractFunctionExecutionError, type Address } from "viem";
import { describe, expect, it, type Mock } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../../core/chains";
import { SymmError } from "../../../shared/errors/symm-error";
import { mockConfig } from "../../../shared/test/mock-config";
import { getPartyAOpenPositionsBatch } from "./get-party-a-open-positions-batch";

const DEFAULT = getChainConfig(SymmioSupportedChainId.ARBITRUM);

const VA_1: Address = "0x00000000000000000000000000000000000000a1";
const VA_2: Address = "0x00000000000000000000000000000000000000a2";
const VA_3: Address = "0x00000000000000000000000000000000000000a3";
const MIXED_CASE_VA: Address = "0x00000000000000000000000000000000000000Bc";

interface Call {
  functionName: string;
  args: readonly unknown[];
}

type CallResult = { status: "success"; result: unknown } | { status: "failure"; error: Error };

/** Answer every multicall sub-call through `handler`. */
function respond(multicall: Mock, handler: (call: Call) => CallResult) {
  multicall.mockImplementation(async ({ contracts }: { contracts: Call[] }) => contracts.map(handler));
}

function quotes(...ids: bigint[]) {
  return ids.map((id) => ({ id }));
}

describe("getPartyAOpenPositionsBatch", () => {
  it("reads nothing for an empty account list", async () => {
    const { config, multicall } = mockConfig();

    await expect(getPartyAOpenPositionsBatch(config, { partyAs: [] })).resolves.toEqual([]);
    expect(multicall).not.toHaveBeenCalled();
  });

  it("reads every account in one multicall with default pagination", async () => {
    const { config, multicall } = mockConfig();
    respond(multicall, (call) => ({
      status: "success",
      result: call.args[0] === VA_1 ? quotes(1n, 2n) : quotes(),
    }));

    const results = await getPartyAOpenPositionsBatch(config, { partyAs: [VA_1, VA_2] });

    expect(multicall).toHaveBeenCalledTimes(1);
    expect(multicall).toHaveBeenCalledWith({
      allowFailure: true,
      contracts: [
        expect.objectContaining({
          address: DEFAULT.addresses.symmioAddress,
          functionName: "getPartyAOpenPositions",
          args: [VA_1, 0n, 200n],
        }),
        expect.objectContaining({ functionName: "getPartyAOpenPositions", args: [VA_2, 0n, 200n] }),
      ],
    });
    expect(results).toEqual([
      { partyA: VA_1, start: 0n, status: "success", quotes: quotes(1n, 2n), hasMore: false },
      { partyA: VA_2, start: 0n, status: "success", quotes: [], hasMore: false },
    ]);
    expect(results[0]).not.toHaveProperty("isLiquidated");
  });

  it("forwards each account's own start and the shared size", async () => {
    const { config, multicall } = mockConfig();
    respond(multicall, () => ({ status: "success", result: quotes(7n) }));

    const results = await getPartyAOpenPositionsBatch(config, {
      partyAs: [VA_1, { partyA: VA_2, start: 50n }, { partyA: VA_3 }],
      size: 50n,
    });

    expect(multicall.mock.calls[0]![0].contracts.map((call: Call) => call.args)).toEqual([
      [VA_1, 0n, 50n],
      [VA_2, 50n, 50n],
      [VA_3, 0n, 50n],
    ]);
    expect(results.map((result) => result.start)).toEqual([0n, 50n, 0n]);
  });

  it("flags a full page with hasMore", async () => {
    const { config, multicall } = mockConfig();
    respond(multicall, () => ({ status: "success", result: quotes(1n, 2n) }));

    const [result] = await getPartyAOpenPositionsBatch(config, { partyAs: [VA_1], size: 2n });

    expect(result).toMatchObject({ status: "success", hasMore: true });
  });

  it("isolates a reverted account from the rest", async () => {
    const { config, multicall } = mockConfig();
    const revert = new Error("execution reverted");
    respond(multicall, (call) =>
      call.args[0] === VA_2 ? { status: "failure", error: revert } : { status: "success", result: quotes(1n) },
    );

    const results = await getPartyAOpenPositionsBatch(config, { partyAs: [VA_1, VA_2, VA_3] });

    expect(results).toEqual([
      expect.objectContaining({ partyA: VA_1, status: "success" }),
      { partyA: VA_2, start: 0n, status: "failure", error: revert },
      expect.objectContaining({ partyA: VA_3, status: "success" }),
    ]);
  });

  it("reads the liquidation flag in the same multicall", async () => {
    const { config, multicall } = mockConfig();
    respond(multicall, (call) => {
      if (call.functionName === "getPartyAOpenPositions") return { status: "success", result: quotes(1n) };
      if (call.args[0] === VA_3) return { status: "failure", error: new Error("execution reverted") };
      return { status: "success", result: call.args[0] === VA_2 };
    });

    const results = await getPartyAOpenPositionsBatch(config, {
      partyAs: [VA_1, VA_2, VA_3],
      includeLiquidationStatus: true,
    });

    expect(multicall).toHaveBeenCalledTimes(1);
    expect(multicall.mock.calls[0]![0].contracts.map((call: Call) => call.functionName)).toEqual([
      "getPartyAOpenPositions",
      "isPartyALiquidated",
      "getPartyAOpenPositions",
      "isPartyALiquidated",
      "getPartyAOpenPositions",
      "isPartyALiquidated",
    ]);
    expect(results.map((result) => (result.status === "success" ? result.isLiquidated : "failed"))).toEqual([
      false,
      true,
      undefined,
    ]);
  });

  it("splits accounts into multicalls of batchSize and keeps input order", async () => {
    const { config, multicall } = mockConfig();
    respond(multicall, (call) => ({ status: "success", result: quotes(BigInt(call.args[0] as string)) }));
    const partyAs = Array.from(
      { length: 25 },
      (_, index) => `0x${(index + 1).toString(16).padStart(40, "0")}` as Address,
    );

    const results = await getPartyAOpenPositionsBatch(config, { partyAs, batchSize: 10 });

    expect(multicall.mock.calls.map(([{ contracts }]) => contracts.length)).toEqual([10, 10, 5]);
    expect(results.map((result) => result.partyA)).toEqual(partyAs);
    expect(results.map((result) => (result.status === "success" ? result.quotes[0]!.id : 0n))).toEqual(
      partyAs.map((partyA) => BigInt(partyA)),
    );
  });

  it("reads a repeated account once and echoes each input's own casing", async () => {
    const { config, multicall } = mockConfig();
    respond(multicall, () => ({ status: "success", result: quotes(1n) }));

    const results = await getPartyAOpenPositionsBatch(config, {
      partyAs: [MIXED_CASE_VA, MIXED_CASE_VA.toLowerCase() as Address],
    });

    expect(multicall.mock.calls[0]![0].contracts).toHaveLength(1);
    expect(results.map((result) => result.partyA)).toEqual([MIXED_CASE_VA, MIXED_CASE_VA.toLowerCase()]);
  });

  it("rejects when the aggregate3 call fails rather than failing every account", async () => {
    const { config, multicall } = mockConfig();
    // What viem's multicall returns with `allowFailure` when the RPC request fails.
    const transportError = new ContractFunctionExecutionError(new BaseError("HTTP request failed"), {
      abi: [],
      functionName: "aggregate3",
    });
    multicall.mockResolvedValueOnce([
      { status: "failure", error: transportError },
      { status: "failure", error: transportError },
    ]);

    await expect(getPartyAOpenPositionsBatch(config, { partyAs: [VA_1, VA_2] })).rejects.toBe(transportError);
  });

  it("rejects when the multicall transport fails", async () => {
    const { config, multicall } = mockConfig();
    multicall.mockRejectedValueOnce(new Error("HTTP request failed"));

    await expect(getPartyAOpenPositionsBatch(config, { partyAs: [VA_1] })).rejects.toThrow("HTTP request failed");
  });

  it.each([0, -1, 1.5])("throws INVALID_BATCH_SIZE for batchSize %s", async (batchSize) => {
    const { config, multicall } = mockConfig();

    await expect(getPartyAOpenPositionsBatch(config, { partyAs: [VA_1], batchSize })).rejects.toMatchObject({
      code: "INVALID_BATCH_SIZE",
    });
    await expect(getPartyAOpenPositionsBatch(config, { partyAs: [VA_1], batchSize })).rejects.toThrow(SymmError);
    expect(multicall).not.toHaveBeenCalled();
  });
});
