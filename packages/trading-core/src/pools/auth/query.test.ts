import { describe, expect, it, vi } from "vitest";
import { mockConfig } from "../../shared/test/mock-config";
import { authenticateListingMutationOptions } from "./query";

const VARIABLES = { domain: "app.example.com", uri: "https://app.example.com" } as const;

describe("authenticateListingMutationOptions", () => {
  it("tags the mutation with a stable key", () => {
    const { config } = mockConfig();

    expect(authenticateListingMutationOptions(config).mutationKey).toEqual(["authenticateListing"]);
  });

  it("is a mutation, not a query — it signs with the wallet and mints a token", () => {
    const { config } = mockConfig();
    const options = authenticateListingMutationOptions(config);

    expect(typeof options.mutationFn).toBe("function");
    expect(options).not.toHaveProperty("queryKey");
  });

  it("binds the config so the caller only supplies variables", async () => {
    const { config } = mockConfig();
    const authenticateListing = vi
      .spyOn(await import("./authenticate-listing"), "authenticateListing")
      .mockResolvedValue(undefined as never);

    await authenticateListingMutationOptions(config).mutationFn(VARIABLES);

    expect(authenticateListing).toHaveBeenCalledWith(config, VARIABLES);
    authenticateListing.mockRestore();
  });
});
