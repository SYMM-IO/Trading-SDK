import { Check, ChevronRight, ChevronsDownUp, ChevronsUpDown, Copy } from "lucide-react";
import * as React from "react";
import { cn } from "../lib/utils";

export interface JsonViewProps extends Omit<React.ComponentProps<"div">, "children"> {
  /** Any JSON-serializable value. Objects and arrays become collapsible nodes; `bigint` renders as `123n`. */
  data: unknown;
  /**
   * Nodes nested below this depth start collapsed. `1` (the default) keeps the
   * root open and collapses its children; `0` collapses everything.
   */
  defaultExpandedDepth?: number;
  /** Hide the header toolbar (type summary, expand/collapse-all, copy). */
  hideToolbar?: boolean;
  /**
   * Whether the tree scrolls within its own capped height. `true` (the default)
   * keeps the body to a max height and scrolls inside it. Pass `false` when an
   * outer container already owns the scroll (e.g. a resizable card body), so the
   * tree grows to its full height and there is a single scroll region, not two
   * nested ones.
   */
  scroll?: boolean;
}

/**
 * Read-only, collapsible JSON tree with syntax coloring — an editor-like view
 * for raw API payloads. Every object and array can be expanded or collapsed
 * individually, or all at once from the toolbar; values are colored by type and
 * the whole document can be copied. Knows nothing about the data's domain.
 *
 * @example
 * <JsonView data={response} defaultExpandedDepth={2} />
 */
export function JsonView({
  data,
  defaultExpandedDepth = 1,
  hideToolbar = false,
  scroll = true,
  className,
  ...rest
}: JsonViewProps) {
  const [signal, setSignal] = React.useState<ExpandSignal>({ version: 0, open: false });
  const [copied, setCopied] = React.useState(false);
  const isContainer = data !== null && typeof data === "object";

  function broadcast(open: boolean) {
    setSignal((prev) => ({ version: prev.version + 1, open }));
  }

  function handleCopy() {
    void navigator.clipboard?.writeText(safeStringify(data)).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    });
  }

  return (
    <div
      className={cn(
        "border-border/70 bg-muted/20 relative overflow-hidden rounded-lg border font-mono text-xs",
        className,
      )}
      {...rest}
    >
      {hideToolbar ? null : (
        <div className="border-border/70 bg-muted/30 flex items-center justify-between gap-2 border-b px-3 py-1.5">
          <span className="text-muted-foreground/80 text-[0.7rem] tracking-wide uppercase">{describe(data)}</span>
          <div className="flex items-center gap-0.5">
            {isContainer ? (
              <>
                <ToolbarButton label="Expand all" onClick={() => broadcast(true)}>
                  <ChevronsUpDown className="size-3.5" aria-hidden />
                </ToolbarButton>
                <ToolbarButton label="Collapse all" onClick={() => broadcast(false)}>
                  <ChevronsDownUp className="size-3.5" aria-hidden />
                </ToolbarButton>
              </>
            ) : null}
            <ToolbarButton label={copied ? "Copied" : "Copy JSON"} onClick={handleCopy}>
              {copied ? (
                <Check className="text-positive size-3.5" aria-hidden />
              ) : (
                <Copy className="size-3.5" aria-hidden />
              )}
            </ToolbarButton>
          </div>
        </div>
      )}

      <div className={cn("p-3 leading-5", scroll && "max-h-96 overflow-auto")}>
        <ExpandContext.Provider value={signal}>
          <JsonNode value={data} depth={0} defaultExpandedDepth={defaultExpandedDepth} isLast />
        </ExpandContext.Provider>
      </div>
    </div>
  );
}

/** Broadcast object the toolbar uses to force every node open or closed at once. */
interface ExpandSignal {
  /** Bumped on each expand/collapse-all so nodes resync only when it changes. */
  version: number;
  /** Target open state for the latest broadcast. */
  open: boolean;
}

const ExpandContext = React.createContext<ExpandSignal | null>(null);

interface NodeProps {
  /** Object key or array index label; omitted for the root value. */
  name?: string;
  /** Style `name` as a dim array index rather than a quoted object key. */
  isIndex?: boolean;
  value: unknown;
  depth: number;
  defaultExpandedDepth: number;
  /** Suppress the trailing comma on the last entry of a container. */
  isLast: boolean;
}

function JsonNode(props: NodeProps) {
  const { value } = props;
  if (value !== null && typeof value === "object") {
    return <ContainerNode {...props} value={value as Record<string, unknown> | unknown[]} />;
  }
  return (
    <Row>
      <KeyLabel name={props.name} isIndex={props.isIndex} />
      <ValueToken value={value} />
      {props.isLast ? null : <Punctuation>,</Punctuation>}
    </Row>
  );
}

function ContainerNode({ name, isIndex, value, depth, defaultExpandedDepth, isLast }: NodeProps) {
  const ctx = React.useContext(ExpandContext);
  const isArray = Array.isArray(value);
  const entries = isArray
    ? (value as unknown[]).map((item, index) => [String(index), item] as const)
    : Object.entries(value as Record<string, unknown>);
  const [open, setOpen] = React.useState(() => (ctx && ctx.version > 0 ? ctx.open : depth < defaultExpandedDepth));
  const seenVersion = React.useRef(ctx?.version ?? 0);

  React.useEffect(() => {
    if (ctx && ctx.version !== seenVersion.current) {
      seenVersion.current = ctx.version;
      setOpen(ctx.open);
    }
  }, [ctx]);

  const openBracket = isArray ? "[" : "{";
  const closeBracket = isArray ? "]" : "}";

  if (entries.length === 0) {
    return (
      <Row>
        <KeyLabel name={name} isIndex={isIndex} />
        <Punctuation>
          {openBracket}
          {closeBracket}
        </Punctuation>
        {isLast ? null : <Punctuation>,</Punctuation>}
      </Row>
    );
  }

  return (
    <div className="flex flex-col">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        className="hover:bg-muted/40 -mx-1 flex w-[calc(100%+0.5rem)] items-start gap-1 rounded px-1 text-left transition-colors"
      >
        <span className="flex w-3.5 shrink-0 justify-center pt-[0.15rem]">
          <ChevronRight
            className={cn("text-muted-foreground size-3 transition-transform", open && "rotate-90")}
            aria-hidden
          />
        </span>
        <span className="min-w-0 flex-1 break-all">
          <KeyLabel name={name} isIndex={isIndex} inline />
          <Punctuation>{openBracket}</Punctuation>
          {open ? null : (
            <>
              <span className="text-muted-foreground/60">
                {" "}
                {entries.length} {isArray ? plural(entries.length, "item") : plural(entries.length, "key")}{" "}
              </span>
              <Punctuation>{closeBracket}</Punctuation>
              {isLast ? null : <Punctuation>,</Punctuation>}
            </>
          )}
        </span>
      </button>

      {open ? (
        <>
          <div className="border-border/40 ml-[0.4rem] flex flex-col border-l pl-3">
            {entries.map(([key, item], index) => (
              <JsonNode
                key={key}
                name={key}
                isIndex={isArray}
                value={item}
                depth={depth + 1}
                defaultExpandedDepth={defaultExpandedDepth}
                isLast={index === entries.length - 1}
              />
            ))}
          </div>
          <Row>
            <Punctuation>{closeBracket}</Punctuation>
            {isLast ? null : <Punctuation>,</Punctuation>}
          </Row>
        </>
      ) : null}
    </div>
  );
}

/** Leaf/closing line aligned under a container's bracket via a chevron-width spacer. */
function Row({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-1">
      <span className="w-3.5 shrink-0" aria-hidden />
      <span className="min-w-0 flex-1 break-all">{children}</span>
    </div>
  );
}

function KeyLabel({ name, isIndex, inline = false }: { name?: string; isIndex?: boolean; inline?: boolean }) {
  if (name === undefined) return null;
  return (
    <span className={inline ? undefined : "shrink-0"}>
      <span className={isIndex ? "text-muted-foreground/60" : "text-chart-1"}>{isIndex ? name : `"${name}"`}</span>
      <Punctuation>: </Punctuation>
    </span>
  );
}

function ValueToken({ value }: { value: unknown }) {
  if (value === null) return <span className="text-muted-foreground">null</span>;
  switch (typeof value) {
    case "string":
      return <span className="text-chart-2">{`"${value}"`}</span>;
    case "number":
      return <span className="text-chart-3">{String(value)}</span>;
    case "bigint":
      return <span className="text-chart-3">{value.toString()}n</span>;
    case "boolean":
      return <span className="text-chart-5">{String(value)}</span>;
    case "undefined":
      return <span className="text-muted-foreground">undefined</span>;
    default:
      return <span className="text-muted-foreground">{String(value)}</span>;
  }
}

function Punctuation({ children }: { children: React.ReactNode }) {
  return <span className="text-muted-foreground/70">{children}</span>;
}

function ToolbarButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:ring-ring/40 inline-flex size-6 items-center justify-center rounded-md transition-colors outline-none focus-visible:ring-2"
    >
      {children}
    </button>
  );
}

function describe(data: unknown): string {
  if (Array.isArray(data)) return `array · ${data.length} ${plural(data.length, "item")}`;
  if (data !== null && typeof data === "object") {
    const count = Object.keys(data).length;
    return `object · ${count} ${plural(count, "key")}`;
  }
  return typeof data;
}

function plural(count: number, word: string): string {
  return count === 1 ? word : `${word}s`;
}

/** `JSON.stringify` that survives `bigint` values (rendered with an `n` suffix). */
function safeStringify(data: unknown): string {
  return JSON.stringify(data, (_key, value) => (typeof value === "bigint" ? `${value}n` : value), 2);
}
