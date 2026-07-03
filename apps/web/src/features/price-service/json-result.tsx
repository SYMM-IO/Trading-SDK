import { ResultNote } from "@/components/result";
import { JsonView } from "@symmio/ui/components/json-view";

interface Props {
  testId: string;
  value: unknown;
}

/** Collapsible, syntax-highlighted JSON panel for raw API payloads. */
export function JsonResult({ testId, value }: Props) {
  if (value === undefined) {
    return <ResultNote testId={testId}>No result.</ResultNote>;
  }
  return <JsonView data-testid={testId} data={value} />;
}
