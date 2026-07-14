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

const withNextra = nextra({
  defaultShowCopyCode: true,
  mdxOptions: {
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
