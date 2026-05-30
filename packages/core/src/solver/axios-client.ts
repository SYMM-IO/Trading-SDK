import axios, { type AxiosRequestConfig } from "axios"

/**
 * Custom axios instance for Orval-generated API functions.
 * Provides a centralized place to configure headers, interceptors, and base URL.
 */
const instance = axios.create({
  headers: {
    "Content-Type": "application/json",
  },
})

/**
 * Set the base URL for all solver API requests.
 * Call this before making API calls if you need a different solver URL.
 */
export function setSolverBaseUrl(baseUrl: string): void {
  instance.defaults.baseURL = baseUrl
}

/**
 * Axios client wrapper for Orval-generated API functions.
 */
export async function axiosClient<T>(config: AxiosRequestConfig): Promise<T> {
  const response = await instance.request<T>(config)
  return response.data
}

export default instance
