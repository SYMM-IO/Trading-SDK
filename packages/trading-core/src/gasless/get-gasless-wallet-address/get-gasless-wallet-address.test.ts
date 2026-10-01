import { maxUint256, zeroAddress } from "viem";
import { describe, expect, it } from "vitest";
import { SymmError } from "../../shared/errors/symm-error";
import { GASLESS_TEST_CHAIN, TEST_GASLESS, gaslessTestConfig } from "../test/config";
import { getGaslessWalletAddress } from "./get-gasless-wallet-address";

const OWNER = "0x1111111111111111111111111111111111111111" as const;
const WALLET = "0x5555555555555555555555555555555555555555" as const;

describe("getGaslessWalletAddress", () => {
  it("reads the original wallet (id 0) when no wallet id is given", async () => {
    const { config, readContract } = gaslessTestConfig();
    readContract.mockResolvedValue(WALLET);

    await expect(getGaslessWalletAddress(config, { chainId: GASLESS_TEST_CHAIN, owner: OWNER })).resolves.toBe(WALLET);
    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: TEST_GASLESS.gaslessLayerAddress,
        functionName: "getGaslessWalletAddress",
        args: [OWNER, 0n],
      }),
    );
  });

  it.each([1n, 2n, maxUint256])("reads the address of wallet %s", async (walletId) => {
    const { config, readContract } = gaslessTestConfig();
    readContract.mockResolvedValue(WALLET);

    await getGaslessWalletAddress(config, { chainId: GASLESS_TEST_CHAIN, owner: OWNER, walletId });

    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: "getGaslessWalletAddress", args: [OWNER, walletId] }),
    );
  });

  it("refuses the zero address and names the wallet in the error", async () => {
    const { config, readContract } = gaslessTestConfig();
    readContract.mockResolvedValue(zeroAddress);

    const read = getGaslessWalletAddress(config, { chainId: GASLESS_TEST_CHAIN, owner: OWNER, walletId: 7n });

    await expect(read).rejects.toBeInstanceOf(SymmError);
    await expect(read).rejects.toMatchObject({ code: "GASLESS_WALLET_UNAVAILABLE", message: /wallet 7 of 0x1111/ });
  });

  it.each([
    { label: "a negative id", walletId: -1n },
    { label: "an overflowing id", walletId: maxUint256 + 1n },
    { label: "a JavaScript number", walletId: 1 as unknown as bigint },
  ])("rejects $label before any RPC call", async ({ walletId }) => {
    const { config, readContract } = gaslessTestConfig();

    await expect(
      getGaslessWalletAddress(config, { chainId: GASLESS_TEST_CHAIN, owner: OWNER, walletId }),
    ).rejects.toMatchObject({ code: "GASLESS_WALLET_ID_INVALID" });
    expect(readContract).not.toHaveBeenCalled();
  });
});
