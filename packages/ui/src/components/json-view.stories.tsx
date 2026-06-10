import type { Meta, StoryObj } from "@storybook/react";
import { JsonView } from "./json-view";

const METADATA = {
  "0x3d4f0513e8a29669b960f9dbca61861548a9a760": {
    name: "$BANANA::3d..60_SFLOW",
    chain_id: "bsc",
    dex_id: "pancakeswap",
    pair_address: "0x7F51BBf34156ba802dEB0E38B7671DC4fa32041d",
    base_token: {
      address: "0x3d4f0513e8a29669b960f9dbca61861548a9a760",
      name: "Banana For Scale",
      symbol: "BANANAS31",
    },
    price_native: "0.00001921",
    price_usd: "0.01163",
    decimal: 18,
    liquidity: { usd: 145674.21, base: 6043912.5, quote: 71.4 },
    enabled: true,
    tags: ["meme", "bsc", "pancakeswap"],
  },
};

const meta = {
  title: "UI/JsonView",
  component: JsonView,
  parameters: { layout: "padded" },
} satisfies Meta<typeof JsonView>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Metadata: Story = {
  args: { data: METADATA, defaultExpandedDepth: 2 },
  render: (args) => (
    <div className="max-w-2xl">
      <JsonView {...args} />
    </div>
  ),
};

export const CollapsedByDefault: Story = {
  args: { data: METADATA, defaultExpandedDepth: 1 },
  render: (args) => (
    <div className="max-w-2xl">
      <JsonView {...args} />
    </div>
  ),
};

export const Primitive: Story = {
  args: { data: "ok" },
  render: (args) => (
    <div className="max-w-sm">
      <JsonView {...args} />
    </div>
  ),
};
