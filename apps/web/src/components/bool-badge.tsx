import { Badge } from "@symmio/ui/components/badge";

/** Renders a boolean as a tinted chip — positive for `true`, neutral for `false`. */
export function BoolBadge({ value }: { value: boolean }) {
  return <Badge variant={value ? "positive" : "secondary"}>{String(value)}</Badge>;
}
