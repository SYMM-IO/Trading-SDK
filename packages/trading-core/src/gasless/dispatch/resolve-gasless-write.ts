import type { Hex } from "viem";
import type { Config } from "../../core/config";
import { SymmError } from "../../shared/errors/symm-error";
import type { GaslessWriteOptions, GaslessWriteParameter } from "../../shared/types/properties";
import { getVirtualAccount } from "../../symmio-contracts/account-layer/actions/get-virtual-account";
import { resolveGaslessIdempotencyKey } from "../idempotency-key";
import { GASLESS_RELAYABLE_WRITES } from "../relayable-writes";
import { resolveGaslessService, supportsGaslessService } from "../resolve-gasless";
import type { GaslessBillingAccount, GaslessDispatchCall, ResolvedGaslessWrite } from "./types";

/**
 * Normalize a write's `gasless` parameter and validate its caller-owned key.
 * Every path that could reach the wallet runs this first, so a bad key never
 * slips through on a write that turns out not to relay.
 *
 * @param raw - The write's `gasless` parameter, verbatim.
 * @returns The options bag, and whether it carries a caller-owned key.
 * @throws {SymmError} `GASLESS_IDEMPOTENCY_KEY_INVALID` for a blank or over-long key, or a key combined with
 *   `enabled: false` or `fallback: "wallet"`.
 *
 * @internal
 */
export function resolveGaslessWriteOptions(raw: GaslessWriteParameter["gasless"]): {
  options: GaslessWriteOptions;
  keyed: boolean;
} {
  const options = typeof raw === "boolean" ? { enabled: raw } : (raw ?? {});
  const keyed = options.idempotencyKey !== undefined;
  if (keyed) {
    resolveGaslessIdempotencyKey(options.idempotencyKey);
    if (options.enabled === false || options.fallback === "wallet") {
      throw new SymmError(
        "validation",
        "GASLESS_IDEMPOTENCY_KEY_INVALID",
        'Gasless: an idempotency key makes a write strictly gasless, so it cannot be combined with `enabled: false` or `fallback: "wallet"`. Drop the key to send the write through the wallet.',
      );
    }
  }
  return { options, keyed };
}

/**
 * Resolve execution policy and billing identity without resolving or prompting a wallet. Null selects wallet execution.
 *
 * A caller-owned `gasless.idempotencyKey` makes the write strictly gasless: it
 * never resolves to `null` and its fallback is always `"error"`, whatever the
 * chain's `execution` defaults say. A retry under that key must never reach the
 * wallet while an earlier attempt may still run.
 *
 * A `billingAccount` of `null` marks an action with no relay path. It follows
 * the rule for calldata the relay cannot carry: a keyed write, or an explicit
 * `enabled: true` without a wallet fallback, throws `GASLESS_NOT_RELAYABLE`;
 * anything else resolves to `null` and takes the wallet.
 *
 * @internal
 */
export async function resolveGaslessWrite(
  config: Config,
  parameters: GaslessWriteParameter & {
    chainId?: number;
    calls: readonly GaslessDispatchCall[];
    billingAccount: GaslessBillingAccount | null;
  },
): Promise<ResolvedGaslessWrite | null> {
  const { options, keyed } = resolveGaslessWriteOptions(parameters.gasless);
  const chainId = config.getChainConfig(parameters.chainId).chainId;
  /** A keyed write reports the precise configuration/version error instead of falling to the wallet. */
  const supported = keyed || supportsGaslessService(config, { chainId });
  const gasless = supported ? resolveGaslessService(config, { chainId }) : undefined;
  const execution = gasless?.execution ?? {};
  const enabled = keyed || (options.enabled ?? execution.mode === "gasless");
  if (!enabled) return null;
  if (!gasless) {
    // An explicit opt-in must report the precise configuration/version error.
    resolveGaslessService(config, { chainId });
    return null;
  }
  const fallback = keyed ? "error" : (options.fallback ?? execution.fallback ?? "error");
  const writes = parameters.calls.map((call) =>
    GASLESS_RELAYABLE_WRITES.get(call.callData.slice(0, 10).toLowerCase() as Hex),
  );
  const source = parameters.billingAccount;
  if (source === null || writes.some((write) => write === undefined)) {
    if (!keyed && (options.enabled !== true || fallback === "wallet")) return null;
    throw new SymmError(
      "validation",
      "GASLESS_NOT_RELAYABLE",
      source === null
        ? "Gasless: this write has no gasless relay path. Drop `gasless` to send it through the wallet."
        : "Gasless: this write's calldata is not relayable through the gasless service.",
    );
  }

  let account = options.account;
  if (!account && source.kind === "subaccount") account = source.account;
  if (!account && (source.kind === "virtual-account" || source.kind === "account-or-virtual-account")) {
    const detail = await getVirtualAccount(config, { chainId, account: source.account });
    if (!detail.isExists && source.kind === "virtual-account") {
      throw new SymmError(
        "validation",
        "GASLESS_ACCOUNT_UNRESOLVED",
        `Gasless: ${source.account} is not a known virtual account — pass \`gasless.account\` with the paying sub-account.`,
      );
    }
    account = detail.isExists ? detail.parentAccount : source.account;
  }
  if (!account) {
    throw new SymmError(
      "validation",
      "GASLESS_ACCOUNT_UNRESOLVED",
      "Gasless: no sub-account to relay under — pass `gasless.account`.",
    );
  }
  return {
    chainId,
    gasless,
    options,
    execution,
    fallback,
    account,
    operationType: writes[0]?.operationType ?? "gaslessWrite",
    calls: parameters.calls,
  };
}
