import {
  ContractFunctionRevertedError,
  ContractFunctionZeroDataError,
  HttpRequestError,
  decodeFunctionData,
  maxUint256,
  size,
  type Address,
  type Hex,
} from "viem";
import { describe, expect, it } from "vitest";
import type { SignedOperation } from "../../solvers/instant-open/shared/types";
import { gaslessLayerAbi } from "../../symmio-contracts/abi/v0.8.6/gasless-layer";
import { GASLESS_TEST_CHAIN, TEST_GASLESS, gaslessTestConfig } from "../test/config";
import { asReadContractError, feeQuoteRawRevert, feeQuoteRevert, rawFeeQuote } from "../test/fee-quote";
import { GaslessFeeSource } from "../types";
import { GASLESS_FEE_QUOTE_PLACEHOLDER_SIGNATURE } from "./encode-relay-batch-call-data";
import { isGaslessFreeQuotaExhaustedError } from "./fee-quote-errors";
import { getGaslessFeeQuote } from "./get-gasless-fee-quote";

const ACCOUNT: Address = "0x3333333333333333333333333333333333333333";
const WALLET: Address = "0x5555555555555555555555555555555555555555";
const OPERATION: SignedOperation = {
  signer: "0x1111111111111111111111111111111111111111",
  target: "0x2222222222222222222222222222222222222222",
  callData: "0xcf70cb69",
  signerAccount: { addr: ACCOUNT, isPartyB: false },
  flexFields: [],
  maxUses: 1n,
  replayAttackHeader: { nonce: 7n, deadline: 4_102_444_800n, salt: `0x${"11".repeat(32)}` },
};
const WALLET_OPERATION: SignedOperation = {
  ...OPERATION,
  target: WALLET,
  flexFields: [{ offset: 36n, length: 32n, authorizedFlexFiller: "0x4444444444444444444444444444444444444444" }],
  replayAttackHeader: { ...OPERATION.replayAttackHeader, nonce: 1n },
};

/** The `previewFeeQuote` calldata the stub was asked for, decoded back into `relayInstantBatch` arguments. */
function quotedBatch(readContract: ReturnType<typeof gaslessTestConfig>["readContract"]) {
  const [read] = readContract.mock.calls[0] as [{ args: readonly [Hex, bigint] }];
  const decoded = decodeFunctionData({ abi: gaslessLayerAbi, data: read.args[0] });
  return { decoded, nativeAmount: read.args[1] };
}

describe("getGaslessFeeQuote", () => {
  it("previews the relay batch on the GaslessLayer and maps every quote field", async () => {
    const { config, readContract } = gaslessTestConfig();
    readContract.mockResolvedValueOnce(rawFeeQuote(ACCOUNT, { freeOpsApplied: 1n }));

    const quote = await getGaslessFeeQuote(config, {
      chainId: GASLESS_TEST_CHAIN,
      operations: [{ operation: OPERATION }],
    });

    expect(quote).toEqual({
      collateralToken: "0x000000000000000000000000000000000000c011",
      collateralDecimals: 6,
      blockNumber: 506_000_000n,
      timestamp: 1_789_000_000n,
      exact: false,
      payments: [
        {
          account: ACCOUNT,
          payer: ACCOUNT,
          source: GaslessFeeSource.SYMMIO_ACCOUNT,
          operationalFee18: 50_000_000_000_000_000n,
          depositFee18: 0n,
          walletCreationFee18: 0n,
          nativeTopUpFee18: 0n,
          nativeGasCollateral18: 0n,
        },
      ],
      totalFee18: 50_000_000_000_000_000n,
      totalDebit18: 50_000_000_000_000_000n,
      freeOpsApplied: 1n,
      nativeSponsored: false,
    });
    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({ address: TEST_GASLESS.gaslessLayerAddress, functionName: "previewFeeQuote" }),
    );
  });

  it("encodes relayInstantBatch with the exact operations, placeholder signatures, no fills, and aligned wallet ids", async () => {
    const { config, readContract } = gaslessTestConfig();
    readContract.mockResolvedValueOnce(rawFeeQuote(ACCOUNT));

    await getGaslessFeeQuote(config, {
      chainId: GASLESS_TEST_CHAIN,
      operations: [{ operation: OPERATION }, { operation: WALLET_OPERATION, walletId: 2n }],
    });

    const { decoded, nativeAmount } = quotedBatch(readContract);
    expect(decoded.functionName).toBe("relayInstantBatch");
    const [signedOps, signatures, fills, flexFillerSignatures, walletIds] = decoded.args;
    /** The quote prices the exact structs, so every field round-trips unchanged and in order. */
    expect(signedOps).toEqual([OPERATION, WALLET_OPERATION]);
    expect(signatures).toEqual([GASLESS_FEE_QUOTE_PLACEHOLDER_SIGNATURE, GASLESS_FEE_QUOTE_PLACEHOLDER_SIGNATURE]);
    expect(size(GASLESS_FEE_QUOTE_PLACEHOLDER_SIGNATURE)).toBe(65);
    expect(fills).toEqual([[], []]);
    expect(flexFillerSignatures).toEqual([[], []]);
    /** An omitted wallet id is wallet 0; one id per operation, in order. */
    expect(walletIds).toEqual([0n, 2n]);
    /** A relay batch carries no native value. */
    expect(nativeAmount).toBe(0n);
  });

  it("maps a wallet-collateral payment and a first-use creation fee", async () => {
    const { config, readContract } = gaslessTestConfig();
    readContract.mockResolvedValueOnce(
      rawFeeQuote(ACCOUNT, {
        payments: [
          {
            account: WALLET,
            payer: WALLET,
            source: GaslessFeeSource.WALLET_COLLATERAL,
            operationalFee18: 0n,
            depositFee18: 30_000_000_000_000_000n,
            walletCreationFee18: 10_000_000_000_000_000n,
            nativeTopUpFee18: 0n,
            nativeGasCollateral18: 0n,
          },
        ],
      }),
    );

    const quote = await getGaslessFeeQuote(config, {
      chainId: GASLESS_TEST_CHAIN,
      operations: [{ operation: WALLET_OPERATION, walletId: 1n }],
    });

    expect(quote.payments).toEqual([
      expect.objectContaining({
        account: WALLET,
        source: GaslessFeeSource.WALLET_COLLATERAL,
        depositFee18: 30_000_000_000_000_000n,
        walletCreationFee18: 10_000_000_000_000_000n,
      }),
    ]);
  });

  describe("errors", () => {
    it("throws GASLESS_FREE_QUOTA_EXHAUSTED for a DailyFreeOpsLimitExceeded revert", async () => {
      const { config, readContract } = gaslessTestConfig();
      const revert = feeQuoteRevert("DailyFreeOpsLimitExceeded", [ACCOUNT, 5n]);
      readContract.mockRejectedValueOnce(revert);

      const error = await getGaslessFeeQuote(config, {
        chainId: GASLESS_TEST_CHAIN,
        operations: [{ operation: OPERATION }],
      }).catch((err: unknown) => err);

      expect(error).toMatchObject({ code: "GASLESS_FREE_QUOTA_EXHAUSTED", kind: "api", cause: revert });
      expect((error as Error).message).toContain(ACCOUNT);
      expect(isGaslessFreeQuotaExhaustedError(error)).toBe(true);
    });

    it("throws GASLESS_FEE_QUOTE_REVERTED, naming the decoded error, for any other revert", async () => {
      const { config, readContract } = gaslessTestConfig();
      readContract.mockRejectedValueOnce(feeQuoteRevert("InvalidWalletOperationTarget", [WALLET, OPERATION.target]));

      const error = await getGaslessFeeQuote(config, {
        chainId: GASLESS_TEST_CHAIN,
        operations: [{ operation: OPERATION, walletId: 1n }],
      }).catch((err: unknown) => err);

      expect(error).toMatchObject({ code: "GASLESS_FEE_QUOTE_REVERTED", kind: "validation" });
      expect((error as Error).message).toContain("InvalidWalletOperationTarget");
      expect(isGaslessFreeQuotaExhaustedError(error)).toBe(false);
      /** Revert data already proves the interface exists, so there is no second read. */
      expect(readContract).toHaveBeenCalledTimes(1);
    });

    it("throws GASLESS_FEE_QUOTE_REVERTED for a revert whose data this ABI cannot decode", async () => {
      const { config, readContract } = gaslessTestConfig();
      readContract.mockRejectedValueOnce(feeQuoteRawRevert("0xdeadbeef"));

      await expect(
        getGaslessFeeQuote(config, { chainId: GASLESS_TEST_CHAIN, operations: [{ operation: OPERATION }] }),
      ).rejects.toMatchObject({ code: "GASLESS_FEE_QUOTE_REVERTED", message: expect.stringContaining("0xdeadbeef") });
    });

    it("throws GASLESS_LAYER_INTERFACE_UNSUPPORTED, with no second read, when the call returns no data (not a contract)", async () => {
      const { config, readContract } = gaslessTestConfig();
      readContract.mockRejectedValueOnce(
        asReadContractError(new ContractFunctionZeroDataError({ functionName: "previewFeeQuote" })),
      );

      await expect(
        getGaslessFeeQuote(config, { chainId: GASLESS_TEST_CHAIN, operations: [{ operation: OPERATION }] }),
      ).rejects.toMatchObject({
        code: "GASLESS_LAYER_INTERFACE_UNSUPPORTED",
        kind: "config",
        message: expect.stringContaining(TEST_GASLESS.gaslessLayerAddress),
      });
      expect(readContract).toHaveBeenCalledTimes(1);
    });

    describe("an empty-data revert", () => {
      it("checks the interface by quoting empty calldata on the same GaslessLayer", async () => {
        const { config, readContract } = gaslessTestConfig();
        readContract.mockRejectedValueOnce(feeQuoteRawRevert("0x")).mockRejectedValueOnce(feeQuoteRawRevert("0x"));

        await getGaslessFeeQuote(config, {
          chainId: GASLESS_TEST_CHAIN,
          operations: [{ operation: OPERATION }],
        }).catch(() => undefined);

        expect(readContract).toHaveBeenCalledTimes(2);
        expect(readContract).toHaveBeenLastCalledWith(
          expect.objectContaining({
            address: TEST_GASLESS.gaslessLayerAddress,
            functionName: "previewFeeQuote",
            args: ["0x", 0n],
          }),
        );
      });

      it("throws GASLESS_FEE_QUOTE_REVERTED when the GaslessLayer implements previewFeeQuote (a batch it cannot decode)", async () => {
        const { config, readContract } = gaslessTestConfig();
        const revert = feeQuoteRawRevert("0x");
        /** The multi-wallet GaslessLayer rejects empty calldata with revert data before anything else. */
        readContract
          .mockRejectedValueOnce(revert)
          .mockRejectedValueOnce(feeQuoteRevert("UnsupportedFeeQuoteCall", ["0x00000000"]));

        const error = await getGaslessFeeQuote(config, {
          chainId: GASLESS_TEST_CHAIN,
          operations: [{ operation: WALLET_OPERATION, walletId: 1n }],
        }).catch((err: unknown) => err);

        expect(error).toMatchObject({ code: "GASLESS_FEE_QUOTE_REVERTED", kind: "validation", cause: revert });
        expect((error as Error).message).toContain("empty revert data");
        expect(isGaslessFreeQuotaExhaustedError(error)).toBe(false);
      });

      it.each([
        { label: "empty data again (a pre-upgrade proxy)", check: () => feeQuoteRawRevert("0x") },
        {
          label: "no data at all",
          check: () => asReadContractError(new ContractFunctionZeroDataError({ functionName: "previewFeeQuote" })),
        },
      ])("throws GASLESS_LAYER_INTERFACE_UNSUPPORTED when the interface check returns $label", async ({ check }) => {
        const { config, readContract } = gaslessTestConfig();
        const revert = feeQuoteRawRevert("0x");
        readContract.mockRejectedValueOnce(revert).mockRejectedValueOnce(check());

        await expect(
          getGaslessFeeQuote(config, { chainId: GASLESS_TEST_CHAIN, operations: [{ operation: OPERATION }] }),
        ).rejects.toMatchObject({
          code: "GASLESS_LAYER_INTERFACE_UNSUPPORTED",
          kind: "config",
          cause: revert,
          message: expect.stringContaining(TEST_GASLESS.gaslessLayerAddress),
        });
      });

      it.each([
        {
          label: "fails for transport reasons",
          check: () => Promise.reject(asReadContractError(new HttpRequestError({ url: "https://rpc.invalid" }))),
        },
        { label: "unexpectedly answers", check: () => Promise.resolve(rawFeeQuote(ACCOUNT)) },
      ])("rethrows the original revert unchanged when the interface check $label", async ({ check }) => {
        const { config, readContract } = gaslessTestConfig();
        const revert = feeQuoteRawRevert("0x");
        readContract.mockRejectedValueOnce(revert).mockImplementationOnce(check);

        await expect(
          getGaslessFeeQuote(config, { chainId: GASLESS_TEST_CHAIN, operations: [{ operation: OPERATION }] }),
        ).rejects.toBe(revert);
      });
    });

    it.each([
      {
        label: "a transport failure",
        error: () => asReadContractError(new HttpRequestError({ url: "https://rpc.invalid", status: 429 })),
      },
      {
        label: "a node error with no revert data",
        error: () =>
          asReadContractError(
            new ContractFunctionRevertedError({
              abi: gaslessLayerAbi,
              functionName: "previewFeeQuote",
              message: "header not found",
            }),
          ),
      },
    ])("rethrows $label unchanged", async ({ error }) => {
      const { config, readContract } = gaslessTestConfig();
      const failure = error();
      readContract.mockRejectedValueOnce(failure);

      await expect(
        getGaslessFeeQuote(config, { chainId: GASLESS_TEST_CHAIN, operations: [{ operation: OPERATION }] }),
      ).rejects.toBe(failure);
      expect(readContract).toHaveBeenCalledTimes(1);
    });

    it("refuses an empty batch before any read", async () => {
      const { config, readContract } = gaslessTestConfig();

      await expect(getGaslessFeeQuote(config, { chainId: GASLESS_TEST_CHAIN, operations: [] })).rejects.toMatchObject({
        code: "GASLESS_EMPTY_BATCH",
        kind: "validation",
      });
      expect(readContract).not.toHaveBeenCalled();
    });

    it.each([
      { label: "a negative wallet id", walletId: -1n },
      { label: "a wallet id above uint256", walletId: maxUint256 + 1n },
      { label: "a number wallet id", walletId: 1 as unknown as bigint },
    ])("refuses $label before any read", async ({ walletId }) => {
      const { config, readContract } = gaslessTestConfig();

      const error = await getGaslessFeeQuote(config, {
        chainId: GASLESS_TEST_CHAIN,
        operations: [{ operation: OPERATION }, { operation: WALLET_OPERATION, walletId }],
      }).catch((err: unknown) => err);

      expect(error).toMatchObject({ code: "GASLESS_WALLET_ID_INVALID", kind: "validation" });
      expect((error as Error).message).toContain("operations[1].walletId");
      expect(readContract).not.toHaveBeenCalled();
    });
  });
});

describe("isGaslessFreeQuotaExhaustedError", () => {
  it("recognizes a raw viem DailyFreeOpsLimitExceeded revert", () => {
    expect(isGaslessFreeQuotaExhaustedError(feeQuoteRevert("DailyFreeOpsLimitExceeded", [ACCOUNT, 5n]))).toBe(true);
  });

  it("recognizes the typed code after a framework layer re-wraps the error", () => {
    const rewrapped = Object.assign(new Error("wrapped"), { code: "GASLESS_FREE_QUOTA_EXHAUSTED" });

    expect(isGaslessFreeQuotaExhaustedError(rewrapped)).toBe(true);
  });

  it.each([
    { label: "another revert", error: feeQuoteRevert("EmptyOperationBatch", []) },
    { label: "an empty-data revert", error: feeQuoteRawRevert("0x") },
    { label: "a plain error", error: new Error("DailyFreeOpsLimitExceeded") },
    { label: "a non-error value", error: "DailyFreeOpsLimitExceeded" },
    { label: "null", error: null },
  ])("rejects $label", ({ error }) => {
    expect(isGaslessFreeQuotaExhaustedError(error)).toBe(false);
  });
});
