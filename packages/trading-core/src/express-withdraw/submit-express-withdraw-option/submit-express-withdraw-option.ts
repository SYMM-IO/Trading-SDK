import type { Hash } from "viem";
import type { Config } from "../../core/config";
import { initiateWithdraw } from "../../symmio-contracts/symmio";
import { resolveExpressWithdrawService } from "../resolve-express-withdraw";
import type { SubmitExpressWithdrawOptionParameters } from "../types";
import { validateExpressWithdrawOption } from "../validate-express-withdraw-option";

/**
 * Validate and submit one signed Express Withdraw option.
 *
 * @param config - SDK configuration with a wallet resolver.
 * @param parameters - Original intent, signed option, and write overrides.
 * @returns Submitted transaction hash.
 */
export async function submitExpressWithdrawOption(
  config: Config,
  parameters: SubmitExpressWithdrawOptionParameters,
): Promise<Hash> {
  const chainId = parameters.chainId ?? config.defaultChainId;
  const service = resolveExpressWithdrawService(config, { chainId });

  validateExpressWithdrawOption({
    option: parameters.option,
    amount: parameters.amount,
    receiver: parameters.receiver,
    providerAddress: service.providerAddress,
    chainId,
  });

  return initiateWithdraw(config, {
    account: parameters.account,
    parts: parameters.option.parts,
    speedUp: false,
    providerData: parameters.option.providerData,
    chainId,
    from: parameters.from,
    simulateBeforeWrite: parameters.simulateBeforeWrite,
    gasless: parameters.gasless,
  });
}
