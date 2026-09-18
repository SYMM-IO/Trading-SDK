import {
  ContractFunctionExecutionError,
  ContractFunctionRevertedError,
  encodeErrorResult,
  type Address,
  type BaseError,
  type ContractErrorArgs,
  type ContractErrorName,
  type ContractFunctionReturnType,
  type Hex,
} from "viem";
import { gaslessLayerAbi } from "../../symmio-contracts/abi/v0.8.6/gasless-layer";
import { GaslessFeeSource } from "../types";
import { TEST_GASLESS } from "./config";

/** The raw struct `previewFeeQuote` decodes to, as the public-client stub returns it. */
export type RawGaslessFeeQuote = ContractFunctionReturnType<typeof gaslessLayerAbi, "view", "previewFeeQuote">;

/**
 * A one-operation quote as the staging GaslessLayer returns it: one Core-paid
 * payment, nothing free, `exact: false`.
 *
 * @internal test helper — not exported from the package.
 */
export function rawFeeQuote(account: Address, overrides?: Partial<RawGaslessFeeQuote>): RawGaslessFeeQuote {
  return {
    collateralToken: "0x000000000000000000000000000000000000c011",
    collateralDecimals: 6,
    blockNumber: 506_000_000n,
    timestamp: 1_789_000_000n,
    exact: false,
    payments: [
      {
        account,
        payer: account,
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
    freeOpsApplied: 0n,
    nativeSponsored: false,
    ...overrides,
  };
}

/**
 * Wrap a failure exactly as viem's `readContract` surfaces it.
 *
 * @internal test helper — not exported from the package.
 */
export function asReadContractError(cause: BaseError): ContractFunctionExecutionError {
  return new ContractFunctionExecutionError(cause, {
    abi: gaslessLayerAbi,
    functionName: "previewFeeQuote",
    args: [],
    contractAddress: TEST_GASLESS.gaslessLayerAddress,
  });
}

/**
 * The error `readContract` throws when `previewFeeQuote` reverts with a
 * GaslessLayer custom error.
 *
 * @internal test helper — not exported from the package.
 */
export function feeQuoteRevert<errorName extends ContractErrorName<typeof gaslessLayerAbi>>(
  errorName: errorName,
  args: ContractErrorArgs<typeof gaslessLayerAbi, errorName>,
): ContractFunctionExecutionError {
  const data = encodeErrorResult({ abi: gaslessLayerAbi, errorName, args } as Parameters<typeof encodeErrorResult>[0]);
  return feeQuoteRawRevert(data);
}

/**
 * The error `readContract` throws for a revert carrying `data` verbatim. `"0x"` is
 * what a proxy whose implementation lacks `previewFeeQuote` returns, and also what
 * the multi-wallet GaslessLayer returns for a batch it cannot ABI-decode.
 *
 * @internal test helper — not exported from the package.
 */
export function feeQuoteRawRevert(data: Hex): ContractFunctionExecutionError {
  return asReadContractError(
    new ContractFunctionRevertedError({
      abi: gaslessLayerAbi,
      data,
      functionName: "previewFeeQuote",
      message: "execution reverted",
    }),
  );
}
