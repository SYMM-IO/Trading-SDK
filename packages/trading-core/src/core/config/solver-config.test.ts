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
  it("is the plain `chainId:solverId` composite", () => {
    const config = twoSolverConfig();
    expect(config.getSolverKey({ chainId: CHAIN, solverId: "enigma" })).toBe(`${CHAIN}:enigma`);
    expect(config.getSolverKey({ chainId: CHAIN, solverId: "enigma2" })).toBe(`${CHAIN}:enigma2`);
  });

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

  it("never throws — an unknown chain without a solverId yields the `unknown` sentinel", () => {
    const config = twoSolverConfig();
    expect(config.getSolverKey({ chainId: CHAIN, solverId: "nope" })).toBe(`${CHAIN}:nope`);
    expect(config.getSolverKey({ chainId: 1 })).toBe("1:unknown");
  });

  it("is identity, not content — changing a solver's endpoints does not rotate its key", () => {
    const a = twoSolverConfig({ url: "https://a.example/api" });
    const b = twoSolverConfig({ url: "https://b.example/api" });
    expect(a.getSolverKey({ chainId: CHAIN, solverId: "enigma2" })).toBe(
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
