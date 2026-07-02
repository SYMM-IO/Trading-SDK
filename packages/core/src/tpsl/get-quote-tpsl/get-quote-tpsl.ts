import type { Config } from "../../core/config";
import type { ChainIdParameter, Compute } from "../../shared/types/properties";
import { rethrowTpSlError } from "../internal/axios";
import { resolveTpSlConfig } from "../internal/resolve-tpsl-config";
import { getConditionalOrdersV5ApiV5Get, type ConditionalOrderResponseSchema } from "../types/generated/tpsl-handler";
export type {
  PriceActionType as QuoteTpSlActionPriceType,
  ConditionalOrderType as QuoteTpSlConditionalOrderType,
  ConditionalOrdersState as QuoteTpSlRowState,
} from "../types/generated/tpsl-handler";

/**
 * One conditional-order row as returned by `GET /api/v5/?quote_id=…`.
 *
 * The shape comes from the orval-generated client; the openapi spec was
 * patched by `input.override.transformer` in `orval.config.ts` to reflect the
 * live wire format (numeric prices, `conditional_order_price`,
 * `action_price_type`, + `position_type` / `close_status` / `create_time` /
 * `modify_time`). Drop the transformer once the backend ships a corrected
 * spec.
 */
export type QuoteTpSlRow = ConditionalOrderResponseSchema;

/** Parameters for {@link getQuoteTpSl}. */
export type GetQuoteTpSlParameters = Compute<
  ChainIdParameter & {
    /** On-chain quote id. */
    quoteId: bigint;
  }
>;

/** Return type of {@link getQuoteTpSl}. */
export type GetQuoteTpSlReturnType = QuoteTpSlRow[];

/**
 * Read the raw TP/SL rows for one on-chain quote from the handler.
 *
 * Hits `GET /api/v5/?quote_id=<id>`. Returns the full row list (every state).
 * Framework layers (`@symm-frontier/react`) fold/filter into UI-facing
 * snapshots — `core` keeps the raw shape so consumers can apply their own
 * selection rules.
 *
 * The handler returns a plain array (the openapi spec wraps it in
 * `{ data: [...] }`, but the live response is unwrapped — we cast accordingly).
 *
 * @throws {SymmError} when the chain has no `tpsl` config.
 * @throws {SymmApiError} when the HTTP request fails.
 */
export async function getQuoteTpSl(config: Config, parameters: GetQuoteTpSlParameters): Promise<QuoteTpSlRow[]> {
  const tpsl = resolveTpSlConfig(config, parameters.chainId);
  try {
    const response = await getConditionalOrdersV5ApiV5Get(
      { quote_id: Number(parameters.quoteId) },
      {
        baseURL: tpsl.url,
        headers: { "App-Name": tpsl.appName, Accept: "application/json" },
      },
    );
    return (response.data ?? []) as unknown as QuoteTpSlRow[];
  } catch (err) {
    return rethrowTpSlError(err, { code: "FETCH_QUOTE_TPSL_FAILED", baseURL: tpsl.url });
  }
}
