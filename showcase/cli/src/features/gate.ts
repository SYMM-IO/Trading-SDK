import { isIsolationCompatibleWithSolver } from "../lib/sub-account.js";
import { useTradingBalance } from "../sdk/use-balances.js";
import { useTradingDelegation } from "../sdk/use-delegation.js";
import { useSdkScope } from "../sdk/use-sdk-scope.js";
import { useSigner } from "../sdk/use-signer.js";
import { useSubAccount } from "../sdk/use-sub-accounts.js";

/** The next thing a user must do before they can open a position. */
export type GateAction =
  | "connect"
  | "select-subaccount"
  | "select-compatible-subaccount"
  | "deposit"
  | "enable-trading"
  | "ready";

export interface GateState {
  action: GateAction;
  isReady: boolean;
  canSign: boolean;
  hasSubAccount: boolean;
  isFunded: boolean;
  hasSessionKey: boolean;
  delegationsActive: boolean;
  isChecking: boolean;
  /** A short imperative label for the status bar / CTA. */
  label: string;
}

const LABELS: Record<GateAction, string> = {
  connect: "Connect a signing wallet",
  "select-subaccount": "Create or select a sub-account",
  "select-compatible-subaccount": "Select a compatible sub-account",
  deposit: "Deposit collateral",
  "enable-trading": "Enable one-tap trading",
  ready: "Ready to trade",
};

/**
 * The readiness ladder every trading surface gates on: connect → compatible
 * sub-account → funded → unexpired session-key delegations → ready. Each rung
 * hides everything below it and follows deployment/account switches.
 */
export function useGate(): GateState {
  const { solverId } = useSdkScope();
  const { canSign, sessionKeyAddress, sessionKeyExpiresAt } = useSigner();
  const { subAccount, subAccountDetail } = useSubAccount();
  const balance = useTradingBalance(subAccount);
  const delegation = useTradingDelegation();

  const hasSubAccount = Boolean(subAccount);
  const hasCompatibleSubAccount = isIsolationCompatibleWithSolver(subAccountDetail?.isolationType, solverId);
  const isFunded = (balance.data ?? 0n) > 0n;
  const hasSessionKey = Boolean(sessionKeyAddress && sessionKeyExpiresAt != null && sessionKeyExpiresAt > Date.now());
  const delegationsActive = delegation.isActive;

  let action: GateAction = "ready";
  if (!canSign) action = "connect";
  else if (!hasSubAccount) action = "select-subaccount";
  else if (!hasCompatibleSubAccount) action = "select-compatible-subaccount";
  else if (!isFunded) action = "deposit";
  else if (!hasSessionKey || !delegationsActive) action = "enable-trading";

  return {
    action,
    isReady: action === "ready",
    canSign,
    hasSubAccount,
    isFunded,
    hasSessionKey,
    delegationsActive,
    isChecking: balance.isLoading || delegation.isChecking,
    label: LABELS[action],
  };
}
