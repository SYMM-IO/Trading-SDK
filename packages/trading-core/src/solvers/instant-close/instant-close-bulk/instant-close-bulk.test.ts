import { decodeFunctionData } from "viem";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SymmioSupportedChainId } from "../../../core/chains";
import { createConfig } from "../../../core/config";
import { mockConfig, TEST_AFFILIATE_ADDRESS, TEST_TYPED_SIGNATURE } from "../../../shared/test/mock-config";
import { symmioAbi } from "../../../symmio-contracts/abi/v0.8.6/symmio";
import { instantCloseBulk, type InstantCloseBulkOrder } from "./instant-close-bulk";

const { postInstantTradeInstantClose, instantRequestToCloseWithSignatureInstantTradeClosePost } = vi.hoisted(() => ({
  postInstantTradeInstantClose: vi.fn(),
  instantRequestToCloseWithSignatureInstantTradeClosePost: vi.fn(),
}));

vi.mock("../../types/generated/enigma-solver", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../types/generated/enigma-solver")>()),
  postInstantTradeInstantClose,
}));

vi.mock("../../types/generated/rasa-solver", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../types/generated/rasa-solver")>()),
  instantRequestToCloseWithSignatureInstantTradeClosePost,
}));

const ORDERS = [
  {
    partyA: "0x0000000000000000000000000000000000005Ab1",
    order: { quoteId: 42n, closePrice: 50_000_000_000_000_000_000n, quantityToClose: 1_000_000_000_000_000_000n },
    deadline: 1_700_000_300n,
    salt: `0x${"12".repeat(32)}`,
  },
  {
    partyA: "0x2222222222222222222222222222222222222222",
    order: { quoteId: 43n, closePrice: 25_000_000_000_000_000_000n, quantityToClose: 500_000_000_000_000_000n },
    deadline: 1_700_000_400n,
    salt: `0x${"34".repeat(32)}`,
  },
] satisfies InstantCloseBulkOrder[];

describe("instantCloseBulk — signed order type", () => {
  beforeEach(() => {
    postInstantTradeInstantClose.mockResolvedValue({ data: undefined });
    instantRequestToCloseWithSignatureInstantTradeClosePost.mockResolvedValue({ data: { successful: true } });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    { solver: "enigma", chainId: undefined, expected: 2 },
    { solver: "rasa", chainId: SymmioSupportedChainId.BASE, expected: 1 },
  ] as const)("encodes $expected for every $solver close", async ({ solver, chainId, expected }) => {
    const { config, signTypedData } = mockConfig();

    const result = await instantCloseBulk(config, { orders: ORDERS, chainId });

    const [body, options] = (
      solver === "enigma" ? postInstantTradeInstantClose : instantRequestToCloseWithSignatureInstantTradeClosePost
    ).mock.calls[0]!;
    const operations = solver === "enigma" ? body.operations : body;

    expect(operations).toHaveLength(ORDERS.length);
    expect(signTypedData).toHaveBeenCalledTimes(ORDERS.length);
    for (const [index, entry] of ORDERS.entries()) {
      const operation = operations[index];
      expect(decodeFunctionData({ abi: symmioAbi, data: operation.signedOperation.callData })).toEqual({
        functionName: "requestToClosePosition",
        args: [entry.order.quoteId, entry.order.closePrice, entry.order.quantityToClose, expected, entry.deadline],
      });
      expect(signTypedData.mock.calls[index]![0].message.callData).toBe(operation.signedOperation.callData);
      expect(operation.signature).toBe(TEST_TYPED_SIGNATURE);
      expect(operation.signedOperation.target).toBe(config.getChainConfig(chainId).addresses.symmioAddress);
      expect(operation.signedOperation.signerAccount).toEqual({ addr: entry.partyA, isPartyB: false });
      expect(operation.signedOperation.replayAttackHeader).toEqual({
        nonce: 0,
        deadline: Number(entry.deadline),
        salt: entry.salt,
      });
      expect(operation.signedOperation.flexFields).toEqual([]);
      expect(operation.signedOperation.maxUses).toBe(1);
    }
    expect(options.baseURL).toBe(config.getSolver({ chainId }).url);
    expect(
      solver === "enigma" ? instantRequestToCloseWithSignatureInstantTradeClosePost : postInstantTradeInstantClose,
    ).not.toHaveBeenCalled();
    expect(result).toEqual({ count: ORDERS.length, success: true });
  });

  it.each(["enigma", "rasa"] as const)("honors an explicit %s override for the entire batch", async (solverId) => {
    const { config: original, signTypedData } = mockConfig();
    const config = createConfig({
      getClient: original.getClient,
      getWalletClient: original.getWalletClient,
      symmioConfig: {
        [SymmioSupportedChainId.ARBITRUM]: {
          addresses: { affiliatesAddress: TEST_AFFILIATE_ADDRESS },
          defaultSolverId: solverId === "enigma" ? "rasa" : "enigma",
          solvers: { rasa: original.getSolver({ chainId: SymmioSupportedChainId.BASE }) },
        },
      },
    });

    await instantCloseBulk(config, { orders: ORDERS, solverId });

    const [body, options] = (
      solverId === "enigma" ? postInstantTradeInstantClose : instantRequestToCloseWithSignatureInstantTradeClosePost
    ).mock.calls[0]!;
    const operations = solverId === "enigma" ? body.operations : body;

    expect(operations).toHaveLength(ORDERS.length);
    for (const [index] of ORDERS.entries()) {
      const callData = operations[index].signedOperation.callData;
      expect(decodeFunctionData({ abi: symmioAbi, data: callData }).args[3]).toBe(solverId === "enigma" ? 2 : 1);
      expect(signTypedData.mock.calls[index]![0].message.callData).toBe(callData);
    }
    expect(options.baseURL).toBe(config.getSolver({ solverId }).url);
    expect(
      solverId === "enigma" ? instantRequestToCloseWithSignatureInstantTradeClosePost : postInstantTradeInstantClose,
    ).not.toHaveBeenCalled();
  });
});
