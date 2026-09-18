import { maxUint256 } from "viem";
import { describe, expect, it } from "vitest";
import { GASLESS_TEST_CHAIN, TEST_GASLESS, gaslessTestConfig } from "../test/config";
import { getGaslessWalletCreationFee } from "./get-gasless-wallet-creation-fee";

const OWNER = "0x1111111111111111111111111111111111111111" as const;

describe("getGaslessWalletCreationFee", () => {
  it("quotes the original wallet (id 0) when no wallet id is given — it pays the fee too while undeployed", async () => {
    const { config, readContract } = gaslessTestConfig();
    readContract.mockResolvedValue(250_000n);

    await expect(getGaslessWalletCreationFee(config, { chainId: GASLESS_TEST_CHAIN, owner: OWNER })).resolves.toBe(
      250_000n,
    );
    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: TEST_GASLESS.gaslessLayerAddress,
        functionName: "getWalletCreationFee",
        args: [OWNER, 0n],
      }),
    );
  });

  it("quotes the selected wallet in (owner, walletId) order and returns the raw collateral-unit amount", async () => {
    const { config, readContract } = gaslessTestConfig();
    readContract.mockResolvedValue(0n);

    await expect(
      getGaslessWalletCreationFee(config, { chainId: GASLESS_TEST_CHAIN, owner: OWNER, walletId: 2n }),
    ).resolves.toBe(0n);
    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: "getWalletCreationFee", args: [OWNER, 2n] }),
    );
  });

  it.each([
    { label: "a negative id", walletId: -1n },
    { label: "an overflowing id", walletId: maxUint256 + 1n },
    { label: "a JavaScript number", walletId: 2 as unknown as bigint },
  ])("rejects $label before any RPC call", async ({ walletId }) => {
    const { config, readContract } = gaslessTestConfig();

    await expect(
      getGaslessWalletCreationFee(config, { chainId: GASLESS_TEST_CHAIN, owner: OWNER, walletId }),
    ).rejects.toMatchObject({ code: "GASLESS_WALLET_ID_INVALID" });
    expect(readContract).not.toHaveBeenCalled();
  });

  it("requires a gasless block on the target chain", async () => {
    const { config, readContract } = gaslessTestConfig();

    /** The config's default chain carries no gasless block. */
    await expect(getGaslessWalletCreationFee(config, { owner: OWNER })).rejects.toMatchObject({
      code: "GASLESS_NOT_CONFIGURED",
    });
    expect(readContract).not.toHaveBeenCalled();
  });
});
