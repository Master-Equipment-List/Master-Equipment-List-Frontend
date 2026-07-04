"use client";
import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import useSWR, { useSWRConfig } from "swr";
import { FileText, Filter, Loader2, Trash2, X } from "lucide-react";

import { Badge, Card, ConfirmModal, ErrorBox, Spinner } from "@/components/ui";
import { api, fetcher } from "@/lib/api";
import type { ProjectFile } from "@/lib/types";

export default function FilesPage() {
  const params = useParams();
  const id = Number(Array.isArray(params?.id) ? params.id[0] : params?.id);
  const { mutate } = useSWRConfig();

  // workspace lives in the URL PATH segment.
  const wsParam = params?.workspace;
  const wsRaw = Array.isArray(wsParam) ? wsParam[0] : wsParam;
  const workspace: "topside" | "marine" = wsRaw === "marine" ? "marine" : "topside";

  const [category, setCategory] = React.useState<string>("");
  const [extension, setExtension] = React.useState<string>("");

  const q = new URLSearchParams();
  q.set("workspace", workspace);
  if (category) q.set("category", category);
  if (extension) q.set("extension", extension);
  const key = `/projects/${id}/files?${q.toString()}`;
  const { data, error, isLoading } = useSWR<ProjectFile[]>(key, fetcher);

  // Per-row delete state: the file pending confirmation, whether the
  // delete request is in flight, and the last error so it stays visible
  // after the modal closes.
  const [pendingDelete, setPendingDelete] = React.useState<ProjectFile | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);

  // Bulk-selection state — a Set of file IDs. Keeping it as a Set (not
  // a react-table selection map) matches the plain HTML table used here.
  const [selected, setSelected] = React.useState<Set<number>>(new Set());
  const [bulkConfirmOpen, setBulkConfirmOpen] = React.useState(false);
  const [bulkBusy, setBulkBusy] = React.useState(false);
  const [bulkError, setBulkError] = React.useState<string | null>(null);

  // Drop selections whose row no longer exists (deleted elsewhere, filter
  // changed, etc). Prevents ghost IDs from being sent to bulk-delete.
  React.useEffect(() => {
    if (!data) return;
    const visibleIds = new Set(data.map((f) => f.id));
    setSelected((prev) => {
      const next = new Set<number>();
      prev.forEach((id) => { if (visibleIds.has(id)) next.add(id); });
      return next.size === prev.size ? prev : next;
    });
  }, [data]);

  const rows = data ?? [];
  const allSelected = rows.length > 0 && rows.every((f) => selected.has(f.id));
  const someSelected = selected.size > 0 && !allSelected;
  const selectedFiles = React.useMemo(
    () => rows.filter((f) => selected.has(f.id)),
    [rows, selected],
  );

  function toggleOne(fid: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(fid)) next.delete(fid); else next.add(fid);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => {
      if (rows.length > 0 && rows.every((f) => prev.has(f.id))) return new Set();
      return new Set(rows.map((f) => f.id));
    });
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await api.delete(`/projects/${id}/files/${pendingDelete.id}`);
      // Refresh every files-related cache key so the row disappears immediately.
      mutate((k) => typeof k === "string" && k.startsWith(`/projects/${id}/files`));
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
      await api.post(`/projects/${id}/files/bulk-delete`, { ids });
      mutate((k) => typeof k === "string" && k.startsWith(`/projects/${id}/files`));
      setSelected(new Set());
      setBulkConfirmOpen(false);
    } catch (e) {
      setBulkError(e instanceof Error ? e.message : String(e));
    } finally {
      setBulkBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-ink-900">Files</h2>
          <p className="text-xs text-ink-500">
            Files synced from OneDrive. Click a row to see the extracted JSON.
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Filter className="h-4 w-4 text-ink-400" />
          <select className="input w-44" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">All categories</option>
            <option value="PFD Samples">PFD Samples</option>
            <option value="P&ID">P&amp;ID</option>
            <option value="Vendor Data">Vendor Data</option>
          </select>
          <select className="input w-32" value={extension} onChange={(e) => setExtension(e.target.value)}>
            <option value="">All types</option>
            <option value=".pdf">PDF</option>
            <option value=".xlsx">Excel</option>
            <option value=".csv">CSV</option>
            <option value=".docx">Word</option>
            <option value=".png">PNG</option>
            <option value=".jpg">JPG</option>
          </select>
        </div>
      </div>

      {isLoading && <div className="grid place-items-center py-20"><Spinner className="h-6 w-6" /></div>}
      {error && <ErrorBox error={error} />}
      {deleteError && <ErrorBox error={{ message: deleteError }} />}
      {bulkError && <ErrorBox error={{ message: bulkError }} />}

      {/* Bulk action bar — only renders when one or more rows are selected.
          Mirrors the equipment table's sticky bar so the UX matches. */}
      {selectedFiles.length > 0 && (
        <div className="sticky top-2 z-10 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-brand-200 bg-brand-50 px-4 py-2 shadow-sm">
          <div className="flex items-center gap-3 text-sm text-brand-900">
            <span className="grid h-6 w-6 place-items-center rounded-full bg-brand-600 text-xs font-semibold text-white tabular-nums">
              {selectedFiles.length}
            </span>
            <span>
              {selectedFiles.length === 1 ? "file selected" : "files selected"}
            </span>
            <button
              type="button"
              className="text-xs text-brand-700 underline hover:text-brand-900"
              onClick={() => setSelected(new Set())}
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
              Delete {selectedFiles.length} selected
            </button>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => setSelected(new Set())}
              disabled={bulkBusy}
              title="Clear selection"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <ConfirmModal
        open={pendingDelete !== null}
        title="Remove file from this project"
        description={
          pendingDelete ? (
            <div className="space-y-2">
              <p>
                Remove{" "}
                <span className="font-mono text-xs text-ink-900">
                  {pendingDelete.name}
                </span>
                {" "}from this project?
              </p>
              <ul className="list-disc space-y-1 pl-5 text-xs text-ink-600">
                <li>The file row and its extracted JSON will be deleted.</li>
                <li>The local cached copy on disk will be removed.</li>
                <li>Equipment rows and version history that reference this file are kept (the source link is just cleared).</li>
                <li>If the file is still in your OneDrive selection, it will be re-downloaded on the next sync.</li>
              </ul>
            </div>
          ) : null
        }
        confirmLabel={deleting ? "Removing…" : "Remove file"}
        tone="red"
        busy={deleting}
        onConfirm={confirmDelete}
        onClose={() => { if (!deleting) setPendingDelete(null); }}
      />

      <ConfirmModal
        open={bulkConfirmOpen}
        title={`Remove ${selectedFiles.length} file${selectedFiles.length === 1 ? "" : "s"}`}
        description={
          <div className="space-y-2">
            <p>
              Permanently remove{" "}
              <span className="font-semibold text-ink-900">
                {selectedFiles.length}
              </span>{" "}
              file{selectedFiles.length === 1 ? "" : "s"} from this project?
            </p>
            {selectedFiles.length <= 12 ? (
              <ul className="max-h-40 list-disc space-y-0.5 overflow-y-auto pl-5 text-xs text-ink-700">
                {selectedFiles.map((f) => (
                  <li key={f.id} className="truncate">
                    <span className="font-mono">{f.name}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-ink-500">
                Includes <span className="font-mono">{selectedFiles[0].name}</span>,{" "}
                <span className="font-mono">{selectedFiles[1].name}</span>, and{" "}
                {selectedFiles.length - 2} more.
              </p>
            )}
            <ul className="list-disc space-y-1 pl-5 text-xs text-ink-600">
              <li>Every selected file row and its extracted JSON will be deleted.</li>
              <li>Local cached copies on disk will be removed.</li>
              <li>Equipment rows and version history that reference these files are kept (the source link is just cleared).</li>
              <li>Files still in your OneDrive selection will be re-downloaded on the next sync.</li>
            </ul>
          </div>
        }
        confirmLabel={bulkBusy ? "Removing…" : `Remove ${selectedFiles.length} file${selectedFiles.length === 1 ? "" : "s"}`}
        tone="red"
        busy={bulkBusy}
        onConfirm={() => bulkDelete(selectedFiles.map((f) => f.id))}
        onClose={() => { if (!bulkBusy) setBulkConfirmOpen(false); }}
      />

      {data && (
        <Card>
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr>
                  <th className="table-th w-8">
                    <input
                      type="checkbox"
                      className="cursor-pointer"
                      aria-label="Select all visible files"
                      checked={allSelected}
                      ref={(el) => { if (el) el.indeterminate = someSelected; }}
                      onChange={toggleAll}
                      disabled={rows.length === 0}
                    />
                  </th>
                  <th className="table-th">Name</th>
                  <th className="table-th">Location</th>
                  <th className="table-th">Category</th>
                  <th className="table-th">Type</th>
                  <th className="table-th">Size</th>
                  <th className="table-th">Last synced</th>
                  <th className="table-th">Status</th>
                  <th className="table-th w-20 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-10 text-center text-sm text-ink-500">
                      No files yet. Pick a OneDrive folder and trigger a sync.
                    </td>
                  </tr>
                )}
                {data.map((f) => {
                  const busy = deleting && pendingDelete?.id === f.id;
                  const isSelected = selected.has(f.id);
                  return (
                    <tr key={f.id} className="table-row-hover">
                      <td className="table-td">
                        <input
                          type="checkbox"
                          className="cursor-pointer"
                          aria-label={`Select ${f.name}`}
                          checked={isSelected}
                          onChange={() => toggleOne(f.id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </td>
                      <td className="table-td">
                        <Link
                          href={`/projects/${id}/${workspace}/files/${f.id}`}
                          className="inline-flex items-center gap-2 text-brand-700 hover:underline"
                        >
                          <FileText className="h-4 w-4" />
                          <span className="truncate">{f.name}</span>
                        </Link>
                      </td>
                      <td className="table-td font-mono text-[11px] text-ink-500">{f.onedrive_path}</td>
                      <td className="table-td">
                        {f.folder_category ? (
                          <Badge
                            tone={
                              f.folder_category === "PFD Samples" ? "amber"
                              : f.folder_category === "P&ID"        ? "blue"
                              : f.folder_category === "Vendor Data" ? "green"
                              : "slate"
                            }
                          >
                            {f.folder_category}
                          </Badge>
                        ) : <span className="text-ink-300">—</span>}
                      </td>
                      <td className="table-td font-mono text-[11px]">{f.extension || "—"}</td>
                      <td className="table-td tabular-nums">{f.size_bytes ? prettyBytes(f.size_bytes) : "—"}</td>
                      <td className="table-td text-[11px] text-ink-500">{f.last_synced_at ? new Date(f.last_synced_at).toLocaleString() : "—"}</td>
                      <td className="table-td">
                        <Badge tone={f.sync_status === "synced" ? "green" : f.sync_status === "pending" ? "amber" : "red"}>
                          {f.sync_status}
                        </Badge>
                      </td>
                      <td className="table-td text-right">
                        <button
                          className="inline-flex items-center justify-center gap-1 rounded px-2 py-1 text-rose-600 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40"
                          onClick={() => { setDeleteError(null); setPendingDelete(f); }}
                          disabled={busy || deleting}
                          title="Remove this file and its extracted data from the project"
                        >
                          {busy
                            ? <Loader2 className="h-4 w-4 animate-spin" />
                            : <Trash2 className="h-4 w-4" />}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

function prettyBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}
