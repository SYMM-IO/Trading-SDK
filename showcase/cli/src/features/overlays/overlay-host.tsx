import type { Overlay } from "../app-state.js";
import { AllocateSheet } from "./allocate-sheet.js";
import { CloseAllSheet } from "./close-all-sheet.js";
import { CloseSheet } from "./close-sheet.js";
import { DepositSheet } from "./deposit-sheet.js";
import { EnableTradingSheet } from "./enable-trading-sheet.js";
import { GroupCloseSheet } from "./group-close-sheet.js";
import { HelpSheet } from "./help-sheet.js";
import { MarginSheet } from "./margin-sheet.js";
import { MarketPickerSheet } from "./market-picker-sheet.js";
import { OrderActionsSheet } from "./order-actions-sheet.js";
import { SubAccountSheet } from "./subaccount-sheet.js";
import { TpSlSheet } from "./tpsl-sheet.js";
import { WalletSheet } from "./wallet-sheet.js";
import { WithdrawSheet } from "./withdraw-sheet.js";

/** Renders the single active overlay. Each sheet owns its own input. */
export function OverlayHost({ overlay }: { overlay: Overlay }) {
  switch (overlay.kind) {
    case "wallet":
      return <WalletSheet active />;
    case "market-picker":
      return <MarketPickerSheet active startSearching={overlay.startSearching} />;
    case "subaccount":
      return <SubAccountSheet active />;
    case "deposit":
      return <DepositSheet active />;
    case "allocate":
      return <AllocateSheet active />;
    case "withdraw":
      return <WithdrawSheet active />;
    case "enable-trading":
      return <EnableTradingSheet active />;
    case "help":
      return <HelpSheet />;
    case "order-actions":
      return <OrderActionsSheet active quote={overlay.quote} />;
    case "close-all":
      return <CloseAllSheet active quotes={overlay.quotes} />;
    case "group-close":
      return <GroupCloseSheet active group={overlay.group} />;
    case "close":
      return <CloseSheet active quote={overlay.quote} />;
    case "margin":
      return <MarginSheet active quote={overlay.quote} />;
    case "tpsl":
      return <TpSlSheet active quote={overlay.quote} />;
  }
}
