interface Props {
  /** A schema.org node or `@graph`; `@context` is added here. */
  data: Record<string, unknown>;
}

/**
 * Renders schema.org structured data as a server-rendered JSON-LD `<script>`.
 * `<` is escaped to `<` so no value can close the tag early, as the Next.js
 * JSON-LD guide requires.
 */
export function JsonLd({ data }: Props) {
  const json = JSON.stringify({ "@context": "https://schema.org", ...data }).replace(/</g, "\\u003c");
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
