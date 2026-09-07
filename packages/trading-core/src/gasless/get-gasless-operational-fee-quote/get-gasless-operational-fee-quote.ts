import type { Address } from "viem";
import type { Config } from "../../core/config";
import type { ChainIdParameter, Compute } from "../../shared/types/properties";
import type { SignedOperation } from "../../solvers/instant-open/shared/types";
import { gaslessLayerAbi } from "../gateway/gasless-layer-abi";
import { resolveGaslessService } from "../resolve-gasless";

/**
 * Parameters for {@link getGaslessOperationalFeeQuote}.
 */
export type GetGaslessOperationalFeeQuoteParameters = Compute<
  ChainIdParameter & {
    /** The billing account (the operations' `signerAccount.addr`). */
    account: Address;
    /**
     * The exact operations about to be relayed. Signatures are not needed for
     * the quote — an unsigned struct with the final calldata and replay header
     * quotes identically.
     */
    operations: readonly SignedOperation[];
  }
>;

/** Return type of {@link getGaslessOperationalFeeQuote}. */
export interface GetGaslessOperationalFeeQuoteReturnType {
  /** Total collateral the gateway would charge for these operations (raw units). */
  amountDue: bigint;
  /** How many of the operations the account's daily free quota covers. */
  freeOpsApplied: bigint;
  /** `true` when the daily-quota policy would reject the batch outright. */
  wouldBlockOnQuota: boolean;
}

/**
 * Quote the operational fee the GaslessLayer would charge for a batch —
 * **before** asking the user to sign anything.
 *
 * This is the authoritative pre-flight: it applies the per-selector base fee,
 * the payer's fee multiplier, and the daily free quota to the exact
 * operations. Compare `amountDue` against the account's available collateral
 * and treat `wouldBlockOnQuota` as a hard stop.
 *
 * @param config - The SDK config.
 * @param parameters - Billing account and the operations to quote.
 * @returns The fee quote.
 * @throws {SymmError} `GASLESS_NOT_CONFIGURED` / `GASLESS_UNSUPPORTED_CONTRACTS_VERSION`.
 * @throws Viem read errors.
 *
 * @example
 * ```ts
 * const quote = await getGaslessOperationalFeeQuote(config, { account: subAccount, operations: [operation] });
 * if (quote.wouldBlockOnQuota) throw new Error("daily gasless quota exhausted");
 * ```
 */
export async function getGaslessOperationalFeeQuote(
  config: Config,
  parameters: GetGaslessOperationalFeeQuoteParameters,
): Promise<GetGaslessOperationalFeeQuoteReturnType> {
  const { chainId, account, operations } = parameters;
  const gasless = resolveGaslessService(config, { chainId });
  const client = config.getClient({ chainId });

  const [amountDue, freeOpsApplied, wouldBlockOnQuota] = await client.readContract({
    address: gasless.gaslessLayerAddress,
    abi: gaslessLayerAbi,
    functionName: "getAccountOperationalFee",
    args: [
      account,
      operations.map((operation) => ({
        signer: operation.signer,
        target: operation.target,
        callData: operation.callData,
        signerAccount: { addr: operation.signerAccount.addr, isPartyB: operation.signerAccount.isPartyB },
        flexFields: operation.flexFields.map((field) => ({
          offset: field.offset,
          length: field.length,
          authorizedFlexFiller: field.authorizedFlexFiller,
        })),
        maxUses: operation.maxUses,
        replayAttackHeader: {
          nonce: operation.replayAttackHeader.nonce,
          deadline: operation.replayAttackHeader.deadline,
          salt: operation.replayAttackHeader.salt,
        },
      })),
    ],
  });

  return { amountDue, freeOpsApplied, wouldBlockOnQuota };
}
