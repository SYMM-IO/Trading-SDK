import { Children, cloneElement, isValidElement, type ReactNode } from "react";

/**
 * The kind of entry an overview page catalogs. Each kind carries its own accent
 * colour and leading glyph so a reader can tell reads, writes, and types apart
 * at a glance: `read` (cobalt, eye), `write` (amber, pen), `type` (mint, braces).
 */
export type MethodKind = "read" | "write" | "type";

interface KindGlyphProps {
  kind: MethodKind;
}

/** The leading icon for an entry — an eye for reads, a pen for writes, braces for types. */
function KindGlyph({ kind }: KindGlyphProps) {
  if (kind === "write") {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
      </svg>
    );
  }
  if (kind === "type") {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M8 3H7a2 2 0 0 0-2 2v5a2 2 0 0 1-2 2 2 2 0 0 1 2 2v5a2 2 0 0 0 2 2h1" />
        <path d="M16 3h1a2 2 0 0 1 2 2v5a2 2 0 0 0 2 2 2 2 0 0 0-2 2v5a2 2 0 0 1-2 2h-1" />
      </svg>
    );
  }
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

interface MethodEntryProps {
  /** Method, hook, or type name — rendered in monospace as the card title. */
  name: string;
  /** Destination for the card link — the entry's own page. */
  href: string;
  /**
   * Overrides the parent `<MethodIndex>` kind for a single entry, for a section
   * that mixes reads and writes. Defaults to the parent's kind.
   */
  kind?: MethodKind;
  /** One-line summary; supports inline MDX (prose, `code`). */
  children?: ReactNode;
}

/** A single navigable catalog entry: a full-width card that links to the entry's own page. */
export function MethodEntry({ name, href, kind = "read", children }: MethodEntryProps) {
  return (
    <a className={`symm-index__card symm-index__card--${kind}`} href={href}>
      <span className="symm-index__glyph">
        <KindGlyph kind={kind} />
      </span>
      <span className="symm-index__main">
        <span className="symm-index__name">{name}</span>
        {children ? <span className="symm-index__desc">{children}</span> : null}
      </span>
      <span className="symm-index__arrow" aria-hidden="true">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m9 18 6-6-6-6" />
        </svg>
      </span>
    </a>
  );
}

interface MethodIndexProps {
  /** Default kind for every entry in the group — sets the accent colour and glyph. */
  kind: MethodKind;
  /** `<MethodEntry>` rows. */
  children: ReactNode;
}

/**
 * A navigable catalog of an overview section's methods, hooks, or types — one
 * card per entry, replacing the plain "Method / Summary" table. Deliberately a
 * different visual grammar from the `<Properties>` / `<Returns>` panel: a stack
 * of linked cards, not a boxed field list. Each child `<MethodEntry>` inherits
 * this `kind` unless it sets its own.
 *
 * @example
 * ```mdx
 * ## Reads
 *
 * <MethodIndex kind="read">
 *   <MethodEntry name="getDelegationExpiry" href="/core/instant-layer/get-delegation-expiry">
 *     Raw delegation expiry timestamp from the `delegations` mapping.
 *   </MethodEntry>
 * </MethodIndex>
 * ```
 */
export function MethodIndex({ kind, children }: MethodIndexProps) {
  return (
    <div className="symm-index">
      {Children.map(children, (child) =>
        isValidElement<MethodEntryProps>(child) && child.type === MethodEntry
          ? cloneElement(child, { kind: child.props.kind ?? kind })
          : child,
      )}
    </div>
  );
}
