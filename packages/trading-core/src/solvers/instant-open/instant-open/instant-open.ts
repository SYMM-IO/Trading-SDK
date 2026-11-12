import type { SymmioSolverKind } from "../../../core/chains/types";
import type { Config } from "../../../core/config";
import { SymmError } from "../../../shared/errors/symm-error";
import { buildQuoteMetadata } from "../shared/calldata";
import { getMarketOrderDeadline } from "../shared/trade-math";
import {
  prepareEnigmaInstantOpen,
  submitEnigmaInstantOpen,
  submitRasaInstantOpen,
  type InstantOpenAdapterContext,
} from "./adapters";
import type { PreparedInstantOpen } from "./prepared/types";
import type { InstantOpenParameters, InstantOpenReturnType } from "./types";

/**
 * Open an instant position through the solver's InstantLayer v2 flow.
 *
 * Pure primitive — every domain value is already final wei. It builds calldata,
 * signs the operations, and submits them. It does no math and no market
 * fetching; use `prepareInstantOpenParams` to derive this shape from UI inputs,
 * or `instantOpenAuto` for the combined convenience.
 *
 * **The two solver kinds open positions differently, and this dispatches on that:**
 *
 * - **Enigma (lowcap)** signs `sendQuote` and, when margin is requested, an
 *   `addMarginToNextVA` operation on the AccountLayer. The quote carries a
 *   placeholder Muon signature whose byte range is delegated to the solver.
 * - **Rasa (majors)** signs *one* operation — `sendQuote` on the diamond, under
 *   the sub-account. It is cross-margin, so there is no virtual account, no
 *   `addMargin`, and no `margin` parameter. The quote carries a **live** Muon
 *   attestation fetched immediately before signing.
 *
 * Pass a literal `solverId` to narrow both the parameters and the return type to
 * one kind. Omit it and the chain's `defaultSolverId` decides at runtime.
 *
 * Before signing, it checks that the signer holds the InstantLayer delegation
 * for every operation it is about to sign (skip it with
 * `preflightDelegation: false`). The sub-account's owner needs none.
 * On Enigma v0.8.6 deployments, it also reads `/info`. A solver advertising
 * timelock approvals requires the configured account policy and receives an
 * `executeTimelockOp` margin wrapper with only 65 approval-signature bytes
 * fillable by the solver. This policy check is not skipped by delegation options.
 *
 * @param config - The SDK config.
 * @param parameters - Final-wei order, locked params, and the target sub-account.
 * @returns The hedger's acknowledgement, discriminated on `kind`.
 * @throws {SymmError} when the chain or solver is unsupported, or a kind's
 *   required inputs are missing.
 * @throws {SymmError} `INSTANT_SIGNER_NOT_DELEGATED` when the signer lacks the
 *   delegation, before anything is signed.
 * @throws {SymmError} `INSTANT_OPEN_TIMELOCK_POLICY_REQUIRED` when the account's
 *   selector timelocks do not satisfy the advertised solver policy. No policy is changed.
 * @throws {SymmError} `INVALID_INSTANT_OPEN_TIMELOCK_METADATA` for malformed or
 *   foreign-domain metadata, or `FETCH_INSTANT_OPEN_TIMELOCK_METADATA_FAILED` when it cannot be read.
 * @throws {SymmError} `INSTANT_OPEN_TIMELOCK_APPROVAL_EXPIRED` when signing leaves
 *   less than 30 seconds on the approval; no open is submitted.
 * @throws {SymmApiError} when the hedger request fails.
 *
 * @example
 * ```ts
 * // Rasa (majors) — one operation, live Muon sig, no margin.
 * const { tempQuoteId, rfq } = await instantOpen(config, {
 *   solverId: "rasa",
 *   subAccountAddress,
 *   marketId: 1,
 *   positionType: PositionType.LONG,
 *   order: { price: 50_000000000000000000n, quantity: 1_000000000000000000n },
 *   lockedParam: { cva: 1_000000000000000000n, lf: 500000000000000000n, partyAmm: 1_500000000000000000n, partyBmm: 1_500000000000000000n },
 * });
 * ```
 */
export async function instantOpen<K extends SymmioSolverKind = SymmioSolverKind>(
  config: Config,
  parameters: InstantOpenParameters<K>,
): Promise<InstantOpenReturnType<K>> {
  const context = await resolveContext(config, parameters);
  const { solver } = context;

  switch (solver.id) {
    case "enigma":
      return (await submitEnigmaInstantOpen(context, parameters)) as InstantOpenReturnType<K>;
    case "rasa":
      return (await submitRasaInstantOpen(context, parameters)) as InstantOpenReturnType<K>;
    default: {
      const unreachable: never = solver.id;
      throw new SymmError("api", "UNSUPPORTED_BY_SOLVER", `instantOpen: unsupported solver ${String(unreachable)}.`);
    }
  }
}

/**
 * Prepare an immutable instant-open payload without making a submission request.
 * @param config - Selected deployment and wallet configuration.
 * @param parameters - The same raw-unit inputs as instantOpen. Currently supports Enigma; other adapters fail before signing.
 * @returns JSON-serializable signed payload to persist before submitPreparedInstantOpen.
 * @example const prepared = await prepareInstantOpen(config, inputs);
 */
export async function prepareInstantOpen(
  config: Config,
  parameters: InstantOpenParameters,
): Promise<PreparedInstantOpen> {
  if (config.getSolver(parameters).id !== "enigma")
    throw new SymmError(
      "config",
      "UNSUPPORTED_BY_SOLVER",
      "This solver does not yet expose a prepared instant-open adapter.",
    );
  return prepareEnigmaInstantOpen(await resolveContext(config, parameters), parameters);
}

async function resolveContext(config: Config, parameters: InstantOpenParameters): Promise<InstantOpenAdapterContext> {
  const chainConfig = config.getChainConfig(parameters.chainId);
  const solver = config.getSolver({ chainId: parameters.chainId, solverId: parameters.solverId });

  /** Resolved once: this can prompt the user, so it must not run per adapter. */
  const walletClient = await config.getWalletClient({ chainId: parameters.chainId, from: parameters.from });

  return {
    config,
    solver,
    chainConfig,
    walletClient,
    signerAddress: walletClient.account.address,
    chainId: parameters.chainId,
    deadline: parameters.deadline ?? getMarketOrderDeadline(),
    symbolId: BigInt(parameters.marketId),
    metadata: buildQuoteMetadata(parameters.uuid ?? globalThis.crypto.randomUUID()),
  };
}
