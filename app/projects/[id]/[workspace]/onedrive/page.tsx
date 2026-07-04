"use client";
import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import useSWR, { useSWRConfig } from "swr";
import {
  ChevronRight,
  Cloud,
  Edit3,
  File as FileIcon,
  Folder,
  Home,
  Loader2,
  Play,
  RefreshCcw,
  Save
} from "lucide-react";

import { Badge, Card, CardHeader, ErrorBox, Field, Spinner } from "@/components/ui";
import { OneDriveFolderPicker, type FolderSelection } from "@/components/OneDriveFolderPicker";
import { api, fetcher } from "@/lib/api";
import type { BrowseResponse, DriveItem, OneDriveSelection, Project, SyncSummary } from "@/lib/types";

interface Crumb { id: string | null; name: string }

export default function OneDrivePage() {
  const params = useParams();
  const router = useRouter();
  const id = Number(Array.isArray(params?.id) ? params.id[0] : params?.id);

  // workspace lives in the URL PATH segment — drives every fetch / save
  // below. The parent layout has already validated the value.
  const wsParam = params?.workspace;
  const wsRaw = Array.isArray(wsParam) ? wsParam[0] : wsParam;
  const workspace: "topside" | "marine" = wsRaw === "marine" ? "marine" : "topside";

  const [path, setPath] = React.useState<Crumb[]>([{ id: null, name: "Project root" }]);
  const current = path[path.length - 1];

  // Reset breadcrumb whenever the active workspace changes so we don't
  // try to browse the other workspace's item ids.
  React.useEffect(() => {
    setPath([{ id: null, name: "Project root" }]);
  }, [workspace]);

  const { data: project, mutate: mutateProject } = useSWR<Project>(`/projects/${id}`, fetcher);

  // Resolve the active workspace's root from the project row.
  const wsRootPath = workspace === "marine"
    ? project?.marine_onedrive_root_path
    : (project?.topside_onedrive_root_path || project?.onedrive_root_path);
  const wsRootItem = workspace === "marine"
    ? project?.marine_onedrive_root_item_id
    : (project?.topside_onedrive_root_item_id || project?.onedrive_root_item_id);
  const wsDriveId = workspace === "marine"
    ? project?.marine_onedrive_drive_id
    : (project?.topside_onedrive_drive_id || project?.onedrive_drive_id);
  const hasRoot = !!(wsRootPath || wsRootItem);

  const [editingRoot, setEditingRoot] = React.useState(false);

  const browseUrl = hasRoot
    ? (current.id
        ? `/projects/${id}/onedrive/browse?item_id=${encodeURIComponent(current.id)}&workspace=${workspace}`
        : `/projects/${id}/onedrive/browse?workspace=${workspace}`)
    : null;
  const { data: browse, error: browseErr, isLoading } = useSWR<BrowseResponse>(browseUrl, fetcher);

  const { data: selection, mutate: mutateSelection } = useSWR<OneDriveSelection[]>(
    `/projects/${id}/onedrive/selection?workspace=${workspace}`,
    fetcher
  );

  const [selected, setSelected] = React.useState<Record<string, DriveItem>>({});
  React.useEffect(() => {
    if (selection) {
      const map: Record<string, DriveItem> = {};
      for (const s of selection) {
        map[s.item_id] = {
          id: s.item_id, name: s.name, path: s.item_path,
          type: s.item_type, size: s.size_bytes, modified_at: null, mime_type: null
        };
      }
      setSelected(map);
    }
  }, [selection]);

  function toggle(item: DriveItem) {
    setSelected((prev) => {
      const next = { ...prev };
      if (next[item.id]) delete next[item.id];
      else next[item.id] = item;
      return next;
    });
  }

  function drillInto(item: DriveItem) {
    if (item.type !== "folder") return;
    setPath((p) => [...p, { id: item.id, name: item.name }]);
  }

  function goTo(index: number) {
    setPath((p) => p.slice(0, index + 1));
  }

  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);

  async function saveSelection() {
    setSaving(true);
    setSaveError(null);
    try {
      const items = Object.values(selected).map((it) => ({
        item_id: it.id,
        item_path: it.path,
        item_type: it.type,
        name: it.name,
        size_bytes: it.size
      }));
      await api.post(`/projects/${id}/onedrive/selection?workspace=${workspace}`, { items, replace: true });
      mutateSelection();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  const [syncing, setSyncing] = React.useState(false);
  const [syncResult, setSyncResult] = React.useState<SyncSummary | null>(null);
  const [syncError, setSyncError] = React.useState<string | null>(null);
  const [forceResync, setForceResync] = React.useState(false);
  const { mutate } = useSWRConfig();

  // Has the in-memory selection diverged from what's saved on the server?
  const selectionDirty = React.useMemo(() => {
    const savedIds = new Set((selection || []).map((s) => s.item_id));
    const currentIds = new Set(Object.keys(selected));
    if (savedIds.size !== currentIds.size) return true;
    for (const id of currentIds) if (!savedIds.has(id)) return true;
    return false;
  }, [selection, selected]);

  async function runSync() {
    setSyncing(true);
    setSyncResult(null);
    setSyncError(null);
    try {
      // Auto-save any pending selection changes so users don't have to remember.
      if (selectionDirty && Object.keys(selected).length > 0) {
        const items = Object.values(selected).map((it) => ({
          item_id: it.id,
          item_path: it.path,
          item_type: it.type,
          name: it.name,
          size_bytes: it.size,
        }));
        await api.post(`/projects/${id}/onedrive/selection?workspace=${workspace}`, { items, replace: true });
        await mutateSelection();
      }
      const qs = new URLSearchParams({ workspace });
      if (forceResync) qs.set("force", "true");
      const summary = await api.post<SyncSummary>(`/projects/${id}/sync?${qs.toString()}`);
      setSyncResult(summary);
      mutate((key) => typeof key === "string" && key.includes(`/projects/${id}/`));
    } catch (e) {
      setSyncError(e instanceof Error ? e.message : String(e));
    } finally {
      setSyncing(false);
    }
  }

  // Per-row sync state: which item id is currently being synced + last result/error per item
  const [syncingItemId, setSyncingItemId] = React.useState<string | null>(null);
  const [itemSyncMessages, setItemSyncMessages] = React.useState<Record<string, { kind: "ok" | "err"; text: string }>>({});

  async function syncOneItem(item: DriveItem) {
    setSyncingItemId(item.id);
    setItemSyncMessages((prev) => {
      const next = { ...prev };
      delete next[item.id];
      return next;
    });
    try {
      const qs = new URLSearchParams({ item_id: item.id, workspace });
      if (forceResync) qs.set("force", "true");
      const summary = await api.post<SyncSummary>(`/projects/${id}/sync/item?${qs.toString()}`);
      const parts: string[] = [];
      if (summary.files_synced) parts.push(`${summary.files_synced} synced`);
      if (summary.files_skipped) parts.push(`${summary.files_skipped} skipped`);
      if (summary.files_failed) parts.push(`${summary.files_failed} failed`);
      if (summary.equipment_created) parts.push(`${summary.equipment_created} new equipment`);
      if (summary.pfd_updates_applied) parts.push(`${summary.pfd_updates_applied} PFD upd`);
      if (summary.pid_updates_applied) parts.push(`${summary.pid_updates_applied} P&ID upd`);
      if (summary.vendor_updates_applied) parts.push(`${summary.vendor_updates_applied} vendor upd`);
      if (summary.pid_locked_skips) parts.push(`${summary.pid_locked_skips} skipped (P&ID-locked)`);
      if (summary.vendor_low_confidence_skips) parts.push(`${summary.vendor_low_confidence_skips} vendor field(s) held for review (low confidence)`);
      const msg = parts.length ? parts.join(" · ") : "nothing to do";
      setItemSyncMessages((prev) => ({ ...prev, [item.id]: { kind: "ok", text: msg } }));
      mutate((key) => typeof key === "string" && key.includes(`/projects/${id}/`));
    } catch (e) {
      setItemSyncMessages((prev) => ({
        ...prev,
        [item.id]: { kind: "err", text: e instanceof Error ? e.message : String(e) },
      }));
    } finally {
      setSyncingItemId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-ink-900">OneDrive &amp; Sync</h2>
            <Badge tone={workspace === "marine" ? "violet" : "blue"}>
              {workspace === "marine" ? "Marine" : "Topsides"}
            </Badge>
          </div>
          <p className="text-xs text-ink-500">
            Configuring the OneDrive folder and selections for the
            {" "}<strong>{workspace === "marine" ? "Marine" : "Topsides"}</strong>{" "}
            workspace only. Pick files/folders, then sync — per row, or all at once with{" "}
            <strong>Run sync</strong>. The other workspace has its own root and selections.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-ink-600" title="Re-process every selected item even if the OneDrive timestamp hasn't changed.">
            <input
              type="checkbox"
              checked={forceResync}
              onChange={(e) => setForceResync(e.target.checked)}
            />
            Force re-sync
          </label>
          <button
            className="btn-secondary"
            disabled={saving || !selectionDirty}
            onClick={saveSelection}
            title={
              selectionDirty
                ? "Save the checked items as this project's sync list"
                : "Selection is already saved"
            }
          >
            <Save className="h-4 w-4" />
            {selectionDirty
              ? `Save selection (${Object.keys(selected).length})`
              : `Saved (${(selection || []).length})`}
          </button>
          <button className="btn-primary" disabled={syncing} onClick={runSync}>
            <RefreshCcw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Syncing…" : forceResync ? "Run sync (force)" : "Run sync"}
          </button>
        </div>
      </div>

      {(!hasRoot || editingRoot || browseErr) && (
        <ConfigureRootCard
          projectId={id}
          project={project}
          workspace={workspace}
          forced404={!!browseErr && !editingRoot}
          onSaved={() => { mutateProject(); setEditingRoot(false); }}
          onCancel={hasRoot ? () => setEditingRoot(false) : undefined}
        />
      )}

      {hasRoot && !editingRoot && !browseErr && (<>
      <Card>
        <CardHeader
          title="Browse"
          subtitle={
            <span>
              Clamped to{" "}
              <code className="font-mono text-[11px] text-ink-700">
                {wsRootPath || wsRootItem}
              </code>
            </span>
          }
          action={
            <button className="btn-ghost" onClick={() => setEditingRoot(true)}>
              <Edit3 className="h-3.5 w-3.5" /> Edit folder
            </button>
          }
        />
        <div className="border-b border-ink-100 px-5 py-3">
          <nav className="flex items-center gap-1 text-xs">
            {path.map((c, i) => (
              <React.Fragment key={i}>
                {i > 0 && <ChevronRight className="h-3 w-3 text-ink-400" />}
                <button
                  className="rounded px-2 py-1 hover:bg-ink-100"
                  onClick={() => goTo(i)}
                >
                  {i === 0 ? <Home className="mr-1 inline h-3 w-3" /> : null}{c.name}
                </button>
              </React.Fragment>
            ))}
          </nav>
        </div>

        {browseErr && <div className="p-5"><ErrorBox error={browseErr} /></div>}
        {isLoading && <div className="grid place-items-center py-12"><Spinner /></div>}

        {browse && (
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr>
                  <th className="table-th w-10"></th>
                  <th className="table-th">Name</th>
                  <th className="table-th">Type</th>
                  <th className="table-th">Size</th>
                  <th className="table-th">Modified</th>
                  <th className="table-th w-32 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {browse.items.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-sm text-ink-500">
                      Empty folder.
                    </td>
                  </tr>
                )}
                {browse.items.map((item) => {
                  const msg = itemSyncMessages[item.id];
                  const busy = syncingItemId === item.id;
                  return (
                    <tr key={item.id} className="table-row-hover">
                      <td className="table-td">
                        <input
                          type="checkbox"
                          checked={!!selected[item.id]}
                          onChange={() => toggle(item)}
                        />
                      </td>
                      <td className="table-td">
                        <button
                          className="inline-flex items-center gap-2 text-ink-800 hover:text-brand-700"
                          onClick={() => drillInto(item)}
                        >
                          {item.type === "folder"
                            ? <Folder className="h-4 w-4 text-amber-500" />
                            : <FileIcon className="h-4 w-4 text-ink-400" />}
                          <span className={item.type === "folder" ? "font-medium" : ""}>{item.name}</span>
                        </button>
                        {msg && (
                          <div className={`mt-1 text-[11px] ${msg.kind === "ok" ? "text-emerald-700" : "text-rose-700"}`}>
                            {msg.text}
                          </div>
                        )}
                      </td>
                      <td className="table-td">
                        <Badge tone={item.type === "folder" ? "amber" : "slate"}>{item.type}</Badge>
                      </td>
                      <td className="table-td tabular-nums text-xs">{item.size ? `${(item.size / 1024).toFixed(1)} KB` : "—"}</td>
                      <td className="table-td text-[11px] text-ink-500">
                        {item.modified_at ? new Date(item.modified_at).toLocaleString() : "—"}
                      </td>
                      <td className="table-td text-right">
                        <button
                          className="btn-ghost text-xs"
                          disabled={busy || syncingItemId !== null || syncing}
                          onClick={() => syncOneItem(item)}
                          title={
                            item.type === "folder"
                              ? "Sync every file inside this folder"
                              : "Sync just this file"
                          }
                        >
                          {busy
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            : <Play className="h-3.5 w-3.5" />}
                          {item.type === "folder" ? "Sync folder" : "Sync"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      </>)}

      {saveError && <ErrorBox error={{ message: saveError }} />}

      {syncError && <ErrorBox error={{ message: syncError }} />}
      {syncResult && (
        <Card>
          <CardHeader
            title="Sync summary"
            subtitle={
              syncResult.force
                ? "Force re-sync — every selected item was re-processed."
                : "Files whose OneDrive timestamp hadn't changed were skipped."
            }
          />
          <div className="grid grid-cols-2 gap-4 p-5 md:grid-cols-7">
            <Mini label="Files synced" value={syncResult.files_synced.toString()} />
            <Mini label="Files skipped" value={(syncResult.files_skipped ?? 0).toString()} />
            <Mini label="Files failed" value={syncResult.files_failed.toString()} />
            <Mini label="New equipment" value={(syncResult.equipment_created ?? 0).toString()} />
            <Mini label="PFD updates" value={syncResult.pfd_updates_applied.toString()} />
            <Mini label="P&ID updates" value={(syncResult.pid_updates_applied ?? 0).toString()} />
            <Mini label="Vendor updates" value={syncResult.vendor_updates_applied.toString()} />
            {syncResult.errors.length > 0 && (
              <div className="md:col-span-7">
                <div className="mb-1 text-xs font-medium text-rose-700">Errors</div>
                <ul className="space-y-1 text-xs text-rose-700">
                  {syncResult.errors.map((e, i) => (
                    <li key={i}><span className="font-mono">{e.item}</span>: {e.error}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Card>
      )}

      <div className="text-[11px] text-ink-500">
        <Cloud className="mr-1 inline h-3 w-3" />
        Tip: OneDrive must be connected at the organization level by an admin first. See{" "}
        <button className="underline" onClick={() => router.push("/admin/onedrive")}>Admin → OneDrive</button>.
      </div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-ink-400">{label}</div>
      <div className="mt-0.5 text-sm font-semibold tabular-nums text-ink-800">{value}</div>
    </div>
  );
}

function ConfigureRootCard({
  projectId,
  project,
  workspace,
  onSaved,
  onCancel,
  forced404
}: {
  projectId: number;
  project: Project | undefined;
  workspace: "topside" | "marine";
  onSaved: () => void;
  onCancel?: () => void;
  forced404?: boolean;
}) {
  const [mode, setMode] = React.useState<"picker" | "manual">("picker");
  const [pending, setPending] = React.useState<FolderSelection | null>(null);

  // Resolve the workspace's existing root values to pre-fill the form.
  const wsPath  = workspace === "marine" ? project?.marine_onedrive_root_path    : (project?.topside_onedrive_root_path || project?.onedrive_root_path);
  const wsItem  = workspace === "marine" ? project?.marine_onedrive_root_item_id : (project?.topside_onedrive_root_item_id || project?.onedrive_root_item_id);
  const wsDrive = workspace === "marine" ? project?.marine_onedrive_drive_id     : (project?.topside_onedrive_drive_id || project?.onedrive_drive_id);

  // Manual-mode state
  const [rootPath, setRootPath] = React.useState(wsPath || "");
  const [rootItem, setRootItem] = React.useState(wsItem || "");
  const [driveId, setDriveId] = React.useState(wsDrive || "");

  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setRootPath(wsPath || "");
    setRootItem(wsItem || "");
    setDriveId(wsDrive || "");
    // Reset every time the workspace OR the project payload changes.
  }, [project, workspace, wsPath, wsItem, wsDrive]);

  async function save(opts: { path?: string | null; item_id?: string | null; drive_id?: string | null }) {
    setSaving(true);
    setError(null);
    try {
      // Write to the per-workspace columns so the other workspace's root
      // is left untouched.
      const prefix = workspace; // "topside" | "marine"
      await api.patch(`/projects/${projectId}`, {
        [`${prefix}_onedrive_root_path`]:    opts.path    ?? null,
        [`${prefix}_onedrive_root_item_id`]: opts.item_id ?? null,
        [`${prefix}_onedrive_drive_id`]:     opts.drive_id ?? null,
      });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function saveManual(e: React.FormEvent) {
    e.preventDefault();
    await save({ path: rootPath || null, item_id: rootItem || null, drive_id: driveId || null });
  }

  async function savePicker() {
    if (!pending) return;
    await save({ path: pending.path, item_id: pending.item_id, drive_id: pending.drive_id });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title={forced404 ? "Folder not found in OneDrive" : "Configure OneDrive folder for this project"}
          subtitle={
            forced404
              ? <>The configured path doesn&apos;t exist for the connected account. Pick a folder that does.</>
              : "Pick the OneDrive subtree this project may read. Sync is clamped to that subtree."
          }
          action={
            <div className="flex items-center gap-1">
              <button
                className={`tab-link ${mode === "picker" ? "tab-link-active" : ""}`}
                onClick={() => setMode("picker")}
              >Browse</button>
              <button
                className={`tab-link ${mode === "manual" ? "tab-link-active" : ""}`}
                onClick={() => setMode("manual")}
              >Type path</button>
            </div>
          }
        />
        <div className="p-5">
          {forced404 && (
            <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
              Microsoft Graph returned 404 for{" "}
              <code className="font-mono">
                {wsPath || wsItem}
              </code>. Pick a different folder below.
            </div>
          )}

          {pending && (
            <div className="mb-3 flex items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
              <span>
                <strong>Selected:</strong>{" "}
                <code className="font-mono">{pending.display_label}</code>
                {pending.path && <span className="ml-2 text-emerald-700">path={pending.path}</span>}
                {pending.item_id && <span className="ml-2 text-emerald-700">item_id={pending.item_id.slice(0, 12)}…</span>}
              </span>
              <button
                className="btn-primary"
                onClick={savePicker}
                disabled={saving}
              >
                {saving && <Spinner className="text-white" />}
                <Save className="h-4 w-4" /> Save this folder
              </button>
            </div>
          )}

          {error && <div className="mb-3"><ErrorBox error={{ message: error }} /></div>}

          {mode === "manual" && (
            <form onSubmit={saveManual} className="space-y-4">
              <Field
                label="OneDrive root path"
                hint='Relative to the connected account&apos;s drive. Example: "/Documents/Topside-20171".'
              >
                <input
                  className="input font-mono text-xs"
                  placeholder="/Documents/My Project"
                  value={rootPath}
                  onChange={(e) => setRootPath(e.target.value)}
                />
              </Field>
              <details className="text-xs">
                <summary className="cursor-pointer text-ink-500 hover:text-ink-800">
                  Advanced (use an item id / specific drive)
                </summary>
                <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                  <Field label="OneDrive root item id" hint="Overrides the path when set.">
                    <input className="input font-mono text-xs" value={rootItem} onChange={(e) => setRootItem(e.target.value)} />
                  </Field>
                  <Field label="Drive id" hint="Leave blank to use the connected account's default drive.">
                    <input className="input font-mono text-xs" value={driveId} onChange={(e) => setDriveId(e.target.value)} />
                  </Field>
                </div>
              </details>
              <div className="flex items-center justify-end gap-2">
                {onCancel && <button type="button" className="btn-ghost" onClick={onCancel}>Cancel</button>}
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => { setRootPath(""); setRootItem(""); setDriveId(""); }}
                >Reset</button>
                <button className="btn-primary" type="submit" disabled={saving || (!rootPath && !rootItem)}>
                  {saving && <Spinner className="text-white" />}
                  <Save className="h-4 w-4" /> Save folder &amp; browse
                </button>
              </div>
            </form>
          )}
        </div>
      </Card>

      {mode === "picker" && (
        <>
          <OneDriveFolderPicker
            onPick={(sel) => setPending(sel)}
            initialPath={wsPath || null}
          />
          {onCancel && (
            <div className="flex justify-end">
              <button className="btn-ghost" onClick={onCancel}>Cancel</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
