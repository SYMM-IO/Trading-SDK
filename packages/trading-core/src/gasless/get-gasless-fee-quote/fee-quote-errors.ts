import {
  BaseError,
  ContractFunctionRevertedError,
  ContractFunctionZeroDataError,
  type Address,
  type ContractErrorName,
  type Hex,
  type PublicClient,
} from "viem";
import { SymmError } from "../../shared/errors/symm-error";
import { gaslessLayerAbi } from "../../symmio-contracts/abi/v0.8.6/gasless-layer";

/** The custom error the GaslessLayer reverts with once a billing account's daily free quota is spent. */
const FREE_QUOTA_EXHAUSTED_ERROR = "DailyFreeOpsLimitExceeded" satisfies ContractErrorName<typeof gaslessLayerAbi>;

/** Error code of a quote refused because the daily free-operations quota is exhausted. */
const FREE_QUOTA_EXHAUSTED_CODE = "GASLESS_FREE_QUOTA_EXHAUSTED";

/** What reached the client when a contract read failed. */
type ReadFailure =
  | { type: "no-data" }
  | { type: "revert"; revert: ContractFunctionRevertedError; data: Hex }
  | { type: "inconclusive" };

function formatRevertArgument(value: unknown): string {
  return typeof value === "bigint" ? value.toString() : String(value);
}

/**
 * Classify a failed contract read by what reached the client.
 *
 * - `no-data`: the call returned nothing, so no code answers the function (an
 *   address without code, for example).
 * - `revert`: the call reverted; `data` is the revert data, `"0x"` when empty.
 * - `inconclusive`: no revert data arrived at all (a transport failure, a rate
 *   limit, a node error), which says nothing about the contract.
 */
function classifyReadFailure(err: unknown): ReadFailure {
  if (!(err instanceof BaseError)) return { type: "inconclusive" };
  if (err.walk((cause) => cause instanceof ContractFunctionZeroDataError)) return { type: "no-data" };
  const revert = err.walk((cause) => cause instanceof ContractFunctionRevertedError);
  if (!(revert instanceof ContractFunctionRevertedError) || revert.raw === undefined) return { type: "inconclusive" };
  return { type: "revert", revert, data: revert.raw };
}

/**
 * Whether the GaslessLayer at `gaslessLayerAddress` implements `previewFeeQuote`,
 * decided by quoting empty calldata. The multi-wallet GaslessLayer checks the
 * selector before anything else and rejects it with revert data
 * (`UnsupportedFeeQuoteCall(0x00000000)`). A proxy whose implementation predates
 * the function reverts with empty data again, and an address without code
 * returns nothing.
 *
 * @returns `true` or `false` on that evidence, or `undefined` when the check is
 *   inconclusive: it failed for transport reasons, or it answered calldata every
 *   GaslessLayer rejects.
 */
async function implementsPreviewFeeQuote(
  client: PublicClient,
  gaslessLayerAddress: Address,
): Promise<boolean | undefined> {
  try {
    await client.readContract({
      address: gaslessLayerAddress,
      abi: gaslessLayerAbi,
      functionName: "previewFeeQuote",
      args: ["0x", 0n],
    });
  } catch (err) {
    const failure = classifyReadFailure(err);
    if (failure.type === "no-data") return false;
    if (failure.type === "revert") return failure.data !== "0x";
  }
  return undefined;
}

function interfaceUnsupportedError(err: unknown, gaslessLayerAddress: Address): SymmError {
  return new SymmError(
    "config",
    "GASLESS_LAYER_INTERFACE_UNSUPPORTED",
    `Gasless: the GaslessLayer at ${gaslessLayerAddress} does not implement previewFeeQuote — it predates the multi-wallet interface this SDK targets, or is not a GaslessLayer. Point gaslessLayerAddress at an upgraded deployment.`,
    { cause: err },
  );
}

/** Input of {@link resolveGaslessFeeQuoteError}. @internal */
export interface ResolveGaslessFeeQuoteErrorParameters {
  /** The public client the failed quote was read with. */
  client: PublicClient;
  /** The quoted GaslessLayer. */
  gaslessLayerAddress: Address;
}

/**
 * Map a failed `previewFeeQuote` read onto the SDK's typed errors.
 *
 * - A `DailyFreeOpsLimitExceeded` revert → `GASLESS_FREE_QUOTA_EXHAUSTED`.
 * - Any other revert that carries data → `GASLESS_FEE_QUOTE_REVERTED`: the
 *   contract refused the batch itself (a mismatched wallet target, an empty or
 *   misaligned batch), so re-signing the same input cannot help.
 * - A call that returned nothing → `GASLESS_LAYER_INTERFACE_UNSUPPORTED`: no
 *   code at the configured address answers `previewFeeQuote`.
 * - A revert with **empty** data is ambiguous. A GaslessLayer proxy that
 *   predates the multi-wallet interface answers every `previewFeeQuote` this
 *   way, but the multi-wallet GaslessLayer does too when it cannot ABI-decode
 *   the batch (malformed wallet `execute` calldata, for example). One more read
 *   quotes empty calldata to tell them apart (see
 *   `implementsPreviewFeeQuote`): revert data there means the interface exists
 *   and the batch is at fault → `GASLESS_FEE_QUOTE_REVERTED`; empty data or no
 *   data again → `GASLESS_LAYER_INTERFACE_UNSUPPORTED`. When that check is
 *   inconclusive, `err` is returned unchanged.
 * - Anything else (transport, rate limit, node error without revert data) is
 *   returned unchanged — it says nothing about the batch.
 *
 * @param err - The error `readContract` threw.
 * @param parameters - The client for the empty-revert check, and the quoted GaslessLayer.
 * @returns The typed error to throw, or `err` itself.
 *
 * @internal
 */
export async function resolveGaslessFeeQuoteError(
  err: unknown,
  parameters: ResolveGaslessFeeQuoteErrorParameters,
): Promise<unknown> {
  const { client, gaslessLayerAddress } = parameters;
  const failure = classifyReadFailure(err);
  if (failure.type === "inconclusive") return err;
  if (failure.type === "no-data") return interfaceUnsupportedError(err, gaslessLayerAddress);

  if (failure.data === "0x") {
    const implemented = await implementsPreviewFeeQuote(client, gaslessLayerAddress);
    if (implemented === undefined) return err;
    if (!implemented) return interfaceUnsupportedError(err, gaslessLayerAddress);
    return new SymmError(
      "validation",
      "GASLESS_FEE_QUOTE_REVERTED",
      `Gasless: the GaslessLayer fee quote reverted with empty revert data. The GaslessLayer at ${gaslessLayerAddress} implements previewFeeQuote, so it could not process this batch — typically calldata it cannot ABI-decode, such as malformed wallet execute arguments. The relay would revert the same way.`,
      { cause: err },
    );
  }

  const { revert } = failure;
  const errorName = revert.data?.errorName;
  if (errorName === FREE_QUOTA_EXHAUSTED_ERROR) {
    const [account, limit] = revert.data?.args ?? [];
    return new SymmError(
      "api",
      FREE_QUOTA_EXHAUSTED_CODE,
      `Gasless: billing account ${formatRevertArgument(account)} has used its daily free-operations quota (${formatRevertArgument(limit)}), and this GaslessLayer refuses paid operations once it is spent. Retry after the UTC reset or use the wallet path.`,
      { cause: err },
    );
  }

  const described = errorName
    ? `${errorName}(${(revert.data?.args ?? []).map(formatRevertArgument).join(", ")})`
    : `unknown error ${revert.signature ?? failure.data.slice(0, 10)}`;
  return new SymmError(
    "validation",
    "GASLESS_FEE_QUOTE_REVERTED",
    `Gasless: the GaslessLayer fee quote reverted with ${described}. The batch itself is invalid — the relay would revert the same way.`,
    { cause: err },
  );
}

/**
 * Whether an error means the billing account's **daily free-operations quota is
 * exhausted** and the GaslessLayer refuses paid operations until the UTC reset.
 *
 * Matches the `GASLESS_FREE_QUOTA_EXHAUSTED` error {@link getGaslessFeeQuote}
 * throws (also after a framework layer re-wraps it, e.g. React's
 * `SymmioRequestError`), and a raw viem revert carrying `DailyFreeOpsLimitExceeded`
 * from a direct GaslessLayer call. For the relay service's own HTTP rejections,
 * use `isConfirmedGaslessFeeLimitError`.
 *
 * @param err - Anything caught from a fee quote or a GaslessLayer call.
 * @returns `true` when the free quota blocks the batch.
 *
 * @example
 * ```ts
 * try {
 *   await getGaslessFeeQuote(config, { operations });
 * } catch (err) {
 *   if (isGaslessFreeQuotaExhaustedError(err)) showQuotaResetNotice();
 *   else throw err;
 * }
 * ```
 */
export function isGaslessFreeQuotaExhaustedError(err: unknown): boolean {
  if (typeof err === "object" && err !== null && "code" in err && err.code === FREE_QUOTA_EXHAUSTED_CODE) return true;
  const failure = classifyReadFailure(err);
  return failure.type === "revert" && failure.revert.data?.errorName === FREE_QUOTA_EXHAUSTED_ERROR;
}
