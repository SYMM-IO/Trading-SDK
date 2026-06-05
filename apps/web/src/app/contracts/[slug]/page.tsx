import { ContractMethodsShell } from "@/features/contracts/contract-methods-shell";
import { ALL_PAGES, getContractPage } from "@/features/contracts/pages";
import { notFound } from "next/navigation";

/** Only the registered ABI/flow slugs are valid; anything else 404s. */
export const dynamicParams = false;

export function generateStaticParams() {
  return ALL_PAGES.map((page) => ({ slug: page.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = getContractPage(slug);
  if (!page) return {};
  return { title: `${page.title} · Symmio Contracts`, description: page.description };
}

export default async function ContractMethodsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!getContractPage(slug)) notFound();
  return <ContractMethodsShell slug={slug} />;
}
