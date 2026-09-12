import { zeroAddress, type Address } from "viem";
import { describe, expect, it, type Mock } from "vitest";
import { SymmError } from "../../shared/errors/symm-error";
import { GASLESS_TEST_CHAIN, TEST_GASLESS, gaslessTestConfig } from "../test/config";
import { getGaslessDepositPolicy } from "./get-gasless-deposit-policy";

const OWNER = "0x1111111111111111111111111111111111111111" as const;
const DEPOSIT_ADDRESS = "0x5555555555555555555555555555555555555555" as const;
const COLLATERAL = "0x6666666666666666666666666666666666666666" as const;

/** The GaslessLayer reads a deposit policy performs, and the terms they answer with. */
interface PolicyTerms {
  depositFee: bigint;
  minimumDeposit: bigint;
  wallet?: Address;
}

function programPolicy(readContract: Mock, terms: PolicyTerms): void {
  readContract.mockImplementation(({ functionName }: { functionName: string }) => {
    switch (functionName) {
      case "getGaslessWalletAddress":
        return Promise.resolve(terms.wallet ?? DEPOSIT_ADDRESS);
      case "collateralToken":
        return Promise.resolve(COLLATERAL);
      case "depositFee":
        return Promise.resolve(terms.depositFee);
      case "minimumDeposit":
        return Promise.resolve(terms.minimumDeposit);
      default:
        return Promise.reject(new Error(`unprogrammed read: ${functionName}`));
    }
  });
}

describe("getGaslessDepositPolicy", () => {
  it("reads the owner's deposit address and the fee terms from the GaslessLayer", async () => {
    const { config, readContract } = gaslessTestConfig();
    programPolicy(readContract, { depositFee: 1_000_000n, minimumDeposit: 5_000_000n });

    const policy = await getGaslessDepositPolicy(config, { chainId: GASLESS_TEST_CHAIN, owner: OWNER });

    expect(policy).toEqual({
      depositAddress: DEPOSIT_ADDRESS,
      collateralTokenAddress: COLLATERAL,
      depositFee: 1_000_000n,
      minimumDeposit: 5_000_000n,
      settlementMinimum: 5_000_000n,
    });

    const reads = readContract.mock.calls.map(([read]) => read as { address: Address; functionName: string });
    expect(reads.map((read) => read.functionName).sort()).toEqual([
      "collateralToken",
      "depositFee",
      "getGaslessWalletAddress",
      "minimumDeposit",
    ]);
    expect(reads.every((read) => read.address === TEST_GASLESS.gaslessLayerAddress)).toBe(true);
    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: "getGaslessWalletAddress", args: [OWNER] }),
    );
  });

  it.each([
    {
      label: "the minimum when it exceeds the fee",
      depositFee: 1_000_000n,
      minimumDeposit: 5_000_000n,
      expected: 5_000_000n,
    },
    {
      label: "the minimum when it is exactly one unit above the fee",
      depositFee: 1_000_000n,
      minimumDeposit: 1_000_001n,
      expected: 1_000_001n,
    },
    {
      label: "one unit above the fee when the minimum equals it",
      depositFee: 1_000_000n,
      minimumDeposit: 1_000_000n,
      expected: 1_000_001n,
    },
    {
      label: "one unit above the fee when the minimum is below it",
      depositFee: 1_000_000n,
      minimumDeposit: 500_000n,
      expected: 1_000_001n,
    },
    { label: "one unit when there is neither fee nor minimum", depositFee: 0n, minimumDeposit: 0n, expected: 1n },
  ])("sets settlementMinimum to $label", async ({ depositFee, minimumDeposit, expected }) => {
    const { config, readContract } = gaslessTestConfig();
    programPolicy(readContract, { depositFee, minimumDeposit });

    const policy = await getGaslessDepositPolicy(config, { chainId: GASLESS_TEST_CHAIN, owner: OWNER });

    /** A settlement must clear the minimum AND leave something after the flat fee. */
    expect(policy.settlementMinimum).toBe(expected);
  });

  it("refuses to show a deposit address when the gateway answers the zero address", async () => {
    const { config, readContract } = gaslessTestConfig();
    programPolicy(readContract, { depositFee: 1_000_000n, minimumDeposit: 5_000_000n, wallet: zeroAddress });

    const policy = getGaslessDepositPolicy(config, { chainId: GASLESS_TEST_CHAIN, owner: OWNER });

    await expect(policy).rejects.toBeInstanceOf(SymmError);
    await expect(policy).rejects.toMatchObject({ code: "GASLESS_WALLET_UNAVAILABLE" });
  });
});
