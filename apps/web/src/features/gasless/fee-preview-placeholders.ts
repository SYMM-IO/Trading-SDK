import type { SingleUpnlSig } from "@symmio/trading-core";
import { zeroAddress } from "viem";

/**
 * Stand-in for the Muon uPnL signature a `deallocate` or `removeMargin` write
 * fetches only when it is sent. The GaslessLayer prices a relayed write by its
 * selector and its payer — never by this argument — so a fee preview can price
 * the call before any signature exists. Never send it: the contract would
 * reject it.
 */
export const FEE_PREVIEW_UPNL_SIG: SingleUpnlSig = {
  reqId: "0x",
  timestamp: 0n,
  upnl: 0n,
  gatewaySignature: "0x",
  sigs: { signature: 0n, owner: zeroAddress, nonce: zeroAddress },
};
