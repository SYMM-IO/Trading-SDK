import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { SearchInput } from "./search-input";

const meta = {
  title: "UI/SearchInput",
  component: SearchInput,
  parameters: { layout: "padded" },
  args: { placeholder: "Search…", "aria-label": "Search" },
} satisfies Meta<typeof SearchInput>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => {
    const Demo = () => {
      const [value, setValue] = useState("");
      return <SearchInput {...args} value={value} onChange={(event) => setValue(event.target.value)} />;
    };
    return <Demo />;
  },
};

export const InAToolbar: Story = {
  name: "Inside a flex toolbar",
  render: (args) => {
    const Demo = () => {
      const [value, setValue] = useState("");
      return (
        <div className="flex items-center gap-2">
          <SearchInput
            {...args}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            containerClassName="flex-1"
          />
          <div className="bg-muted text-muted-foreground rounded-xl px-3 py-2 text-sm">Filter</div>
        </div>
      );
    };
    return <Demo />;
  },
};
