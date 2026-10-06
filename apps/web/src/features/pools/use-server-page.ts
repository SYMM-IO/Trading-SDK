import { useState } from "react";

/**
 * Page state for a table the server pages — the listing backend's
 * `/{start}/{size}` reads.
 *
 * `page` is 1-based, for the footer. `start` is what the request sends, and it
 * counts **rows**, not pages: page 3 at 10 a page is `start = 20`. Changing the
 * page size returns to page 1, since the old page number points somewhere else
 * at the new size.
 *
 * The hook holds no scope of its own. Key the component that calls it on
 * whatever narrows the rows (the pool, the session), so a new scope remounts
 * it: it opens on page 1, and `placeholderData` never shows the old scope's rows
 * while the new ones load.
 *
 * @param defaultPageSize - Rows per page on first render.
 */
export function useServerPage(defaultPageSize: number) {
  const [page, setPage] = useState(1);
  const [pageSize, setSize] = useState(defaultPageSize);

  function setPageSize(size: number) {
    setSize(size);
    setPage(1);
  }

  return {
    page,
    pageSize,
    start: (page - 1) * pageSize,
    /** Pages needed for `total` rows at the current size — at least one, so the footer never reads "of 0". */
    pageCount: (total: number) => Math.max(1, Math.ceil(total / pageSize)),
    setPage,
    setPageSize,
  };
}
