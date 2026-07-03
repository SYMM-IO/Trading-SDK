import { SymmioConfigDebug } from "@/features/config-debug/symmio-config-debug";

export const metadata = {
  title: "Resolved Config · Symmio",
  description: "Resolved SYMMIO chain config wired through @symmio/trading-react.",
};

export default function ConfigPage() {
  return <SymmioConfigDebug />;
}
