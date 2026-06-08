import { ResultNote } from "@/components/result";

interface Props {
  testId: string;
  value: unknown;
}

/** Small JSON panel for raw API payloads. */
export function JsonResult({ testId, value }: Props) {
  return (
    <pre
      data-testid={testId}
      className="border-border/70 bg-muted/20 max-h-80 overflow-auto rounded-xl border p-3 font-mono text-xs leading-5"
    >
      {value === undefined ? <ResultNote>No result.</ResultNote> : JSON.stringify(value, null, 2)}
    </pre>
  );
}
