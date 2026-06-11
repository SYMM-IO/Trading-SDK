import type { Meta, StoryObj } from "@storybook/react";
import { useMemo, useState } from "react";
import { Button } from "./button";
import { CommandPalette, type CommandPaletteGroup } from "./command-palette";

const meta = {
  title: "UI/CommandPalette",
  component: CommandPalette,
  parameters: { layout: "centered" },
} satisfies Meta<typeof CommandPalette>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    open: true,
    onOpenChange: () => {},
    query: "",
    onQueryChange: () => {},
    groups: [],
    onSelect: () => {},
  },
  render: () => <CommandPaletteStory />,
};

interface Entry {
  id: string;
  group: string;
  title: string;
  subtitle: string;
}

const ENTRIES: Entry[] = [
  { id: "overview", group: "Pages", title: "Overview", subtitle: "/" },
  { id: "contracts", group: "Pages", title: "Contracts", subtitle: "/contracts" },
  { id: "getSubAccount", group: "Methods", title: "getSubAccount", subtitle: "AccountLayer · read" },
  { id: "allocate", group: "Methods", title: "allocate", subtitle: "SYMMIO Core · write" },
  { id: "initiateWithdraw", group: "Methods", title: "initiateWithdraw", subtitle: "SYMMIO Core · write" },
  { id: "btc", group: "Markets", title: "BTCUSDT", subtitle: "Bitcoin" },
  { id: "eth", group: "Markets", title: "ETHUSDT", subtitle: "Ethereum" },
];

function CommandPaletteStory() {
  const [open, setOpen] = useState(true);
  const [query, setQuery] = useState("");

  const groups = useMemo<CommandPaletteGroup[]>(() => {
    const term = query.trim().toLowerCase();
    const matches = term ? ENTRIES.filter((e) => `${e.title} ${e.subtitle}`.toLowerCase().includes(term)) : ENTRIES;
    const order = ["Pages", "Methods", "Markets"];
    return order
      .map((name) => ({
        id: name,
        heading: name,
        items: matches
          .filter((e) => e.group === name)
          .map((e) => ({
            id: e.id,
            label: (
              <div className="flex w-full items-center justify-between gap-3">
                <span className="font-mono">{e.title}</span>
                <span className="text-muted-foreground text-xs">{e.subtitle}</span>
              </div>
            ),
          })),
      }))
      .filter((group) => group.items.length > 0);
  }, [query]);

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        Open palette
      </Button>
      <CommandPalette
        open={open}
        onOpenChange={setOpen}
        query={query}
        onQueryChange={setQuery}
        groups={groups}
        onSelect={() => setOpen(false)}
        placeholder="Search pages, methods, markets…"
        emptyState="No matches."
        footer={
          <div className="flex gap-4">
            <span>↑↓ navigate</span>
            <span>↵ open</span>
            <span>esc close</span>
          </div>
        }
      />
    </>
  );
}
