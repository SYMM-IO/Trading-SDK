import type { SymmioSubgraphName } from "../../core/chains/types";
import type { Config } from "../../core/config";
import { SymmError } from "../../shared/errors/symm-error";
import type { ChainIdParameter, Compute } from "../../shared/types/properties";
import { executeSubgraphRequest } from "../executeSubgraphRequest";

/**
 * A typed GraphQL document the subgraph transport can execute.
 *
 * Structurally compatible with the `TypedDocumentString` produced by
 * graphql-codegen (and with a plain template string): {@link querySubgraph}
 * serializes it with `toString()` and infers `TResult` / `TVariables` from the
 * phantom `__apiType` brand. Defined here (rather than importing the codegen
 * class) so the public API does not leak the codegen runtime.
 */
export interface SubgraphDocument<TResult = unknown, TVariables = Record<string, unknown>> {
  toString(): string;
  /** Phantom type carrier — never read at runtime. */
  __apiType?: (variables: TVariables) => TResult;
}

/**
 * Parameters for {@link querySubgraph}.
 */
export type QuerySubgraphParameters<TResult, TVariables> = Compute<
  ChainIdParameter & {
    /** The query document (a codegen `TypedDocumentString` or a raw GraphQL string). */
    document: SubgraphDocument<TResult, TVariables> | string;
    /** The operation variables. */
    variables: TVariables;
    /** Which configured subgraph to query. @default "analytics" */
    subgraph?: SymmioSubgraphName;
  }
>;

/** Return type of {@link querySubgraph}: the operation's `data`. */
export type QuerySubgraphReturnType<TResult> = TResult;

/**
 * Low-level escape hatch: run an arbitrary typed GraphQL document against a
 * configured SYMMIO subgraph (default `analytics`) over the SDK's axios
 * transport. The curated actions (e.g. `getQuoteHistory`) are built on this;
 * power users can call it directly to run their own queries.
 *
 * @param config - The SDK config.
 * @param parameters - The document, its variables, an optional subgraph name and chain id.
 * @returns The operation's `data`, typed by the document.
 * @throws {SymmError} when the chain has no endpoint for the requested subgraph.
 * @throws {SymmApiError} when the HTTP request fails.
 *
 * @example
 * ```ts
 * import { graphql } from "@symm-frontier/core/subgraph";
 * const doc = graphql(`query Q($id: ID!) { quote(id: $id) { quoteStatus } }`);
 * const data = await querySubgraph(config, { document: doc, variables: { id: "8232-…" } });
 * ```
 */
export async function querySubgraph<TResult, TVariables = Record<string, unknown>>(
  config: Config,
  parameters: QuerySubgraphParameters<TResult, TVariables>,
): Promise<QuerySubgraphReturnType<TResult>> {
  const { chainId, document, variables, subgraph = "analytics" } = parameters;
  const chainConfig = config.getChainConfig(chainId);
  const url = chainConfig.subgraphs[subgraph];
  if (!url) {
    throw new SymmError(
      "config",
      "UNCONFIGURED_SUBGRAPH",
      `No "${subgraph}" subgraph endpoint is configured for chain ${chainConfig.chainId}.`,
    );
  }
  return executeSubgraphRequest<TResult>(url, document.toString(), variables, "SUBGRAPH_QUERY_FAILED");
}
