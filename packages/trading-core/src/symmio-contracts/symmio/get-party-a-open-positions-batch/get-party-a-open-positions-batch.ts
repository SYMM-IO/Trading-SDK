import type { Address } from "viem";
import type { Config } from "../../../core/config";
import { SymmError } from "../../../shared/errors/symm-error";
import type { ChainIdParameter, Compute } from "../../../shared/types/properties";
import { symmioAbi } from "../../abi/v0.8.6/symmio";
import type { Quote } from "../types";

/** Default number of positions read per account. */
const DEFAULT_SIZE = 200n;
/** Default number of accounts bundled into one multicall. */
const DEFAULT_BATCH_SIZE = 10;

/**
 * One account to read in {@link getPartyAOpenPositionsBatch}: a bare address
 * (reads from `0n`) or an address with its own pagination offset.
 */
export type PartyAOpenPositionsBatchAccount =
  | Address
  | {
      /** The partyA (virtual account, lowcap; or the sub-account, cross-margin) to read. */
      partyA: Address;
      /**
       * Pagination offset into this partyA's open-positions list. A `start`
       * greater than the account's position count reverts on-chain, so the entry
       * comes back as a `failure`.
       * @default 0n
       */
      start?: bigint;
    };

/**
 * Parameters for {@link getPartyAOpenPositionsBatch}.
 */
export type GetPartyAOpenPositionsBatchParameters = Compute<
  ChainIdParameter & {
    /** The accounts to read. Any length; the same address + `start` is read once. */
    partyAs: readonly PartyAOpenPositionsBatchAccount[];
    /**
     * Maximum number of positions to return per account. Clamped on-chain to the
     * number remaining after that account's `start`.
     * @default 200n
     */
    size?: bigint;
    /**
     * Also read each account's liquidation-in-progress flag (`isPartyALiquidated`)
     * inside the same multicall, reported as `isLiquidated` on each success.
     * @default false
     */
    includeLiquidationStatus?: boolean;
    /**
     * How many accounts to bundle into one multicall. Chunks run in parallel. A
     * full 200-position read costs a lot of gas, and one `eth_call` has a gas cap,
     * so keep this modest when accounts may hold many positions.
     * @default 10
     */
    batchSize?: number;
  }
>;

/** An account whose open positions were read. */
export interface PartyAOpenPositionsBatchSuccess {
  /** The partyA exactly as passed in (no checksum rewrite). */
  partyA: Address;
  /** The pagination offset that was read. */
  start: bigint;
  status: "success";
  /** The open-position quotes in range — the same structs `getPartyAOpenPositions` returns. */
  quotes: readonly Quote[];
  /**
   * `true` when a full page came back (`quotes.length === size`), so more
   * positions may follow. Read the next page with
   * `{ partyA, start: start + BigInt(quotes.length) }`.
   */
  hasMore: boolean;
  /**
   * Whether the partyA is in liquidation. Present only with
   * `includeLiquidationStatus`; `undefined` when that read failed (unknown,
   * never reported as `false`).
   */
  isLiquidated?: boolean;
}

/** An account whose open-positions read reverted. */
export interface PartyAOpenPositionsBatchFailure {
  /** The partyA exactly as passed in (no checksum rewrite). */
  partyA: Address;
  /** The pagination offset that was attempted. */
  start: bigint;
  status: "failure";
  /** The revert, as reported by the multicall. */
  error: Error;
}

/** One entry of {@link getPartyAOpenPositionsBatch}'s result. */
export type PartyAOpenPositionsBatchResult = PartyAOpenPositionsBatchSuccess | PartyAOpenPositionsBatchFailure;

/**
 * Return type of {@link getPartyAOpenPositionsBatch}: one result per input
 * account, in input order.
 */
export type GetPartyAOpenPositionsBatchReturnType = readonly PartyAOpenPositionsBatchResult[];

interface BatchRead {
  partyA: Address;
  start: bigint;
}

/**
 * Read the open positions of **many** partyAs (e.g. every virtual account of a
 * sub-account) in multicalls of `batchSize` accounts — one `eth_call` per chunk
 * instead of one per account.
 *
 * Each account is isolated: a revert in one account's read marks only that entry
 * `failure`, and the rest still succeed. A transport/RPC error fails the whole
 * call — it is not reported as every account failing. Pass
 * `includeLiquidationStatus` to read each account's
 * liquidation-in-progress flag in the same multicall.
 *
 * Each account pages on its own: a success with `hasMore` is read further by
 * passing `{ partyA, start }` for just that account.
 *
 * @remarks
 * Uses the client's `multicall`, so the client's chain must define a Multicall3
 * address. Ordering inside each account's `quotes` is not stable between calls
 * (swap-and-pop on-chain), as with `getPartyAOpenPositions`.
 *
 * @param config - The SDK config.
 * @param parameters - Accounts (each with an optional `start`), page `size`,
 *   `includeLiquidationStatus`, `batchSize`, optional chain id.
 * @returns One result per input account, in input order.
 * @throws {SymmError} `INVALID_BATCH_SIZE` when `batchSize` is not a positive integer.
 * @throws {SymmError} when the chain is not supported.
 * @throws Viem's multicall errors for transport/RPC failures.
 *
 * @example
 * ```ts
 * const results = await getPartyAOpenPositionsBatch(config, {
 *   partyAs: virtualAccounts,
 *   includeLiquidationStatus: true,
 * });
 * const quotes = results.flatMap((r) => (r.status === "success" && !r.isLiquidated ? r.quotes : []));
 * ```
 */
export async function getPartyAOpenPositionsBatch(
  config: Config,
  parameters: GetPartyAOpenPositionsBatchParameters,
): Promise<GetPartyAOpenPositionsBatchReturnType> {
  const {
    chainId,
    partyAs,
    size = DEFAULT_SIZE,
    includeLiquidationStatus = false,
    batchSize = DEFAULT_BATCH_SIZE,
  } = parameters;

  if (!Number.isInteger(batchSize) || batchSize < 1) {
    throw new SymmError(
      "validation",
      "INVALID_BATCH_SIZE",
      `getPartyAOpenPositionsBatch: \`batchSize\` must be a positive integer, got ${batchSize}.`,
    );
  }

  const accounts = partyAs.map(toBatchRead);
  // The same address (any casing) + start is read once.
  const reads = [...new Map(accounts.map((account) => [readKey(account), account])).values()];
  if (reads.length === 0) return [];

  const { addresses } = config.getChainConfig(chainId);
  const client = config.getClient({ chainId });
  const callsPerAccount = includeLiquidationStatus ? 2 : 1;

  const chunks: BatchRead[][] = [];
  for (let start = 0; start < reads.length; start += batchSize) {
    chunks.push(reads.slice(start, start + batchSize));
  }

  const chunkResults = await Promise.all(
    chunks.map(async (chunk) => {
      const results = await client.multicall({
        allowFailure: true,
        contracts: chunk.flatMap(({ partyA, start }) => {
          const positions = {
            address: addresses.symmioAddress,
            abi: symmioAbi,
            functionName: "getPartyAOpenPositions",
            args: [partyA, start, size],
          } as const;
          if (!includeLiquidationStatus) return [positions];
          const liquidation = {
            address: addresses.symmioAddress,
            abi: symmioAbi,
            functionName: "isPartyALiquidated",
            args: [partyA],
          } as const;
          return [positions, liquidation];
        }),
      });
      // viem reports a failed `aggregate3` call — the transport or RPC, not an
      // account's read — as a failure of every call in it. That fails the read.
      for (const result of results) {
        if (result.status === "failure" && isMulticallError(result.error)) throw result.error;
      }

      return chunk.map(({ partyA, start }, index): PartyAOpenPositionsBatchResult => {
        const positions = results[index * callsPerAccount];
        if (!positions || positions.status === "failure") {
          const error = positions?.error ?? new Error("getPartyAOpenPositions: missing multicall result.");
          return { partyA, start, status: "failure", error };
        }

        const quotes = positions.result as readonly Quote[];
        const result: PartyAOpenPositionsBatchSuccess = {
          partyA,
          start,
          status: "success",
          quotes,
          hasMore: size > 0n && BigInt(quotes.length) === size,
        };
        if (includeLiquidationStatus) {
          const liquidation = results[index * callsPerAccount + 1];
          result.isLiquidated = liquidation?.status === "success" ? (liquidation.result as boolean) : undefined;
        }
        return result;
      });
    }),
  );

  const resultByKey = new Map(chunkResults.flat().map((result) => [readKey(result), result]));
  // Echo every input's own spelling of the address, even when it shared a read.
  return accounts.map((account) => ({ ...resultByKey.get(readKey(account))!, partyA: account.partyA }));
}

/** Whether a multicall leg failed because the `aggregate3` call itself failed. */
function isMulticallError(error: Error): boolean {
  return (error as { functionName?: unknown }).functionName === "aggregate3";
}

function toBatchRead(account: PartyAOpenPositionsBatchAccount): BatchRead {
  if (typeof account === "string") return { partyA: account, start: 0n };
  return { partyA: account.partyA, start: account.start ?? 0n };
}

function readKey({ partyA, start }: BatchRead) {
  return `${partyA.toLowerCase()}:${start}`;
}
