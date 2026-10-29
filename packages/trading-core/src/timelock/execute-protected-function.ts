import {
  encodeFunctionData,
  isAddress,
  isAddressEqual,
  type Abi,
  type Address,
  type ContractFunctionArgs,
  type Hash,
  type Hex,
} from "viem";
import type { Config } from "../core/config";
import { SymmError } from "../shared/errors/symm-error";
import type { GaslessWriteParameter, WriteContractParameter } from "../shared/types/properties";
import { accountLayerAbi } from "../symmio-contracts/abi/v0.8.6/account-layer";
import { symmioAbi } from "../symmio-contracts/abi/v0.8.6/symmio";
import { executeProtectedCall, type TimelockAuthorization } from "./execute-protected-call";
import { INSTANT_OPEN_TIMELOCK_ACCOUNT_LAYER_FUNCTIONS, INSTANT_OPEN_TIMELOCK_CORE_FUNCTIONS } from "./policy";

type CoreFunction = (typeof INSTANT_OPEN_TIMELOCK_CORE_FUNCTIONS)[number];
type AccountLayerFunction = (typeof INSTANT_OPEN_TIMELOCK_ACCOUNT_LAYER_FUNCTIONS)[number];
type CoreCall = {
  [Name in CoreFunction]: {
    target: "core";
    functionName: Name;
    args: ContractFunctionArgs<typeof symmioAbi, "nonpayable" | "payable", Name>;
  };
}[CoreFunction];
type AccountLayerCall = {
  [Name in AccountLayerFunction]: {
    target: "account-layer";
    functionName: Name;
    args: ContractFunctionArgs<typeof accountLayerAbi, "nonpayable" | "payable", Name>;
  };
}[AccountLayerFunction];

/** Function and ABI-typed arguments for any documented protected operation. */
export type ProtectedFunctionCall = CoreCall | AccountLayerCall;

/** One of the documented protected functions, with ABI-typed arguments and explicit authorization. */
export type ExecuteProtectedFunctionParameters = ProtectedFunctionCall &
  WriteContractParameter &
  GaslessWriteParameter & {
    account: Address;
    timelock: TimelockAuthorization;
  };

/**
 * Encode one documented protected function using its ABI.
 * @param parameters - Function target, name and ABI-typed arguments.
 * @returns Raw function calldata suitable for approval and execution.
 */
export function encodeProtectedFunction(parameters: ProtectedFunctionCall): Hex {
  const functions: readonly string[] =
    parameters.target === "core" ? INSTANT_OPEN_TIMELOCK_CORE_FUNCTIONS : INSTANT_OPEN_TIMELOCK_ACCOUNT_LAYER_FUNCTIONS;
  if (!functions.includes(parameters.functionName))
    throw new SymmError("validation", "TIMELOCK_FUNCTION_UNSUPPORTED", "This function is not in the timelock policy.");
  const abi = parameters.target === "core" ? symmioAbi : accountLayerAbi;
  return encodeFunctionData({
    abi: abi as Abi,
    functionName: parameters.functionName,
    args: parameters.args,
  });
}

/**
 * Execute a documented protected function with explicit authorization.
 * @param config - SDK configuration and clients.
 * @param parameters - Function, ABI arguments, original account and timelock authorization.
 * @returns Transaction hash; execution is confirmed by its receipt.
 */
export async function executeProtectedFunction(
  config: Config,
  parameters: ExecuteProtectedFunctionParameters,
): Promise<Hash> {
  const callData = encodeProtectedFunction(parameters);
  if (parameters.target === "account-layer") {
    const target = parameters.args[0];
    if (typeof target !== "string" || !isAddress(target) || !isAddressEqual(target, parameters.account))
      throw new SymmError(
        "validation",
        "TIMELOCK_ACCOUNT_MISMATCH",
        "The AccountLayer call must target the original account.",
      );
  }
  return executeProtectedCall(config, { ...parameters, callData });
}

/** Mutation options for an explicit one-attempt protected function execution. */
export function executeProtectedFunctionMutationOptions(config: Config) {
  return {
    mutationKey: ["executeProtectedFunction"] as const,
    retry: false as const,
    mutationFn: (parameters: ExecuteProtectedFunctionParameters) => executeProtectedFunction(config, parameters),
  };
}
