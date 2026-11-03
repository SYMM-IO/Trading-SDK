import {
  encodeFunctionData,
  type Abi,
  type ContractFunctionArgs,
  type ContractFunctionName,
  type ContractFunctionParameters,
  type Hash,
} from "viem";
import type { Config } from "../core/config";
import type { GaslessWriteParameter, WriteContractParameter } from "../shared/types/properties";
import { shouldSimulateBeforeWrite } from "../shared/utils/simulate-before-write";
import { executeWrite, type WriteExecutionCapabilities } from "./execute-write";

/** Execute a direct nonpayable contract write from one ABI-typed definition shared by simulation, wallet and relay. @internal */
export function executeContractWrite<
  const abi extends Abi,
  functionName extends ContractFunctionName<abi, "nonpayable">,
  const args extends ContractFunctionArgs<abi, "nonpayable", functionName>,
>(
  config: Config,
  parameters: WriteContractParameter & GaslessWriteParameter,
  definition: WriteExecutionCapabilities & {
    contract: ContractFunctionParameters<abi, "nonpayable", functionName, args>;
  },
): Promise<Hash>;
// The overload validates each literal ABI/function/args tuple at the action.
// Execution keeps that same definition; it never selects or substitutes an ABI.
export async function executeContractWrite(
  config: Config,
  parameters: WriteContractParameter & GaslessWriteParameter,
  definition: WriteExecutionCapabilities & { contract: ContractFunctionParameters<Abi, "nonpayable"> },
): Promise<Hash> {
  const chainId = config.getChainConfig(parameters.chainId).chainId;
  const { contract } = definition;
  const calls = [{ target: contract.address, callData: encodeFunctionData(contract) }];

  return executeWrite(
    config,
    { ...parameters, chainId },
    {
      relay: definition.relay,
      calls,
      submitWallet: async (from) => {
        const wallet = await config.getWalletClient({ chainId, from });
        if (shouldSimulateBeforeWrite(config, parameters)) {
          await config.getClient({ chainId }).simulateContract({ ...contract, account: wallet.account.address });
        }
        return wallet.writeContract({ ...contract, account: wallet.account, chain: wallet.chain });
      },
    },
  );
}
