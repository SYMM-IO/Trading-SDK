import { describe, expect, it } from "vitest";
import { SymmioSupportedChainId } from "../core/chains";
import { SymmError } from "../shared/errors/symm-error";
import { mockConfig } from "../shared/test/mock-config";
import { resolveInventoryService, supportsInventoryService } from "./resolve-inventory";

describe("resolveInventoryService", () => {
  it("returns the chain's inventory configuration", () => {
    const { config } = mockConfig();

    expect(resolveInventoryService(config, SymmioSupportedChainId.ARBITRUM).url).toEqual(expect.any(String));
  });

  it("resolves the config's default chain when no chainId is passed", () => {
    const { config } = mockConfig();

    expect(resolveInventoryService(config)).toEqual(resolveInventoryService(config, SymmioSupportedChainId.ARBITRUM));
  });

  it("throws INVENTORY_NOT_CONFIGURED rather than falling back to another chain's deployment", () => {
    const { config } = mockConfig();

    const call = () => resolveInventoryService(config, SymmioSupportedChainId.BASE);

    expect(call).toThrow(SymmError);
    expect(call).toThrowError(expect.objectContaining({ kind: "config", code: "INVENTORY_NOT_CONFIGURED" }));
  });
});

describe("supportsInventoryService", () => {
  it("reports true where the service is configured", () => {
    const { config } = mockConfig();

    expect(supportsInventoryService(config, SymmioSupportedChainId.ARBITRUM)).toBe(true);
  });

  it("reports false instead of throwing where it is not — it is the gate, not the read", () => {
    const { config } = mockConfig();

    expect(supportsInventoryService(config, SymmioSupportedChainId.BASE)).toBe(false);
  });
});
