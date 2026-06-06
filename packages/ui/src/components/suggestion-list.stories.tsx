import type { Meta, StoryObj } from "@storybook/react";
import { SuggestionList, SuggestionListItem } from "./suggestion-list";

const meta = {
  title: "UI/SuggestionList",
  component: SuggestionList,
  parameters: { layout: "centered" },
} satisfies Meta<typeof SuggestionList>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Wrap: Story = {
  render: () => (
    <SuggestionList className="max-w-xl">
      <SuggestionListItem title="Close quote" meta="0x501e891f" selected />
      <SuggestionListItem title="Add margin" meta="0xa6d66852" />
      <SuggestionListItem title="Send quote" meta="0xa7f3b34b" />
    </SuggestionList>
  ),
};

export const Stack: Story = {
  render: () => (
    <SuggestionList layout="stack" className="w-[360px]">
      <SuggestionListItem
        title="Primary signer"
        description="Recommended delegate for this environment."
        meta="0x1234...abcd"
        actionLabel="Use"
      />
      <SuggestionListItem
        title="Backup signer"
        description="Alternate delegate for manual flows."
        meta="0xabcd...1234"
        selected
      />
    </SuggestionList>
  ),
};
