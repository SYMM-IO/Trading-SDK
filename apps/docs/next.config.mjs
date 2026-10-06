import nextra from "nextra";

/**
 * Re-expose each fenced block's language on its `<pre>` as `data-language`.
 * Nextra strips the language off the highlighted output, so we capture it from
 * the `language-*` class the MDX compiler sets on `<code>` — user rehype plugins
 * run before Nextra's, while that class is still present. components/code-block.tsx
 * reads it to label the console panel's header.
 */
function rehypeExposeCodeLanguage() {
  const walk = (node) => {
    if (node.type === "element" && node.tagName === "pre") {
      const code = node.children?.find((child) => child.type === "element" && child.tagName === "code");
      const raw = code?.properties?.className;
      const classes = Array.isArray(raw) ? raw : typeof raw === "string" ? raw.split(" ") : [];
      const match = classes.find((cls) => typeof cls === "string" && cls.startsWith("language-"));
      if (match) {
        node.properties = node.properties ?? {};
        node.properties["data-language"] = match.slice("language-".length);
      }
    }
    node.children?.forEach(walk);
  };
  return (tree) => walk(tree);
}

/** Longest meta description emitted — about what a search result shows before it truncates. */
const DESCRIPTION_MAX_LENGTH = 160;

/** A lead paragraph shorter than this borrows the paragraph right after it. */
const DESCRIPTION_MIN_LENGTH = 70;

/**
 * Give every page its own `<meta name="description">`. Nextra only reads a
 * description from front matter, and our pages set none, so without this every
 * page inherits the root layout's. Pages lead with what the API is and when to
 * reach for it (see AGENTS.md), so the paragraph under the H1 is the summary:
 * flatten it to text (inline code keeps its identifier; JSX expressions drop
 * out), clip it on a sentence or word boundary, and hand it to Nextra as a
 * front-matter `description`. User remark plugins run before Nextra's own, so the
 * injected `yaml` node flows through Nextra's front-matter step into
 * `export const metadata` exactly like hand-written front matter. An explicit
 * `description` always wins, and pages with their own `export const metadata`
 * are skipped (Nextra rejects YAML plus a metadata export). No `title` is added,
 * so page titles still come from the H1.
 */
function remarkLeadDescription() {
  const toText = (node) => {
    if (node.type === "text" || node.type === "inlineCode") return node.value;
    if (node.type === "break") return " ";
    if (node.type === "mdxTextExpression" || node.type === "inlineMath" || node.type === "html") return "";
    return Array.isArray(node.children) ? node.children.map(toText).join("") : "";
  };
  const clip = (text) => {
    if (text.length <= DESCRIPTION_MAX_LENGTH) return text;
    const head = text.slice(0, DESCRIPTION_MAX_LENGTH + 1);
    const sentenceEnd = head.lastIndexOf(". ");
    if (sentenceEnd >= DESCRIPTION_MAX_LENGTH / 2) return head.slice(0, sentenceEnd + 1);
    const wordEnd = head.lastIndexOf(" ", DESCRIPTION_MAX_LENGTH - 1);
    return `${head.slice(0, wordEnd).replace(/[\s,;:(—–-]+$/, "")}…`;
  };
  const exportsMetadata = (node) =>
    node.type === "mdxjsEsm" &&
    (node.data?.estree?.body ?? []).some((statement) =>
      statement.declaration?.declarations?.some((declarator) => declarator.id?.name === "metadata"),
    );
  return (tree) => {
    if (tree.children.some(exportsMetadata)) return;
    const frontMatter = tree.children.find((node) => node.type === "yaml");
    if (frontMatter && /^description\s*:/m.test(frontMatter.value)) return;
    const h1 = tree.children.findIndex((node) => node.type === "heading" && node.depth === 1);
    const body = tree.children.slice(h1 + 1);
    let index = body.findIndex((node) => node.type === "paragraph");
    let lead = "";
    while (body[index]?.type === "paragraph" && lead.length < DESCRIPTION_MIN_LENGTH) {
      lead = `${lead} ${toText(body[index])}`.replace(/\s+/g, " ").trim();
      index += 1;
    }
    if (!lead) return;
    const entry = `description: ${JSON.stringify(clip(lead))}`;
    if (frontMatter) frontMatter.value = `${frontMatter.value}\n${entry}`;
    else tree.children.unshift({ type: "yaml", value: entry });
  };
}

const withNextra = nextra({
  defaultShowCopyCode: true,
  mdxOptions: {
    remarkPlugins: [remarkLeadDescription],
    rehypePlugins: [rehypeExposeCodeLanguage],
  },
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  trailingSlash: true,
  reactStrictMode: true,
  experimental: {
    // Force server-component renders to invalidate on every file change so
    // Nextra picks up MDX edits without a full dev-server restart.
    staleTimes: {
      dynamic: 0,
      static: 0,
    },
  },
};

export default withNextra(nextConfig);
