import { maxUint256 } from "viem";
import { describe, expect, it } from "vitest";
import { GASLESS_TEST_CHAIN, TEST_GASLESS, gaslessTestConfig } from "../test/config";
import { getGaslessWalletNonce } from "./get-gasless-wallet-nonce";

const OWNER = "0x2222222222222222222222222222222222222222" as const;
const ACCOUNT = "0x1111111111111111111111111111111111111111" as const;

describe("getGaslessWalletNonce", () => {
  it("reads the original wallet's stream (id 0) when no wallet id is given", async () => {
    const { config, readContract } = gaslessTestConfig();
    readContract.mockResolvedValue(4n);

    await expect(
      getGaslessWalletNonce(config, { chainId: GASLESS_TEST_CHAIN, owner: OWNER, account: ACCOUNT }),
    ).resolves.toBe(4n);
    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: TEST_GASLESS.gaslessLayerAddress,
        functionName: "walletOperationNonces",
        args: [OWNER, 0n, ACCOUNT],
      }),
    );
  });

  it("reads the selected wallet's stream in (owner, walletId, signerAccount) order", async () => {
    const { config, readContract } = gaslessTestConfig();
    readContract.mockResolvedValue(0n);

    await getGaslessWalletNonce(config, { chainId: GASLESS_TEST_CHAIN, owner: OWNER, walletId: 2n, account: ACCOUNT });

    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: "walletOperationNonces", args: [OWNER, 2n, ACCOUNT] }),
    );
  });

  it.each([
    { label: "a negative id", walletId: -1n },
    { label: "an overflowing id", walletId: maxUint256 + 1n },
  ])("rejects $label before any RPC call", async ({ walletId }) => {
    const { config, readContract } = gaslessTestConfig();

    await expect(
      getGaslessWalletNonce(config, { chainId: GASLESS_TEST_CHAIN, owner: OWNER, walletId, account: ACCOUNT }),
    ).rejects.toMatchObject({ code: "GASLESS_WALLET_ID_INVALID" });
    expect(readContract).not.toHaveBeenCalled();
  });
});
