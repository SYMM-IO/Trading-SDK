import type { PublicClient } from "viem";
import { describe, expect, it, vi } from "vitest";
import { getDefaultSolver, SymmioSupportedChainId } from "../../core/chains";
import { createConfig } from "../../core/config";

const genFn = vi.hoisted(() => vi.fn());

vi.mock("../types/generated/rasa-solver", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../types/generated/rasa-solver")>();
  return { ...actual, getErrorMessageErrorCodesErrorCodeGet: genFn };
});

import { getErrorMessageQueryKey, getErrorMessageQueryOptions } from "./query";

const BASE = SymmioSupportedChainId.BASE;
const config = createConfig({
  getClient: () => ({}) as PublicClient,
  symmioConfig: { 999: { addresses: { affiliatesAddress: "0x000000000000000000000000000000000000aFF1" } } },
});

describe("getErrorMessageQueryOptions", () => {
  it("separates cache entries by solverId and by error code", () => {
    const a = getErrorMessageQueryKey({ chainId: BASE, solverId: "rasa", errorCode: 2000 });
    expect(a).not.toEqual(getErrorMessageQueryKey({ chainId: BASE, solverId: "other", errorCode: 2000 }));
    expect(a).not.toEqual(getErrorMessageQueryKey({ chainId: BASE, solverId: "rasa", errorCode: 2001 }));
  });

  it("queryFn forwards the error code to the fetch, not just the key", async () => {
    genFn.mockResolvedValue({ data: { "2000": "insufficient margin" } });
    const spy = vi.spyOn(config, "getSolver");

    const options = getErrorMessageQueryOptions(config, { chainId: BASE, solverId: "rasa", errorCode: 2000 });
    await (options.queryFn as () => Promise<unknown>)();

    expect(spy).toHaveBeenCalledWith({ chainId: BASE, solverId: "rasa" });
    expect(genFn).toHaveBeenCalledWith(2000, { baseURL: getDefaultSolver(BASE).url });
  });
});
