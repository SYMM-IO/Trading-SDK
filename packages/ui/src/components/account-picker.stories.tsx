import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { AccountPicker, type AccountPickerItem } from "./account-picker";

const ITEMS: readonly AccountPickerItem[] = [
  { id: "0x1111", title: "Main account", meta: "0x1111...aaaa" },
  { id: "0x2222", title: "Trading account", meta: "0x2222...bbbb", selected: true },
  { id: "0x3333", title: "Archive account", meta: "0x3333...cccc" },
];

const meta = {
  title: "UI/AccountPicker",
  component: AccountPicker,
  parameters: { layout: "centered" },
} satisfies Meta<typeof AccountPicker>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    idPrefix: "story-account-picker",
    ownerValue: "",
    onOwnerValueChange: () => undefined,
    accountValue: "",
    onAccountValueChange: () => undefined,
    onSelect: () => undefined,
  },
  render: () => <DefaultAccountPickerStory />,
};

export const Loading: Story = {
  args: {
    idPrefix: "story-account-picker-loading",
    className: "w-[420px]",
    ownerValue: "0xowner",
    onOwnerValueChange: () => undefined,
    accountValue: "",
    onAccountValueChange: () => undefined,
    listState: "loading",
    onSelect: () => undefined,
  },
};

function DefaultAccountPickerStory() {
  const [owner, setOwner] = useState("0xowner");
  const [account, setAccount] = useState("0x2222");

  return (
    <AccountPicker
      idPrefix="story-account-picker"
      className="w-[420px]"
      ownerLabel="owner"
      ownerHint="Load selectable accounts for this owner."
      ownerValue={owner}
      onOwnerValueChange={setOwner}
      accountLabel="account"
      accountHint="Select an account or enter one manually."
      accountValue={account}
      onAccountValueChange={setAccount}
      listState="ready"
      items={ITEMS.map((item) => ({ ...item, selected: item.id === account }))}
      onSelect={(item) => setAccount(item.id)}
    />
  );
}
