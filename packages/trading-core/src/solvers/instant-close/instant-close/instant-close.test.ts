import { decodeFunctionData } from "viem";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SymmioSupportedChainId } from "../../../core/chains";
import { createConfig } from "../../../core/config";
import { mockConfig, TEST_AFFILIATE_ADDRESS, TEST_TYPED_SIGNATURE } from "../../../shared/test/mock-config";
import { symmioAbi } from "../../../symmio-contracts/abi/v0.8.6/symmio";
import { ORDER_TYPE_LIMIT, ORDER_TYPE_MARKET } from "../shared/types";
import { instantClose, type InstantCloseParameters } from "./instant-close";

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

const PARAMETERS = {
  partyA: "0x0000000000000000000000000000000000005Ab1",
  order: {
    quoteId: 42n,
    closePrice: 50_000_000_000_000_000_000n,
    quantityToClose: 1_000_000_000_000_000_000n,
  },
  deadline: 1_700_000_300n,
  salt: `0x${"12".repeat(32)}`,
} satisfies InstantCloseParameters;

describe("instantClose — signed order type", () => {
  beforeEach(() => {
    postInstantTradeInstantClose.mockResolvedValue({ data: undefined });
    instantRequestToCloseWithSignatureInstantTradeClosePost.mockResolvedValue({
      data: { successful: true },
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it.each([
    { solver: "enigma", chainId: undefined, orderType: undefined, expected: 2 },
    { solver: "enigma", chainId: undefined, orderType: ORDER_TYPE_MARKET, expected: 2 },
    { solver: "enigma", chainId: undefined, orderType: ORDER_TYPE_LIMIT, expected: 0 },
    { solver: "rasa", chainId: SymmioSupportedChainId.BASE, orderType: undefined, expected: 1 },
    { solver: "rasa", chainId: SymmioSupportedChainId.BASE, orderType: ORDER_TYPE_MARKET, expected: 1 },
    { solver: "rasa", chainId: SymmioSupportedChainId.BASE, orderType: ORDER_TYPE_LIMIT, expected: 0 },
  ] as const)(
    "encodes $expected for $solver with requested order type $orderType",
    async ({ solver, chainId, orderType, expected }) => {
      const { config, signTypedData } = mockConfig();

      const result = await instantClose(config, { ...PARAMETERS, chainId, orderType });

      const [body, options] = (
        solver === "enigma" ? postInstantTradeInstantClose : instantRequestToCloseWithSignatureInstantTradeClosePost
      ).mock.calls[0]!;
      const operation = solver === "enigma" ? body.operations[0] : body[0];
      const decoded = decodeFunctionData({ abi: symmioAbi, data: operation.signedOperation.callData });

      expect(decoded).toEqual({
        functionName: "requestToClosePosition",
        args: [
          PARAMETERS.order.quoteId,
          PARAMETERS.order.closePrice,
          PARAMETERS.order.quantityToClose,
          expected,
          PARAMETERS.deadline,
        ],
      });
      expect(signTypedData).toHaveBeenCalledOnce();
      expect(signTypedData.mock.calls[0]![0].message.callData).toBe(operation.signedOperation.callData);
      expect(operation.signature).toBe(TEST_TYPED_SIGNATURE);
      expect(operation.signedOperation.target).toBe(config.getChainConfig(chainId).addresses.symmioAddress);
      expect(operation.signedOperation.signerAccount).toEqual({ addr: PARAMETERS.partyA, isPartyB: false });
      expect(operation.signedOperation.flexFields).toEqual([]);
      expect(operation.signedOperation.maxUses).toBe(1);
      expect(options.baseURL).toBe(config.getSolver({ chainId }).url);
      expect(
        solver === "enigma" ? instantRequestToCloseWithSignatureInstantTradeClosePost : postInstantTradeInstantClose,
      ).not.toHaveBeenCalled();
      expect(result).toEqual({ success: true });
    },
  );

  it.each(["enigma", "rasa"] as const)(
    "honors an explicit %s override of the chain's other default solver",
    async (solverId) => {
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

      await instantClose(config, { ...PARAMETERS, solverId });

      const [body, options] = (
        solverId === "enigma" ? postInstantTradeInstantClose : instantRequestToCloseWithSignatureInstantTradeClosePost
      ).mock.calls[0]!;
      const operation = solverId === "enigma" ? body.operations[0] : body[0];
      const decoded = decodeFunctionData({ abi: symmioAbi, data: operation.signedOperation.callData });

      expect(decoded.args[3]).toBe(solverId === "enigma" ? 2 : 1);
      expect(signTypedData.mock.calls[0]![0].message.callData).toBe(operation.signedOperation.callData);
      expect(options.baseURL).toBe(config.getSolver({ solverId }).url);
      expect(
        solverId === "enigma" ? instantRequestToCloseWithSignatureInstantTradeClosePost : postInstantTradeInstantClose,
      ).not.toHaveBeenCalled();
    },
  );

  it.each([
    { chainId: undefined, orderType: undefined, expectedOrderType: 2, seconds: 300 },
    { chainId: SymmioSupportedChainId.BASE, orderType: ORDER_TYPE_LIMIT, expectedOrderType: 0, seconds: 900 },
  ] as const)(
    "retains the $seconds-second default deadline for encoded order type $expectedOrderType",
    async ({ chainId, orderType, expectedOrderType, seconds }) => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-09-27T12:00:00Z"));
      const { config, signTypedData } = mockConfig();

      await instantClose(config, { ...PARAMETERS, deadline: undefined, chainId, orderType });

      const message = signTypedData.mock.calls[0]![0].message;
      const decoded = decodeFunctionData({ abi: symmioAbi, data: message.callData });
      const deadline = BigInt(Date.now() / 1000 + seconds);

      expect(decoded.args[3]).toBe(expectedOrderType);
      expect(decoded.args[4]).toBe(deadline);
      expect(message.replayAttackHeader.deadline).toBe(deadline);
    },
  );
});
