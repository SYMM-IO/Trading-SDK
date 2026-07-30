import type { PublicClient } from "viem";
import { describe, expect, it, vi } from "vitest";
import { getChainConfig, getDefaultSolver, SymmioSupportedChainId } from "../../core/chains";
import { createConfig } from "../../core/config";

const genFn = vi.hoisted(() => vi.fn());

vi.mock("../types/generated/rasa-solver", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../types/generated/rasa-solver")>();
  return { ...actual, whitelistCheckSubAddressAddSubAddressInWhitelistAddressMultiAccountAddressGet: genFn };
});

import { addSolverWhitelistMutationOptions } from "./query";

const BASE = SymmioSupportedChainId.BASE;
const USER = "0x1111111111111111111111111111111111111111" as const;
const config = createConfig({
  getClient: () => ({}) as PublicClient,
  symmioConfig: { 999: { addresses: { affiliatesAddress: "0x000000000000000000000000000000000000aFF1" } } },
});

describe("addSolverWhitelistMutationOptions", () => {
  it("exposes a stable mutation key", () => {
    expect(addSolverWhitelistMutationOptions(config).mutationKey).toEqual(["addSolverWhitelist"]);
  });

  it("mutationFn forwards the variables to the action and the wire", async () => {
    genFn.mockResolvedValue({ data: { successful: true, message: null } });

    const options = addSolverWhitelistMutationOptions(config);
    await expect(options.mutationFn({ chainId: BASE, solverId: "rasa", address: USER })).resolves.toEqual({
      successful: true,
      message: null,
    });

    expect(genFn).toHaveBeenCalledWith(USER, getChainConfig(BASE).addresses.accountLayerAddress, {
      baseURL: getDefaultSolver(BASE).url,
    });
  });
});
