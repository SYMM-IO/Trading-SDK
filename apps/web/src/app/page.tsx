import { SymmioConfigDebug } from "@/features/config-debug/symmio-config-debug";

export default function Home() {
  return (
    <main className="flex min-h-dvh flex-1 items-center justify-center bg-zinc-50 p-6 dark:bg-black">
      <SymmioConfigDebug />
    </main>
  );
}
