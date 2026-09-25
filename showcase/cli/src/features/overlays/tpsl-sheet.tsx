import {
  getIsDelegationActive,
  grantDelegation,
  PositionType,
  REQUEST_TO_CLOSE_POSITION_SELECTOR,
  validateTpSl,
  type TpSlConfig,
  type TpSlValidation,
  type UnifiedQuote,
} from "@symmio/trading-core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Box, Text, useInput } from "ink";
import { useEffect, useRef, useState } from "react";
import { formatUnits } from "viem";
import { glyph, theme } from "../../config/theme.js";
import { formatError } from "../../lib/error.js";
import { formatPercent, formatPrice } from "../../lib/format.js";
import { parseAmount } from "../../lib/parse-amount.js";
import { cohWalletAddress } from "../../sdk/chain.js";
import { confirmTransaction } from "../../sdk/confirm-transaction.js";
import { useSetTpSl } from "../../sdk/mutations.js";
import { useGrantTradingDelegation, useTradingDelegation } from "../../sdk/use-delegation.js";
import { useMarketLookup } from "../../sdk/use-markets.js";
import { useSdkScope } from "../../sdk/use-sdk-scope.js";
import { useSigner } from "../../sdk/use-signer.js";
import { useSubAccount } from "../../sdk/use-sub-accounts.js";
import { useQuoteTpSl, useTpSlConfig } from "../../sdk/use-tpsl.js";
import { Field } from "../../ui/controls.js";
import { ErrorLine, LoadingLine } from "../../ui/feedback.js";
import { KeyValue } from "../../ui/kit.js";
import { Sheet } from "../../ui/sheet.js";
import { useAppState } from "../app-state.js";
import { useFormNav } from "../form-nav.js";
import { useToast } from "../toast.js";

function validateDraft(
  tpPrice: string,
  slPrice: string,
  openPrice: string,
  positionType: PositionType,
  pricePrecision: number,
  config: TpSlConfig,
): TpSlValidation {
  const takeProfitPrice = tpPrice.trim();
  const stopLossPrice = slPrice.trim();
  const tpError =
    takeProfitPrice && parseAmount(takeProfitPrice, 18) == null ? "Enter a positive decimal price" : undefined;
  const slError =
    stopLossPrice && parseAmount(stopLossPrice, 18) == null ? "Enter a positive decimal price" : undefined;
  if (tpError || slError) return { ok: false, tpError, slError };

  return validateTpSl({
    takeProfitPrice: takeProfitPrice || undefined,
    stopLossPrice: stopLossPrice || undefined,
    openPrice,
    positionType,
    pricePrecision,
    config,
  });
}

/**
 * Attach take-profit / stop-loss to a position. TP/SL is executed by the
 * solver's conditional-order-handler (COH) wallet, so both the signing session
 * key's trading delegation and the handler's close-only delegation must be
 * active before the trigger form can submit.
 */
export function TpSlSheet({ active, quote }: { active: boolean; quote: UnifiedQuote }) {
  const { config, chainId, solverId } = useSdkScope();
  const { byId } = useMarketLookup();
  const { subAccount } = useSubAccount();
  const { closeOverlay } = useAppState();
  const toast = useToast();
  const queryClient = useQueryClient();
  const setTpSl = useSetTpSl();
  const tradingDelegation = useTradingDelegation();
  const grantTradingDelegation = useGrantTradingDelegation();
  const { sessionKeyAddress, sessionKeyExpiresAt } = useSigner();

  const meta = byId.get(String(quote.symbolId));
  const cohWallet = cohWalletAddress(config, chainId, solverId);
  const tpSlConfig = useTpSlConfig(Boolean(cohWallet));

  const cohDelegation = useQuery({
    queryKey: ["coh-delegation", chainId, subAccount, cohWallet],
    enabled: Boolean(subAccount && cohWallet),
    queryFn: () =>
      getIsDelegationActive(config, {
        chainId,
        account: subAccount as `0x${string}`,
        delegate: cohWallet as `0x${string}`,
        selector: REQUEST_TO_CLOSE_POSITION_SELECTOR,
      }),
  });

  const cohActive = cohDelegation.data === true;
  const sessionKeyUsable = Boolean(
    sessionKeyAddress && sessionKeyExpiresAt != null && sessionKeyExpiresAt > Date.now(),
  );
  const delegationsReady = sessionKeyUsable && tradingDelegation.isActive && cohActive;
  const delegationChecksLoading = tradingDelegation.isChecking || cohDelegation.isLoading;
  const delegationReadError = tradingDelegation.error ?? cohDelegation.error;
  const [grantStep, setGrantStep] = useState<"session" | "handler" | null>(null);

  const grantMissingDelegations = useMutation({
    mutationFn: async () => {
      if (!subAccount) throw new Error("Select a sub-account first.");
      if (!sessionKeyAddress) throw new Error("Initialize a session key before authorizing TP/SL.");
      if (!sessionKeyExpiresAt || sessionKeyExpiresAt <= Date.now()) {
        throw new Error("The local session key expired. Reconnect the wallet before authorizing TP/SL.");
      }
      if (!cohWallet) throw new Error("TP/SL is not configured for this deployment.");

      // Each grant is a separate owner-signed write. Wait for its receipt before
      // opening the next wallet prompt so nonces cannot race.
      if (!tradingDelegation.isActive) {
        setGrantStep("session");
        await grantTradingDelegation.mutateAsync();
      }
      if (!cohActive) {
        setGrantStep("handler");
        await confirmTransaction(
          config,
          chainId,
          grantDelegation(config, {
            chainId,
            account: { addr: subAccount, isPartyB: false },
            delegatedSigner: cohWallet,
            selectors: [REQUEST_TO_CLOSE_POSITION_SELECTOR],
            expiryTimestamp: BigInt(Math.floor(sessionKeyExpiresAt / 1000)),
          }),
        );
      }
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["delegation", chainId, subAccount] }),
        queryClient.invalidateQueries({ queryKey: ["coh-delegation", chainId, subAccount, cohWallet] }),
      ]);
      toast.push("success", "TP/SL authorizations enabled");
    },
    onSettled: () => setGrantStep(null),
  });

  const existing = useQuoteTpSl(quote);
  const [tpPrice, setTpPrice] = useState("");
  const [slPrice, setSlPrice] = useState("");
  const { row } = useFormNav(3, active && delegationsReady, (current) => current === 0 || current === 1);

  /**
   * Seed the fields from the orders the handler already holds, so the sheet
   * reads as an edit of the live triggers rather than a blank slate — and so
   * resubmitting one side does not silently drop the other.
   */
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current || !existing) return;
    seeded.current = true;
    if (existing.tp) setTpPrice(existing.tp);
    if (existing.sl) setSlPrice(existing.sl);
  }, [existing]);

  const tp = tpPrice.trim() ? { triggerPrice: tpPrice.trim(), priceType: "markPrice" as const } : undefined;
  const sl = slPrice.trim() ? { triggerPrice: slPrice.trim(), priceType: "markPrice" as const } : undefined;
  const openPriceRaw =
    quote.openedPrice != null && quote.openedPrice > 0n ? quote.openedPrice : quote.requestedOpenPrice;
  const openPrice = formatUnits(openPriceRaw, 18);
  const validation =
    meta && openPriceRaw > 0n && tpSlConfig.data
      ? validateDraft(tpPrice, slPrice, openPrice, quote.positionType, meta.pricePrecision, tpSlConfig.data)
      : undefined;
  const tpError = validation && !validation.ok ? validation.tpError : undefined;
  const slError = validation && !validation.ok ? validation.slError : undefined;
  const canSubmit = Boolean(
    meta &&
    subAccount &&
    quote.quoteId != null &&
    (tp || sl) &&
    delegationsReady &&
    openPriceRaw > 0n &&
    tpSlConfig.data &&
    validation?.ok &&
    !setTpSl.isPending,
  );
  const isLong = quote.positionType === PositionType.LONG;

  useEffect(() => {
    if (setTpSl.isSuccess) {
      toast.push("info", "TP/SL submitted — confirming");
      closeOverlay();
    }
  }, [setTpSl.isSuccess, toast, closeOverlay]);

  function submit() {
    if (!canSubmit || !meta || !subAccount || quote.quoteId == null) return;
    setTpSl.mutate({
      quoteId: quote.quoteId,
      virtualAccount: quote.vaAddress ?? quote.partyA,
      subAccount,
      symbolId: quote.symbolId,
      positionType: quote.positionType,
      quantity: formatUnits(quote.openQuantity, 18),
      pricePrecision: meta.pricePrecision,
      ...(tp ? { tp } : {}),
      ...(sl ? { sl } : {}),
    });
  }

  useInput(
    (_input, key) => {
      if (!delegationsReady) {
        if (
          key.return &&
          !delegationChecksLoading &&
          delegationReadError == null &&
          !grantMissingDelegations.isPending &&
          cohWallet &&
          subAccount &&
          sessionKeyUsable
        ) {
          grantMissingDelegations.mutate();
        }
      } else if (row === 2 && key.return) submit();
    },
    { isActive: active },
  );

  if (!cohWallet) {
    return (
      <Sheet title="Take-profit / Stop-loss">
        <Text color={theme.warning}>TP/SL is not configured for this chain.</Text>
      </Sheet>
    );
  }

  return (
    <Sheet title={`TP / SL ${glyph.dot} ${meta?.symbol ?? ""}`} subtitle="conditional orders">
      {!delegationsReady ? (
        <Box flexDirection="column">
          <Text color={theme.muted}>
            TP/SL needs the session key to sign each order and the handler wallet to fire its close. Authorize each
            missing delegate to continue.
          </Text>
          <Box marginTop={1} flexDirection="column">
            <Text color={tradingDelegation.isActive ? theme.positive : theme.warning}>
              {tradingDelegation.isActive ? glyph.check : glyph.dot} Session-key trading delegation
            </Text>
            <Text color={cohActive ? theme.positive : theme.warning}>
              {cohActive ? glyph.check : glyph.dot} Handler close delegation
            </Text>
          </Box>
          <Box marginTop={1} flexDirection="column">
            {grantMissingDelegations.isPending ? (
              <LoadingLine
                label={
                  grantStep === "handler"
                    ? "Authorizing handler close — waiting for receipt…"
                    : "Authorizing session key — waiting for receipt…"
                }
              />
            ) : delegationChecksLoading ? (
              <LoadingLine label="Checking authorizations…" />
            ) : !sessionKeyUsable ? (
              <Text color={theme.warning}>
                {sessionKeyAddress
                  ? "The local session key expired. Reconnect the wallet before enabling TP/SL."
                  : "Initialize a session key before enabling TP/SL."}
              </Text>
            ) : delegationReadError != null ? (
              <ErrorLine message={formatError(delegationReadError)} />
            ) : (
              <Text backgroundColor={theme.primary} color={theme.onAccent} bold>
                {` ${glyph.caret} ${!tradingDelegation.isActive && !cohActive ? "Authorize both" : tradingDelegation.isActive ? "Authorize handler" : "Authorize session key"}  ⏎ `}
              </Text>
            )}
            {grantMissingDelegations.error != null && (
              <ErrorLine message={formatError(grantMissingDelegations.error)} />
            )}
          </Box>
          <Box marginTop={1}>
            <Text color={theme.faint}>Each missing authorization is confirmed on-chain before the next begins.</Text>
          </Box>
        </Box>
      ) : (
        <Box flexDirection="column" gap={1}>
          <Field
            label="Take profit"
            value={tpPrice}
            onChange={setTpPrice}
            focused={row === 0}
            suffix="price"
            placeholder="—"
            invalid={tpError != null}
            hint={tpError ?? `Must be ${isLong ? "above" : "below"} the entry price`}
          />
          <Field
            label="Stop loss"
            value={slPrice}
            onChange={setSlPrice}
            focused={row === 1}
            suffix="price"
            placeholder="—"
            invalid={slError != null}
            hint={slError ?? `Must be ${isLong ? "below" : "above"} the entry price`}
          />
          <KeyValue label="Entry" value={formatPrice(openPrice, meta?.pricePrecision)} />
          <KeyValue
            label="Size"
            value={`${formatUnits(quote.openQuantity, 18)} ${(meta?.symbol ?? "").replace("USDT", "")}`}
          />
          {tpSlConfig.data != null && (
            <KeyValue
              label="Rules"
              value={`≥${formatPercent(tpSlConfig.data.minPriceDistancePercent)} from entry · ≥${formatPercent(tpSlConfig.data.minProfitStopLossSpreadPercent)} spread`}
              dim
            />
          )}
          <Box marginTop={1} flexDirection="column">
            {setTpSl.isPending ? (
              <LoadingLine label="Submitting TP/SL…" />
            ) : tpSlConfig.isLoading ? (
              <LoadingLine label="Loading handler rules…" />
            ) : (
              <Text
                backgroundColor={canSubmit ? theme.primary : undefined}
                color={canSubmit ? theme.onAccent : row === 2 ? theme.primaryBright : theme.faint}
                bold
              >
                {row === 2 ? `${glyph.caret} ` : "  "}
                {" Submit TP/SL "}
                {row === 2 ? " ⏎" : ""}
              </Text>
            )}
            <Text color={theme.faint}>Leave a field blank to skip that leg. Confirmed live over the socket.</Text>
            {openPriceRaw <= 0n && <ErrorLine message="Entry price is unavailable; TP/SL cannot be validated." />}
            {tpSlConfig.error != null && <ErrorLine message={formatError(tpSlConfig.error)} />}
            {setTpSl.error != null && <ErrorLine message={formatError(setTpSl.error)} />}
          </Box>
        </Box>
      )}
    </Sheet>
  );
}
