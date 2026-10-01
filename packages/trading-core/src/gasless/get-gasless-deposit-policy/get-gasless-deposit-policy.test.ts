import { erc20Abi, maxUint256, zeroAddress, type Abi, type Address } from "viem";
import { describe, expect, it, type Mock } from "vitest";
import { SymmError } from "../../shared/errors/symm-error";
import { GASLESS_TEST_CHAIN, TEST_GASLESS, gaslessTestConfig } from "../test/config";
import { getGaslessDepositPolicy } from "./get-gasless-deposit-policy";

const OWNER = "0x1111111111111111111111111111111111111111" as const;
const DEPOSIT_ADDRESS = "0x5555555555555555555555555555555555555555" as const;
const COLLATERAL = "0x6666666666666666666666666666666666666666" as const;

/** The reads a deposit policy performs, and the terms they answer with. */
interface PolicyTerms {
  depositFee: bigint;
  minimumDeposit: bigint;
  walletCreationFee?: bigint;
  collateralDecimals?: number;
  wallet?: Address;
}

/** One `readContract` call as the stub receives it. */
interface Read {
  address: Address;
  abi: Abi;
  functionName: string;
  args?: readonly unknown[];
}

function programPolicy(readContract: Mock, terms: PolicyTerms): void {
  readContract.mockImplementation(({ address, abi, functionName }: Read) => {
    /** `decimals()` is the only read on the collateral token itself, through the plain ERC-20 ABI. */
    if (address === COLLATERAL) {
      return abi === erc20Abi && functionName === "decimals"
        ? Promise.resolve(terms.collateralDecimals ?? 6)
        : Promise.reject(new Error(`unprogrammed token read: ${functionName}`));
    }
    switch (functionName) {
      case "getGaslessWalletAddress":
        return Promise.resolve(terms.wallet ?? DEPOSIT_ADDRESS);
      case "collateralToken":
        return Promise.resolve(COLLATERAL);
      case "depositFee":
        return Promise.resolve(terms.depositFee);
      case "minimumDeposit":
        return Promise.resolve(terms.minimumDeposit);
      case "getWalletCreationFee":
        return Promise.resolve(terms.walletCreationFee ?? 0n);
      default:
        return Promise.reject(new Error(`unprogrammed read: ${functionName}`));
    }
  });
}

function readsOf(readContract: Mock): Read[] {
  return readContract.mock.calls.map(([read]) => read as Read);
}

describe("getGaslessDepositPolicy", () => {
  it("reads the wallet's deposit address, collateral, fee terms and creation fee from the GaslessLayer", async () => {
    const { config, readContract } = gaslessTestConfig();
    programPolicy(readContract, { depositFee: 30_000n, minimumDeposit: 50_000n, walletCreationFee: 0n });

    const policy = await getGaslessDepositPolicy(config, { chainId: GASLESS_TEST_CHAIN, owner: OWNER });

    expect(policy).toEqual({
      walletId: 0n,
      depositAddress: DEPOSIT_ADDRESS,
      collateralTokenAddress: COLLATERAL,
      collateralDecimals: 6,
      depositFee: 30_000n,
      minimumDeposit: 50_000n,
      walletCreationFee: 0n,
      settlementMinimum: 50_000n,
    });

    const layerReads = readsOf(readContract).filter((read) => read.address !== COLLATERAL);
    expect(layerReads.map((read) => read.functionName).sort()).toEqual([
      "collateralToken",
      "depositFee",
      "getGaslessWalletAddress",
      "getWalletCreationFee",
      "minimumDeposit",
    ]);
    expect(layerReads.every((read) => read.address === TEST_GASLESS.gaslessLayerAddress)).toBe(true);
    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: "getGaslessWalletAddress", args: [OWNER, 0n] }),
    );
    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: "getWalletCreationFee", args: [OWNER, 0n] }),
    );
  });

  it("reads the collateral decimals from the GaslessLayer's own collateral token", async () => {
    const { config, readContract } = gaslessTestConfig();
    programPolicy(readContract, { depositFee: 1n, minimumDeposit: 2n, collateralDecimals: 18 });

    const policy = await getGaslessDepositPolicy(config, { chainId: GASLESS_TEST_CHAIN, owner: OWNER });

    expect(policy.collateralDecimals).toBe(18);
    expect(readContract).toHaveBeenCalledWith({ address: COLLATERAL, abi: erc20Abi, functionName: "decimals" });
  });

  it("reads the address and creation fee of the selected wallet and echoes its id", async () => {
    const { config, readContract } = gaslessTestConfig();
    programPolicy(readContract, { depositFee: 30_000n, minimumDeposit: 50_000n });

    const policy = await getGaslessDepositPolicy(config, { chainId: GASLESS_TEST_CHAIN, owner: OWNER, walletId: 2n });

    expect(policy.walletId).toBe(2n);
    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: "getGaslessWalletAddress", args: [OWNER, 2n] }),
    );
    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: "getWalletCreationFee", args: [OWNER, 2n] }),
    );
  });

  it.each([
    {
      label: "the minimum when it exceeds the fee",
      depositFee: 1_000_000n,
      minimumDeposit: 5_000_000n,
      walletCreationFee: 0n,
      expected: 5_000_000n,
    },
    {
      label: "the minimum when it is exactly one unit above the fee",
      depositFee: 1_000_000n,
      minimumDeposit: 1_000_001n,
      walletCreationFee: 0n,
      expected: 1_000_001n,
    },
    {
      label: "one unit above the fee when the minimum equals it",
      depositFee: 1_000_000n,
      minimumDeposit: 1_000_000n,
      walletCreationFee: 0n,
      expected: 1_000_001n,
    },
    {
      label: "one unit above the fee when the minimum is below it",
      depositFee: 1_000_000n,
      minimumDeposit: 500_000n,
      walletCreationFee: 0n,
      expected: 1_000_001n,
    },
    {
      label: "one unit when there is neither fee nor minimum",
      depositFee: 0n,
      minimumDeposit: 0n,
      walletCreationFee: 0n,
      expected: 1n,
    },
    {
      label: "the minimum when it still exceeds the deposit and creation fees together",
      depositFee: 30_000n,
      minimumDeposit: 50_000n,
      walletCreationFee: 10_000n,
      expected: 50_000n,
    },
    {
      label: "one unit above both fees when the creation fee lifts them to the minimum",
      depositFee: 30_000n,
      minimumDeposit: 50_000n,
      walletCreationFee: 20_000n,
      expected: 50_001n,
    },
    {
      label: "one unit above both fees when the creation fee lifts them past the minimum",
      depositFee: 30_000n,
      minimumDeposit: 50_000n,
      walletCreationFee: 100_000n,
      expected: 130_001n,
    },
  ])("sets settlementMinimum to $label", async ({ depositFee, minimumDeposit, walletCreationFee, expected }) => {
    const { config, readContract } = gaslessTestConfig();
    programPolicy(readContract, { depositFee, minimumDeposit, walletCreationFee });

    const policy = await getGaslessDepositPolicy(config, { chainId: GASLESS_TEST_CHAIN, owner: OWNER });

    /** A settlement must clear the minimum AND leave something after the deposit and creation fees. */
    expect(policy.walletCreationFee).toBe(walletCreationFee);
    expect(policy.settlementMinimum).toBe(expected);
  });

  it("refuses to show a deposit address when the gateway answers the zero address", async () => {
    const { config, readContract } = gaslessTestConfig();
    programPolicy(readContract, { depositFee: 1_000_000n, minimumDeposit: 5_000_000n, wallet: zeroAddress });

    const policy = getGaslessDepositPolicy(config, { chainId: GASLESS_TEST_CHAIN, owner: OWNER, walletId: 1n });

    await expect(policy).rejects.toBeInstanceOf(SymmError);
    await expect(policy).rejects.toMatchObject({ code: "GASLESS_WALLET_UNAVAILABLE", message: /wallet 1 of/ });
  });

  it("rejects a wallet id outside the uint256 range before any RPC call", async () => {
    const { config, readContract } = gaslessTestConfig();

    await expect(
      getGaslessDepositPolicy(config, { chainId: GASLESS_TEST_CHAIN, owner: OWNER, walletId: maxUint256 + 1n }),
    ).rejects.toMatchObject({ code: "GASLESS_WALLET_ID_INVALID" });
    expect(readContract).not.toHaveBeenCalled();
  });
});
