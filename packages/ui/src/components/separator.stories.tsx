import type { Meta, StoryObj } from "@storybook/react";
import { Separator } from "./separator";

const meta = {
  title: "UI/Separator",
  component: Separator,
  parameters: { layout: "centered" },
} satisfies Meta<typeof Separator>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Horizontal: Story = {
  render: () => (
    <div className="w-[320px] space-y-2">
      <p className="text-foreground text-sm font-medium">Section A</p>
      <Separator />
      <p className="text-muted-foreground text-sm">Section B</p>
    </div>
  ),
};

export const Vertical: Story = {
  render: () => (
    <div className="flex h-12 items-center gap-3 text-sm">
      <span className="text-foreground">Inspector</span>
      <Separator orientation="vertical" />
      <span className="text-muted-foreground">Config</span>
      <Separator orientation="vertical" />
      <span className="text-muted-foreground">Docs</span>
    </div>
  ),
};
