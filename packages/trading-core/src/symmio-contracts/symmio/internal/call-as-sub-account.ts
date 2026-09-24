import { isAddressEqual, type Address, type Hash, type Hex } from "viem";
import type { Config } from "../../../core/config";
import { maybeRelayAsGasless } from "../../../gasless/dispatch/maybe-relay-as-gasless";
import { SymmError } from "../../../shared/errors/symm-error";
import type { GaslessWriteParameter } from "../../../shared/types/properties";
import { shouldSimulateBeforeWrite } from "../../../shared/utils/simulate-before-write";
import { accountLayerAbi } from "../../abi/v0.8.6/account-layer";
import { getSubAccount } from "../../account-layer/actions/get-sub-account";
import { simulateCallAsSubAccount } from "./simulate-call-as-sub-account";

/**
 * Execute pre-encoded SYMMIO-core calldata **as a subaccount**, by routing it
 * through the AccountLayer's `_call(account, callDatas[])` proxy.
 *
 * Internal helper for withdraw writes whose underlying core function takes the
 * caller (the subaccount) as the implicit `msg.sender` — `initiateWithdraw`,
 * `requestCancelWithdraw` — and therefore cannot be sent to the core directly by
 * the owner EOA.
 *
 * `data` may be a single calldata or an **array**. An array batches several core
 * calls into one `_call(account, callDatas[])`, which runs them in order in a
 * single transaction and reverts the whole transaction if any inner call reverts.
 *
 * @remarks
 * When the resolved `simulateBeforeWrite` is `true`, the routed `_call` is
 * dry-run via {@link simulateCallAsSubAccount} first; if it would revert the
 * decoded error is thrown and nothing is signed or broadcast.
 *
 * @param config - The SDK config (must have a `getWalletClient` resolver).
 * @param parameters - Subaccount address, the encoded core calldata (a single
 *   `Hex`, or an array of `Hex` to batch several core calls into one atomic
 *   `_call`), optional chain id, optional pre-flight opt-out.
 * @returns The submitted transaction hash.
 * @throws {SymmError} when the chain is unsupported or no wallet is available.
 */
export async function callAsSubAccount(
  config: Config,
  parameters: {
    account: Address;
    data: Hex | readonly Hex[];
    chainId?: number;
    from?: Address;
    simulateBeforeWrite?: boolean;
  } & GaslessWriteParameter,
): Promise<Hash> {
  const { account, data, chainId, from } = parameters;
  const callDatas = typeof data === "string" ? [data] : data;

  const { addresses } = config.getChainConfig(chainId);

  /**
   * Transparent gasless seam: when the gasless execution mode applies, the
   * same core calldata is signed as InstantLayer operations (signerAccount =
   * this sub-account, preserving the `_call` batch's atomicity) and relayed;
   * the relayer's broadcast hash is returned in place of a wallet submission.
   * `null` means: proceed on the wallet path below, unchanged.
   */
  const relayed = await maybeRelayAsGasless(config, {
    chainId,
    from,
    gasless: parameters.gasless,
    signerAccount: account,
    calls: callDatas.map((callData) => ({ target: addresses.symmioAddress, callData })),
  });
  if (relayed !== null) return relayed;

  const walletClient = await config.getWalletClient({ chainId, from });

  await assertWalletPathSigner(config, {
    account,
    chainId,
    from,
    signer: walletClient.account.address,
  });

  if (shouldSimulateBeforeWrite(config, parameters)) {
    await simulateCallAsSubAccount(config, { account, data, chainId, from: walletClient.account.address });
  }

  return walletClient.writeContract({
    address: addresses.accountLayerAddress,
    abi: accountLayerAbi,
    functionName: "_call",
    args: [account, callDatas],
    account: walletClient.account,
    chain: walletClient.chain,
  });
}

/**
 * Reject the ordinary gas-paid wallet path when the resolved signer is not the
 * sub-account's owner — in practice, a session key.
 *
 * `AccountLayer._call` is `onlyAccountOwner` and reverts `NotOwner` for anybody
 * else, and a session key holds no native gas to pay for the attempt anyway. So
 * a session key reaching this point can only produce a confusing on-chain
 * failure: it is authorized through the InstantLayer delegation (the gasless
 * relay), never through a direct wallet submission. The guard lives at the write
 * seam rather than inside the gasless fallback branch because the same thing
 * happens when a caller passes `from: sessionKeyAddress` with gasless simply off.
 *
 * @remarks
 * **Why the check is keyed on `from` being supplied.** Comparing `from` against
 * the resolved wallet's own address would catch nothing: `getWalletClient({ from })`
 * returns a client whose account *is* `from`, so the two are equal by
 * construction. The meaningful signal is whether the caller steered the signer at
 * all. With `from` omitted the SDK uses the app's connected account, which is the
 * owner on the ordinary path; a session key can only enter the SDK through an
 * explicit `from`. Keying on `from !== undefined` therefore costs **zero extra
 * RPC** on the ordinary owner path and reads the owner only for the calls that
 * could plausibly be signing with something else.
 *
 * @param config - The SDK config.
 * @param parameters - The sub-account, the chain, the caller's `from` (if any),
 *   and the address the wallet client actually resolved to.
 * @throws {SymmError} `validation` / `WALLET_PATH_REQUIRES_OWNER` when `from` was
 *   supplied and the resolved signer is not the sub-account's owner.
 */
async function assertWalletPathSigner(
  config: Config,
  parameters: {
    account: Address;
    chainId?: number;
    from?: Address;
    signer: Address;
  },
): Promise<void> {
  const { account, chainId, from, signer } = parameters;
  if (from === undefined) return;

  /**
   * TODO(session-key): replace this uncached `getSubAccount` read with the
   * shared owner accessor once it is lifted into
   * `symmio-contracts/account-layer/actions/get-account-owner`. The gasless
   * dispatcher already owns an equivalent cache — `getCachedAccountOwner`, still
   * private to `gasless/dispatch/maybe-relay-as-gasless.ts` — and this guard must
   * reuse that one helper rather than start a competing cache here.
   */
  const detail = await getSubAccount(config, { chainId, account });
  /**
   * An address the AccountLayer does not know as a sub-account (a virtual
   * account, for one) has no `owner` to compare against — `getSubAccount`
   * returns the zero address for it. Leave those writes to the contract's own
   * `onlyAccountOwner` guard rather than blocking them on a false negative.
   */
  if (!detail.isExists) return;
  if (isAddressEqual(detail.owner, signer)) return;

  throw new SymmError(
    "validation",
    "WALLET_PATH_REQUIRES_OWNER",
    `The wallet path for sub-account ${account} requires its owner (${detail.owner}) to sign, but the resolved signer is ${signer}. AccountLayer._call is onlyAccountOwner and would revert NotOwner. This signer can only act on the sub-account through the gasless relay (an InstantLayer delegation), so enable gasless execution for this write instead of falling back to the wallet.`,
  );
}
