import {
  concatHex,
  decodeFunctionData,
  getAddress,
  keccak256,
  parseUnits,
  sliceHex,
  zeroAddress,
  type Address,
  type PublicClient,
} from "viem";
import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import { SymmioSupportedChainId } from "../../../core/chains";
import { SymmError } from "../../../shared/errors/symm-error";
import { delegationReads, programDelegationReads } from "../../../shared/test/delegation-reads";
import { mockConfig, TEST_USER } from "../../../shared/test/mock-config";
import { accountLayerAbi } from "../../../symmio-contracts/abi/v0.8.6/account-layer";
import { symmioAbi } from "../../../symmio-contracts/abi/v0.8.6/symmio";
import { PositionType } from "../../../symmio-contracts/symmio/types";
import {
  ADD_MARGIN_TO_NEXT_VA_SELECTOR,
  SEND_QUOTE_SELECTOR,
  SEND_QUOTE_WITH_AFFILIATE_AND_DATA_SELECTOR,
} from "../shared/selectors";
import { instantOpen } from "./instant-open";
import type { EnigmaInstantOpenResult, InstantOpenReturnType, RasaInstantOpenResult } from "./types";

const { postInstantTradeInstantOpen, instantRequestForQuoteWithSignatureInstantTradeOpenPost, fetchMuonMock, getInfo } =
  vi.hoisted(() => ({
    postInstantTradeInstantOpen: vi.fn(),
    instantRequestForQuoteWithSignatureInstantTradeOpenPost: vi.fn(),
    fetchMuonMock: vi.fn(),
    getInfo: vi.fn(),
  }));

vi.mock("../../types/generated/enigma-solver", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../types/generated/enigma-solver")>()),
  postInstantTradeInstantOpen,
  getInfo,
}));

vi.mock("../../types/generated/rasa-solver", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../types/generated/rasa-solver")>()),
  instantRequestForQuoteWithSignatureInstantTradeOpenPost,
}));

vi.mock("../../../muon/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../muon/client")>()),
  fetchMuon: fetchMuonMock,
}));

const SUB_ACCOUNT: Address = "0x0000000000000000000000000000000000005Ab1";
const OWNER: Address = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const NONCE: Address = "0xcccccccccccccccccccccccccccccccccccccccc";

const MUON_RAW = {
  reqId: "0x1234",
  data: {
    timestamp: 1_700_000_000,
    result: { uPnl: "-25000000000000000000", price: "50000000000000000000" },
    init: { nonceAddress: NONCE },
  },
  nodeSignature: "0xabcd",
  signatures: [{ signature: "0x63", owner: OWNER }],
};

const RASA_RFQ = {
  position_type: PositionType.LONG,
  temp_quote_id: 4242,
  symbol_id: 1,
  requested_open_price: "50",
  quantity: "1",
  party_a_address: SUB_ACCOUNT,
  cva: "1",
  partyAmm: "1.5",
  partyBmm: "1.5",
  lf: "0.5",
  order_type: 1,
};

function params(overrides: Record<string, unknown> = {}) {
  return {
    subAccountAddress: SUB_ACCOUNT,
    marketId: 1,
    positionType: PositionType.LONG,
    order: { price: 50_000000000000000000n, quantity: 1_000000000000000000n },
    lockedParam: {
      cva: 1_000000000000000000n,
      lf: 500000000000000000n,
      partyAmm: 1_500000000000000000n,
      partyBmm: 1_500000000000000000n,
    },
    margin: { amount: 3_000000000000000000n },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  getInfo.mockReset().mockResolvedValue({ data: {} });
});

describe("instantOpen — Enigma timelock margin", () => {
  const now = 1_700_000_000n;

  function setup() {
    const mocks = mockConfig();
    const getBlock = vi.fn().mockResolvedValue({ timestamp: now });
    const config = {
      ...mocks.config,
      getClient: () => ({ ...mocks.config.getClient(), getBlock }) as unknown as PublicClient,
    };
    const info = {
      timelock_approval: {
        validity_seconds: 60,
        min_timelock_delay_seconds: 600,
        unlocker: OWNER,
        request_domain: {
          name: "SymmioTimelockApprovalRequest",
          version: "1",
          chainId: "42161",
          verifyingContract: config.getChainConfig().addresses.accountLayerAddress,
        },
      },
    };
    getInfo.mockResolvedValue({ data: info });
    mocks.readContract.mockResolvedValue(true);
    postInstantTradeInstantOpen.mockResolvedValue({ data: { temp_quote_id: 7 } });
    return { ...mocks, config, getBlock, info };
  }

  it("signs a canonical wrapper with immutable approval fields and one 65-byte signature flex field", async () => {
    const { config, readContract } = setup();
    await instantOpen(config, params({ preflightDelegation: false, operationDeadline: now + 300n }));

    const [request] = postInstantTradeInstantOpen.mock.lastCall!;
    const operation = request.addMargin.signedOperation;
    const decoded = decodeFunctionData({ abi: accountLayerAbi, data: operation.callData });
    expect(decoded.functionName).toBe("executeTimelockOp");
    if (decoded.functionName !== "executeTimelockOp") throw new Error("Expected timelock wrapper");
    const [approvals, inner] = decoded.args;
    expect(approvals).toHaveLength(1);
    expect(approvals[0]).toMatchObject({
      approval: {
        account: SUB_ACCOUNT,
        unlocker: getAddress(OWNER),
        callDataHash: keccak256(inner),
        deadline: now + 60n,
      },
      signature: `0x${"00".repeat(65)}`,
    });
    expect(decodeFunctionData({ abi: accountLayerAbi, data: inner })).toMatchObject({
      functionName: "addMarginToNextVA",
      args: [SUB_ACCOUNT, 2, 1n, 3_000000000000000000n],
    });
    expect(operation.flexFields).toEqual([
      { offset: 352, length: 65, authorizedFlexFiller: config.getSolver().address },
    ]);
    const signature = `0x${"ab".repeat(65)}` as const;
    const filled = concatHex([sliceHex(operation.callData, 0, 356), signature, sliceHex(operation.callData, 421)]);
    expect(decodeFunctionData({ abi: accountLayerAbi, data: filled })).toEqual({
      ...decoded,
      args: [[{ ...approvals[0], signature }], inner],
    });
    expect(operation.maxUses).toBe(1);
    expect(operation.replayAttackHeader.deadline).toBe(Number(now + 300n));
    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        functionName: "allTimelockedBy",
        args: [SUB_ACCOUNT, OWNER, 600n, expect.arrayContaining([ADD_MARGIN_TO_NEXT_VA_SELECTOR])],
      }),
    );
    const selectors = readContract.mock.calls.find(([call]) => call.functionName === "allTimelockedBy")![0].args[3];
    expect(new Set(selectors).size).toBe(22);
  });

  it("reports missing policy before signing or posting even when delegation preflight is disabled", async () => {
    const { config, readContract, signTypedData, getBlock } = setup();
    readContract.mockResolvedValue(false);
    await expect(instantOpen(config, params({ preflightDelegation: false }))).rejects.toMatchObject({
      code: "INSTANT_OPEN_TIMELOCK_POLICY_REQUIRED",
    });
    expect(signTypedData).not.toHaveBeenCalled();
    expect(postInstantTradeInstantOpen).not.toHaveBeenCalled();
    expect(getBlock).not.toHaveBeenCalled();
  });

  it("checks the fixed inner margin selector rather than requiring delegation for the wrapper", async () => {
    const { config, readContract } = setup();
    programDelegationReads(readContract, {
      owners: { [SUB_ACCOUNT]: OWNER },
      isDelegationActive: (_account, _signer, selector) =>
        selector === ADD_MARGIN_TO_NEXT_VA_SELECTOR || selector === SEND_QUOTE_SELECTOR,
    });
    const delegationRead = readContract.getMockImplementation()!;
    readContract.mockImplementation((read) => (read.functionName === "allTimelockedBy" ? true : delegationRead(read)));

    await expect(instantOpen(config, params())).resolves.toMatchObject({ success: true });
    expect(delegationReads(readContract)).toEqual([
      [SUB_ACCOUNT, TEST_USER, ADD_MARGIN_TO_NEXT_VA_SELECTOR],
      [SUB_ACCOUNT, TEST_USER, SEND_QUOTE_SELECTOR],
    ]);
  });

  it("rejects metadata for a different AccountLayer before any signature", async () => {
    const { config, info, signTypedData, readContract } = setup();
    info.timelock_approval.request_domain.verifyingContract = OWNER;
    await expect(instantOpen(config, params())).rejects.toMatchObject({
      code: "INVALID_INSTANT_OPEN_TIMELOCK_METADATA",
    });
    expect(readContract).not.toHaveBeenCalled();
    expect(signTypedData).not.toHaveBeenCalled();
    expect(postInstantTradeInstantOpen).not.toHaveBeenCalled();
  });

  it.each([
    { unlocker: zeroAddress },
    { unlocker: "not-an-address" },
    { validity_seconds: 29 },
    { validity_seconds: 1.5 },
    { min_timelock_delay_seconds: -1 },
    { min_timelock_delay_seconds: "600" },
    { request_domain: { name: "wrong-domain" } },
  ])("rejects malformed advertised metadata %j without selecting the bare-margin path", async (update) => {
    const { config, info, signTypedData, readContract } = setup();
    getInfo.mockResolvedValue({ data: { timelock_approval: { ...info.timelock_approval, ...update } } });
    await expect(instantOpen(config, params())).rejects.toMatchObject({
      code: "INVALID_INSTANT_OPEN_TIMELOCK_METADATA",
    });
    expect(readContract).not.toHaveBeenCalled();
    expect(signTypedData).not.toHaveBeenCalled();
    expect(postInstantTradeInstantOpen).not.toHaveBeenCalled();
  });

  it("does not downgrade after a metadata fetch failure", async () => {
    const { config, signTypedData } = setup();
    getInfo.mockRejectedValue(new Error("metadata unavailable"));
    await expect(instantOpen(config, params())).rejects.toMatchObject({
      code: "FETCH_INSTANT_OPEN_TIMELOCK_METADATA_FAILED",
    });
    expect(signTypedData).not.toHaveBeenCalled();
    expect(postInstantTradeInstantOpen).not.toHaveBeenCalled();
  });

  it("rejects an approval that becomes too short-lived while the wallet signs", async () => {
    const { config, getBlock, signTypedData } = setup();
    getBlock.mockResolvedValueOnce({ timestamp: now }).mockResolvedValue({ timestamp: now + 31n });
    await expect(instantOpen(config, params({ preflightDelegation: false }))).rejects.toMatchObject({
      code: "INSTANT_OPEN_TIMELOCK_APPROVAL_EXPIRED",
    });
    expect(signTypedData).toHaveBeenCalledTimes(2);
    expect(postInstantTradeInstantOpen).not.toHaveBeenCalled();
  });
});

describe("instantOpen — kind dispatch", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("routes an Arbitrum (Enigma) chain to the two-operation Enigma flow", async () => {
    const { config } = mockConfig();
    postInstantTradeInstantOpen.mockResolvedValue({ data: { temp_quote_id: 7, partyBmm: "1.5" } });

    const result = await instantOpen(config, params());

    expect(result).toEqual({ kind: "enigma", success: true, tempQuoteId: "7", partyBmm: "1.5" });
    expect(instantRequestForQuoteWithSignatureInstantTradeOpenPost).not.toHaveBeenCalled();
    /** Enigma sends both legs. */
    const [request] = postInstantTradeInstantOpen.mock.calls[0]!;
    expect(Object.keys(request).sort()).toEqual(["addMargin", "sendQuote"]);
    /** No Muon call: the lowcap quote carries a placeholder signature. */
    expect(fetchMuonMock).not.toHaveBeenCalled();
  });

  it("delegates only the sendQuote upnlSig region to the Enigma solver", async () => {
    const { config } = mockConfig();
    postInstantTradeInstantOpen.mockResolvedValue({ data: { temp_quote_id: 7 } });

    await instantOpen(config, params());

    const [request] = postInstantTradeInstantOpen.mock.calls[0]!;
    const solverAddress = config.getSolver({ chainId: SymmioSupportedChainId.ARBITRUM }).address;

    expect(request.sendQuote.signedOperation.flexFields).toHaveLength(1);
    expect(request.sendQuote.signedOperation.flexFields[0].authorizedFlexFiller).toBe(solverAddress);
    expect(request.sendQuote.signedOperation.flexFields[0].length).toBeGreaterThan(0);
    /** addMargin carries no delegation — only the quote's signature is fillable. */
    expect(request.addMargin.signedOperation.flexFields).toEqual([]);
  });

  it("signs the chain-generation quote-send call: legacy on v0.8.5, capped sendQuote on v0.8.6", async () => {
    const { config: legacyConfig } = mockConfig({ contractsVersion: "0.8.5" });
    const { config: cappedConfig } = mockConfig();
    postInstantTradeInstantOpen.mockResolvedValue({ data: { temp_quote_id: 7 } });

    await instantOpen(legacyConfig, params({ chainId: SymmioSupportedChainId.ARBITRUM }));
    const [legacyRequest] = postInstantTradeInstantOpen.mock.calls[0]!;
    expect(
      legacyRequest.sendQuote.signedOperation.callData.startsWith(SEND_QUOTE_WITH_AFFILIATE_AND_DATA_SELECTOR),
    ).toBe(true);

    await instantOpen(
      cappedConfig,
      params({ chainId: SymmioSupportedChainId.ARBITRUM, solverFeeCaps: { openRateCap: 1n, closeRateCap: 2n } }),
    );
    const [cappedRequest] = postInstantTradeInstantOpen.mock.calls[1]!;
    expect(cappedRequest.sendQuote.signedOperation.callData.startsWith(SEND_QUOTE_SELECTOR)).toBe(true);
  });

  it("keeps quote expiry, operation expiry and mark price distinct in signed calldata", async () => {
    const { config } = mockConfig();
    postInstantTradeInstantOpen.mockResolvedValue({ data: { temp_quote_id: 7 } });
    await instantOpen(
      config,
      params({ deadline: 1_900_000_300n, operationDeadline: 1_900_000_060n, markPrice: parseUnits("49", 18) }),
    );
    const [request] = postInstantTradeInstantOpen.mock.calls[0]!;
    expect(request.addMargin.signedOperation.replayAttackHeader.deadline).toBe(1900000060);
    expect(request.sendQuote.signedOperation.replayAttackHeader.deadline).toBe(1900000060);
    const decoded = decodeFunctionData({ abi: symmioAbi, data: request.sendQuote.signedOperation.callData });
    expect(decoded.functionName).toBe("sendQuote");
    if (decoded.functionName !== "sendQuote") throw new Error("Unexpected call");
    expect(decoded.args[10]).toBe(1_900_000_300n);
    expect(decoded.args[12].price).toBe(parseUnits("49", 18));
  });

  it("accepts negative temporary quote ids used before an on-chain quote exists", async () => {
    const { config } = mockConfig();
    postInstantTradeInstantOpen.mockResolvedValue({ data: { temp_quote_id: -1765 } });
    await expect(instantOpen(config, params())).resolves.toMatchObject({ success: true, tempQuoteId: "-1765" });
  });

  it.each([
    { successful: false, temp_quote_id: 7 },
    { successful: "false", temp_quote_id: 7 },
    { error_code: 3111, error_message: "Insufficient balance", temp_quote_id: 7 },
    {},
    { temp_quote_id: null },
    { temp_quote_id: 0 },
    { temp_quote_id: "invalid" },
  ])("does not accept an unsuccessful HTTP 200 body: %j", async (data) => {
    const { config } = mockConfig();
    postInstantTradeInstantOpen.mockResolvedValue({ data, status: 200, statusText: "OK" });
    await expect(instantOpen(config, params())).rejects.toMatchObject({ kind: "api", responseData: data });
    expect(postInstantTradeInstantOpen).toHaveBeenCalledTimes(1);
  });

  it("throws a typed error when the Enigma flow is missing its margin", async () => {
    const { config } = mockConfig();
    const withoutMargin = { ...params(), margin: undefined };

    await expect(instantOpen(config, withoutMargin)).rejects.toThrow(SymmError);
    expect(postInstantTradeInstantOpen).not.toHaveBeenCalled();
  });

  it("routes a Base (Rasa) chain to the single-operation Rasa flow with a live Muon signature", async () => {
    const { config } = mockConfig();
    fetchMuonMock.mockResolvedValue(MUON_RAW);
    instantRequestForQuoteWithSignatureInstantTradeOpenPost.mockResolvedValue({ data: RASA_RFQ });

    const result = await instantOpen(config, params({ chainId: SymmioSupportedChainId.BASE }));

    expect(result.kind).toBe("rasa");
    expect(result.tempQuoteId).toBe("4242");
    expect(postInstantTradeInstantOpen).not.toHaveBeenCalled();

    /** Exactly one leg, and no `addMargin` key at all — Rasa is cross-margin. */
    const [request] = instantRequestForQuoteWithSignatureInstantTradeOpenPost.mock.calls[0]!;
    expect(Object.keys(request)).toEqual(["sendQuote"]);
    expect(request).not.toHaveProperty("addMargin");
    /** Nothing to delegate: the quote already carries a real signature. */
    expect(request.sendQuote.signedOperation.flexFields).toEqual([]);
    /** The operation runs under the sub-account, not a virtual account. */
    expect(request.sendQuote.signedOperation.signerAccount.addr).toBe(SUB_ACCOUNT);
  });

  it("fetches the Rasa Muon attestation before signing, not after", async () => {
    const { config, signTypedData } = mockConfig();
    const order: string[] = [];
    fetchMuonMock.mockImplementation(async () => {
      order.push("muon");
      return MUON_RAW;
    });
    signTypedData.mockImplementation(async () => {
      order.push("sign");
      return `0x${"ab".repeat(65)}`;
    });
    instantRequestForQuoteWithSignatureInstantTradeOpenPost.mockResolvedValue({ data: RASA_RFQ });

    await instantOpen(config, params({ chainId: SymmioSupportedChainId.BASE }));

    /** The signature is encoded inside the signed calldata — order is load-bearing. */
    expect(order).toEqual(["muon", "sign"]);
  });

  it("normalizes the Rasa response into the shared instant-open shape", async () => {
    const { config } = mockConfig();
    fetchMuonMock.mockResolvedValue(MUON_RAW);
    instantRequestForQuoteWithSignatureInstantTradeOpenPost.mockResolvedValue({ data: RASA_RFQ });

    const result = (await instantOpen(config, {
      ...params({ chainId: SymmioSupportedChainId.BASE }),
      solverId: "rasa",
    })) as RasaInstantOpenResult;

    expect(result.rfq).toMatchObject({ kind: "rasa", tempQuoteId: 4242, marketId: 1, partyA: SUB_ACCOUNT });
  });

  it("narrows the return type from a literal solverId", () => {
    expectTypeOf<InstantOpenReturnType<"rasa">>().toEqualTypeOf<RasaInstantOpenResult>();
    expectTypeOf<InstantOpenReturnType<"enigma">>().toEqualTypeOf<EnigmaInstantOpenResult>();
    expectTypeOf<InstantOpenReturnType>().toEqualTypeOf<EnigmaInstantOpenResult | RasaInstantOpenResult>();
  });
});

describe("instantOpen — delegation preflight", () => {
  /** The stub wallet always signs as `TEST_USER`; owning the sub-account elsewhere makes it a delegate. */
  const SUB_ACCOUNT_OWNER: Address = "0x0000000000000000000000000000000000000a11";

  afterEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    { contractsVersion: "0.8.6", openSelector: SEND_QUOTE_SELECTOR },
    { contractsVersion: "0.8.5", openSelector: SEND_QUOTE_WITH_AFFILIATE_AND_DATA_SELECTOR },
  ] as const)(
    "checks the two Enigma operations it signs on a $contractsVersion chain",
    async ({ contractsVersion, openSelector }) => {
      const { config, readContract } = mockConfig({ contractsVersion });
      programDelegationReads(readContract, { owners: { [SUB_ACCOUNT]: SUB_ACCOUNT_OWNER } });
      postInstantTradeInstantOpen.mockResolvedValue({ data: { temp_quote_id: 7 } });

      await instantOpen(config, params());

      expect(delegationReads(readContract)).toEqual([
        [SUB_ACCOUNT, TEST_USER, ADD_MARGIN_TO_NEXT_VA_SELECTOR],
        [SUB_ACCOUNT, TEST_USER, openSelector],
      ]);
    },
  );

  it("throws INSTANT_SIGNER_NOT_DELEGATED before signing or posting when the Enigma signer lacks a selector", async () => {
    const { config, readContract, signTypedData } = mockConfig();
    programDelegationReads(readContract, {
      owners: { [SUB_ACCOUNT]: SUB_ACCOUNT_OWNER },
      isDelegationActive: (_delegator, _delegate, selector) => selector !== SEND_QUOTE_SELECTOR,
    });

    const open = instantOpen(config, params());

    await expect(open).rejects.toMatchObject({ code: "INSTANT_SIGNER_NOT_DELEGATED" });
    await expect(open).rejects.toThrowError(SEND_QUOTE_SELECTOR);
    expect(signTypedData).not.toHaveBeenCalled();
    expect(postInstantTradeInstantOpen).not.toHaveBeenCalled();
  });

  it("checks the Rasa quote-send it signs, and stops before signing or posting when it is missing", async () => {
    const { config, readContract, signTypedData } = mockConfig();
    programDelegationReads(readContract, {
      owners: { [SUB_ACCOUNT]: SUB_ACCOUNT_OWNER },
      isDelegationActive: () => false,
    });
    fetchMuonMock.mockResolvedValue(MUON_RAW);
    instantRequestForQuoteWithSignatureInstantTradeOpenPost.mockResolvedValue({ data: RASA_RFQ });

    await expect(instantOpen(config, params({ chainId: SymmioSupportedChainId.BASE }))).rejects.toMatchObject({
      code: "INSTANT_SIGNER_NOT_DELEGATED",
    });
    expect(delegationReads(readContract)).toEqual([
      [SUB_ACCOUNT, TEST_USER, SEND_QUOTE_WITH_AFFILIATE_AND_DATA_SELECTOR],
    ]);
    expect(signTypedData).not.toHaveBeenCalled();
    expect(instantRequestForQuoteWithSignatureInstantTradeOpenPost).not.toHaveBeenCalled();
  });

  it("makes no delegation reads when the signer owns the sub-account", async () => {
    const { config, readContract } = mockConfig();
    programDelegationReads(readContract, { owners: { [SUB_ACCOUNT]: TEST_USER }, isDelegationActive: () => false });
    postInstantTradeInstantOpen.mockResolvedValue({ data: { temp_quote_id: 7 } });

    await expect(instantOpen(config, params())).resolves.toMatchObject({ success: true });
    expect(delegationReads(readContract)).toEqual([]);
  });

  it("skips the check entirely with preflightDelegation: false", async () => {
    const { config, readContract, signTypedData } = mockConfig();
    programDelegationReads(readContract, {
      owners: { [SUB_ACCOUNT]: SUB_ACCOUNT_OWNER },
      isDelegationActive: () => false,
    });
    postInstantTradeInstantOpen.mockResolvedValue({ data: { temp_quote_id: 7 } });

    await expect(instantOpen(config, params({ preflightDelegation: false }))).resolves.toMatchObject({ success: true });
    expect(readContract).not.toHaveBeenCalled();
    expect(signTypedData).toHaveBeenCalledTimes(2);
  });
});
