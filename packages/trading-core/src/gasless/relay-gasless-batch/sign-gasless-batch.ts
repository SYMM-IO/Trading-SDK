import type { Hex, TypedDataDomain } from "viem";
import type { Config, SymmioWalletClient } from "../../core/config";
import { getInstantLayerEip712Domain, signSignedOperation } from "../../solvers/instant-open/shared/eip712";
import type { SignedOperation } from "../../solvers/instant-open/shared/types";
import type { ResolvedGaslessBatchEntry } from "../batch/resolve-gasless-batch";
import { GASLESS_WALLET_OPERATION_TYPES, getGaslessGatewayEip712Domain } from "../eip712";

/** Input of {@link signGaslessBatchOperations}. @internal */
export interface SignGaslessBatchOperationsParameters {
  /** The chain the batch relays on. */
  chainId: number;
  /** The wallet client that signs every operation. */
  walletClient: SymmioWalletClient;
  /** The resolved entries, in relay order — they decide each operation's signing domain. */
  entries: readonly ResolvedGaslessBatchEntry[];
  /** The operations to sign, aligned with `entries`. */
  operations: readonly SignedOperation[];
}

/**
 * Sign every operation of a batch, one EIP-712 prompt each, in relay order.
 *
 * The protocol has no batch signature: the InstantLayer verifies each
 * operation's signature against that operation alone. Two domains are in play:
 *
 * - a relayable write signs the InstantLayer's seven-field `SignedOperation`
 *   under the `SymmioInstantLayer` domain;
 * - a GaslessWallet entry signs the **five-field** gateway struct (no
 *   `flexFields`, no `maxUses`) under the `GaslessGateway` domain, whose
 *   verifying contract is the GaslessLayer.
 *
 * The prompts run one after the other, so a rejected prompt stops the batch
 * before anything is submitted.
 *
 * @returns One signature per operation, aligned with `operations`.
 *
 * @internal
 */
export async function signGaslessBatchOperations(
  config: Config,
  parameters: SignGaslessBatchOperationsParameters,
): Promise<Hex[]> {
  const { chainId, walletClient, entries, operations } = parameters;
  let instantDomain: TypedDataDomain | undefined;
  let gatewayDomain: TypedDataDomain | undefined;

  const signatures: Hex[] = [];
  for (const [index, operation] of operations.entries()) {
    if (entries[index]?.type === "wallet") {
      gatewayDomain ??= getGaslessGatewayEip712Domain(config, { chainId });
      signatures.push(
        await walletClient.signTypedData({
          account: walletClient.account,
          domain: gatewayDomain,
          types: GASLESS_WALLET_OPERATION_TYPES,
          primaryType: "SignedOperation",
          message: {
            signer: operation.signer,
            target: operation.target,
            callData: operation.callData,
            signerAccount: operation.signerAccount,
            replayAttackHeader: operation.replayAttackHeader,
          },
        }),
      );
    } else {
      instantDomain ??= getInstantLayerEip712Domain(config, { chainId });
      signatures.push(await signSignedOperation(operation, instantDomain, walletClient));
    }
  }
  return signatures;
}
