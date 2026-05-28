/**
 * A React-Query key builder that has been tagged with the literal prefix it
 * always emits (typically `[...slice.all, methodName]`). `predicateMatch`
 * reads the tag to identify which cache entries the builder produces.
 *
 * Created by {@link defineQueryKey}; not constructed by hand.
 */
export type TaggedQueryKey<TArgs extends readonly unknown[]> = ((...args: TArgs) => readonly unknown[]) & {
  /** Leading segments every key produced by this builder begins with. */
  readonly prefix: readonly unknown[];
};

/**
 * Define a tagged React-Query key builder.
 *
 * The returned function emits `[...prefix, ...buildTail(...args)]` and
 * carries `prefix` as a property so {@link predicateMatch} can recognize
 * its cache entries without re-running the builder.
 *
 * **Contract for `buildTail`.** Each positional argument of the builder must
 * correspond to exactly one trailing segment, in order — typically a plain
 * params object whose field names mirror that argument's field names. This
 * 1:1 mapping is what lets `predicateMatch` line up its variadic partials
 * with cache-key segments by index.
 *
 * @example
 * const getUserSubAccounts = defineQueryKey<[GetUserSubAccountsArgs]>(
 *   [...ROOT, "getUserSubAccounts"],
 *   (args) => [{ chainId: args.chainId, user: args.user }] as const,
 * );
 */
export function defineQueryKey<TArgs extends readonly unknown[]>(
  prefix: readonly unknown[],
  buildTail: (...args: TArgs) => readonly unknown[],
): TaggedQueryKey<TArgs> {
  function build(...args: TArgs) {
    return [...prefix, ...buildTail(...args)] as const;
  }
  return Object.assign(build, { prefix } as const);
}
