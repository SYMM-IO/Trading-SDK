import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { Combobox, type ComboboxItem } from "./combobox";

const DELEGATEES: readonly ComboboxItem[] = [
  {
    id: "0x1111111111111111111111111111111111111111",
    title: "Solver PartyB",
    description: "Delegates to the solver address for delegated execution.",
    meta: "0x1111…1111",
  },
  {
    id: "0x2222222222222222222222222222222222222222",
    title: "COH wallet",
    description: "Conditional Order Handler wallet for TP/SL delegation.",
    meta: "0x2222…2222",
  },
  {
    id: "manual:session",
    title: "Session key",
    description: "Paste the browser session-key address manually.",
    meta: "Paste manually",
    disabled: true,
  },
];

const SELECTORS: readonly ComboboxItem[] = [
  { id: "0xa6d66852", title: "ADD_MARGIN_TO_NEXT_VA", meta: "0xa6d66852" },
  { id: "0x501e891f", title: "CLOSE_QUOTE", meta: "0x501e891f" },
  { id: "0xa7f3b34b", title: "SEND_QUOTE_WITH_AFFILIATE_AND_DATA", meta: "0xa7f3b34b" },
];

const meta = {
  title: "UI/Combobox",
  component: Combobox,
  parameters: { layout: "centered" },
} satisfies Meta<typeof Combobox>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Single: Story = {
  args: {
    idPrefix: "story-single",
    value: "",
    onValueChange: () => undefined,
    onSelect: () => undefined,
  },
  render: () => <SingleStory />,
};

export const Multiple: Story = {
  args: {
    idPrefix: "story-multiple",
    value: "",
    onValueChange: () => undefined,
    onSelect: () => undefined,
  },
  render: () => <MultipleStory />,
};

function SingleStory() {
  const [value, setValue] = useState("");
  return (
    <div className="w-[380px]">
      <Combobox
        idPrefix="story-single"
        value={value}
        onValueChange={setValue}
        items={DELEGATEES.map((item) => ({ ...item, selected: item.id === value }))}
        placeholder="0x…"
        mono
        triggerLabel="Browse delegatees"
        onSelect={(item) => setValue(item.id)}
      />
    </div>
  );
}

function MultipleStory() {
  const [value, setValue] = useState("");
  const picked = value.split(/[\s,]+/).filter(Boolean);
  return (
    <div className="w-[380px]">
      <Combobox
        idPrefix="story-multiple"
        mode="multiple"
        value={value}
        onValueChange={setValue}
        items={SELECTORS.map((item) => ({ ...item, selected: picked.includes(item.id) }))}
        placeholder="0x12345678, 0xabcdef12"
        mono
        triggerLabel="Browse selectors"
        onSelect={(item) => {
          const next = picked.includes(item.id) ? picked.filter((id) => id !== item.id) : [...picked, item.id];
          setValue(next.join(", "));
        }}
      />
    </div>
  );
}
