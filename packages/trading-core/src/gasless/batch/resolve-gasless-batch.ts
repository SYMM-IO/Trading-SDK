import { encodeFunctionData, type Address, type Hex } from "viem";
import type { SymmioContractAddresses } from "../../core/chains/types";
import type { Config } from "../../core/config";
import { SymmError } from "../../shared/errors/symm-error";
import { buildSignedOperation } from "../../solvers/instant-open/shared/operations";
import type { SignedOperation } from "../../solvers/instant-open/shared/types";
import { gaslessWalletAbi } from "../../symmio-contracts/abi/v0.8.6/gasless-wallet";
import { toWalletCallTuple, type GaslessWalletCall } from "../gasless-wallet-execute/calls";
import { GASLESS_WALLET_EXECUTE_OPERATION_TYPE } from "../gasless-wallet-execute/gasless-wallet-execute";
import { getGaslessWalletAddress } from "../get-gasless-wallet-address/get-gasless-wallet-address";
import { GASLESS_RELAYABLE_WRITES, type GaslessRelayableTarget } from "../relayable-writes";
import { assertGaslessWalletId } from "../wallet-id";
import {
  gaslessBatchCallData,
  gaslessCallDataSelector,
  isGaslessBatchWalletExecute,
  type GaslessBatchCall,
} from "./calls";

/** The label a batch relays under when its entries' own labels do not fit the service's 128 characters. */
const GASLESS_BATCH_OPERATION_TYPE = "gaslessBatch";

/** The service's limit on an `operationType` label. */
const GASLESS_OPERATION_TYPE_MAX_LENGTH = 128;

/** A relayable write, resolved to the contract the InstantLayer calls. @internal */
export interface ResolvedGaslessInstantEntry {
  type: "instant";
  /** Contract the InstantLayer calls with `callData`. */
  target: Address;
  /** The write's calldata. */
  callData: Hex;
  /** The write's selector, lowercased. */
  selector: Hex;
  /** The write's stable workflow label (`"allocate"`, `"initiateWithdraw"`, …). */
  operationType: string;
}

/** A GaslessWallet `execute` entry, encoded. @internal */
export interface ResolvedGaslessWalletEntry {
  type: "wallet";
  /** The wallet id the entry executes from. */
  walletId: bigint;
  /** `GaslessWallet.execute(calls)` calldata. */
  callData: Hex;
  /** The inner calls, for the delegation pre-flight. */
  walletCalls: readonly GaslessWalletCall[];
}

/** One batch entry, resolved and encoded, in relay order. @internal */
export type ResolvedGaslessBatchEntry = ResolvedGaslessInstantEntry | ResolvedGaslessWalletEntry;

function relayableTargetAddress(addresses: SymmioContractAddresses, target: GaslessRelayableTarget): Address {
  switch (target) {
    case "symmio":
      return addresses.symmioAddress;
    case "accountLayer":
      return addresses.accountLayerAddress;
    case "instantLayer":
      return addresses.instantLayerAddress;
  }
}

/**
 * Encode every batch entry and resolve each relayable write to its contract.
 *
 * Runs before any network call or signature prompt, so a malformed call, an
 * invalid wallet id or a write the relayer cannot carry fails up front.
 *
 * @param addresses - The chain's contract addresses.
 * @param calls - The batch, in relay order.
 * @returns The resolved entries, in the same order.
 * @throws {SymmError} `GASLESS_EMPTY_BATCH` for an empty batch.
 * @throws {SymmError} `GASLESS_NOT_RELAYABLE` for a call whose selector is not a relayable write.
 * @throws {SymmError} `GASLESS_WALLET_ID_INVALID` for a wallet id outside the `uint256` range.
 * @throws Viem's encoding error when an ABI-level call does not encode.
 *
 * @internal
 */
export function resolveGaslessBatchEntries(
  addresses: SymmioContractAddresses,
  calls: readonly GaslessBatchCall[],
): ResolvedGaslessBatchEntry[] {
  if (calls.length === 0) {
    throw new SymmError("validation", "GASLESS_EMPTY_BATCH", "Gasless: a batch needs at least one call.");
  }

  return calls.map((call, index): ResolvedGaslessBatchEntry => {
    if (isGaslessBatchWalletExecute(call)) {
      return {
        type: "wallet",
        walletId: assertGaslessWalletId(call.walletId ?? 0n, `calls[${index}].walletId`),
        callData: encodeFunctionData({
          abi: gaslessWalletAbi,
          functionName: "execute",
          args: [call.walletCalls.map(toWalletCallTuple)],
        }),
        walletCalls: call.walletCalls,
      };
    }

    const callData = gaslessBatchCallData(call);
    const selector = gaslessCallDataSelector(callData);
    const write = GASLESS_RELAYABLE_WRITES.get(selector);
    if (!write) {
      throw new SymmError(
        "validation",
        "GASLESS_NOT_RELAYABLE",
        `Gasless: calls[${index}] (selector ${selector}) is not a relayable write. A batch carries the writes in GASLESS_RELAYABLE_SELECTORS; run any other call from the GaslessWallet as a \`walletCalls\` entry.`,
      );
    }
    return {
      type: "instant",
      target: relayableTargetAddress(addresses, write.target),
      callData,
      selector,
      operationType: write.operationType,
    };
  });
}

/**
 * The label a batch relays under by default: its entries' labels joined with
 * `+` (`"approveOperationalFee+allocate"`), or `"gaslessBatch"` when that exceeds
 * the service's 128 characters.
 *
 * @internal
 */
export function defaultGaslessBatchOperationType(entries: readonly ResolvedGaslessBatchEntry[]): string {
  const label = entries
    .map((entry) => (entry.type === "wallet" ? GASLESS_WALLET_EXECUTE_OPERATION_TYPE : entry.operationType))
    .join("+");
  return label.length <= GASLESS_OPERATION_TYPE_MAX_LENGTH ? label : GASLESS_BATCH_OPERATION_TYPE;
}

/**
 * The distinct wallet ids a batch's GaslessWallet entries execute from, in first-seen order.
 *
 * @internal
 */
export function distinctGaslessBatchWalletIds(entries: readonly ResolvedGaslessBatchEntry[]): bigint[] {
  return [...new Set(entries.flatMap((entry) => (entry.type === "wallet" ? [entry.walletId] : [])))];
}

/**
 * Read the address of each wallet a batch executes from — the signed `target`
 * of its GaslessWallet entries.
 *
 * @param config - The SDK config.
 * @param parameters - The chain, the wallets' owner, and the distinct wallet ids.
 * @returns Each id's wallet address.
 *
 * @internal
 */
export async function readGaslessBatchWalletTargets(
  config: Config,
  parameters: { chainId: number; owner: Address; walletIds: readonly bigint[] },
): Promise<Map<bigint, Address>> {
  const { chainId, owner, walletIds } = parameters;
  const addresses = await Promise.all(
    walletIds.map((walletId) => getGaslessWalletAddress(config, { chainId, owner, walletId })),
  );
  return new Map(walletIds.map((walletId, index) => [walletId, addresses[index]!]));
}

/** Everything a batch's operations are built from, besides its entries. @internal */
export interface GaslessBatchBuildContext {
  /** The EIP-712 signer written into every operation. */
  signer: Address;
  /** The batch's account — every operation's `signerAccount.addr`. */
  account: Address;
  /** The signature deadline shared by every operation (unix seconds). */
  deadline: bigint;
  /** The InstantLayer nonce the account has consumed; the first relayable write signs `+ 1n`. */
  instantNonce: bigint;
  /** Each wallet id's address — the signed `target` of its entries. */
  walletTargets: ReadonlyMap<bigint, Address>;
  /** Each wallet id's consumed wallet-operation nonce; the first entry on it signs `+ 1n`. Omitted ids start at `0n`. */
  walletNonces: ReadonlyMap<bigint, bigint>;
  /** The replay salt of each operation, called once per operation in order. */
  salt: () => Hex;
}

/** A batch's operations, ready to sign. @internal */
export interface GaslessBatchOperations {
  /** One operation per entry, in relay order. */
  operations: SignedOperation[];
  /** One wallet id per operation — `0n` for every relayable write. */
  walletIds: bigint[];
  /** The highest InstantLayer nonce the batch signs, or `null` when it has no relayable write. */
  lastInstantNonce: bigint | null;
  /** The highest wallet-operation nonce the batch signs on each wallet id. */
  lastWalletNonces: Map<bigint, bigint>;
}

/**
 * Build a batch's operations with sequential nonces on each stream: the
 * relayable writes count up the account's InstantLayer stream, and each wallet
 * id's entries count up that wallet's own stream.
 *
 * Every operation is the full InstantLayer `SignedOperation` shape — a wallet
 * entry too, with no flex fields and `maxUses` 1, which is how the relay's ABI
 * and wire format carry it. Only its **signature** covers the five-field
 * gateway struct.
 *
 * @internal
 */
export function buildGaslessBatchOperations(
  entries: readonly ResolvedGaslessBatchEntry[],
  context: GaslessBatchBuildContext,
): GaslessBatchOperations {
  const operations: SignedOperation[] = [];
  const walletIds: bigint[] = [];
  let lastInstantNonce: bigint | null = null;
  const lastWalletNonces = new Map<bigint, bigint>();

  for (const entry of entries) {
    let target: Address;
    let nonce: bigint;
    if (entry.type === "instant") {
      target = entry.target;
      nonce = (lastInstantNonce ?? context.instantNonce) + 1n;
      lastInstantNonce = nonce;
      walletIds.push(0n);
    } else {
      const walletTarget = context.walletTargets.get(entry.walletId);
      if (walletTarget === undefined) {
        throw new Error(`gasless batch: no wallet address was resolved for wallet id ${entry.walletId}.`);
      }
      target = walletTarget;
      nonce = (lastWalletNonces.get(entry.walletId) ?? context.walletNonces.get(entry.walletId) ?? 0n) + 1n;
      lastWalletNonces.set(entry.walletId, nonce);
      walletIds.push(entry.walletId);
    }

    operations.push(
      buildSignedOperation({
        signer: context.signer,
        target,
        callData: entry.callData,
        signerAccount: context.account,
        deadline: context.deadline,
        nonce,
        salt: context.salt(),
      }),
    );
  }

  return { operations, walletIds, lastInstantNonce, lastWalletNonces };
}
