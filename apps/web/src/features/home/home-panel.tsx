import Link from "next/link";

interface HomeCard {
  href: string;
  eyebrow: string;
  title: string;
  description: string;
}

const cards: HomeCard[] = [
  {
    href: "/inspector/account-layer",
    eyebrow: "Inspector",
    title: "AccountLayer",
    description: "Run live reads and writes against the AccountLayer slice on HyperEVM.",
  },
  {
    href: "/config",
    eyebrow: "Config",
    title: "Resolved VibeCaps Config",
    description: "Inspect the chain config the web app pulls from @symm-frontier/react.",
  },
];

export function HomePanel() {
  return (
    <section className="w-full max-w-5xl">
      <header className="mb-6">
        <p className="text-sm font-semibold tracking-wide text-blue-600 uppercase dark:text-blue-400">
          Symmio Frontier
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">Web app</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          Entry points for the SDK&apos;s consumer surface. Pick a panel to drill in.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {cards.map((card) => (
          <HomeCardLink key={card.href} card={card} />
        ))}
      </div>
    </section>
  );
}

function HomeCardLink(props: { card: HomeCard }) {
  const { card } = props;
  return (
    <Link
      href={card.href}
      className="group rounded-lg border border-zinc-200 bg-white p-5 shadow-sm transition hover:border-blue-400 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-blue-500"
    >
      <p className="text-xs font-semibold tracking-wide text-blue-600 uppercase dark:text-blue-400">{card.eyebrow}</p>
      <h2 className="mt-2 text-lg font-semibold text-zinc-950 dark:text-zinc-50">{card.title}</h2>
      <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">{card.description}</p>
      <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-blue-600 dark:text-blue-400">
        Open
        <span aria-hidden className="transition group-hover:translate-x-0.5">
          →
        </span>
      </span>
    </Link>
  );
}
