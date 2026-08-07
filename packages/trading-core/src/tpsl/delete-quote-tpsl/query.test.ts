import axios, { type AxiosResponse } from "axios";
import type { Account, Address, Chain, PublicClient } from "viem";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../core/chains";
import { createConfig, type Config, type SymmioWalletClient } from "../../core/config";
import { SymmError } from "../../shared/errors/symm-error";
import { TEST_AFFILIATE_ADDRESS, TEST_USER } from "../../shared/test/mock-config";
import type { TpSlSigningSpec } from "../types";
import type { StatusResponse } from "../types/generated/tpsl-handler";
import type { DeleteQuoteTpSlParameters } from "./delete-quote-tpsl";
import { deleteQuoteTpSlMutationOptions } from "./query";

const CHAIN_CONFIG = getChainConfig(SymmioSupportedChainId.HYPER_EVM);
const TPSL = CHAIN_CONFIG.solver.tpsl!;

/** Local fixtures — handler-issued / test-only values, never real on-chain constants. */
const VIRTUAL_ACCOUNT: Address = "0x2222222222222222222222222222222222222222";
const COH_QUOTE_ID = "coh7";
const TEST_SIGNATURE = "0xc0ffee";

const SIGNING_SPEC: TpSlSigningSpec = {
  domain: {
    name: "ConditionalOrders",
    version: "1",
    chainId: SymmioSupportedChainId.HYPER_EVM,
    verifyingContract: TPSL.cohWalletAddress,
  },
  types: {
    DeleteConditionalOrder: [
      { name: "virtualAccount", type: "address" },
      { name: "salt", type: "uint256" },
      { name: "cohQuoteId", type: "string" },
      { name: "conditionalOrderType", type: "string" },
    ],
  },
  primaryType: "DeleteConditionalOrder",
};

const VARIABLES: DeleteQuoteTpSlParameters = {
  chainId: SymmioSupportedChainId.HYPER_EVM,
  from: TEST_USER,
  quoteId: 7n,
  virtualAccount: VIRTUAL_ACCOUNT,
  cohQuoteId: COH_QUOTE_ID,
  conditionalOrderType: "stop_loss",
};

/** Config whose wallet client can sign typed data (`mockConfig()`'s stub cannot). */
function mockSigningConfig(): Config {
  const account = { address: TEST_USER, type: "json-rpc" } as Account;
  const walletClient = {
    account,
    chain: { id: SymmioSupportedChainId.HYPER_EVM } as Chain,
    signTypedData: vi.fn().mockResolvedValue(TEST_SIGNATURE),
  } as unknown as SymmioWalletClient;

  return createConfig({
    symmioConfig: {
      [SymmioSupportedChainId.HYPER_EVM]: { addresses: { affiliatesAddress: TEST_AFFILIATE_ADDRESS } },
    },
    getClient: () => ({}) as PublicClient,
    getWalletClient: async () => walletClient,
  });
}

function okResponse<T>(data: T): AxiosResponse<T> {
  return {
    data,
    status: 200,
    statusText: "OK",
    headers: {},
    config: { headers: {} } as AxiosResponse["config"],
  } as AxiosResponse<T>;
}

describe("deleteQuoteTpSlMutationOptions", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("builds a stable mutation key", () => {
    expect(deleteQuoteTpSlMutationOptions(mockSigningConfig()).mutationKey).toEqual(["deleteQuoteTpSl"]);
  });

  it("mutationFn forwards every variable to the action and resolves `{ success: true }`", async () => {
    vi.spyOn(axios, "get").mockResolvedValue(okResponse(SIGNING_SPEC));
    const del = vi
      .spyOn(axios, "delete")
      .mockResolvedValue(okResponse<StatusResponse>({ successful: true, message: null }));

    const result = await deleteQuoteTpSlMutationOptions(mockSigningConfig()).mutationFn(VARIABLES);

    expect(result).toEqual({ success: true });
    expect(del).toHaveBeenCalledWith("/api/v5/", {
      data: {
        typedData: {
          types: SIGNING_SPEC.types,
          primaryType: SIGNING_SPEC.primaryType,
          domain: SIGNING_SPEC.domain,
          message: {
            virtualAccount: VIRTUAL_ACCOUNT,
            salt: expect.stringMatching(/^\d+$/),
            cohQuoteId: COH_QUOTE_ID,
            conditionalOrderType: "stop_loss",
          },
        },
        signature: TEST_SIGNATURE,
        signer: TEST_USER,
      },
      baseURL: TPSL.url,
      headers: { "App-Name": TPSL.appName, "Content-Type": "application/json", Accept: "application/json" },
    });
  });

  it("mutationFn surfaces the action's rejection instead of swallowing it", async () => {
    vi.spyOn(axios, "get").mockResolvedValue(okResponse(SIGNING_SPEC));
    vi.spyOn(axios, "delete").mockResolvedValue(
      okResponse<StatusResponse>({ successful: false, message: "order already canceled" }),
    );

    const error = await deleteQuoteTpSlMutationOptions(mockSigningConfig())
      .mutationFn(VARIABLES)
      .catch((err: unknown) => err);

    expect(error).toBeInstanceOf(SymmError);
    expect(error).toMatchObject({ kind: "api", code: "DELETE_TPSL_REJECTED", message: "order already canceled" });
  });
});
