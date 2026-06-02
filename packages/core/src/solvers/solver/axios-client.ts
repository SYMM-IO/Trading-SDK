import axios, { type AxiosRequestConfig } from "axios";

/**
 * Custom axios instance for Orval-generated API functions. Centralizes headers
 * and interceptors. The base URL is passed per request (see `getMarkets`), not
 * stored on the instance, so concurrent calls to different solvers don't clash.
 */
const instance = axios.create({
  headers: {
    "Content-Type": "application/json",
  },
});

/**
 * Axios client wrapper for Orval-generated API functions. Pass `baseURL` on the
 * per-call config to target a specific solver.
 */
export async function axiosClient<T>(config: AxiosRequestConfig): Promise<T> {
  const response = await instance.request<T>(config);
  return response.data;
}

export default instance;
