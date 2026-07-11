import { Pre as NextraPre } from "nextra/components";
import type { ComponentProps, ReactElement } from "react";

interface Props extends ComponentProps<"pre"> {
  /** Fence language, re-exposed onto `<pre>` by the `rehypeExposeCodeLanguage` plugin in `next.config.mjs`. */
  "data-language"?: string;
  /** Present when the fence declares `filename="…"`; Nextra then renders its own titled header. */
  "data-filename"?: string;
}

/**
 * Frame around Nextra's `<Pre>` that gives every fenced block the "Voltage
 * Graphite" console treatment: a graphite surface, a chrome header carrying the
 * language label, and a persistent copy affordance. Registered as the `pre` MDX
 * component in `mdx-components.tsx`, so it applies site-wide without per-page
 * imports.
 *
 * The language header is drawn in CSS from `data-language` on the wrapper —
 * Nextra keeps that attribute on the inner `<code>`, out of reach of a
 * wrapper-level `::before`, so we lift it up here. The header is suppressed for
 * filename blocks (Nextra renders its own titled header) and for language-less
 * fences.
 */
export function CodeBlock(props: Props): ReactElement {
  const language = props["data-language"];
  const filename = props["data-filename"];
  const showHeader = !filename && !!language && language !== "plaintext" && language !== "text";
  const className = filename ? "symm-code symm-code--file" : "symm-code";
  return (
    <div className={className} data-language={showHeader ? language : undefined}>
      <NextraPre {...props} />
    </div>
  );
}
