/**
 * Userinfo (`user:password@`) right after an absolute or protocol-relative
 * scheme. The authority stops at the first `/`, `?` or `#`; the greedy class
 * runs to the last `@` inside it, which is where the WHATWG parser splits the
 * userinfo from the host.
 */
const USERINFO = /^((?:[a-z][a-z\d+.-]*:)?\/\/)[^/?#]*@/i;

/** The query string and fragment: everything from the first `?` or `#`. */
const QUERY_AND_FRAGMENT = /[?#].*$/s;

/**
 * Strip the credential-bearing parts of a URL before it lands in an error: the
 * userinfo, the query string and the fragment. What remains (scheme, host and
 * path) still says where the request went.
 *
 * Works on the raw string, so a URL with nothing to strip comes back
 * unchanged, and relative URLs (a same-origin proxy path) are handled too.
 *
 * @param url - Absolute, protocol-relative or relative request URL.
 * @returns The URL without userinfo, query string or fragment.
 *
 * @internal
 */
export function redactUrl(url: string): string {
  return url.replace(USERINFO, "$1").replace(QUERY_AND_FRAGMENT, "");
}
