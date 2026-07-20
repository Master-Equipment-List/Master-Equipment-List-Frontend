"use client";
import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import useSWR from "swr";
import { AlertTriangle, Download, ListChecks, Loader2, Plus, Search, Upload } from "lucide-react";

import { EquipmentTable } from "@/components/EquipmentTable";
import { Pagination, usePagination, type Paged } from "@/components/Pagination";
import { Badge, ErrorBox, Spinner } from "@/components/ui";
import { apiBase, fetcher } from "@/lib/api";
import type { Equipment, PendingChange } from "@/lib/types";

type UpdatedSince = "any" | "24h" | "7d" | "30d";
const UPDATED_HOURS: Record<UpdatedSince, number | null> = {
  any: null, "24h": 24, "7d": 24 * 7, "30d": 24 * 30,
};
const UPDATED_LABEL: Record<UpdatedSince, string> = {
  any: "Any time", "24h": "Last 24 hours", "7d": "Last 7 days", "30d": "Last 30 days",
};

/** Debounce a fast-changing value (the search box) so it doesn't fire a
 *  server request on every keystroke. */
function useDebounced<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

export default function EquipmentListPage() {
  const params = useParams();
  const router = useRouter();
  const id = Number(Array.isArray(params?.id) ? params.id[0] : params?.id);

  // workspace lives in the URL PATH now (/projects/[id]/[workspace]/...).
  // The parent `[workspace]/layout.tsx` already validated the segment, so
  // here we just narrow the param's type for TypeScript.
  const wsParam = params?.workspace;
  const wsRaw = Array.isArray(wsParam) ? wsParam[0] : wsParam;
  const workspace: "topside" | "marine" = wsRaw === "marine" ? "marine" : "topside";

  // ---- Server-side filters — search / updated-since / min-version all
  // hit the API directly now (paired with pagination, these can't stay
  // client-side over a fully-fetched dataset any more). ----
  const [searchInput, setSearchInput] = React.useState("");
  const search = useDebounced(searchInput, 300);
  const [updatedSince, setUpdatedSince] = React.useState<UpdatedSince>("any");
  const [minVer, setMinVer] = React.useState(1);
  const { limit, offset, setLimit, setOffset, qs } = usePagination(50);

  // Any filter change invalidates the current offset — start back at page 1.
  React.useEffect(() => { setOffset(0); }, [search, updatedSince, minVer, setOffset]);

  const updatedSinceHours = UPDATED_HOURS[updatedSince];
  const filterQs = new URLSearchParams({ workspace, min_version: String(minVer) });
  if (search) filterQs.set("q", search);
  if (updatedSinceHours) filterQs.set("updated_since_hours", String(updatedSinceHours));

  const { data: page, error, isLoading } = useSWR<Paged<Equipment>>(
    `/projects/${id}/equipment?${filterQs.toString()}&${qs}`,
    fetcher,
  );
  const data = page?.items;

  // Before letting someone export, warn if this workspace has equipment
  // sitting in review — the Excel would reflect PRE-review values for
  // those rows. Both counts are already used for the workspace tab
  // badges elsewhere, so this reuses the same cheap/throttled pattern
  // rather than adding new backend work just for this check.
  const { data: pendingPage } = useSWR<Paged<PendingChange>>(
    `/projects/${id}/equipment/pending?workspace=${workspace}&status=pending&limit=1`,
    fetcher,
  );
  const pendingCount = pendingPage?.total ?? 0;

  const { data: duplicatesPage } = useSWR<Paged<unknown>>(
    `/projects/${id}/equipment/duplicate-audit?workspace=${workspace}&limit=1`,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60_000 },
  );
  const duplicateCount = duplicatesPage?.total ?? 0;

  const [showExportWarning, setShowExportWarning] = React.useState(false);
  const [exporting, setExporting] = React.useState(false);
  const [exportErr, setExportErr] = React.useState<string | null>(null);

  const isFiltering = !!search || minVer > 1 || !!updatedSinceHours;

  function handleExportClick() {
    if (pendingCount > 0 || duplicateCount > 0) {
      setShowExportWarning(true);
      return;
    }
    downloadExcel();
  }

  async function downloadExcel() {
    setExporting(true);
    setExportErr(null);
    try {
      const access =
        typeof window !== "undefined" ? window.localStorage.getItem("mel.access_token") : null;
      const res = await fetch(
        `${apiBase()}/projects/${id}/export/excel?workspace=${workspace}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(access ? { Authorization: `Bearer ${access}` } : {}),
          },
          // Send the ACTIVE FILTERS (not an enumerated id list — the table
          // only ever holds one page client-side now) so the export
          // matches everything matching the filter, across every page.
          // Empty body when nothing's filtered exports the whole workspace.
          body: JSON.stringify(
            isFiltering
              ? { q: search || null, min_version: minVer, updated_since_hours: updatedSinceHours }
              : {},
          ),
        },
      );
      if (!res.ok) throw new Error(`Export failed (${res.status})`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `project_${id}_${workspace}_equipment_list.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setExportErr(e instanceof Error ? e.message : String(e));
    } finally {
      setExporting(false);
    }
  }

  const exportLabel = exporting
    ? "Exporting…"
    : isFiltering
    ? `Excel (${page?.total ?? "…"} filtered)`
    : "Excel";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-ink-900">Equipment</h2>
            <Badge tone={workspace === "marine" ? "violet" : "blue"}>
              {workspace === "marine" ? "Marine" : "Topsides"}
            </Badge>
          </div>
          <p className="text-xs text-ink-500">
            Showing the <strong>{workspace === "marine" ? "Marine" : "Topsides"}</strong> MEL for this project — searchable, sortable, exportable.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="btn-secondary"
            onClick={handleExportClick}
            disabled={exporting || !data}
            title={
              isFiltering
                ? `Download every row matching the current filters as Excel`
                : "Download all equipment as Excel"
            }
          >
            {exporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {exportLabel}
          </button>
          <Link className="btn-secondary" href={`/projects/${id}/${workspace}/equipment/import`}>
            <Upload className="h-4 w-4" /> Import Excel
          </Link>
          <Link className="btn-primary" href={`/projects/${id}/${workspace}/equipment/new`}>
            <Plus className="h-4 w-4" /> Add Equipment
          </Link>
        </div>
      </div>

      {/* Filter bar — search / updated-since / min-version all hit the
          server (paired with pagination below), so results + row counts
          always reflect the FULL matching set, not just this page. */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <input
            className="input pl-8"
            placeholder="Search by tag, old tag, or description…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
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
          >
            <option value={1}>Any version</option>
            <option value={2}>v2+ (changed at least once)</option>
            <option value={3}>v3+</option>
            <option value={4}>v4+</option>
            <option value={5}>v5+</option>
          </select>
        </label>
      </div>

      {exportErr && <ErrorBox error={{ message: exportErr }} />}

      {isLoading && (
        <div className="grid place-items-center py-20"><Spinner className="h-6 w-6" /></div>
      )}
      {error && <ErrorBox error={error} />}
      {data && (
        <>
          <EquipmentTable
            projectId={id}
            rows={data}
            workspace={workspace}
          />
          <Pagination
            total={page?.total ?? 0}
            limit={limit}
            offset={offset}
            onOffsetChange={setOffset}
            onLimitChange={setLimit}
            className="rounded-xl border border-ink-100 bg-white shadow-card"
          />
        </>
      )}

      {showExportWarning && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-ink-900/40 p-4 backdrop-blur-[1px]"
          onMouseDown={(e) => { if (e.target === e.currentTarget) setShowExportWarning(false); }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="export-warning-title"
        >
          <div
            className="w-full max-w-md overflow-hidden rounded-xl bg-white shadow-2xl ring-1 ring-ink-200"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 border-b border-ink-100 px-5 py-4">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
              <h3 id="export-warning-title" className="text-sm font-semibold text-ink-900">
                This Excel may be out of date
              </h3>
            </div>
            <div className="space-y-2 px-5 py-4 text-sm text-ink-700">
              <p>
                {pendingCount > 0 && (
                  <>
                    <strong>{pendingCount}</strong> equipment update{pendingCount === 1 ? "" : "s"} from
                    a recent sync {pendingCount === 1 ? "is" : "are"} still awaiting admin review
                  </>
                )}
                {pendingCount > 0 && duplicateCount > 0 && " and "}
                {duplicateCount > 0 && (
                  <>
                    <strong>{duplicateCount}</strong> possible duplicate{duplicateCount === 1 ? "" : "s"} {duplicateCount === 1 ? "hasn't" : "haven't"} been resolved
                  </>
                )}
                {" "}for this workspace. This export won&apos;t include whatever those reviews would change.
              </p>
              <p>
                Please check the Pending list to verify before treating this as the latest file —
                or contact your project administrator to get the outstanding items reviewed first.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-ink-100 bg-ink-50 px-5 py-3">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setShowExportWarning(false);
                  router.push(`/projects/${id}/${workspace}/pending`);
                }}
              >
                <ListChecks className="h-4 w-4" />
                Show Pending List
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  setShowExportWarning(false);
                  downloadExcel();
                }}
              >
                <Download className="h-4 w-4" />
                Download Anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
