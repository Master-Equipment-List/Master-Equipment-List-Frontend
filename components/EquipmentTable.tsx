"use client";
import * as React from "react";
import Link from "next/link";
import { useSWRConfig } from "swr";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type RowSelectionState,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Check,
  History,
  Loader2,
  Search,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react";

import { Badge, ConfirmModal, ErrorBox } from "@/components/ui";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import type { Equipment } from "@/lib/types";

// ---- Column catalog --------------------------------------------------------
// Every column the table can show. `defaultVisible` controls what's on screen
// by default; users can toggle the rest via the Columns dropdown.

type EqKey = keyof Equipment;

interface ColSpec {
  id: string;
  header: string;
  accessor: EqKey;
  numeric?: boolean;
  defaultVisible?: boolean;
}

const FIELD_COLUMNS: ColSpec[] = [
  { id: "rev_no",                 header: "REV",            accessor: "rev_no" },
  { id: "old_tag",                header: "OLD TAG",        accessor: "old_tag" },
  { id: "description",            header: "DESCRIPTION",    accessor: "description",     defaultVisible: true },
  { id: "module",                 header: "MODULE",         accessor: "module",           defaultVisible: true },
  { id: "equipment_type",         header: "TYPE",           accessor: "equipment_type",   defaultVisible: true },
  { id: "vendor",                 header: "VENDOR",         accessor: "vendor",           defaultVisible: true },
  { id: "design_code",            header: "DESIGN CODE",    accessor: "design_code" },
  { id: "orientation",            header: "ORIENTATION",    accessor: "orientation" },
  { id: "material",               header: "MATERIAL",       accessor: "material",         defaultVisible: true },
  { id: "configuration",          header: "CONFIG",         accessor: "configuration" },
  { id: "location",               header: "LOCATION",       accessor: "location" },
  { id: "operating_press",        header: "OP PRESS",       accessor: "operating_press",  defaultVisible: true },
  { id: "operating_temp",         header: "OP TEMP",        accessor: "operating_temp",   defaultVisible: true },
  { id: "design_press",           header: "DES PRESS",      accessor: "design_press",     defaultVisible: true },
  { id: "design_temp",            header: "DES TEMP",       accessor: "design_temp",      defaultVisible: true },
  { id: "design_flow",            header: "DES FLOW",       accessor: "design_flow" },
  { id: "pump_capacity",          header: "CAPACITY",       accessor: "pump_capacity" },
  { id: "heat_exchanger_duty_kw", header: "DUTY kW",        accessor: "heat_exchanger_duty_kw", numeric: true },
  { id: "liquid_fill",            header: "LIQ FILL",       accessor: "liquid_fill" },
  { id: "absorbed_power_kw",      header: "ABS kW",         accessor: "absorbed_power_kw", numeric: true },
  { id: "rated_power_kw",         header: "RATED kW",       accessor: "rated_power_kw",    numeric: true },
  { id: "length_m",               header: "L T/T (m)",      accessor: "length_m",          numeric: true, defaultVisible: true },
  { id: "width_id_m",             header: "W / I.D (m)",    accessor: "width_id_m",        numeric: true, defaultVisible: true },
  { id: "height_tt_m",            header: "H T/T (m)",      accessor: "height_tt_m",       numeric: true, defaultVisible: true },
  { id: "dry_weight_mt",          header: "DRY WT (MT)",    accessor: "dry_weight_mt",     numeric: true, defaultVisible: true },
  { id: "operating_weight_mt",    header: "OPE WT (MT)",    accessor: "operating_weight_mt", numeric: true, defaultVisible: true },
  { id: "hydrotest_weight_mt",    header: "HYDRO WT (MT)",  accessor: "hydrotest_weight_mt", numeric: true },
  { id: "pid",                    header: "P&ID",           accessor: "pid" },
  { id: "remarks",                header: "REMARKS",        accessor: "remarks" },
  { id: "total_dry_weight_mt",    header: "TOT DRY WT",     accessor: "total_dry_weight_mt", numeric: true },
  { id: "total_operating_weight_mt", header: "TOT OPE WT",  accessor: "total_operating_weight_mt", numeric: true },
  { id: "lifecycle_status",       header: "LIFECYCLE",      accessor: "lifecycle_status",  defaultVisible: true },
];

// Legacy export, kept for any external consumers.
export const COLUMNS = [
  { key: "rev_no" as EqKey, label: "REV No.", width: "w-20" },
  ...FIELD_COLUMNS.map((c) => ({ key: c.accessor, label: c.header })),
];

// ---- Filter options --------------------------------------------------------

type UpdatedSince = "any" | "24h" | "7d" | "30d";

const UPDATED_LABEL: Record<UpdatedSince, string> = {
  any: "Any time",
  "24h": "Last 24 hours",
  "7d":  "Last 7 days",
  "30d": "Last 30 days",
};

function withinWindow(updatedAt: string, win: UpdatedSince): boolean {
  if (win === "any") return true;
  const ts = new Date(updatedAt).getTime();
  if (Number.isNaN(ts)) return true;
  const now = Date.now();
  const ms = win === "24h" ? 24 * 3600e3 : win === "7d" ? 7 * 86400e3 : 30 * 86400e3;
  return now - ts <= ms;
}

/**
 * Build the list of version-threshold options from the actual data.
 * Returns [{value:1,label:"Any version"}, {value:2,label:"v2+ (changed…)"},
 *          {value:3,label:"v3+"}, …, {value:max,label:"vMAX+"}].
 * If every row is still on v1 (untouched), only "Any version" is offered.
 */
function buildVersionOptions(rows: Equipment[]): { value: number; label: string }[] {
  const max = rows.reduce((m, r) => Math.max(m, r.current_version ?? 1), 1);
  const opts = [{ value: 1, label: "Any version" }];
  for (let v = 2; v <= max; v++) {
    opts.push({
      value: v,
      label: v === 2 ? "v2+ (changed at least once)" : `v${v}+`,
    });
  }
  return opts;
}

function relativeTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  const diff = Date.now() - t;
  const abs = Math.abs(diff);
  if (abs < 60_000) return "just now";
  if (abs < 3_600_000) return `${Math.round(abs / 60_000)}m ago`;
  if (abs < 86_400_000) return `${Math.round(abs / 3_600_000)}h ago`;
  if (abs < 30 * 86_400_000) return `${Math.round(abs / 86_400_000)}d ago`;
  if (abs < 365 * 86_400_000) return `${Math.round(abs / (30 * 86_400_000))}mo ago`;
  return `${Math.round(abs / (365 * 86_400_000))}y ago`;
}

function sourceTone(src: string): "blue" | "amber" | "green" | "violet" | "slate" {
  switch (src) {
    case "pfd":    return "amber";
    case "pid":    return "blue";
    case "vendor": return "green";
    case "seed":   return "slate";
    case "manual": return "blue";
    case "excel":  return "violet";
    default:       return "slate";
  }
}

function numCell(v: string | null | undefined) {
  if (!v || v === "-") return <span className="text-ink-300">—</span>;
  return <span className="font-mono tabular-nums">{v}</span>;
}

// ---- Main component --------------------------------------------------------

export function EquipmentTable({
  projectId,
  rows,
  workspace = "topside",
  onFilteredIdsChange,
}: {
  projectId: number;
  rows: Equipment[];
  /** Forwarded to row-to-detail links so workspace context is preserved. */
  workspace?: "topside" | "marine";
  /** Called with the equipment IDs currently passing all active filters
   *  (search text, "Updated", "Version") whenever the filtered set
   *  changes. Used by the parent page so the Excel-export button can
   *  download exactly what the table is showing, not the full dataset. */
  onFilteredIdsChange?: (ids: number[]) => void;
}) {
  const { mutate } = useSWRConfig();
  const [globalFilter, setGlobalFilter] = React.useState("");
  const [sorting, setSorting] = React.useState<SortingState>([
    { id: "client_tag", desc: false },
  ]);
  const [updatedSince, setUpdatedSince] = React.useState<UpdatedSince>("any");
  const [minVer, setMinVer] = React.useState<number>(1); // 1 = "Any version"

  // ---- Per-row delete state ----
  const [pendingDelete, setPendingDelete] = React.useState<Equipment | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);

  // ---- Bulk selection + bulk-delete state ----
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
  const [bulkConfirmOpen, setBulkConfirmOpen] = React.useState(false);
  const [bulkBusy, setBulkBusy] = React.useState(false);
  const [bulkError, setBulkError] = React.useState<string | null>(null);

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await api.delete(`/projects/${projectId}/equipment/${pendingDelete.id}`);
      mutate((k) => typeof k === "string" && k.includes(`/projects/${projectId}/`));
      setPendingDelete(null);
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : String(e));
    } finally {
      setDeleting(false);
    }
  }

  async function bulkDelete(ids: number[]) {
    if (!ids.length) return;
    setBulkBusy(true);
    setBulkError(null);
    try {
      await api.post(`/projects/${projectId}/equipment/bulk-delete`, { ids });
      mutate((k) => typeof k === "string" && k.includes(`/projects/${projectId}/`));
      setRowSelection({});
      setBulkConfirmOpen(false);
    } catch (e) {
      setBulkError(e instanceof Error ? e.message : String(e));
    } finally {
      setBulkBusy(false);
    }
  }

  // Version threshold options are derived from the actual data — so if your
  // project's max version is 7, you get v2+ through v7+ here.
  const versionOptions = React.useMemo(() => buildVersionOptions(rows), [rows]);

  // If a sync raises the max version above the current selection, keep it;
  // if the data shrinks (less likely), clamp back to "Any".
  React.useEffect(() => {
    if (!versionOptions.some((o) => o.value === minVer)) setMinVer(1);
  }, [versionOptions, minVer]);

  // Visibility state — keyed by column id. Defaults from FIELD_COLUMNS.
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>(
    () => {
      const v: VisibilityState = {
        client_tag: true,
        current_version: true,
        updated_at: true,
        actions: true,
      };
      for (const c of FIELD_COLUMNS) v[c.id] = !!c.defaultVisible;
      return v;
    },
  );

  // ---- Pre-filter rows by "updated since" + "min version" ----
  const visibleRows = React.useMemo(() => {
    return rows.filter((r) => {
      if ((r.current_version ?? 1) < minVer) return false;
      if (!withinWindow(r.updated_at, updatedSince)) return false;
      return true;
    });
  }, [rows, updatedSince, minVer]);

  const updatedRecentlyCount = React.useMemo(
    () => rows.filter((r) => withinWindow(r.updated_at, "7d") && (r.current_version ?? 1) >= 2).length,
    [rows],
  );

  // ---- Column definitions ----
  const columns = React.useMemo<ColumnDef<Equipment>[]>(() => {
    const fixedHead: ColumnDef<Equipment>[] = [
      {
        id: "select",
        enableSorting: false,
        enableHiding: false,
        header: ({ table }) => (
          <input
            type="checkbox"
            className="cursor-pointer"
            aria-label="Select all visible rows"
            checked={table.getIsAllPageRowsSelected() || table.getIsAllRowsSelected()}
            ref={(el) => {
              if (el) {
                el.indeterminate = table.getIsSomePageRowsSelected() || table.getIsSomeRowsSelected();
              }
            }}
            onChange={(e) => table.toggleAllRowsSelected(!!e.target.checked)}
          />
        ),
        cell: ({ row }) => (
          <input
            type="checkbox"
            className="cursor-pointer"
            aria-label={`Select ${row.original.client_tag}`}
            checked={row.getIsSelected()}
            disabled={!row.getCanSelect()}
            onChange={row.getToggleSelectedHandler()}
            onClick={(e) => e.stopPropagation()}
          />
        ),
      },
      {
        id: "client_tag",
        header: "CLIENT TAG",
        accessorKey: "client_tag",
        cell: ({ row }) => (
          <Link
            href={`/projects/${projectId}/${workspace}/equipment/${row.original.id}`}
            className="font-mono text-xs font-semibold text-brand-700 hover:underline"
          >
            {row.original.client_tag}
          </Link>
        ),
      },
    ];

    const dynamicCols: ColumnDef<Equipment>[] = FIELD_COLUMNS.map((c) => ({
      id: c.id,
      header: c.header,
      accessorKey: c.accessor,
      // ALWAYS provide a cell renderer — TanStack's flexRender returns
      // null when columnDef.cell is undefined, which is why text columns
      // were showing blank.
      cell: c.numeric
        ? ({ getValue }) => numCell(getValue() as string | null)
        : ({ getValue }) => {
            const v = getValue() as string | null | undefined;
            if (v == null || v === "") return <span className="text-ink-300">—</span>;
            return <span>{String(v)}</span>;
          },
    }));

    const fixedTail: ColumnDef<Equipment>[] = [
      {
        id: "current_version",
        header: "VER",
        accessorKey: "current_version",
        cell: ({ row }) => {
          const v = row.original.current_version;
          const tone = v >= 2 ? "amber" : "slate";
          return (
            <Link
              href={`/projects/${projectId}/${workspace}/equipment/${row.original.id}`}
              className="inline-flex items-center gap-1.5 hover:underline"
              title="Click to view version history"
            >
              <Badge tone={tone as "amber" | "slate"}>v{v}</Badge>
              {row.original.last_source && (
                <Badge tone={sourceTone(row.original.last_source)}>
                  {row.original.last_source}
                </Badge>
              )}
            </Link>
          );
        },
      },
      {
        id: "updated_at",
        header: "UPDATED",
        accessorKey: "updated_at",
        cell: ({ row }) => {
          const iso = row.original.updated_at;
          const exact = iso ? new Date(iso).toLocaleString() : "—";
          return (
            <span className="text-xs text-ink-600" title={exact}>
              {relativeTime(iso)}
            </span>
          );
        },
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) => {
          const busy = deleting && pendingDelete?.id === row.original.id;
          return (
            <button
              type="button"
              className="inline-flex items-center justify-center rounded p-1 text-rose-600 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40"
              onClick={(e) => {
                e.stopPropagation();
                setDeleteError(null);
                setPendingDelete(row.original);
              }}
              disabled={busy || deleting}
              title="Remove this equipment row from the project"
            >
              {busy
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Trash2 className="h-4 w-4" />}
            </button>
          );
        },
      },
    ];

    return [...fixedHead, ...dynamicCols, ...fixedTail];
  }, [projectId, workspace, deleting, pendingDelete]);

  const table = useReactTable({
    data: visibleRows,
    columns,
    state: { sorting, globalFilter, columnVisibility, rowSelection },
    enableRowSelection: true,
    // Use equipment.id so checked state survives sort / filter changes
    getRowId: (row) => String(row.id),
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    globalFilterFn: "includesString",
  });

  // Selected equipment objects (derived from row selection map)
  const selectedRows = React.useMemo(() => {
    return table.getSelectedRowModel().rows.map((r) => r.original);
  }, [table, rowSelection]); // eslint-disable-line react-hooks/exhaustive-deps

  // Push the IDs of currently-visible rows up to the parent so the
  // Excel-export button knows what to download. We derive from the
  // filter inputs (rows + globalFilter + updatedSince + minVer) so the
  // effect re-runs whenever any of those change — depending on the
  // table instance directly would skip updates because TanStack mutates
  // it in place rather than creating a new reference.
  React.useEffect(() => {
    if (!onFilteredIdsChange) return;
    const ids = table.getFilteredRowModel().rows.map((r) => r.original.id);
    onFilteredIdsChange(ids);
  }, [rows, globalFilter, updatedSince, minVer, table, onFilteredIdsChange]);

  return (
    <div className="space-y-3">
      {/* Filter / search bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <input
            className="input pl-8"
            placeholder="Filter by tag, description, module…"
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
          />
        </div>

        <label className="flex items-center gap-1.5 text-xs text-ink-600">
          Updated:
          <select
            className="input h-8 px-2 py-0 text-xs"
            value={updatedSince}
            onChange={(e) => setUpdatedSince(e.target.value as UpdatedSince)}
          >
            {(Object.keys(UPDATED_LABEL) as UpdatedSince[]).map((k) => (
              <option key={k} value={k}>{UPDATED_LABEL[k]}</option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-1.5 text-xs text-ink-600">
          Version:
          <select
            className="input h-8 px-2 py-0 text-xs"
            value={minVer}
            onChange={(e) => setMinVer(Number(e.target.value))}
            disabled={versionOptions.length <= 1}
            title={
              versionOptions.length <= 1
                ? "Nothing has been updated yet — every row is still on v1"
                : undefined
            }
          >
            {versionOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </label>

        <ColumnsMenu table={table} />

        <div className="ml-auto text-xs text-ink-500">
          {table.getFilteredRowModel().rows.length} of {rows.length} rows
          {updatedRecentlyCount > 0 && (
            <>
              {" · "}
              <span className="text-amber-700">
                {updatedRecentlyCount} updated in last 7d
              </span>
            </>
          )}
        </div>
      </div>

      {/* Bulk action bar — only renders when one or more rows are selected */}
      {selectedRows.length > 0 && (
        <div className="sticky top-2 z-10 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-brand-200 bg-brand-50 px-4 py-2 shadow-sm">
          <div className="flex items-center gap-3 text-sm text-brand-900">
            <span className="grid h-6 w-6 place-items-center rounded-full bg-brand-600 text-xs font-semibold text-white tabular-nums">
              {selectedRows.length}
            </span>
            <span>
              {selectedRows.length === 1 ? "row selected" : "rows selected"}
            </span>
            <button
              type="button"
              className="text-xs text-brand-700 underline hover:text-brand-900"
              onClick={() => setRowSelection({})}
            >
              Clear selection
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="btn-danger"
              onClick={() => { setBulkError(null); setBulkConfirmOpen(true); }}
              disabled={bulkBusy}
            >
              <Trash2 className="h-4 w-4" />
              Delete {selectedRows.length} selected
            </button>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => setRowSelection({})}
              disabled={bulkBusy}
              title="Clear selection"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {bulkError && <ErrorBox error={{ message: bulkError }} />}

      {/* Table */}
      <div className="overflow-auto rounded-xl border border-ink-100 bg-white shadow-card max-h-[70vh]">
        <table className="min-w-full text-sm">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => {
                  const sort = h.column.getIsSorted();
                  return (
                    <th key={h.id} className="table-th">
                      <button
                        className="inline-flex items-center gap-1"
                        onClick={h.column.getToggleSortingHandler()}
                      >
                        {flexRender(h.column.columnDef.header, h.getContext())}
                        {sort === "asc"  && <ArrowUp className="h-3 w-3" />}
                        {sort === "desc" && <ArrowDown className="h-3 w-3" />}
                        {!sort && <ArrowUpDown className="h-3 w-3 opacity-40" />}
                      </button>
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => {
              const recently = withinWindow(row.original.updated_at, "24h")
                && (row.original.current_version ?? 1) >= 2;
              return (
                <tr
                  key={row.id}
                  className={cn(
                    "table-row-hover",
                    recently && "bg-amber-50/40",
                  )}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="table-td whitespace-nowrap">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              );
            })}
            {table.getRowModel().rows.length === 0 && (
              <tr>
                <td
                  colSpan={table.getAllLeafColumns().length}
                  className="px-3 py-10 text-center text-sm text-ink-500"
                >
                  No equipment matches the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-end text-[11px] text-ink-500">
        <History className="mr-1 h-3 w-3" />
        Click a tag or version badge to open detail &amp; version history. Rows with a
        <span className="mx-1 inline-block h-2 w-2 rounded-sm bg-amber-50 ring-1 ring-amber-200" />
        background were updated in the last 24h.
      </div>

      {deleteError && <ErrorBox error={{ message: deleteError }} />}

      <ConfirmModal
        open={pendingDelete !== null}
        title="Remove equipment from this project"
        description={
          pendingDelete ? (
            <div className="space-y-2">
              <p>
                Remove{" "}
                <span className="font-mono text-xs font-semibold text-ink-900">
                  {pendingDelete.client_tag}
                </span>
                {pendingDelete.description ? (
                  <span className="text-ink-500"> — {pendingDelete.description}</span>
                ) : null}
                {" "}from this project?
              </p>
              <ul className="list-disc space-y-1 pl-5 text-xs text-ink-600">
                <li>The equipment row and its entire version history will be permanently deleted.</li>
                <li>Files synced from OneDrive are kept (only their reference to this row is cleared).</li>
                <li>This cannot be undone. To restore, you&apos;d need to re-import the Excel or re-sync the PDFs that originally provided the data.</li>
              </ul>
            </div>
          ) : null
        }
        confirmLabel={deleting ? "Removing…" : "Remove equipment"}
        tone="red"
        busy={deleting}
        onConfirm={confirmDelete}
        onClose={() => { if (!deleting) setPendingDelete(null); }}
      />

      <ConfirmModal
        open={bulkConfirmOpen}
        title={`Remove ${selectedRows.length} equipment row${selectedRows.length === 1 ? "" : "s"}`}
        description={
          <div className="space-y-2">
            <p>
              Permanently delete{" "}
              <span className="font-semibold text-ink-900">
                {selectedRows.length}
              </span>{" "}
              equipment row{selectedRows.length === 1 ? "" : "s"} from this project?
            </p>
            {selectedRows.length <= 12 ? (
              <ul className="max-h-40 list-disc space-y-0.5 overflow-y-auto pl-5 text-xs text-ink-700">
                {selectedRows.map((r) => (
                  <li key={r.id} className="truncate">
                    <span className="font-mono">{r.client_tag}</span>
                    {r.description && <span className="text-ink-500"> — {r.description}</span>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-ink-500">
                Includes <span className="font-mono">{selectedRows[0].client_tag}</span>,{" "}
                <span className="font-mono">{selectedRows[1].client_tag}</span>, and{" "}
                {selectedRows.length - 2} more.
              </p>
            )}
            <ul className="list-disc space-y-1 pl-5 text-xs text-ink-600">
              <li>All selected rows and their entire version histories will be deleted.</li>
              <li>Files synced from OneDrive are kept; only their reference to these rows is cleared.</li>
              <li>This cannot be undone.</li>
            </ul>
          </div>
        }
        confirmLabel={bulkBusy ? "Removing…" : `Remove ${selectedRows.length} row${selectedRows.length === 1 ? "" : "s"}`}
        tone="red"
        busy={bulkBusy}
        onConfirm={() => bulkDelete(selectedRows.map((r) => r.id))}
        onClose={() => { if (!bulkBusy) setBulkConfirmOpen(false); }}
      />
    </div>
  );
}

// ---- Columns dropdown ------------------------------------------------------

function ColumnsMenu({ table }: { table: ReturnType<typeof useReactTable<Equipment>> }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const allLeaf = table.getAllLeafColumns();
  const hiddenCount = allLeaf.filter((c) => !c.getIsVisible()).length;

  return (
    <div className="relative" ref={ref}>
      <button
        className="btn-ghost text-xs"
        onClick={() => setOpen((v) => !v)}
      >
        <SlidersHorizontal className="h-3.5 w-3.5" />
        Columns
        {hiddenCount > 0 && (
          <span className="ml-1 rounded-full bg-ink-100 px-1.5 py-0.5 text-[10px] text-ink-600">
            {allLeaf.length - hiddenCount}/{allLeaf.length}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-1 max-h-80 w-64 overflow-auto rounded-lg border border-ink-200 bg-white p-2 text-xs shadow-xl">
          <div className="mb-1 flex items-center justify-between px-1">
            <span className="font-medium text-ink-600">Show columns</span>
            <div className="flex gap-1">
              <button
                className="rounded px-1.5 py-0.5 text-[10px] text-ink-500 hover:bg-ink-100"
                onClick={() => table.toggleAllColumnsVisible(true)}
              >All</button>
              <button
                className="rounded px-1.5 py-0.5 text-[10px] text-ink-500 hover:bg-ink-100"
                onClick={() => {
                  // Reset to defaults (defined in FIELD_COLUMNS + fixed cols).
                  table.setColumnVisibility(() => {
                    const v: VisibilityState = {
                      client_tag: true,
                      current_version: true,
                      updated_at: true,
                      actions: true,
                    };
                    for (const c of FIELD_COLUMNS) v[c.id] = !!c.defaultVisible;
                    return v;
                  });
                }}
              >Default</button>
            </div>
          </div>
          <ul className="space-y-0.5">
            {allLeaf.map((c) => {
              const label = typeof c.columnDef.header === "string"
                ? c.columnDef.header
                : c.id;
              const isFixed = c.id === "client_tag" || c.id === "actions";
              return (
                <li key={c.id}>
                  <label
                    className={cn(
                      "flex w-full items-center gap-2 rounded px-2 py-1",
                      isFixed
                        ? "cursor-not-allowed text-ink-400"
                        : "cursor-pointer hover:bg-ink-50",
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={c.getIsVisible()}
                      disabled={isFixed}
                      onChange={c.getToggleVisibilityHandler()}
                    />
                    <span className="flex-1">{label}</span>
                    {c.getIsVisible() && !isFixed && (
                      <Check className="h-3 w-3 text-emerald-600" />
                    )}
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
