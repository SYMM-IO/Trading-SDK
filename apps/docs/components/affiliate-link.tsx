import { useMDXComponents as getThemeComponents } from "nextra-theme-docs";
import type { ReactNode } from "react";

/**
 * Canonical URL of the hosted affiliate-registration page.
 *
 * Single source of truth — reference this constant (or {@link AffiliateLink})
 * instead of hardcoding the URL, so changing it is a one-line edit.
 */
export const AFFILIATE_REGISTRATION_URL = "https://trading-sdk.symm.io/affiliate";

interface Props {
  children?: ReactNode;
}

/**
 * Link to the hosted affiliate-registration page. Registered globally in
 * `mdx-components.tsx`, so any `.mdx` page can use `<AffiliateLink>…</AffiliateLink>`
 * without an import. Omit children to render the raw URL as the link text.
 *
 * Renders through the theme's own anchor so it gets the same styling (color,
 * hover, external-link affordance) as every other link in the docs.
 */
export function AffiliateLink({ children }: Props) {
  const { a: Anchor = "a" } = getThemeComponents();
  return <Anchor href={AFFILIATE_REGISTRATION_URL}>{children ?? AFFILIATE_REGISTRATION_URL}</Anchor>;
}
