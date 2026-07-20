"use client";
import * as React from "react";
import { useParams } from "next/navigation";
import useSWR, { useSWRConfig } from "swr";
import { AlertTriangle, GitMerge, Loader2, ShieldAlert } from "lucide-react";

import { Badge, Card, CardHeader, ErrorBox, Spinner } from "@/components/ui";
import { Pagination, usePagination, type Paged } from "@/components/Pagination";
import { api, fetcher } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Equipment, ProjectMember } from "@/lib/types";

interface DuplicatePair {
  equipment_a: Equipment;
  equipment_b: Equipment;
  description_similarity: number;
  type_similarity: number;
}

// Fields eligible to merge — mirrors the backend's TRACKED_FIELDS, minus
// client_tag/old_tag: the surviving row always keeps its OWN tag and
// version history. This tool is about picking a survivor, not renaming it.
const MERGE_FIELDS: { key: keyof Equipment; label: string }[] = [
  { key: "description", label: "Description" },
  { key: "vendor", label: "Vendor" },
  { key: "equipment_type", label: "Type" },
  { key: "module", label: "Module" },
  { key: "design_code", label: "Design code" },
  { key: "orientation", label: "Orientation" },
  { key: "material", label: "Material" },
  { key: "configuration", label: "Configuration" },
  { key: "location", label: "Location" },
  { key: "operating_press", label: "Op press" },
  { key: "operating_temp", label: "Op temp" },
  { key: "design_press", label: "Des press" },
  { key: "design_temp", label: "Des temp" },
  { key: "design_flow", label: "Des flow" },
  { key: "pump_capacity", label: "Capacity" },
  { key: "heat_exchanger_duty_kw", label: "Duty kW" },
  { key: "liquid_fill", label: "Liq fill" },
  { key: "absorbed_power_kw", label: "Abs kW" },
  { key: "rated_power_kw", label: "Rated kW" },
  { key: "length_m", label: "L (m)" },
  { key: "width_id_m", label: "W (m)" },
  { key: "height_tt_m", label: "H (m)" },
  { key: "dry_weight_mt", label: "Dry wt" },
  { key: "operating_weight_mt", label: "Ope wt" },
  { key: "hydrotest_weight_mt", label: "Hydro wt" },
  { key: "pid", label: "P&ID" },
  { key: "remarks", label: "Remarks" },
  { key: "lifecycle_status", label: "Lifecycle" },
];

function displayValue(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  return String(v);
}

function pairKey(p: DuplicatePair): string {
  return `${p.equipment_a.id}-${p.equipment_b.id}`;
}

export default function DuplicatesPage() {
  const params = useParams();
  const id = Number(Array.isArray(params?.id) ? params.id[0] : params?.id);
  const wsRaw = Array.isArray(params?.workspace) ? params.workspace[0] : params?.workspace;
  const workspace: "topside" | "marine" = wsRaw === "marine" ? "marine" : "topside";
  const { user } = useAuth();
  const { mutate } = useSWRConfig();

  const { limit, offset, setLimit, setOffset, qs } = usePagination(25);
  const { data: page, error, isLoading } = useSWR<Paged<DuplicatePair>>(
    Number.isFinite(id)
      ? `/projects/${id}/equipment/duplicate-audit?workspace=${workspace}&${qs}`
      : null,
    fetcher,
  );
  const pairs = page?.items;

  const { data: membersPage } = useSWR<Paged<ProjectMember>>(
    Number.isFinite(id) ? `/projects/${id}/members?limit=1000` : null,
    fetcher,
  );
  const members = membersPage?.items;
  const isProjectAdmin = React.useMemo(() => {
    if (!user) return false;
    if (user.is_superuser || user.role === "admin") return true;
    return (members || []).some((m) => m.user_id === user.id && m.role === "admin");
  }, [user, members]);

  // Pairs dismissed THIS SESSION — the scan is recomputed fresh every load,
  // there's no server-side "dismissed" state to persist.
  const [dismissed, setDismissed] = React.useState<Set<string>>(new Set());
  const [keepChoice, setKeepChoice] = React.useState<Record<string, "a" | "b">>({});
  const [accepted, setAccepted] = React.useState<Record<string, Set<string>>>({});
  const [busyKey, setBusyKey] = React.useState<string | null>(null);
  const [confirmingKey, setConfirmingKey] = React.useState<string | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);

  function keepOf(p: DuplicatePair): "a" | "b" {
    return keepChoice[pairKey(p)] || "a";
  }
  function acceptedFor(p: DuplicatePair): Set<string> {
    return accepted[pairKey(p)] || new Set();
  }
  function setKeep(p: DuplicatePair, choice: "a" | "b") {
    const key = pairKey(p);
    setKeepChoice((prev) => ({ ...prev, [key]: choice }));
    // Which values "checked" fields pull FROM flips when keep/remove swap —
    // clear selections rather than silently reinterpreting them.
    setAccepted((prev) => ({ ...prev, [key]: new Set() }));
  }
  function toggleField(p: DuplicatePair, field: string) {
    const key = pairKey(p);
    setAccepted((prev) => {
      const current = new Set(prev[key] || []);
      if (current.has(field)) current.delete(field);
      else current.add(field);
      return { ...prev, [key]: current };
    });
  }
  async function dismiss(p: DuplicatePair) {
    const key = pairKey(p);
    setDismissed((prev) => new Set(prev).add(key));
    try {
      await api.post(`/projects/${id}/equipment/duplicate-audit/dismiss`, {
        equipment_a_id: p.equipment_a.id,
        equipment_b_id: p.equipment_b.id,
      });
      // Dismissal count changes the workspace tab badge and the total on
      // this page's own pagination — refresh both rather than waiting for
      // the next natural revalidation.
      mutate((k) => typeof k === "string" && k.includes(`/projects/${id}/equipment/duplicate-audit`));
    } catch (e) {
      // The pair stays hidden locally either way — a failed dismiss just
      // means it can reappear on a future scan, not that anything broke
      // visibly right now. Surface it so a persistent failure isn't silent.
      setActionError(e instanceof Error ? e.message : String(e));
    }
  }

  async function doMerge(p: DuplicatePair) {
    const key = pairKey(p);
    const keep = keepOf(p) === "a" ? p.equipment_a : p.equipment_b;
    const remove = keepOf(p) === "a" ? p.equipment_b : p.equipment_a;
    setBusyKey(key);
    setActionError(null);
    try {
      const fields = Array.from(acceptedFor(p));
      await api.post(`/projects/${id}/equipment/${keep.id}/merge/${remove.id}`, { accepted_fields: fields });
      setDismissed((prev) => new Set(prev).add(key));
      setConfirmingKey(null);
      mutate((k) => typeof k === "string" && k.includes(`/projects/${id}/`));
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyKey(null);
    }
  }

  const visiblePairs = (pairs || []).filter((p) => !dismissed.has(pairKey(p)));

  return (
    <div className="space-y-4">
      <header>
        <h2 className="text-lg font-semibold text-ink-900">Possible Duplicates</h2>
        <p className="text-sm text-ink-500">
          An on-demand scan across every equipment row already in this workspace,
          looking for description + type matches under different tags — independent
          of syncing. Many pairs here are legitimate identical spare/redundant units
          (e.g. multiple identical generators across different trains), not real
          data-entry duplicates. Review each one; nothing merges automatically.
        </p>
      </header>

      {!isProjectAdmin && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          You can view these candidates, but only a project admin can merge rows.
        </div>
      )}

      {actionError && <ErrorBox error={{ message: actionError }} />}
      {error && <ErrorBox error={{ message: error instanceof Error ? error.message : String(error) }} />}
      {isLoading && <Spinner />}

      {pairs && visiblePairs.length === 0 && (
        <Card>
          <div className="p-8 text-center text-sm text-ink-500">
            {pairs.length === 0
              ? "No fuzzy-match candidates found in this workspace."
              : "Nothing left to review on this page — dismissed or merged."}
          </div>
        </Card>
      )}

      {visiblePairs.length > 0 && (
        <div className="space-y-3">
          {visiblePairs.map((p) => {
            const key = pairKey(p);
            const keep = keepOf(p) === "a" ? p.equipment_a : p.equipment_b;
            const remove = keepOf(p) === "a" ? p.equipment_b : p.equipment_a;
            const selected = acceptedFor(p);
            const busy = busyKey === key;
            const confirming = confirmingKey === key;

            const diffFields = MERGE_FIELDS.filter(
              ({ key: f }) => displayValue(keep[f]) !== displayValue(remove[f]),
            );

            return (
              <Card key={key}>
                <CardHeader
                  title={`${p.equipment_a.client_tag}  vs  ${p.equipment_b.client_tag}`}
                  subtitle={
                    <span>
                      {p.equipment_a.description || "—"} ({p.equipment_a.module || "no module"})
                      {" ⟷ "}
                      {p.equipment_b.description || "—"} ({p.equipment_b.module || "no module"})
                    </span>
                  }
                  action={
                    <div className="flex items-center gap-2 text-[11px] text-ink-500">
                      <Badge tone="amber">
                        <AlertTriangle className="h-3 w-3" /> possible duplicate
                      </Badge>
                      <span>
                        desc {Math.round(p.description_similarity * 100)}% · type{" "}
                        {Math.round(p.type_similarity * 100)}%
                      </span>
                    </div>
                  }
                />
                <div className="space-y-3 p-4">
                  {isProjectAdmin && (
                    <div className="flex flex-wrap items-center gap-4 text-xs text-ink-600">
                      <span className="font-medium">Keep:</span>
                      <label className="flex items-center gap-1.5">
                        <input
                          type="radio"
                          checked={keepOf(p) === "a"}
                          onChange={() => setKeep(p, "a")}
                          disabled={busy}
                        />
                        <span className="font-mono">{p.equipment_a.client_tag}</span>
                      </label>
                      <label className="flex items-center gap-1.5">
                        <input
                          type="radio"
                          checked={keepOf(p) === "b"}
                          onChange={() => setKeep(p, "b")}
                          disabled={busy}
                        />
                        <span className="font-mono">{p.equipment_b.client_tag}</span>
                      </label>
                      <span className="text-ink-400">— the other row is deleted if you merge.</span>
                    </div>
                  )}

                  {diffFields.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-xs">
                        <thead>
                          <tr className="text-left text-ink-500">
                            {isProjectAdmin && <th className="w-8 pb-2" />}
                            <th className="pb-2 pr-4">FIELD</th>
                            <th className="pb-2 pr-4">{keep.client_tag} (KEEP)</th>
                            <th className="pb-2">{remove.client_tag} (WOULD BE REMOVED)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {diffFields.map(({ key: field, label }) => {
                            const isAccepted = selected.has(field);
                            return (
                              <tr key={field} className="border-t border-ink-100">
                                {isProjectAdmin && (
                                  <td className="py-2">
                                    <input
                                      type="checkbox"
                                      checked={isAccepted}
                                      disabled={busy}
                                      onChange={() => toggleField(p, field)}
                                    />
                                  </td>
                                )}
                                <td className="py-2 pr-4 font-medium text-ink-700">{label}</td>
                                <td className="py-2 pr-4 text-ink-800">{displayValue(keep[field])}</td>
                                <td className={isAccepted ? "py-2 font-medium text-emerald-700" : "py-2 text-ink-400"}>
                                  {displayValue(remove[field])}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-xs text-ink-400">No differing fields besides the tag itself.</p>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-end gap-2 border-t border-ink-100 p-3">
                  <button
                    type="button"
                    className="btn-ghost text-xs"
                    onClick={() => dismiss(p)}
                    disabled={busy}
                  >
                    Not a duplicate
                  </button>
                  {isProjectAdmin && !confirming && (
                    <button
                      type="button"
                      className="btn-primary text-xs"
                      onClick={() => setConfirmingKey(key)}
                      disabled={busy}
                    >
                      <GitMerge className="h-3.5 w-3.5" />
                      Merge — keep {keep.client_tag}
                    </button>
                  )}
                  {isProjectAdmin && confirming && (
                    <>
                      <span className="text-xs text-rose-700">
                        Permanently delete {remove.client_tag} and apply checked fields to {keep.client_tag}?
                      </span>
                      <button
                        type="button"
                        className="btn-ghost text-xs"
                        onClick={() => setConfirmingKey(null)}
                        disabled={busy}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="btn-danger text-xs"
                        onClick={() => doMerge(p)}
                        disabled={busy}
                      >
                        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <GitMerge className="h-3.5 w-3.5" />}
                        Confirm merge
                      </button>
                    </>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {page && (
        <Card>
          <Pagination
            total={page.total}
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
