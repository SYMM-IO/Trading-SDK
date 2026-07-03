import { describe, expect, it } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../../core/chains";
import { mockConfig } from "../../../shared/test/mock-config";
import { getQuote } from "./get-quote";

const DEFAULT = getChainConfig(SymmioSupportedChainId.HYPER_EVM);

describe("getQuote", () => {
  it("reads a single quote from the SYMMIO core by id", async () => {
    const { config, readContract } = mockConfig();
    readContract.mockResolvedValueOnce({ id: 42n });

    await getQuote(config, { quoteId: 42n });

    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: DEFAULT.addresses.symmioAddress,
        functionName: "getQuote",
        args: [42n],
      }),
    );
  });

  it("returns the quote when it exists", async () => {
    const { config, readContract } = mockConfig();
    const quote = { id: 7n };
    readContract.mockResolvedValueOnce(quote);

    await expect(getQuote(config, { quoteId: 7n })).resolves.toBe(quote);
  });

  it("maps the zeroed not-found sentinel (id === 0n) to null", async () => {
    const { config, readContract } = mockConfig();
    readContract.mockResolvedValueOnce({ id: 0n });

    await expect(getQuote(config, { quoteId: 999n })).resolves.toBeNull();
  });
});
