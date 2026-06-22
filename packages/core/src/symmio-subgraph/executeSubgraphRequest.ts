import axios, { isAxiosError } from "axios";
import { SymmApiError, SymmError } from "../shared/errors/symm-error";

/** Shape of a GraphQL-over-HTTP response body. */
interface GraphQLResponse<TResult> {
  /** The query result, present when the operation succeeded. */
  data?: TResult;
  /** GraphQL-level errors (a 200 response can still carry these). */
  errors?: { message: string }[];
}

/**
 * POST a GraphQL query to a subgraph endpoint over the SDK's axios transport and
 * return its typed `data`.
 *
 * The SDK's only GraphQL transport: a single POST, no cache and no batching —
 * TanStack Query owns caching in the framework layer. A `200` carrying GraphQL
 * `errors`, or a response with no `data`, is treated as a failure.
 *
 * @param url - The subgraph endpoint URL.
 * @param query - The serialized GraphQL document text.
 * @param variables - The operation variables.
 * @param errorCode - Stable `SymmError`/`SymmApiError` code for the caller's domain.
 * @returns The operation's `data`.
 * @throws {SymmApiError} on HTTP failure (non-2xx, network error).
 * @throws {SymmError} (`kind: "api"`) when the response carries GraphQL `errors`
 *   or omits `data`.
 */
export async function executeSubgraphRequest<TResult>(
  url: string,
  query: string,
  variables: unknown,
  errorCode: string,
): Promise<TResult> {
  let body: GraphQLResponse<TResult>;
  try {
    const response = await axios.post<GraphQLResponse<TResult>>(
      url,
      { query, variables },
      { headers: { "content-type": "application/json" } },
    );
    body = response.data;
  } catch (err) {
    if (isAxiosError(err)) {
      throw new SymmApiError({
        code: errorCode,
        message: `${errorCode}: ${err.message} (POST ${url} → ${err.response?.status ?? 0} ${err.response?.statusText ?? "Unknown"})`,
        status: err.response?.status ?? 0,
        statusText: err.response?.statusText ?? "Unknown",
        responseData: err.response?.data,
        url,
        method: "POST",
        cause: err,
      });
    }
    throw new SymmError(
      "api",
      errorCode,
      `Subgraph request failed: ${err instanceof Error ? err.message : String(err)}`,
      {
        cause: err instanceof Error ? err : undefined,
      },
    );
  }

  if (body.errors?.length) {
    throw new SymmError(
      "api",
      errorCode,
      `Subgraph query failed: ${body.errors.map((error) => error.message).join("; ")}`,
    );
  }
  if (!body.data) {
    throw new SymmError("api", errorCode, "Subgraph query returned no data.");
  }
  return body.data;
}
