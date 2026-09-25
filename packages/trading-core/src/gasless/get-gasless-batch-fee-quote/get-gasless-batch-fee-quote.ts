import { zeroAddress, zeroHash, type Address } from "viem";
import type { Config } from "../../core/config";
import type { ChainIdParameter, Compute } from "../../shared/types/properties";
import type { GaslessBatchCall } from "../batch/calls";
import {
  buildGaslessBatchOperations,
  distinctGaslessBatchWalletIds,
  readGaslessBatchWalletTargets,
  resolveGaslessBatchEntries,
} from "../batch/resolve-gasless-batch";
import { getGaslessFeeQuote } from "../get-gasless-fee-quote/get-gasless-fee-quote";
import { resolveGaslessService } from "../resolve-gasless";
import { resolveGaslessWalletIdentities } from "../resolve-wallet-identities";
import type { GaslessFeeQuote } from "../types";

/**
 * Parameters for {@link getGaslessBatchFeeQuote}.
 */
export type GetGaslessBatchFeeQuoteParameters = Compute<
  ChainIdParameter & {
    /**
     * The sub-account every operation runs under — the account `relayGaslessBatch`
     * would relay with. It decides the billing account (a virtual account bills
     * its parent) and, for GaslessWallet entries, which owner's wallets execute.
     */
    account: Address;
    /**
     * The batch, in relay order. Quote the whole batch rather than one call at a
     * time: free-quota slots and first-use wallet creation fees are allocated
     * across it.
     */
    calls: readonly GaslessBatchCall[];
  }
>;

/** Return type of {@link getGaslessBatchFeeQuote}. */
export type GetGaslessBatchFeeQuoteReturnType = GaslessFeeQuote;

/**
 * Preview what {@link relayGaslessBatch} would charge for the same calls —
 * before any signature prompt, and without building a single operation by hand.
 *
 * The calls are resolved exactly as the relay resolves them, encoded as the
 * `relayInstantBatch` call the relayer submits, and priced by the GaslessLayer's
 * `previewFeeQuote`. The preview never checks nonces, deadlines, salts or
 * signatures, so they are fixed placeholders here: the result depends only on
 * the account and the calls, and caches cleanly.
 *
 * The quote is one row per call in `payments` (a GaslessWallet entry is one
 * row, priced by its inner call selectors), with `totalFee18` the batch total.
 * Every amount is 18-decimal. Group rows by `payer` and `source` to tell the
 * user which balance pays: a relayed batch is charged to the SYMMIO account's
 * Core balance, bounded by its operational-fee allowance, never to the wallet.
 *
 * It is a preview, not a guarantee: `exact` is always `false`, and an approval
 * or a transfer inside the batch can change the final fee or its payer. It does
 * not check that the payer can afford it — the relayer's own simulation is
 * authoritative.
 *
 * @param config - The SDK config.
 * @param parameters - The account, the batch, and an optional chain id.
 * @returns The fee quote.
 * @throws {SymmError} `GASLESS_NOT_CONFIGURED` / `GASLESS_UNSUPPORTED_CONTRACTS_VERSION`.
 * @throws {SymmError} `GASLESS_EMPTY_BATCH`, `GASLESS_NOT_RELAYABLE` or `GASLESS_WALLET_ID_INVALID`
 *   for a batch the relay could not carry — before any RPC call.
 * @throws {SymmError} `GASLESS_FREE_QUOTA_EXHAUSTED`, `GASLESS_FEE_QUOTE_REVERTED` or
 *   `GASLESS_LAYER_INTERFACE_UNSUPPORTED`, exactly as {@link getGaslessFeeQuote} does.
 * @throws Viem's encoding error when an ABI-level call does not encode, and viem transport errors.
 *
 * @example
 * ```ts
 * import { getGaslessBatchFeeQuote } from "@symmio/trading-core";
 * import { formatUnits } from "viem";
 *
 * const quote = await getGaslessBatchFeeQuote(config, {
 *   account: subAccount,
 *   calls: [
 *     { functionName: "allocate", args: [amount] },
 *     { functionName: "editAccountName", args: [subAccount, "Main"] },
 *   ],
 * });
 * formatUnits(quote.totalFee18, 18); // "0.1"
 * ```
 */
export async function getGaslessBatchFeeQuote(
  config: Config,
  parameters: GetGaslessBatchFeeQuoteParameters,
): Promise<GetGaslessBatchFeeQuoteReturnType> {
  const { account, calls } = parameters;
  resolveGaslessService(config, { chainId: parameters.chainId });
  const chain = config.getChainConfig(parameters.chainId);
  const chainId = chain.chainId;

  const entries = resolveGaslessBatchEntries(chain.addresses, calls);
  const walletIds = distinctGaslessBatchWalletIds(entries);

  /**
   * A wallet entry's signed target must be the real wallet address — the
   * preview rejects any other with `InvalidWalletOperationTarget` — so only a
   * batch with wallet entries pays for the owner and address reads.
   */
  let walletTargets = new Map<bigint, Address>();
  if (walletIds.length > 0) {
    const { ownerWallet } = await resolveGaslessWalletIdentities(config, { chainId, account });
    walletTargets = await readGaslessBatchWalletTargets(config, { chainId, owner: ownerWallet, walletIds });
  }

  const built = buildGaslessBatchOperations(entries, {
    signer: zeroAddress,
    account,
    deadline: 0n,
    instantNonce: 0n,
    walletTargets,
    walletNonces: new Map(),
    salt: () => zeroHash,
  });

  return getGaslessFeeQuote(config, {
    chainId,
    operations: built.operations.map((operation, index) => ({ operation, walletId: built.walletIds[index] })),
  });
}
