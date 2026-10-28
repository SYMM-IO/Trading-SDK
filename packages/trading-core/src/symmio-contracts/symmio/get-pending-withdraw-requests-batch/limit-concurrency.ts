/**
 * Run tasks with at most `limit` in flight, in arrival order.
 *
 * A finished task hands its slot straight to the next waiting task, so a new
 * caller can never slip in between and push the count over `limit`. Once one
 * task fails, tasks that have not started yet reject with that same failure
 * instead of running: the caller is going to discard their results anyway.
 *
 * @param limit - The most tasks allowed in flight at once.
 * @returns A runner that schedules one task and resolves with its result.
 *
 * @internal
 */
export function createConcurrencyLimiter(limit: number): <result>(task: () => Promise<result>) => Promise<result> {
  let active = 0;
  const waiting: (() => void)[] = [];
  let failure: { error: unknown } | null = null;

  return async function run<result>(task: () => Promise<result>): Promise<result> {
    if (active < limit) active += 1;
    else await new Promise<void>((resolve) => waiting.push(resolve));
    try {
      if (failure) throw failure.error;
      return await task();
    } catch (error) {
      failure ??= { error };
      throw error;
    } finally {
      const next = waiting.shift();
      if (next) next();
      else active -= 1;
    }
  };
}
