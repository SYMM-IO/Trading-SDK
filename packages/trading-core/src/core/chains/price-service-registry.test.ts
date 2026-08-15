import { describe, expect, it } from "vitest";
import { getChainConfig } from "./actions/get-chain-config";
import { listSupportedChains } from "./actions/list-supported-chains";

/**
 * Guards an invariant the type system cannot express.
 *
 * `priceService` resolves as `solver.priceService ?? chain.priceService`. With
 * one solver per chain that fallback is unambiguous. With **two** solvers on one
 * chain it stops being safe: a lowcap solver and a majors solver price off
 * different providers, so whichever one relies on the chain-level default gets
 * the other's feed — and the failure is silent. `getMarkPrices` returns an empty
 * array (the provider simply doesn't carry that market's symbols), the watcher
 * reports `open` and never ticks, and `resolveMarkPrice` throws only at trade
 * time.
 *
 * "Two solvers may legitimately share one provider" is why this is not a
 * `createConfig` throw — it would reject a valid setup. Instead the rule is
 * enforced for the **shipped registry**, so adding a second solver to a chain
 * fails here and forces an explicit decision.
 */
describe("registry — price-service resolution is unambiguous", () => {
  it.each(listSupportedChains())("chain %s resolves exactly one provider per solver", (chainId) => {
    const config = getChainConfig(chainId);
    const solverIds = Object.keys(config.solvers);

    if (solverIds.length <= 1) {
      // Single-solver chain: the chain-level block is the only answer, so the
      // fallback cannot be ambiguous.
      expect(config.priceService.type).toBeTruthy();
      return;
    }

    const relyingOnChainDefault = Object.entries(config.solvers)
      .filter(([, solver]) => !solver?.priceService)
      .map(([id]) => id);

    expect(
      relyingOnChainDefault,
      `Chain ${chainId} registers ${solverIds.length} solvers (${solverIds.join(", ")}) but ${relyingOnChainDefault.join(", ")} inherit the chain-level "${config.priceService.type}" price service. On a multi-solver chain every solver must declare its own \`priceService\` — inheriting silently prices one solver's markets off another provider's feed.`,
    ).toEqual([]);
  });

  it("every configured price service declares both endpoints", () => {
    for (const chainId of listSupportedChains()) {
      const config = getChainConfig(chainId);
      const blocks = [
        config.priceService,
        ...Object.values(config.solvers).map((solver) => solver?.priceService),
      ].filter((block) => block !== undefined);

      for (const block of blocks) {
        expect(block.url, `chain ${chainId} price service has no url`).toBeTruthy();
        expect(block.wsUrl, `chain ${chainId} price service has no wsUrl`).toBeTruthy();
      }
    }
  });
});
