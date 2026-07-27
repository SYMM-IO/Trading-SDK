import type { PublicClient } from "viem";
import { describe, expect, it } from "vitest";
import { TEST_AFFILIATE_ADDRESS } from "../../shared/test/mock-config";
import { getMarketsQueryOptions } from "../../solvers/markets/query";
import { SymmioSupportedChainId } from "../chains";
import { createConfig, type CreateConfigParameters } from "./create-config";

const CHAIN = SymmioSupportedChainId.HYPER_EVM;
const noopClient = () => ({}) as unknown as PublicClient;

/** A config whose HYPER_EVM chain has the built-in `enigma` solver plus a second `enigma2`. */
function twoSolverConfig(enigma2?: { url?: string; withTpsl?: boolean }) {
  return createConfig({
    symmioConfig: {
      [CHAIN]: {
        addresses: { affiliatesAddress: TEST_AFFILIATE_ADDRESS },
        solvers: {
          enigma2: {
            kind: "enigma",
            name: "Enigma 2",
            address: "0x0000000000000000000000000000000000000002",
            url: enigma2?.url ?? "https://solver2.example/api",
            ...(enigma2?.withTpsl
              ? {
                  tpsl: {
                    url: "https://coh2.example",
                    wsUrl: "wss://coh2.example/ws",
                    appName: "app2",
                    cohWalletAddress: "0x0000000000000000000000000000000000000abc",
                  },
                }
              : {}),
          },
        },
      },
    },
    getClient: noopClient,
  });
}

describe("solver query cache isolation — chain configKey + solverId key field", () => {
  it("two solvers on the same chain get distinct query keys (solverId field)", () => {
    const config = twoSolverConfig();
    const a = getMarketsQueryOptions(config, { chainId: CHAIN, solverId: "enigma" }).queryKey;
    const b = getMarketsQueryOptions(config, { chainId: CHAIN, solverId: "enigma2" }).queryKey;
    expect(a).not.toEqual(b);
  });

  it("omitting solverId targets the default solver — key differs from an explicit non-default", () => {
    const config = twoSolverConfig();
    const dflt = getMarketsQueryOptions(config, { chainId: CHAIN }).queryKey;
    const other = getMarketsQueryOptions(config, { chainId: CHAIN, solverId: "enigma2" }).queryKey;
    expect(dflt).not.toEqual(other);
  });

  it("changing a solver's config rotates the chain configKey — overrides never serve stale cache", () => {
    const a = twoSolverConfig({ url: "https://a.example/api" });
    const b = twoSolverConfig({ url: "https://b.example/api" });
    expect(a.getChainConfigKey(CHAIN)).not.toBe(b.getChainConfigKey(CHAIN));
    // Deliberately coarse: the chain-level hash also rotates sibling solvers'
    // keys (enigma here, though only enigma2's url changed). Accepted
    // over-invalidation — config changes are rare, staleness is worse.
    expect(getMarketsQueryOptions(a, { chainId: CHAIN, solverId: "enigma" }).queryKey).not.toEqual(
      getMarketsQueryOptions(b, { chainId: CHAIN, solverId: "enigma" }).queryKey,
    );
  });
});

describe("solver listing", () => {
  it("getDefaultSolverId + listSolverIds reflect the chain's solvers", () => {
    const config = twoSolverConfig();
    expect(config.getDefaultSolverId(CHAIN)).toBe("enigma");
    expect([...config.listSolverIds(CHAIN)].sort()).toEqual(["enigma", "enigma2"]);
  });
});

describe("createConfig — solver validation guard", () => {
  it("throws for an unknown solver kind", () => {
    expect(() =>
      createConfig({
        symmioConfig: {
          [CHAIN]: {
            addresses: { affiliatesAddress: TEST_AFFILIATE_ADDRESS },
            solvers: {
              bad: {
                kind: "rasa",
                name: "x",
                address: "0x0000000000000000000000000000000000000002",
                url: "u",
              },
            },
          },
        } as unknown as CreateConfigParameters["symmioConfig"],
        getClient: noopClient,
      }),
    ).toThrow(/unknown kind/i);
  });
});
