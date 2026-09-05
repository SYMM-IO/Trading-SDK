import type { PublicClient } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getChainConfig, getDefaultSolver, SymmioSupportedChainId } from "../core/chains";
import { createConfig } from "../core/config";
import { SymmError } from "../shared/errors/symm-error";

const mocks = vi.hoisted(() => ({
  getBalanceInfoGetBalanceInfoAddressMultiAccountAddressGet: vi.fn(),
  getCounterpartyUpnlPartyAUpnlAddressGet: vi.fn(),
  getOpenInterestOpenInterestGet: vi.fn(),
  getSymbolPriceRangePriceRangeSymbolGet: vi.fn(),
  getErrorMessageErrorCodesErrorCodeGet: vi.fn(),
  whitelistCheckSubAddressAddSubAddressInWhitelistAddressMultiAccountAddressGet: vi.fn(),
  readyCheckReadyzGet: vi.fn(),
}));

vi.mock("./types/generated/rasa-solver", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./types/generated/rasa-solver")>();
  return { ...actual, ...mocks };
});

import { addSolverWhitelist } from "./add-solver-whitelist";
import { getErrorMessage } from "./get-error-message";
import { getPartyAUpnl } from "./get-party-a-upnl";
import { getSolverBalanceInfo } from "./get-solver-balance-info";
import { getSolverOpenInterest } from "./get-solver-open-interest";
import { getSolverPriceRange } from "./get-solver-price-range";
import { getSolverReadiness } from "./get-solver-readiness";

const BASE = SymmioSupportedChainId.BASE;
const HYPER = SymmioSupportedChainId.HYPER_EVM;
const RASA_URL = getDefaultSolver(BASE).url;
const BASE_ACCOUNT_LAYER = getChainConfig(BASE).addresses.accountLayerAddress;
const USER = "0x1111111111111111111111111111111111111111" as const;

const config = createConfig({
  getClient: () => ({}) as PublicClient,
  symmioConfig: { [HYPER]: { addresses: { affiliatesAddress: "0x000000000000000000000000000000000000aFF1" } } },
});

/** One row per rasa-only action: run it on Base and assert the wire call. */
const CASES = [
  {
    name: "getSolverBalanceInfo",
    run: () => getSolverBalanceInfo(config, { chainId: BASE, address: USER }),
    mock: mocks.getBalanceInfoGetBalanceInfoAddressMultiAccountAddressGet,
    response: [],
    // multiAccountAddress defaults to Base's accountLayerAddress
    expectedArgs: [USER, BASE_ACCOUNT_LAYER, { baseURL: RASA_URL }],
  },
  {
    name: "getPartyAUpnl",
    run: () => getPartyAUpnl(config, { chainId: BASE, address: USER }),
    mock: mocks.getCounterpartyUpnlPartyAUpnlAddressGet,
    response: "-12.5",
    expectedArgs: [USER, { baseURL: RASA_URL }],
  },
  {
    name: "getSolverOpenInterest",
    run: () => getSolverOpenInterest(config, { chainId: BASE }),
    mock: mocks.getOpenInterestOpenInterestGet,
    response: { total_cap: "100", used: "40" },
    expectedArgs: [{ baseURL: RASA_URL }],
  },
  {
    name: "getSolverPriceRange",
    run: () => getSolverPriceRange(config, { chainId: BASE, symbol: "BTCUSDT" }),
    mock: mocks.getSymbolPriceRangePriceRangeSymbolGet,
    response: { min_price: "1", max_price: "2" },
    expectedArgs: ["BTCUSDT", { baseURL: RASA_URL }],
  },
  {
    name: "getErrorMessage",
    run: () => getErrorMessage(config, { chainId: BASE, errorCode: 2000 }),
    mock: mocks.getErrorMessageErrorCodesErrorCodeGet,
    response: { "2000": "insufficient margin" },
    expectedArgs: [2000, { baseURL: RASA_URL }],
  },
  {
    name: "addSolverWhitelist",
    run: () => addSolverWhitelist(config, { chainId: BASE, address: USER }),
    mock: mocks.whitelistCheckSubAddressAddSubAddressInWhitelistAddressMultiAccountAddressGet,
    response: { successful: true, message: null },
    expectedArgs: [USER, BASE_ACCOUNT_LAYER, { baseURL: RASA_URL }],
  },
  {
    name: "getSolverReadiness",
    run: () => getSolverReadiness(config, { chainId: BASE }),
    mock: mocks.readyCheckReadyzGet,
    response: { isReady: true },
    expectedArgs: [{ baseURL: RASA_URL }],
  },
] as const;

/** Same actions targeted at HyperEVM's enigma solver — every one must refuse. */
const ENIGMA_RUNS = [
  () => getSolverBalanceInfo(config, { chainId: HYPER, address: USER }),
  () => getPartyAUpnl(config, { chainId: HYPER, address: USER }),
  () => getSolverOpenInterest(config, { chainId: HYPER }),
  () => getSolverPriceRange(config, { chainId: HYPER, symbol: "BTCUSDT" }),
  () => getErrorMessage(config, { chainId: HYPER, errorCode: 1 }),
  () => addSolverWhitelist(config, { chainId: HYPER, address: USER }),
  () => getSolverReadiness(config, { chainId: HYPER }),
] as const;

describe("rasa-only solver actions", () => {
  beforeEach(() => {
    for (const m of Object.values(mocks)) m.mockReset();
  });

  it.each(CASES)("$name calls the rasa endpoint with forwarded args", async ({ run, mock, response, expectedArgs }) => {
    mock.mockResolvedValue({ data: response });
    await expect(run()).resolves.toEqual(response);
    expect(mock).toHaveBeenCalledWith(...expectedArgs);
  });

  it.each(ENIGMA_RUNS.map((run, i) => ({ run, name: CASES[i]!.name })))(
    "$name throws UNSUPPORTED_BY_SOLVER against an enigma solver",
    async ({ run }) => {
      await expect(run()).rejects.toMatchObject({ code: "UNSUPPORTED_BY_SOLVER" });
      for (const m of Object.values(mocks)) expect(m).not.toHaveBeenCalled();
    },
  );

  it("wraps axios failures in SymmApiError with the action's code", async () => {
    mocks.getOpenInterestOpenInterestGet.mockRejectedValue(
      Object.assign(new Error("boom"), { isAxiosError: true, toJSON: () => ({}) }),
    );
    await expect(getSolverOpenInterest(config, { chainId: BASE })).rejects.toMatchObject({
      code: "FETCH_SOLVER_OPEN_INTEREST_FAILED",
    });
  });

  it("non-axios failures surface as SymmError with the action's code", async () => {
    mocks.readyCheckReadyzGet.mockRejectedValue(new Error("socket hangup"));
    const error = await getSolverReadiness(config, { chainId: BASE }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(SymmError);
    expect((error as SymmError).code).toBe("FETCH_SOLVER_READINESS_FAILED");
  });
});
