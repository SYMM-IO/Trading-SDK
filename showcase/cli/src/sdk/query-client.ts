import { QueryClient } from "@tanstack/react-query";

/**
 * One `QueryClient` per process. Conservative defaults for a terminal: no
 * window-focus refetch (there is no window), short stale windows so the UI
 * feels live, and a single retry so transient RPC blips self-heal without
 * hammering. Per-hook `refetchInterval`s layer polling on top where needed.
 */
export function createAppQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: 1,
        staleTime: 10_000,
        gcTime: 60_000,
        refetchOnWindowFocus: false,
      },
    },
  });
}
