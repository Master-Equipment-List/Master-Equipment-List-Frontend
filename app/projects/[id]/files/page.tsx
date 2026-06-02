"use client";
import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import useSWR, { useSWRConfig } from "swr";
import { FileText, Filter, Loader2, Trash2 } from "lucide-react";

import { Badge, Card, ConfirmModal, ErrorBox, Spinner } from "@/components/ui";
import { api, fetcher } from "@/lib/api";
import type { ProjectFile } from "@/lib/types";

export default function FilesPage() {
  const params = useParams();
  const id = Number(Array.isArray(params?.id) ? params.id[0] : params?.id);
  const { mutate } = useSWRConfig();

  const [category, setCategory] = React.useState<string>("");
  const [extension, setExtension] = React.useState<string>("");

  const q = new URLSearchParams();
  if (category) q.set("category", category);
  if (extension) q.set("extension", extension);
  const key = `/projects/${id}/files${q.toString() ? `?${q.toString()}` : ""}`;
  const { data, error, isLoading } = useSWR<ProjectFile[]>(key, fetcher);

  // Per-row delete state: the file pending confirmation, whether the
  // delete request is in flight, and the last error so it stays visible
  // after the modal closes.
  const [pendingDelete, setPendingDelete] = React.useState<ProjectFile | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);

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

      {data && (
        <Card>
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr>
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
                    <td colSpan={8} className="px-4 py-10 text-center text-sm text-ink-500">
                      No files yet. Pick a OneDrive folder and trigger a sync.
                    </td>
                  </tr>
                )}
                {data.map((f) => {
                  const busy = deleting && pendingDelete?.id === f.id;
                  return (
                    <tr key={f.id} className="table-row-hover">
                      <td className="table-td">
                        <Link
                          href={`/projects/${id}/files/${f.id}`}
                          className="inline-flex items-center gap-2 text-brand-700 hover:underline"
                        >
                          <FileText className="h-4 w-4" />
                          <span className="truncate">{f.name}</span>
                        </Link>
                      </td>
                      <td className="table-td font-mono text-[11px] text-ink-500">{f.onedrive_path}</td>
                      <td className="table-td">
                        {f.folder_category ? (
                          <Badge tone={f.folder_category === "PFD Samples" ? "amber" : f.folder_category === "Vendor Data" ? "green" : "slate"}>
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
