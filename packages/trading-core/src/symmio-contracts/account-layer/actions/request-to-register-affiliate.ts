import type { Hash } from "viem";
import type { Config } from "../../../core/config";
import type { Compute, WriteContractParameter } from "../../../shared/types/properties";
import { shouldSimulateBeforeWrite } from "../../../shared/utils/simulate-before-write";
import { accountLayerAbi } from "../../abi/v0.8.6/account-layer";
import type { AffiliateRegistration } from "../types";
import { simulateRequestToRegisterAffiliate } from "./simulate-request-to-register-affiliate";

/**
 * Parameters for {@link requestToRegisterAffiliate}.
 */
export type RequestToRegisterAffiliateParameters = Compute<
  WriteContractParameter & {
    /**
     * The full `AffiliateRegistration` tuple. Its `stakeholders` shares plus
     * `symmioShare` must sum to exactly `1e18`, `admin` must be non-zero, and
     * every entry in `symmioCores` must be a whitelisted core, or the contract
     * reverts.
     */
    registration: AffiliateRegistration;
  }
>;

/** Return type of {@link requestToRegisterAffiliate}: the submitted transaction hash. */
export type RequestToRegisterAffiliateReturnType = Hash;

/**
 * Send the permissionless on-chain request to register a new affiliate.
 *
 * Resolves the bound wallet client and `AccountLayer` address from `config`. The
 * request is permissionless — anyone may submit it — and creates a `PENDING`
 * affiliate keyed to a deterministic `AccountManager` address derived from the
 * caller and `registration.name`. An `APPROVER_ROLE` holder must then approve it
 * before it becomes `ACTIVE`.
 *
 * Dry-runs the call with {@link simulateRequestToRegisterAffiliate} first unless
 * `simulateBeforeWrite` is `false` (per-call, falling back to the config default).
 *
 * @param config - The SDK config (must have a `getWalletClient` resolver).
 * @param parameters - The registration tuple, optional chain id / simulate opt-out.
 * @returns The submitted transaction hash. A write cannot return the contract's
 *   `affiliateAddress`; derive it deterministically with
 *   {@link generateAccountManagerAddress} instead.
 * @throws {SymmError} when the chain is unsupported or no wallet is available.
 * @throws Viem's write errors (`ContractFunctionExecutionError`, ...).
 *
 * @example
 * ```ts
 * const hash = await requestToRegisterAffiliate(config, {
 *   registration: {
 *     name: "Acme",
 *     brandColor: "#ff5c39",
 *     admin: "0xadmin…",
 *     stakeholders: [{ receiver: "0xadmin…", share: 900000000000000000n }], // 0.9e18
 *     symmioShare: 100000000000000000n, // 0.1e18 — sums to 1e18
 *     metadata: "0x",
 *     legacyMultiAccounts: [],
 *     symmioCores: ["0xcore…"],
 *   },
 * });
 * ```
 */
export async function requestToRegisterAffiliate(
  config: Config,
  parameters: RequestToRegisterAffiliateParameters,
): Promise<RequestToRegisterAffiliateReturnType> {
  const { chainId, registration, from } = parameters;

  const { addresses } = config.getChainConfig(chainId);
  const walletClient = await config.getWalletClient({ chainId, from });

  if (shouldSimulateBeforeWrite(config, parameters)) {
    await simulateRequestToRegisterAffiliate(config, { chainId, registration, from: walletClient.account.address });
  }

  return walletClient.writeContract({
    address: addresses.accountLayerAddress,
    abi: accountLayerAbi,
    functionName: "requestToRegisterAffiliate",
    args: [registration],
    account: walletClient.account,
    chain: walletClient.chain,
  });
}
