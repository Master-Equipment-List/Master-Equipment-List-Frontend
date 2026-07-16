"use client";
import * as React from "react";
import { useParams } from "next/navigation";
import useSWR, { useSWRConfig } from "swr";
import { AlertTriangle, Check, GitMerge, Loader2, ShieldAlert, X } from "lucide-react";

import { Badge, Card, CardHeader, ErrorBox, Spinner } from "@/components/ui";
import { Pagination, usePagination, type Paged } from "@/components/Pagination";
import { api, fetcher } from "@/lib/api";
import { cn } from "@/lib/cn";
import { useAuth } from "@/lib/auth";
import type { PendingChange, ProjectMember } from "@/lib/types";

type StatusFilter = "pending" | "rejected" | "all";

const STATUS_TABS: { value: StatusFilter; label: string }[] = [
  { value: "pending", label: "Pending review" },
  { value: "rejected", label: "Rejected" },
  { value: "all", label: "All (incl. resolved)" },
];

function sourceTone(src: string): "blue" | "amber" | "green" | "violet" | "slate" {
  switch (src) {
    case "pfd":   return "amber";
    case "pid":   return "blue";
    case "vendor": return "green";
    case "excel": return "violet";
    default:      return "slate";
  }
}

function statusTone(status: PendingChange["status"]): "amber" | "green" | "red" | "blue" | "slate" {
  switch (status) {
    case "pending":             return "amber";
    case "approved":            return "green";
    case "confirmed_new":       return "green";
    case "confirmed_duplicate": return "blue";
    case "rejected":            return "red";
    default:                    return "slate";
  }
}

function statusLabel(status: PendingChange["status"]): string {
  switch (status) {
    case "confirmed_new":       return "confirmed new";
    case "confirmed_duplicate": return "confirmed duplicate";
    default:                    return status;
  }
}

function prettifyField(key: string): string {
  return key.replace(/_/g, " ").toUpperCase();
}

function displayValue(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  return String(v);
}

export default function PendingChangesPage() {
  const params = useParams();
  const id = Number(Array.isArray(params?.id) ? params.id[0] : params?.id);
  const wsRaw = Array.isArray(params?.workspace) ? params.workspace[0] : params?.workspace;
  const workspace: "topside" | "marine" = wsRaw === "marine" ? "marine" : "topside";
  const { user } = useAuth();
  const { mutate } = useSWRConfig();

  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("pending");
  const { limit, offset, setLimit, setOffset, qs } = usePagination(25);

  // Changing the status tab starts back at page 1 — the old offset almost
  // certainly doesn't make sense against the new filter's result set.
  function changeStatusFilter(next: StatusFilter) {
    setStatusFilter(next);
    setOffset(0);
  }

  const { data: pendingPage, error, isLoading } = useSWR<Paged<PendingChange>>(
    Number.isFinite(id)
      ? `/projects/${id}/equipment/pending?workspace=${workspace}&status=${statusFilter}&${qs}`
      : null,
    fetcher,
  );
  const pending = pendingPage?.items;

  const { data: membersPage } = useSWR<Paged<ProjectMember>>(
    Number.isFinite(id) ? `/projects/${id}/members?limit=1000` : null,
    fetcher,
  );
  const members = membersPage?.items;

  // Project-admin check: global admin/superuser, OR this project's member
  // list says "admin" for the current user. Approve/reject buttons are
  // hidden (and the backend independently enforces this) for anyone else.
  const isProjectAdmin = React.useMemo(() => {
    if (!user) return false;
    if (user.is_superuser || user.role === "admin") return true;
    return (members || []).some((m) => m.user_id === user.id && m.role === "admin");
  }, [user, members]);

  // Per-pending-change accepted-field selection, keyed by pending change id.
  // A field not yet touched by the admin defaults to "accepted" (every
  // proposed field checked) — unchecking a field keeps that field's
  // existing value untouched on approve.
  const [accepted, setAccepted] = React.useState<Record<number, Set<string>>>({});
  const [busyId, setBusyId] = React.useState<number | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);

  function acceptedFor(pc: PendingChange): Set<string> {
    return accepted[pc.id] || new Set(Object.keys(pc.proposed_fields));
  }

  function toggleField(pc: PendingChange, field: string) {
    setAccepted((prev) => {
      const current = new Set(prev[pc.id] || Object.keys(pc.proposed_fields));
      if (current.has(field)) current.delete(field);
      else current.add(field);
      return { ...prev, [pc.id]: current };
    });
  }

  async function approve(pc: PendingChange) {
    setBusyId(pc.id);
    setActionError(null);
    try {
      const fields = Array.from(acceptedFor(pc));
      await api.post(`/projects/${id}/equipment/pending/${pc.id}/approve`, { accepted_fields: fields });
      mutate((k) => typeof k === "string" && k.includes(`/projects/${id}/`));
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  }

  async function reject(pc: PendingChange) {
    const label = pc.kind === "possible_duplicate" ? pc.new_tag : pc.client_tag;
    if (!confirm(`Discard the proposed change for ${label}? The equipment row won't be touched.`)) return;
    setBusyId(pc.id);
    setActionError(null);
    try {
      await api.post(`/projects/${id}/equipment/pending/${pc.id}/reject`, {});
      mutate((k) => typeof k === "string" && k.includes(`/projects/${id}/`));
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  }

  async function confirmNew(pc: PendingChange) {
    if (!confirm(`Create ${pc.new_tag} as a brand-new equipment row? This will NOT touch ${pc.client_tag}.`)) return;
    setBusyId(pc.id);
    setActionError(null);
    try {
      await api.post(`/projects/${id}/equipment/pending/${pc.id}/confirm-new`, {});
      mutate((k) => typeof k === "string" && k.includes(`/projects/${id}/`));
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  }

  async function confirmDuplicate(pc: PendingChange) {
    setBusyId(pc.id);
    setActionError(null);
    try {
      const fields = Array.from(acceptedFor(pc));
      await api.post(`/projects/${id}/equipment/pending/${pc.id}/confirm-duplicate`, { accepted_fields: fields });
      mutate((k) => typeof k === "string" && k.includes(`/projects/${id}/`));
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <header>
        <h2 className="text-lg font-semibold text-ink-900">Pending Changes</h2>
        <p className="text-sm text-ink-500">
          Sync-proposed updates to EXISTING equipment rows wait here for review —
          pick which fields to accept per row, then approve. A tag the sync
          hasn&apos;t seen before normally auto-creates immediately — unless its
          description and equipment type closely match an existing row under a
          different tag, in which case it shows up here as a{" "}
          <span className="font-medium text-amber-700">possible duplicate</span>{" "}
          instead, for you to confirm as new or merge.
        </p>
      </header>

      {!isProjectAdmin && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          You can view this queue, but only a project admin can approve or reject changes.
        </div>
      )}

      <div className="flex items-center gap-1 border-b border-ink-100">
        {STATUS_TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            className={cn(
              "border-b-2 px-3 py-2 text-xs font-medium",
              statusFilter === t.value
                ? "border-brand-600 text-brand-700"
                : "border-transparent text-ink-500 hover:text-ink-700",
            )}
            onClick={() => changeStatusFilter(t.value)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {actionError && <ErrorBox error={{ message: actionError }} />}
      {error && <ErrorBox error={{ message: error instanceof Error ? error.message : String(error) }} />}
      {isLoading && <Spinner />}

      {pending && pending.length === 0 && (
        <Card>
          <div className="p-8 text-center text-sm text-ink-500">
            {statusFilter === "pending"
              ? "Nothing waiting for review. Every existing-row update from the last sync has been resolved."
              : `No ${statusFilter === "all" ? "" : statusFilter + " "}changes to show.`}
          </div>
        </Card>
      )}

      {pending && pending.length > 0 && (
        <div className="space-y-3">
          {pending.map((pc) => {
            const fieldKeys = Object.keys(pc.proposed_fields);
            const selected = acceptedFor(pc);
            const busy = busyId === pc.id;
            const isPending = pc.status === "pending";
            const isDuplicate = pc.kind === "possible_duplicate";
            return (
              <Card key={pc.id} className={isDuplicate ? "ring-1 ring-amber-200" : undefined}>
                <CardHeader
                  title={isDuplicate ? pc.new_tag || "(unknown tag)" : pc.client_tag}
                  subtitle={
                    <div className="space-y-0.5">
                      {isDuplicate ? (
                        <div className="text-ink-600">
                          Possibly the same as{" "}
                          <span className="font-mono font-medium text-ink-800">{pc.client_tag}</span>
                          {pc.description && <> — {pc.description}</>}
                        </div>
                      ) : (
                        pc.description && <div>{pc.description}</div>
                      )}
                      <div className="text-[11px] text-ink-400">
                        Queued by {pc.created_by_name || "—"}
                        {!isPending && pc.resolved_by_name && (
                          <>
                            {" · "}
                            {statusLabel(pc.status)} by{" "}
                            {pc.resolved_by_name}
                            {pc.resolved_at && ` on ${new Date(pc.resolved_at).toLocaleString()}`}
                          </>
                        )}
                      </div>
                    </div>
                  }
                  action={
                    <div className="flex items-center gap-2">
                      {isDuplicate && (
                        <Badge tone="amber">
                          <AlertTriangle className="h-3 w-3" /> possible duplicate
                        </Badge>
                      )}
                      <Badge tone={statusTone(pc.status)}>{statusLabel(pc.status)}</Badge>
                      <Badge tone={sourceTone(pc.source)}>{pc.source}</Badge>
                      {pc.source_file_name && (
                        <span
                          className="max-w-[220px] truncate text-[11px] text-ink-400"
                          title={pc.source_file_name}
                        >
                          {pc.source_file_name}
                        </span>
                      )}
                    </div>
                  }
                />
                <div className="overflow-x-auto p-4">
                  <table className="min-w-full text-xs">
                    <thead>
                      <tr className="text-left text-ink-500">
                        {isPending && <th className="w-8 pb-2" />}
                        <th className="pb-2 pr-4">FIELD</th>
                        <th className="pb-2 pr-4">
                          {isDuplicate ? `${pc.client_tag} (CURRENT)` : "CURRENT (OLD)"}
                        </th>
                        <th className="pb-2">
                          {isDuplicate ? `INCOMING FOR ${pc.new_tag}` : "PROPOSED (NEW)"}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {fieldKeys.map((field) => {
                        const diff = pc.proposed_fields[field];
                        const isAccepted = selected.has(field);
                        return (
                          <tr key={field} className="border-t border-ink-100">
                            {isPending && (
                              <td className="py-2">
                                <input
                                  type="checkbox"
                                  checked={isAccepted}
                                  disabled={!isProjectAdmin || busy}
                                  onChange={() => toggleField(pc, field)}
                                />
                              </td>
                            )}
                            <td className="py-2 pr-4 font-medium text-ink-700">
                              {prettifyField(field)}
                            </td>
                            <td className={isPending && isAccepted ? "py-2 pr-4 text-ink-400 line-through" : "py-2 pr-4 text-ink-800"}>
                              {displayValue(diff.old)}
                            </td>
                            <td className={!isPending || isAccepted ? "py-2 font-medium text-emerald-700" : "py-2 text-ink-400"}>
                              {displayValue(diff.new)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {isDuplicate && isPending && (
                    <p className="mt-2 text-[11px] text-ink-400">
                      Checkboxes only matter if you merge — confirming as new equipment
                      uses every value on the right regardless of what&apos;s checked.
                    </p>
                  )}
                </div>
                {isProjectAdmin && isPending && !isDuplicate && (
                  <div className="flex items-center justify-end gap-2 border-t border-ink-100 p-3">
                    <button
                      type="button"
                      className="btn-ghost text-xs"
                      onClick={() => reject(pc)}
                      disabled={busy}
                    >
                      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
                      Reject
                    </button>
                    <button
                      type="button"
                      className="btn-primary text-xs"
                      onClick={() => approve(pc)}
                      disabled={busy}
                    >
                      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                      Approve{selected.size ? ` (${selected.size} field${selected.size === 1 ? "" : "s"})` : " (keeps all existing values)"}
                    </button>
                  </div>
                )}
                {isProjectAdmin && isPending && isDuplicate && (
                  <div className="flex items-center justify-end gap-2 border-t border-ink-100 p-3">
                    <button
                      type="button"
                      className="btn-ghost text-xs"
                      onClick={() => reject(pc)}
                      disabled={busy}
                    >
                      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
                      Reject
                    </button>
                    <button
                      type="button"
                      className="btn-secondary text-xs"
                      onClick={() => confirmDuplicate(pc)}
                      disabled={busy}
                      title={`Apply the checked fields to ${pc.client_tag} instead of creating a new row`}
                    >
                      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <GitMerge className="h-3.5 w-3.5" />}
                      Merge into {pc.client_tag}
                    </button>
                    <button
                      type="button"
                      className="btn-primary text-xs"
                      onClick={() => confirmNew(pc)}
                      disabled={busy}
                      title={`Create ${pc.new_tag} as its own equipment row`}
                    >
                      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                      Confirm as new equipment
                    </button>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {pendingPage && (
        <Card>
          <Pagination
            total={pendingPage.total}
            limit={limit}
            offset={offset}
            onOffsetChange={setOffset}
            onLimitChange={setLimit}
          />
        </Card>
      )}
    </div>
  );
}
