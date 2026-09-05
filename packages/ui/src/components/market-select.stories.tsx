import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { MarketSelect, type MarketSelectItem } from "./market-select";

const ITEMS: readonly MarketSelectItem[] = [
  {
    id: "1",
    label: "BTCUSDT",
    description: "Bitcoin perpetual · max 50x",
    meta: "ID 1",
    searchText: "1 BTCUSDT Bitcoin perpetual",
  },
  {
    id: "2",
    label: "ETHUSDT",
    description: "Ethereum perpetual · max 40x",
    meta: "ID 2",
    searchText: "2 ETHUSDT Ethereum perpetual",
  },
  {
    id: "3",
    label: "SOLUSDT",
    description: "Solana perpetual · max 20x",
    meta: "ID 3",
    searchText: "3 SOLUSDT Solana perpetual",
  },
];

const meta = {
  title: "UI/MarketSelect",
  component: MarketSelect,
  parameters: { layout: "centered" },
} satisfies Meta<typeof MarketSelect>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    idPrefix: "story-market-select",
    value: "",
    items: ITEMS,
    onValueChange: () => undefined,
  },
  render: () => <MarketSelectStory />,
};

/** A required field: no clear control, so the picker always holds a value. */
export const NotClearable: Story = {
  args: {
    idPrefix: "story-market-select-required",
    value: "",
    items: ITEMS,
    onValueChange: () => undefined,
  },
  render: () => <MarketSelectStory idPrefix="story-market-select-required" clearable={false} />,
};

function MarketSelectStory({
  idPrefix = "story-market-select",
  clearable,
}: {
  idPrefix?: string;
  clearable?: boolean;
}) {
  const [value, setValue] = useState("2");

  return (
    <div className="w-[360px]">
      <MarketSelect idPrefix={idPrefix} value={value} items={ITEMS} onValueChange={setValue} clearable={clearable} />
    </div>
  );
}
