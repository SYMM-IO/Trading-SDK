import { isAxiosError } from "axios";
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
 * Framework layers (`@symmio/trading-react`) fold/filter into UI-facing
 * snapshots — `core` keeps the raw shape so consumers can apply their own
 * selection rules.
 *
 * The handler returns a plain array (the openapi spec wraps it in
 * `{ data: [...] }`, but the live response is unwrapped — we cast accordingly).
 *
 * A quote with no conditional orders resolves to `[]` rather than throwing —
 * the handler reports that case as a `404`; see {@link isNoConditionalOrders}.
 *
 * @throws {SymmError} when the chain has no `tpsl` config.
 * @throws {SymmApiError} when the HTTP request fails for any reason other than
 * the handler's "no conditional orders" `404`.
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
    if (isNoConditionalOrders(err)) return [];
    return rethrowTpSlError(err, { code: "FETCH_QUOTE_TPSL_FAILED", baseURL: tpsl.url });
  }
}

/**
 * Whether an error is the handler saying "this quote has no conditional
 * orders" rather than reporting a genuine failure.
 *
 * `GET /api/v5/?quote_id=…` answers a quote that has never had a TP/SL with
 * `404` and a `{ successful, message, … }` envelope instead of `200 []`. Its
 * sibling `POST /api/v5/search/` returns `200 { data: [], count: 0 }` for the
 * same emptiness, so this is a quirk of the one route, and the openapi spec
 * documents neither (it declares only `200` and `422` here). Like the response
 * -shape drift patched in `orval.config.ts`, this is observed wire behavior.
 *
 * Surfacing that `404` as an error made every TP/SL-free quote cost a full
 * retry ladder per modal open, cache nothing, and report an error to consumers
 * folding a group — for the most ordinary state a position can be in.
 *
 * **The envelope, not the bare status, is the test.** A routing or host-level
 * `404` (a decommissioned deployment, a mistyped `tpsl.url`) carries no
 * `successful` field, and must still surface as an error rather than read as
 * "no exits". Its *presence* is what we match: the spec types `successful` as
 * `string | boolean`, so `false` versus `"false"` is not something to lean on,
 * while an infrastructure `404` has neither.
 *
 * Returning `[]` introduces no new state. Once a quote has had a conditional
 * order the row survives cancellation as `state: "canceled"` and the handler
 * answers `200` from then on — and an all-terminated row set already folds to
 * exactly what an empty one does.
 */
function isNoConditionalOrders(err: unknown): boolean {
  if (!isAxiosError(err) || err.response?.status !== 404) return false;
  const body: unknown = err.response.data;
  return typeof body === "object" && body !== null && "successful" in body;
}
