import type { TypedDataDomain } from "viem";
import type { Config } from "../core/config";
import { resolveGaslessService } from "./resolve-gasless";

/**
 * EIP-712 domain name of the GaslessLayer.
 *
 * Deliberately the literal `"GaslessGateway"`: the contract was renamed to
 * GaslessLayer, but the on-chain domain string was intentionally kept —
 * "fixing" this constant breaks every wallet-operation signature.
 */
export const GASLESS_GATEWAY_EIP712_DOMAIN_NAME = "GaslessGateway" as const;

/** EIP-712 domain version of the GaslessLayer. */
export const GASLESS_GATEWAY_EIP712_DOMAIN_VERSION = "1" as const;

/**
 * EIP-712 type table for a **gasless-wallet operation** — the gateway-domain
 * `SignedOperation`.
 *
 * NOT the InstantLayer table: this struct has **five** fields — no
 * `flexFields`, no `maxUses`. The relay transport still requires
 * `flexFields: []` and `maxUses: 1` in the JSON body, appended *after*
 * signing; including them in the signed struct produces a digest the gateway
 * rejects.
 */
export const GASLESS_WALLET_OPERATION_TYPES = {
  Account: [
    { name: "addr", type: "address" },
    { name: "isPartyB", type: "bool" },
  ],
  ReplayAttackHeader: [
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
    { name: "salt", type: "bytes32" },
  ],
  SignedOperation: [
    { name: "signer", type: "address" },
    { name: "target", type: "address" },
    { name: "callData", type: "bytes" },
    { name: "signerAccount", type: "Account" },
    { name: "replayAttackHeader", type: "ReplayAttackHeader" },
  ],
} as const;

/**
 * Build the GaslessLayer's EIP-712 domain for a chain.
 *
 * `verifyingContract` is the **GaslessLayer** address (from the chain's
 * `gasless` block) — while a wallet operation's `target` is the deterministic
 * gasless wallet. The two are easy to swap; swapping them yields
 * `InvalidWalletOperationTarget` from simulation.
 *
 * @param config - The SDK config.
 * @param options - Optional chain override.
 * @returns The typed-data domain for gateway-domain signatures.
 * @throws {SymmError} `GASLESS_NOT_CONFIGURED` / `GASLESS_UNSUPPORTED_CONTRACTS_VERSION`.
 *
 * @example
 * ```ts
 * const domain = getGaslessGatewayEip712Domain(config, { chainId });
 * ```
 */
export function getGaslessGatewayEip712Domain(config: Config, options: { chainId?: number } = {}): TypedDataDomain {
  const chain = config.getChainConfig(options.chainId);
  const gasless = resolveGaslessService(config, { chainId: options.chainId });
  return {
    name: GASLESS_GATEWAY_EIP712_DOMAIN_NAME,
    version: GASLESS_GATEWAY_EIP712_DOMAIN_VERSION,
    chainId: chain.chainId,
    verifyingContract: gasless.gaslessLayerAddress,
  };
}
