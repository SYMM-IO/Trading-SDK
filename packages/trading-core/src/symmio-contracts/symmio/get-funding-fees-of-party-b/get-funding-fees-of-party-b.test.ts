import type { Address } from "viem";
import { mainnet } from "viem/chains";
import { describe, expect, it } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../../core/chains";
import { SymmError } from "../../../shared/errors/symm-error";
import { mockConfig } from "../../../shared/test/mock-config";
import { symmioAbi } from "../../abi/v0.8.6/symmio";
import { getFundingFeesOfPartyB } from "./get-funding-fees-of-party-b";
import type { FundingFee } from "./types";

const DEFAULT = getChainConfig(SymmioSupportedChainId.HYPER_EVM);
const ARBITRUM = getChainConfig(SymmioSupportedChainId.ARBITRUM);
const PARTY_B: Address = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

/** A decoded accruing-pair struct, with negative rates to prove no re-signing happens. */
const FUNDING_FEE: FundingFee = {
  currentLongRate: 12n,
  currentShortRate: -12n,
  accumulatedLongRate: 10n,
  accumulatedShortRate: -10n,
  lastUpdatedEpoch: 500n,
  lastUpdatedTimeStamp: 1_800_000n,
  startEpochTimeStamp: 1_700_000n,
  startEpoch: 472n,
  epochDuration: 3_600n,
  snapshotLongFee: 3n,
  snapshotShortFee: -3n,
};

describe("getFundingFeesOfPartyB", () => {
  it("reads getFundingFeesOfPartyB from the SYMMIO core by symbol id and partyB", async () => {
    const { config, readContract } = mockConfig();
    readContract.mockResolvedValueOnce(FUNDING_FEE);

    await getFundingFeesOfPartyB(config, { symbolId: 7n, partyB: PARTY_B });

    expect(readContract).toHaveBeenCalledWith({
      address: DEFAULT.addresses.symmioAddress,
      abi: symmioAbi,
      functionName: "getFundingFeesOfPartyB",
      args: [7n, PARTY_B],
    });
  });

  it("returns the struct verbatim — rates stay cost-positive", async () => {
    const { config, readContract } = mockConfig();
    readContract.mockResolvedValueOnce(FUNDING_FEE);

    await expect(getFundingFeesOfPartyB(config, { symbolId: 7n, partyB: PARTY_B })).resolves.toEqual(FUNDING_FEE);
  });

  it("reads the Arbitrum diamond when chainId targets Arbitrum", async () => {
    const { config, readContract } = mockConfig();
    readContract.mockResolvedValueOnce(FUNDING_FEE);

    await getFundingFeesOfPartyB(config, {
      chainId: SymmioSupportedChainId.ARBITRUM,
      symbolId: 7n,
      partyB: PARTY_B,
    });

    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: ARBITRUM.addresses.symmioAddress,
        functionName: "getFundingFeesOfPartyB",
      }),
    );
  });

  it("throws a SymmError for an unsupported chain", async () => {
    const { config, readContract } = mockConfig();

    await expect(
      getFundingFeesOfPartyB(config, { chainId: mainnet.id, symbolId: 7n, partyB: PARTY_B }),
    ).rejects.toThrow(SymmError);
    expect(readContract).not.toHaveBeenCalled();
  });
});
