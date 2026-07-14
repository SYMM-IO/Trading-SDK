import { useMDXComponents as getThemeComponents } from "nextra-theme-docs"; // nextra-theme-blog or your custom theme
import { MDXComponents } from "nextra/mdx-components";
import { Properties, Property, Returns } from "./components/api-properties";
import { CodeBlock } from "./components/code-block";
import { MethodEntry, MethodIndex } from "./components/method-index";

// Get the default MDX components
const themeComponents = getThemeComponents();

// Merge components. Custom API-reference primitives are registered globally so
// every `.mdx` page can use them without a per-file import. `pre` is swapped for
// the console-panel frame in components/code-block.tsx.
export function useMDXComponents(components: MDXComponents) {
  return {
    ...themeComponents,
    pre: CodeBlock,
    Properties,
    Property,
    Returns,
    MethodIndex,
    MethodEntry,
    ...components,
  };
}
