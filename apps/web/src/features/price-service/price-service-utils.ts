export function parseAddressList(value: string): string[] {
  return value
    .split(/[\s,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function formatTimestamp(value: number | undefined): string {
  if (!value) return "-";
  const milliseconds = value > 10_000_000_000 ? value : value * 1000;
  return new Date(milliseconds).toLocaleString();
}

export function stringifyResult(value: unknown): string {
  return JSON.stringify(value, null, 2);
}
