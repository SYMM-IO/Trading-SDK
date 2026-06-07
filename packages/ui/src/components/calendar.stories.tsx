import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { Calendar } from "./calendar";

const meta = {
  title: "UI/Calendar",
  component: Calendar,
  parameters: { layout: "centered" },
} satisfies Meta<typeof Calendar>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { onSelect: () => undefined },
  render: () => <CalendarStory />,
};

function CalendarStory() {
  const [selected, setSelected] = useState<Date | undefined>(undefined);
  return (
    <div className="border-border bg-popover rounded-xl border p-4 shadow-lg">
      <Calendar selected={selected} onSelect={setSelected} />
    </div>
  );
}
