import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { AccountCombobox, type AccountPickerItem } from "./account-combobox";

const ITEMS: readonly AccountPickerItem[] = [
  {
    id: "0x1111111111111111111111111111111111111111",
    title: "Main account",
    meta: "0x1111…1111",
    detail: "$1,240.50",
  },
  {
    id: "0x2222222222222222222222222222222222222222",
    title: "Trading account",
    meta: "0x2222…2222",
    detail: "$820.25",
  },
  {
    id: "0x3333333333333333333333333333333333333333",
    title: "Archive account",
    meta: "0x3333…3333",
    detail: "$0",
  },
];

const meta = {
  title: "UI/AccountCombobox",
  component: AccountCombobox,
  parameters: { layout: "centered" },
} satisfies Meta<typeof AccountCombobox>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    idPrefix: "story-combobox",
    value: "",
    onValueChange: () => undefined,
    onSelect: () => undefined,
  },
  render: () => <AccountComboboxStory />,
};

export const Loading: Story = {
  args: {
    idPrefix: "story-combobox-loading",
    value: "",
    onValueChange: () => undefined,
    onSelect: () => undefined,
    listState: "loading",
  },
  render: (args) => (
    <div className="w-[360px]">
      <AccountCombobox {...args} />
    </div>
  ),
};

function AccountComboboxStory() {
  const [value, setValue] = useState("");

  return (
    <div className="w-[360px]">
      <AccountCombobox
        idPrefix="story-combobox"
        value={value}
        onValueChange={setValue}
        placeholder="0x…"
        listState="ready"
        items={ITEMS}
        onSelect={(item) => setValue(item.id)}
      />
    </div>
  );
}
