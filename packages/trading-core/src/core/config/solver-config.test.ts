import type { PublicClient } from "viem";
import { describe, expect, it } from "vitest";
import { TEST_AFFILIATE_ADDRESS } from "../../shared/test/mock-config";
import { getMarketsQueryOptions } from "../../solvers/markets/query";
import { SymmioSupportedChainId } from "../chains";
import { createConfig, type CreateConfigParameters } from "./create-config";

const CHAIN = SymmioSupportedChainId.HYPER_EVM;
const noopClient = () => ({}) as unknown as PublicClient;

/** A config whose HyperEVM `enigma` solver has an overridden url. */
function enigmaUrlOverride(url: string) {
  return createConfig({
    symmioConfig: {
      [CHAIN]: {
        addresses: { affiliatesAddress: TEST_AFFILIATE_ADDRESS },
        solvers: { enigma: { url } },
      },
    },
    getClient: noopClient,
  });
}

describe("solver query cache isolation — chain configKey + solverId key field", () => {
  it("query keys differ by solverId (the field rides in the key)", () => {
    const config = enigmaUrlOverride("https://a.example/api");
    const enigmaKey = getMarketsQueryOptions(config, { chainId: CHAIN, solverId: "enigma" }).queryKey;
    const rasaKey = getMarketsQueryOptions(config, { chainId: CHAIN, solverId: "rasa" }).queryKey;
    expect(enigmaKey).not.toEqual(rasaKey);
  });

  it("changing a solver's config rotates the chain configKey — overrides never serve stale cache", () => {
    const a = enigmaUrlOverride("https://a.example/api");
    const b = enigmaUrlOverride("https://b.example/api");
    expect(a.getChainConfigKey(CHAIN)).not.toBe(b.getChainConfigKey(CHAIN));
    expect(getMarketsQueryOptions(a, { chainId: CHAIN, solverId: "enigma" }).queryKey).not.toEqual(
      getMarketsQueryOptions(b, { chainId: CHAIN, solverId: "enigma" }).queryKey,
    );
  });
});

describe("solver listing", () => {
  it("getDefaultSolverId + listSolverIds reflect the chain's solver", () => {
    const config = enigmaUrlOverride("https://a.example/api");
    expect(config.getDefaultSolverId(CHAIN)).toBe("enigma");
    expect([...config.listSolverIds(CHAIN)]).toEqual(["enigma"]);
  });
});

describe("createConfig — solver validation guard", () => {
  it("throws for a solver id that is not a supported kind", () => {
    expect(() =>
      createConfig({
        symmioConfig: {
          [CHAIN]: {
            addresses: { affiliatesAddress: TEST_AFFILIATE_ADDRESS },
            solvers: {
              bad: {
                name: "x",
                address: "0x0000000000000000000000000000000000000002",
                url: "u",
                notifications: { url: "wss://x.test/ws", protocol: "rasa" },
              },
            },
          },
        } as unknown as CreateConfigParameters["symmioConfig"],
        getClient: noopClient,
      }),
    ).toThrow(/not a supported kind/i);
  });
});
