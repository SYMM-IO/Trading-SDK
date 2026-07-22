import type { Address, PublicClient } from "viem";
import { mainnet } from "viem/chains";
import { describe, expect, it } from "vitest";
import { SymmioSupportedChainId } from "../../../core/chains";
import { createConfig } from "../../../core/config";
import { SymmError } from "../../../shared/errors/symm-error";
import { mockConfig } from "../../../shared/test/mock-config";
import {
  generateAccountManagerAddressQueryKey,
  generateAccountManagerAddressQueryOptions,
} from "./generate-account-manager-address";

const REGISTRANT: Address = "0x1111111111111111111111111111111111111111";
const PREDICTED: Address = "0xaff1aff1aff1aff1aff1aff1aff1aff1aff1aff1";
const CUSTOM_SYMMIO: Address = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

describe("generateAccountManagerAddressQueryOptions", () => {
  it("is disabled until both `registrant` and `name` are set", () => {
    const { config } = mockConfig();
    expect(generateAccountManagerAddressQueryOptions(config, {}).enabled).toBe(false);
    expect(generateAccountManagerAddressQueryOptions(config, { registrant: REGISTRANT }).enabled).toBe(false);
    expect(generateAccountManagerAddressQueryOptions(config, { name: "Acme" }).enabled).toBe(false);
    expect(generateAccountManagerAddressQueryOptions(config, { registrant: REGISTRANT, name: "Acme" }).enabled).toBe(
      true,
    );
  });

  it("respects an explicit query.enabled override", () => {
    const { config } = mockConfig();
    expect(
      generateAccountManagerAddressQueryOptions(config, {
        registrant: REGISTRANT,
        name: "Acme",
        query: { enabled: false },
      }).enabled,
    ).toBe(false);
  });

  it("queryFn delegates to the action", async () => {
    const { config, readContract } = mockConfig();
    readContract.mockResolvedValueOnce(PREDICTED);

    const predicted = await generateAccountManagerAddressQueryOptions(config, {
      registrant: REGISTRANT,
      name: "Acme",
    }).queryFn();

    expect(predicted).toBe(PREDICTED);
    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: "generateAccountManagerAddress", args: [REGISTRANT, "Acme"] }),
    );
  });

  it("queryFn throws a SymmError synchronously when `registrant` or `name` is missing", () => {
    const { config } = mockConfig();
    expect(() => generateAccountManagerAddressQueryOptions(config, { registrant: REGISTRANT }).queryFn()).toThrow(
      SymmError,
    );
  });

  it("queryFn surfaces a SymmError for an unsupported chain", async () => {
    const { config } = mockConfig();
    const options = generateAccountManagerAddressQueryOptions(config, {
      registrant: REGISTRANT,
      name: "Acme",
      chainId: mainnet.id,
    });
    await expect(options.queryFn()).rejects.toThrow(SymmError);
  });

  it("builds a stable key", () => {
    const key = generateAccountManagerAddressQueryKey({
      chainId: SymmioSupportedChainId.HYPER_EVM,
      registrant: REGISTRANT,
      name: "Acme",
    });
    expect(key).toEqual([
      "generateAccountManagerAddress",
      {
        chainId: SymmioSupportedChainId.HYPER_EVM,
        registrant: REGISTRANT,
        name: "Acme",
      },
    ]);
  });

  it("folds the chain config fingerprint into the factory key so overrides rekey", () => {
    const { config: base } = mockConfig();
    const overridden = createConfig({
      getClient: () => ({}) as PublicClient,
      symmioConfig: {
        [SymmioSupportedChainId.HYPER_EVM]: {
          addresses: { affiliatesAddress: "0x000000000000000000000000000000000000aFF1", symmioAddress: CUSTOM_SYMMIO },
        },
      },
    });

    const baseKey = generateAccountManagerAddressQueryOptions(base, { registrant: REGISTRANT, name: "Acme" }).queryKey;
    const overriddenKey = generateAccountManagerAddressQueryOptions(overridden, {
      registrant: REGISTRANT,
      name: "Acme",
    }).queryKey;

    expect((baseKey[1] as { configKey?: string }).configKey).toBe(base.getChainConfigKey());
    expect(overriddenKey).not.toEqual(baseKey);
  });
});
