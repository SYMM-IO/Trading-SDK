import { Badge } from "@symm-frontier/ui/components/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@symm-frontier/ui/components/card";
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
    <section className="mx-auto w-full max-w-5xl px-6 py-10">
      <header className="mb-8">
        <Badge variant="outline" className="mb-4">
          Symmio Frontier
        </Badge>
        <h1 className="text-foreground text-3xl font-semibold tracking-tight sm:text-4xl">Web app</h1>
        <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-6">
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

function HomeCardLink({ card }: { card: HomeCard }) {
  return (
    <Link href={card.href} className="group block">
      <Card className="h-full transition-shadow hover:shadow-lg">
        <CardHeader>
          <CardDescription className="text-primary text-xs font-semibold tracking-wide uppercase">
            {card.eyebrow}
          </CardDescription>
          <CardTitle className="text-lg">{card.title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm leading-6">{card.description}</p>
          <span className="text-primary mt-4 inline-flex items-center gap-1 text-sm font-medium">
            Open
            <span aria-hidden className="transition-transform group-hover:translate-x-0.5">
              →
            </span>
          </span>
        </CardContent>
      </Card>
    </Link>
  );
}
