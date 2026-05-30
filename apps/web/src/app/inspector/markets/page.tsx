import { MarketsInspectorShell } from "@/features/inspector/markets-inspector-shell";

export const metadata = {
  title: "Markets · Symmio Inspector",
  description: "Live integration page for the SYMMIO React SDK's Markets slice.",
};

export default function MarketsInspectorPage() {
  return <MarketsInspectorShell />;
}
