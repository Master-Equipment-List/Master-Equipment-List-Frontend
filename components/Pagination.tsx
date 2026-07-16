"use client";
import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/cn";

/** Shared shape every paginated list endpoint returns. */
export interface Paged<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

/** Page/limit state a paginated page keeps, plus the query-string bit to
 *  append to the SWR key. Reset `offset` to 0 whenever a filter changes —
 *  callers are responsible for that (this hook doesn't know about filters). */
export function usePagination(initialLimit = 50) {
  const [limit, setLimit] = React.useState(initialLimit);
  const [offset, setOffset] = React.useState(0);
  const qs = `limit=${limit}&offset=${offset}`;
  return { limit, offset, setLimit, setOffset, qs };
}

export function Pagination({
  total,
  limit,
  offset,
  onOffsetChange,
  onLimitChange,
  pageSizeOptions = [25, 50, 100, 200],
  className,
}: {
  total: number;
  limit: number;
  offset: number;
  onOffsetChange: (offset: number) => void;
  onLimitChange?: (limit: number) => void;
  pageSizeOptions?: number[];
  className?: string;
}) {
  const page = Math.floor(offset / limit) + 1;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const start = total === 0 ? 0 : offset + 1;
  const end = Math.min(offset + limit, total);

  function goTo(p: number) {
    const clamped = Math.min(Math.max(1, p), totalPages);
    onOffsetChange((clamped - 1) * limit);
  }

  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-ink-100 px-3 py-2 text-xs text-ink-500", className)}>
      <div className="whitespace-nowrap">
        {total === 0 ? "No rows" : `Showing ${start}–${end} of ${total}`}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {onLimitChange && (
          <label className="flex shrink-0 items-center gap-1.5 whitespace-nowrap">
            Rows per page
            <select
              className="input h-7 px-1.5 py-0 text-xs"
              value={limit}
              onChange={(e) => {
                onLimitChange(Number(e.target.value));
                onOffsetChange(0);
              }}
            >
              {pageSizeOptions.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </label>
        )}
        <div className="flex shrink-0 items-center gap-2 whitespace-nowrap">
          <button
            type="button"
            className="btn-ghost h-7 px-2 disabled:cursor-not-allowed disabled:opacity-40"
            onClick={() => goTo(page - 1)}
            disabled={page <= 1}
            aria-label="Previous page"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <span className="tabular-nums">
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            className="btn-ghost h-7 px-2 disabled:cursor-not-allowed disabled:opacity-40"
            onClick={() => goTo(page + 1)}
            disabled={page >= totalPages}
            aria-label="Next page"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
