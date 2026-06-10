import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { Pagination } from "./pagination";

const meta = {
  title: "UI/Pagination",
  component: Pagination,
  parameters: { layout: "padded" },
  args: {
    page: 1,
    pageCount: 5,
    pageSize: 10,
    total: 42,
    onPageChange: () => undefined,
    onPageSizeChange: () => undefined,
  },
} satisfies Meta<typeof Pagination>;

export default meta;

type Story = StoryObj<typeof meta>;

const TOTAL = 42;

function Interactive({ totalCount }: { totalCount?: number }) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const pageCount = Math.max(1, Math.ceil(TOTAL / pageSize));
  return (
    <Pagination
      page={Math.min(page, pageCount)}
      pageCount={pageCount}
      pageSize={pageSize}
      total={TOTAL}
      totalCount={totalCount}
      onPageChange={setPage}
      onPageSizeChange={(size) => {
        setPageSize(size);
        setPage(1);
      }}
    />
  );
}

export const Default: Story = {
  render: () => <Interactive />,
};

export const Filtered: Story = {
  name: "Filtered from a larger set",
  render: () => <Interactive totalCount={128} />,
};
