/**
 * Re-export of the address helpers from `@symm-frontier/utils/address`.
 *
 * Same rationale as `./amounts`: apps that already depend on
 * `@symm-frontier/react` get these helpers without a second dependency on
 * `@symm-frontier/utils`. Apps that want raw access can still depend on the
 * utils package directly.
 */
export { shortenAddress, type ShortenAddressOptions } from "@symm-frontier/utils/address";
