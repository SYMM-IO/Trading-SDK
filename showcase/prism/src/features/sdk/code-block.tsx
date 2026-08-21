"use client";

import { MicroLabel } from "@/components/panel";
import { cn } from "@/lib/cn";
import { useEffect, useState } from "react";

/**
 * Words rendered in the accent. Constants (`true`, `null`, …) are included on
 * purpose: in a config file they are values you scan for, not syntax noise.
 */
const KEYWORDS = new Set([
  "as",
  "async",
  "await",
  "class",
  "const",
  "default",
  "export",
  "extends",
  "false",
  "for",
  "from",
  "function",
  "if",
  "import",
  "in",
  "interface",
  "let",
  "new",
  "null",
  "of",
  "readonly",
  "return",
  "satisfies",
  "true",
  "type",
  "typeof",
  "undefined",
  "var",
  "void",
]);

type TokenKind = "comment" | "string" | "number" | "keyword" | "name" | "property" | "punctuation" | "plain";

interface Token {
  kind: TokenKind;
  text: string;
}

/**
 * The palette is one hue plus the neutral ramp, and that is a design decision,
 * not a shortcut. A code block is platform chrome, so it may only speak in the
 * accent — the market palettes are reserved for surfaces that belong to a
 * specific solver.
 */
const TOKEN_CLASS: Record<TokenKind, string> = {
  comment: "text-fg-3 italic",
  string: "text-accent/70",
  number: "text-fg-0",
  keyword: "text-accent font-semibold",
  name: "text-fg-0",
  property: "text-fg-1",
  punctuation: "text-fg-3",
  plain: "text-fg-1",
};

/* Order matters: comments and strings must win before punctuation can split them. */
const SCANNER =
  /\/\*[\s\S]*?\*\/|\/\/[^\n]*|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`|\b0x[0-9a-fA-F]+\b|\b\d[\d_]*(?:\.\d+)?\b|[A-Za-z_$][\w$]*|[{}()[\].,;:=<>+\-*/?&|!@#]/g;

/**
 * Classify one identifier by what follows it.
 *
 * Deliberately shallow — this is a display aid for three known config files,
 * not a TypeScript parser. Anything it cannot classify falls back to plain
 * text, which is always safe.
 */
function classifyIdentifier(text: string, rest: string): TokenKind {
  if (KEYWORDS.has(text)) return "keyword";
  if (/^\s*[:(]/.test(rest)) return "property";
  if (/^[A-Z]/.test(text)) return "name";
  return "plain";
}

/** Split source into rendered tokens, preserving every byte including whitespace. */
function tokenize(code: string): Token[] {
  const tokens: Token[] = [];
  let cursor = 0;

  SCANNER.lastIndex = 0;
  for (let match = SCANNER.exec(code); match !== null; match = SCANNER.exec(code)) {
    if (match.index > cursor) tokens.push({ kind: "plain", text: code.slice(cursor, match.index) });

    const text = match[0];
    const first = text[0] ?? "";
    if (text.startsWith("//") || text.startsWith("/*")) tokens.push({ kind: "comment", text });
    else if (first === '"' || first === "'" || first === "`") tokens.push({ kind: "string", text });
    else if (/^[\d]/.test(text)) tokens.push({ kind: "number", text });
    else if (/^[A-Za-z_$]/.test(text))
      tokens.push({ kind: classifyIdentifier(text, code.slice(match.index + text.length)), text });
    else tokens.push({ kind: "punctuation", text });

    cursor = match.index + text.length;
  }

  if (cursor < code.length) tokens.push({ kind: "plain", text: code.slice(cursor) });
  return tokens;
}

/** Props for {@link CodeBlock}. */
export interface CodeBlockProps {
  /** Source rendered verbatim. */
  code: string;
  /** Repo-relative path this source was copied from — the file a reader can diff against. */
  file?: string;
  /** Right-hand caption in the header, e.g. a line count. */
  caption?: string;
  /** Scroll past this height instead of growing the page. */
  maxHeight?: string;
  className?: string;
}

/**
 * A read-only source view with a copy button.
 *
 * The highlighter is a forty-line scanner rather than a dependency: Prism ships
 * the SDK plus the framework and nothing else, and a syntax theme is not worth
 * a package.
 */
export function CodeBlock({ code, file, caption, maxHeight, className }: CodeBlockProps) {
  const tokens = tokenize(code);

  return (
    <div className={cn("overflow-hidden rounded-lg border border-line bg-bg-0", className)}>
      {file ? (
        <header className="flex items-center gap-3 border-b border-line-subtle bg-bg-1 px-3 py-2">
          <span className="truncate font-mono text-xs text-fg-2">{file}</span>
          {caption ? <MicroLabel className="ml-auto">{caption}</MicroLabel> : null}
          <CopyButton text={code} className={caption ? undefined : "ml-auto"} />
        </header>
      ) : null}

      <pre
        className="overflow-auto px-4 py-3 font-mono text-xs leading-[1.7] whitespace-pre"
        style={maxHeight ? { maxHeight } : undefined}
      >
        <code>
          {tokens.map((token, index) => (
            <span key={index} className={TOKEN_CLASS[token.kind]}>
              {token.text}
            </span>
          ))}
        </code>
      </pre>
    </div>
  );
}

interface CopyButtonProps {
  text: string;
  className?: string;
}

/** Copy-to-clipboard control. Confirms in place rather than through a toast. */
function CopyButton({ text, className }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1600);
    return () => window.clearTimeout(timer);
  }, [copied]);

  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard?.writeText(text).then(() => setCopied(true));
      }}
      className={cn(
        "inline-flex h-6 shrink-0 cursor-pointer items-center gap-1.5 rounded-sm border px-2",
        "font-mono text-2xs font-semibold tracking-[0.12em] uppercase",
        "transition-colors duration-[var(--dur-fast)] ease-[var(--ease-out)]",
        copied
          ? "border-accent-bd bg-accent-bg text-accent"
          : "border-line bg-bg-2 text-fg-3 hover:border-line-strong hover:text-fg-1",
        className,
      )}
    >
      {copied ? <CheckIcon /> : <CopyIcon />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function CopyIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 12 12"
      className="size-3 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
    >
      <rect x="4" y="4" width="6.5" height="6.5" rx="1.2" />
      <path d="M8 2.2A1.2 1.2 0 0 0 6.8 1.5H2.7A1.2 1.2 0 0 0 1.5 2.7v4.1A1.2 1.2 0 0 0 2.2 8" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 12 12"
      className="size-3 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2.2 6.4 4.6 8.8l5.2-5.6" />
    </svg>
  );
}
