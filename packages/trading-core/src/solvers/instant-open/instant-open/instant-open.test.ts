import type { Address } from "viem";
import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import { SymmioSupportedChainId } from "../../../core/chains";
import { SymmError } from "../../../shared/errors/symm-error";
import { mockConfig } from "../../../shared/test/mock-config";
import { PositionType } from "../../../symmio-contracts/symmio/types";
import { SEND_QUOTE_SELECTOR, SEND_QUOTE_WITH_AFFILIATE_AND_DATA_SELECTOR } from "../shared/selectors";
import { instantOpen } from "./instant-open";
import type { EnigmaInstantOpenResult, InstantOpenReturnType, RasaInstantOpenResult } from "./types";

const { postInstantTradeInstantOpen, instantRequestForQuoteWithSignatureInstantTradeOpenPost, fetchMuonMock } =
  vi.hoisted(() => ({
    postInstantTradeInstantOpen: vi.fn(),
    instantRequestForQuoteWithSignatureInstantTradeOpenPost: vi.fn(),
    fetchMuonMock: vi.fn(),
  }));

vi.mock("../../types/generated/enigma-solver", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../types/generated/enigma-solver")>()),
  postInstantTradeInstantOpen,
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

describe("instantOpen — kind dispatch", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("routes a HyperEVM (Enigma) chain to the two-operation Enigma flow", async () => {
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
    const solverAddress = config.getSolver({ chainId: SymmioSupportedChainId.HYPER_EVM }).address;

    expect(request.sendQuote.signedOperation.flexFields).toHaveLength(1);
    expect(request.sendQuote.signedOperation.flexFields[0].authorizedFlexFiller).toBe(solverAddress);
    expect(request.sendQuote.signedOperation.flexFields[0].length).toBeGreaterThan(0);
    /** addMargin carries no delegation — only the quote's signature is fillable. */
    expect(request.addMargin.signedOperation.flexFields).toEqual([]);
  });

  it("signs the chain-generation quote-send call: legacy on v0.8.5, capped sendQuote on v0.8.6", async () => {
    const { config } = mockConfig();
    postInstantTradeInstantOpen.mockResolvedValue({ data: { temp_quote_id: 7 } });

    await instantOpen(config, params({ chainId: SymmioSupportedChainId.HYPER_EVM }));
    const [legacyRequest] = postInstantTradeInstantOpen.mock.calls[0]!;
    expect(
      legacyRequest.sendQuote.signedOperation.callData.startsWith(SEND_QUOTE_WITH_AFFILIATE_AND_DATA_SELECTOR),
    ).toBe(true);

    await instantOpen(
      config,
      params({ chainId: SymmioSupportedChainId.ARBITRUM, solverFeeCaps: { openRateCap: 1n, closeRateCap: 2n } }),
    );
    const [cappedRequest] = postInstantTradeInstantOpen.mock.calls[1]!;
    expect(cappedRequest.sendQuote.signedOperation.callData.startsWith(SEND_QUOTE_SELECTOR)).toBe(true);
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
