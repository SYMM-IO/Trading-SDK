import type { SolverId } from "../../../../core/chains/types";
import type { InstantOperationPayload } from "../../shared/types";

/** JSON-serializable signed request. Persist before transport; never rebuild on an ambiguous result. Currently Enigma only. */
export interface PreparedInstantOpen {
  kind: "enigma";
  chainId: number;
  deploymentKey: string;
  solverId: SolverId;
  request: { sendQuote: InstantOperationPayload; addMargin?: InstantOperationPayload };
  /** Whether preparation used the deployment's mandatory margin timelock. */
  timelock: boolean;
}

/** Exact prepared request to submit. Reconciliation/duplicate detection remains consumer-owned. */
export interface SubmitPreparedInstantOpenParameters {
  prepared: PreparedInstantOpen;
}
