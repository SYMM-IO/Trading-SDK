import type { PublicClient } from "viem";
import { describe, expect, it } from "vitest";
import { TEST_AFFILIATE_ADDRESS } from "../../shared/test/mock-config";
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
            version: "v1",
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

describe("getSolverKey — cache isolation", () => {
  it("two solvers on the same chain get distinct keys", () => {
    const config = twoSolverConfig();
    expect(config.getSolverKey({ chainId: CHAIN, solverId: "enigma" })).not.toBe(
      config.getSolverKey({ chainId: CHAIN, solverId: "enigma2" }),
    );
  });

  it("omitting solverId resolves the chain's default solver", () => {
    const config = twoSolverConfig();
    expect(config.getSolverKey({ chainId: CHAIN })).toBe(config.getSolverKey({ chainId: CHAIN, solverId: "enigma" }));
  });

  it("returns a stable sentinel for an unknown solver (never throws)", () => {
    expect(twoSolverConfig().getSolverKey({ chainId: CHAIN, solverId: "nope" })).toBe("unsupported-solver");
  });

  it("changing one solver's config does not change another solver's key (scoped invalidation)", () => {
    const a = twoSolverConfig({ url: "https://a.example/api" });
    const b = twoSolverConfig({ url: "https://b.example/api" });
    // `enigma` (built-in, untouched) keeps the same key across both configs…
    expect(a.getSolverKey({ chainId: CHAIN, solverId: "enigma" })).toBe(
      b.getSolverKey({ chainId: CHAIN, solverId: "enigma" }),
    );
    // …while `enigma2`, whose url changed, rotates.
    expect(a.getSolverKey({ chainId: CHAIN, solverId: "enigma2" })).not.toBe(
      b.getSolverKey({ chainId: CHAIN, solverId: "enigma2" }),
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
                version: "v1",
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

  it("throws for an unsupported version of a known kind", () => {
    expect(() =>
      createConfig({
        symmioConfig: {
          [CHAIN]: {
            addresses: { affiliatesAddress: TEST_AFFILIATE_ADDRESS },
            solvers: {
              bad: {
                kind: "enigma",
                version: "v2",
                name: "x",
                address: "0x0000000000000000000000000000000000000002",
                url: "u",
              },
            },
          },
        } as unknown as CreateConfigParameters["symmioConfig"],
        getClient: noopClient,
      }),
    ).toThrow(/unsupported version/i);
  });
});
