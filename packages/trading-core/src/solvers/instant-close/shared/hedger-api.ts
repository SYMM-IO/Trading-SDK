import type { Config } from "../../../core/config";
import { SymmError } from "../../../shared/errors/symm-error";
import type { Compute, ReadSolverParameter } from "../../../shared/types/properties";
import type { ApiV2InstantCloseRequest } from "../../types/generated/enigma-solver";
import { sendEnigmaInstantClose, sendRasaInstantClose } from "./adapters";

/**
 * Parameters for {@link sendInstantClose}.
 *
 * `operations` is the raw `ApiV2InstantCloseRequest.operations` array — one
 * entry per quote being closed. Both endpoints accept 1–100; the single-close
 * primitive sends `[op]` and the bulk primitive sends the full batch, so the
 * shared API stays array-shaped.
 */
export type SendInstantCloseParameters = Compute<
  ReadSolverParameter & {
    /** Pre-signed `requestToClosePosition` payloads (1–100). */
    operations: ApiV2InstantCloseRequest["operations"];
  }
>;

/**
 * Result of {@link sendInstantClose}. The hedger endpoints report success via
 * an empty body (Enigma) or a `{ successful: true }` status (Rasa), so this is
 * a normalized success ack either way.
 */
export interface SendInstantCloseReturnType {
  success: true;
}

/**
 * Submit a v2 instant close request to the chain's hedger, dispatched on the
 * resolved solver kind. The calldata and EIP-712 signing are identical across
 * kinds — only the endpoint and response shape differ — so each kind's fetch
 * story lives in its own adapter (`./adapters`) and this is a thin dispatcher:
 *
 * - **Enigma (lowcap)** → {@link sendEnigmaInstantClose} (`/instant_trade/instant_close`).
 * - **Rasa (majors)** → {@link sendRasaInstantClose} (`/instant_trade/close`).
 *
 * @throws {SymmApiError} when the hedger request fails or Rasa reports
 *   `successful: false`.
 * @throws {SymmError} when the chain or solver is unsupported.
 */
export async function sendInstantClose(
  config: Config,
  parameters: SendInstantCloseParameters,
): Promise<SendInstantCloseReturnType> {
  const solver = config.getSolver({ chainId: parameters.chainId, solverId: parameters.solverId });
  switch (solver.id) {
    case "enigma":
      return sendEnigmaInstantClose(solver.url, parameters.operations);
    case "rasa":
      return sendRasaInstantClose(solver.url, parameters.operations);
    default: {
      /** A new solver kind fails to compile here until its close adapter is wired in. */
      const unreachable: never = solver.id;
      throw new SymmError(
        "api",
        "UNSUPPORTED_BY_SOLVER",
        `sendInstantClose: solver kind "${String(unreachable)}" has no instant-close adapter.`,
      );
    }
  }
}
