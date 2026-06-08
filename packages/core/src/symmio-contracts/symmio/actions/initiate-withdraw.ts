import { encodeFunctionData, type Address, type Hash, type Hex } from "viem";
import type { Config } from "../../../core/config";
import type { ChainIdParameter, Compute, SimulateBeforeWriteParameter } from "../../../shared/types/properties";
import { symmioAbi } from "../../abi/v0.8.5/symmio";
import { callAsSubAccount } from "../internal/call-as-sub-account";
import type { WithdrawReceiverPart } from "../types";

/**
 * Parameters for {@link initiateWithdraw}.
 */
export type InitiateWithdrawParameters = Compute<
  ChainIdParameter &
    SimulateBeforeWriteParameter & {
      /**
       * The subaccount initiating the withdrawal. The call is routed through the
       * AccountLayer `_call` proxy so the core sees this subaccount as the caller;
       * the connected wallet must be its on-chain `owner`.
       */
      account: Address;
      /**
       * The receiver parts the withdrawal is split into. A plain same-chain
       * withdrawal is a single part with both provider fields set to the zero
       * address — see `createClassicWithdrawPart`.
       */
      parts: readonly WithdrawReceiverPart[];
      /**
       * Opt into the cooldown speed-up flow. Only effective for speed-up-eligible
       * users; ignored otherwise.
       * @default false
       */
      speedUp?: boolean;
      /**
       * Opaque provider data forwarded to express/virtual providers (e.g. a signed
       * option). Pass `0x` for a classic withdrawal.
       * @default "0x"
       */
      providerData?: Hex;
    }
>;

/** Return type of {@link initiateWithdraw}: the submitted transaction hash. */
export type InitiateWithdrawReturnType = Hash;

/**
 * Open a withdraw request for a subaccount.
 *
 * Encodes the SYMMIO core `initiateWithdraw(parts, speedUp, data)` call and routes
 * it through `AccountLayer._call(account, …)` so the core attributes the request
 * to `account`. The request matures after the cooldown (tied to the subaccount's
 * last deallocation) and is then completed with {@link finalizeWithdrawRequest}.
 *
 * Dry-runs the call with {@link simulateInitiateWithdraw} first unless
 * `simulateBeforeWrite` is `false` (per-call, falling back to the config default).
 *
 * @remarks
 * The full input surface is exposed: provider fields on each part plus `speedUp`
 * and `providerData` enable express/virtual/cross-chain withdrawals where
 * providers are available. For a standard same-chain withdrawal, pass a single
 * classic part and leave `speedUp`/`providerData` at their defaults.
 *
 * @param config - The SDK config (must have a `getWalletClient` resolver).
 * @param parameters - Subaccount, receiver parts, optional speed-up / provider data, optional chain id.
 * @returns The submitted transaction hash. The caller waits on the receipt; the
 *   created `requestId` is available from the receipt's events or via
 *   `getLastWithdrawRequestId`.
 * @throws {SymmError} when the chain is unsupported or no wallet is available.
 * @throws Viem's write errors (`ContractFunctionExecutionError`, ...).
 *
 * @example
 * ```ts
 * const part = createClassicWithdrawPart({ id: 0n, amount: 1_000000n, receiver: "0xabc…", chainId: 999n });
 * const hash = await initiateWithdraw(config, { account: "0xsub…", parts: [part] });
 * ```
 */
export async function initiateWithdraw(
  config: Config,
  parameters: InitiateWithdrawParameters,
): Promise<InitiateWithdrawReturnType> {
  const { chainId, account, parts, speedUp = false, providerData = "0x" } = parameters;

  const data = encodeFunctionData({
    abi: symmioAbi,
    functionName: "initiateWithdraw",
    args: [parts, speedUp, providerData],
  });

  return callAsSubAccount(config, {
    account,
    data,
    chainId,
    simulateBeforeWrite: parameters.simulateBeforeWrite,
  });
}
