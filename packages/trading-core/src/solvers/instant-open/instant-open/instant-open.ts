import type { SymmioSolverKind } from "../../../core/chains/types";
import type { Config } from "../../../core/config";
import { SymmError } from "../../../shared/errors/symm-error";
import { buildQuoteMetadata } from "../shared/calldata";
import { getMarketOrderDeadline } from "../shared/trade-math";
import { submitEnigmaInstantOpen, submitRasaInstantOpen, type InstantOpenAdapterContext } from "./adapters";
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
 * - **Enigma (lowcap)** signs *two* operations — `addMarginToNextVA` on the
 *   AccountLayer plus `sendQuote` on the diamond — funding a fresh virtual
 *   account in the same batch. `margin.amount` is required. The quote carries a
 *   placeholder Muon signature whose byte range is delegated to the solver.
 * - **Rasa (majors)** signs *one* operation — `sendQuote` on the diamond, under
 *   the sub-account. It is cross-margin, so there is no virtual account, no
 *   `addMargin`, and no `margin` parameter. The quote carries a **live** Muon
 *   attestation fetched immediately before signing.
 *
 * Pass a literal `solverId` to narrow both the parameters and the return type to
 * one kind. Omit it and the chain's `defaultSolverId` decides at runtime — in
 * which case a missing `margin` on an Enigma chain throws
 * `INSTANT_OPEN_MARGIN_REQUIRED` rather than silently under-funding the trade.
 *
 * @param config - The SDK config.
 * @param parameters - Final-wei order, locked params, and the target sub-account.
 * @returns The hedger's acknowledgement, discriminated on `kind`.
 * @throws {SymmError} when the chain or solver is unsupported, or a kind's
 *   required inputs are missing.
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
  const chainConfig = config.getChainConfig(parameters.chainId);
  const solver = config.getSolver({ chainId: parameters.chainId, solverId: parameters.solverId });

  /** Resolved once: this can prompt the user, so it must not run per adapter. */
  const walletClient = await config.getWalletClient({ chainId: parameters.chainId, from: parameters.from });

  const context: InstantOpenAdapterContext = {
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

  switch (solver.id) {
    case "enigma":
      return (await submitEnigmaInstantOpen(context, parameters)) as InstantOpenReturnType<K>;
    case "rasa":
      return (await submitRasaInstantOpen(context, parameters)) as InstantOpenReturnType<K>;
    default: {
      /** A new solver kind fails to compile here until its adapter is wired in. */
      const unreachable: never = solver.id;
      throw new SymmError(
        "api",
        "UNSUPPORTED_BY_SOLVER",
        `instantOpen: solver kind "${String(unreachable)}" has no instant-open adapter.`,
      );
    }
  }
}
