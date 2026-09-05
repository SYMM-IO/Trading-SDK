import type { SolverId } from "../../../../core/chains/types";
import type { Config } from "../../../../core/config";
import { getLockedParams } from "../../../locked-params/get-locked-params";
import type { ApiLockedParamsBySymbolIdResponse } from "../../../types/generated/enigma-solver";
import type { ResolvedLockedParams } from "./types";

/**
 * Parameters for {@link resolveLockedParams}.
 */
export interface ResolveLockedParamsParameters {
  chainId?: number;
  /**
   * Solver whose locked params to read. **Must match the solver the trade is
   * sent to** — `cva` / `lf` / `partyAmm` / `partyBmm` are encoded into the
   * signed quote. Defaults to the chain's `defaultSolverId`.
   */
  solverId?: SolverId;
  marketName: string;
  leverage: number;
  /**
   * Pre-fetched solver locked params (matches `getLockedParams` return shape).
   * When supplied with all four percent fields, the fetch is skipped.
   */
  lockedParamPercent?: ApiLockedParamsBySymbolIdResponse;
}

/**
 * Resolve solver locked-param percentages. When the caller supplies
 * `lockedParamPercent` with all four percent fields the fetch is skipped;
 * otherwise `getLockedParams` is called and missing fields default to `"0"`.
 */
export async function resolveLockedParams(
  config: Config,
  parameters: ResolveLockedParamsParameters,
): Promise<ResolvedLockedParams> {
  const supplied = parameters.lockedParamPercent;
  if (
    supplied?.cva !== undefined &&
    supplied.lf !== undefined &&
    supplied.partyAmm !== undefined &&
    supplied.partyBmm !== undefined
  ) {
    return { cva: supplied.cva, lf: supplied.lf, partyAmm: supplied.partyAmm, partyBmm: supplied.partyBmm };
  }

  const locked = await getLockedParams(config, {
    chainId: parameters.chainId,
    solverId: parameters.solverId,
    symbol: parameters.marketName,
    leverage: parameters.leverage,
  });
  return {
    cva: locked.cva ?? "0",
    lf: locked.lf ?? "0",
    partyAmm: locked.partyAmm ?? "0",
    partyBmm: locked.partyBmm ?? "0",
  };
}
