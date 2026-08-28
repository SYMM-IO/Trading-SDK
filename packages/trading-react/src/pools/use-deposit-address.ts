"use client";

import {
  getDepositAddressQueryOptions,
  type ConfigParameter,
  type GetDepositAddressOptions,
  type GetDepositAddressReturnType,
} from "@symmio/trading-core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/** Parameters for {@link useDepositAddress}: the core query options plus an optional `config`. */
export type UseDepositAddressParameters = GetDepositAddressOptions & ConfigParameter;

/** Return type of {@link useDepositAddress}: the signed-in user's deposit wallet for one market. */
export type UseDepositAddressReturnType = UseQueryResult<GetDepositAddressReturnType, SymmioRequestError>;

/**
 * Return (or create) the signed-in user's deposit wallet for a single market —
 * the address the user sends funds to in order to deposit into the market's pool.
 *
 * This is an authed, per-market read: it takes a Bearer `accessToken` from
 * {@link useAuthenticateListing}, the market's `tokenContractAddress`, and the
 * market's `depositChain` — the last two together identify the market. The token
 * and the address both gate the query: until the `accessToken` **and** the
 * `tokenContractAddress` are non-empty strings the hook stays idle
 * (`enabled: false`) rather than firing an incomplete or unauthenticated
 * request, so it can be mounted before sign-in or before a market is selected.
 *
 * The endpoint is an idempotent get-or-create: it returns the user's existing
 * wallet for the market, or provisions a new one on the first call. Enigma-only;
 * errors are normalized to {@link SymmioRequestError}.
 *
 * @example
 * ```tsx
 * const login = useAuthenticateListing();
 * const [token, setToken] = useState("");
 *
 * const { data, isPending } = useDepositAddress({
 *   accessToken: token,
 *   tokenContractAddress: "0x1234…",
 *   depositChain: ListingDepositChainId.HYPER_EVM,
 * });
 *
 * // sign in first, then feed the token to the hook:
 * login.mutate({}, { onSuccess: (result) => setToken(result.accessToken) });
 *
 * // the address to deposit into the market:
 * data?.depositAddress;
 * ```
 */
export function useDepositAddress(parameters: UseDepositAddressParameters): UseDepositAddressReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const options = getDepositAddressQueryOptions(config, {
    ...parameters,
    chainId: parameters.chainId ?? chainId,
  });

  return useQuery({
    ...options,
    enabled:
      (parameters.query?.enabled ?? true) &&
      parameters.accessToken.length > 0 &&
      parameters.tokenContractAddress.length > 0,
    queryFn: async () => {
      try {
        return await options.queryFn();
      } catch (err) {
        throw normalizeSymmError(err);
      }
    },
  }) as UseDepositAddressReturnType;
}
