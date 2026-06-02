"use client";
import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import useSWR, { useSWRConfig } from "swr";
import {
  Activity,
  BarChart3,
  Cloud,
  FileText,
  Layers,
  Plus,
  RefreshCcw,
  Upload,
  Wrench,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Badge, Card, CardHeader, Spinner } from "@/components/ui";
import { api, fetcher } from "@/lib/api";
import type {
  Equipment,
  OneDriveSelection,
  Project,
  ProjectFile,
  ProjectMember,
  SyncSummary,
} from "@/lib/types";

// -----------------------------------------------------------------------------
// Page
// -----------------------------------------------------------------------------

export default function ProjectDashboard() {
  const params = useParams();
  const router = useRouter();
  const id = Number(Array.isArray(params?.id) ? params.id[0] : params?.id);
  const { mutate } = useSWRConfig();

  const { data: project } = useSWR<Project>(`/projects/${id}`, fetcher);
  const { data: equipment } = useSWR<Equipment[]>(`/projects/${id}/equipment?limit=5000`, fetcher);
  const { data: files } = useSWR<ProjectFile[]>(`/projects/${id}/files`, fetcher);
  const { data: members } = useSWR<ProjectMember[]>(`/projects/${id}/members`, fetcher);
  const { data: selection } = useSWR<OneDriveSelection[]>(`/projects/${id}/onedrive/selection`, fetcher);

  // ---------- Derived metrics ----------
  const totals = React.useMemo(() => {
    const dry = sumNumeric(equipment, "dry_weight_mt");
    const ope = sumNumeric(equipment, "operating_weight_mt");
    return { dry, ope };
  }, [equipment]);

  const lastSync = React.useMemo(() => {
    if (!files) return null;
    return files.reduce<string | null>((acc, f) => {
      if (!f.last_synced_at) return acc;
      return !acc || f.last_synced_at > acc ? f.last_synced_at : acc;
    }, null);
  }, [files]);

  const recentlyUpdated = React.useMemo(() => {
    if (!equipment) return 0;
    const since = Date.now() - 24 * 3600 * 1000;
    return equipment.filter((e) => {
      if ((e.current_version ?? 1) < 2) return false;
      const ts = new Date(e.updated_at).getTime();
      return Number.isFinite(ts) && ts >= since;
    }).length;
  }, [equipment]);

  const sourceCounts = React.useMemo(() => {
    const out: Record<string, number> = {};
    if (!equipment) return out;
    for (const e of equipment) {
      const k = e.last_source || "seed";
      out[k] = (out[k] || 0) + 1;
    }
    return out;
  }, [equipment]);

  const touchedBySync = (sourceCounts.pfd || 0) + (sourceCounts.vendor || 0);

  // ---------- Sparkline series (14-day mini trends per KPI) ----------
  const sparks = React.useMemo(() => {
    const days = 14;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const buckets = (datesGetter: (item: any) => string | null | undefined, items: any[] | undefined) => {
      const out = new Array(days).fill(0);
      if (!items) return out;
      for (const it of items) {
        const iso = datesGetter(it);
        if (!iso) continue;
        const d = new Date(iso);
        d.setHours(0, 0, 0, 0);
        const diff = Math.round((today.getTime() - d.getTime()) / 86_400_000);
        if (diff >= 0 && diff < days) out[days - 1 - diff] += 1;
      }
      return out;
    };
    return {
      equipment: buckets(
        (e: Equipment) => ((e.current_version ?? 1) >= 2 ? e.updated_at : null),
        equipment,
      ),
      files: buckets((f: ProjectFile) => f.last_synced_at, files),
      synced: buckets(
        (e: Equipment) =>
          e.last_source === "pfd" || e.last_source === "vendor" ? e.updated_at : null,
        equipment,
      ),
    };
  }, [equipment, files]);

  const moduleBuckets = React.useMemo(() => {
    if (!equipment) return [] as { name: string; count: number; pct: number }[];
    const grouped = groupBy(equipment, (e) => e.module || "—");
    const total = equipment.length || 1;
    return Object.entries(grouped)
      .map(([name, items]) => ({
        name,
        count: items.length,
        pct: Math.round((items.length / total) * 100),
      }))
      .sort((a, b) => b.count - a.count);
  }, [equipment]);

  // ---------- Recent activity feed (synthesised from equipment + files) ----------
  const activity = React.useMemo(() => {
    type Item = {
      ts: string;
      kind: "equipment" | "file";
      title: React.ReactNode;
      sub: React.ReactNode;
      href: string;
      tone: "blue" | "amber" | "green" | "violet" | "slate" | "red";
    };
    const items: Item[] = [];
    if (equipment) {
      for (const e of equipment) {
        if ((e.current_version ?? 1) < 2) continue;
        items.push({
          ts: e.updated_at,
          kind: "equipment",
          title: (
            <>
              <span className="font-mono font-medium">{e.client_tag}</span>
              <span className="text-ink-500"> {e.description ? `· ${e.description}` : ""}</span>
            </>
          ),
          sub: (
            <>
              v{e.current_version} via {e.last_source || "?"}
            </>
          ),
          href: `/projects/${id}/equipment/${e.id}`,
          tone: sourceTone(e.last_source),
        });
      }
    }
    if (files) {
      for (const f of files) {
        if (!f.last_synced_at) continue;
        items.push({
          ts: f.last_synced_at,
          kind: "file",
          title: <span className="truncate">{f.name}</span>,
          sub: (
            <>
              {f.folder_category || "Other"} · {f.sync_status}
            </>
          ),
          href: `/projects/${id}/files/${f.id}`,
          tone: f.folder_category === "PFD Samples"
            ? "amber"
            : f.folder_category === "Vendor Data"
            ? "green"
            : "slate",
        });
      }
    }
    items.sort((a, b) => (a.ts < b.ts ? 1 : a.ts > b.ts ? -1 : 0));
    return items.slice(0, 10);
  }, [equipment, files, id]);

  // ---------- Sync action (also lives on the OneDrive page; mirroring here) ----------
  const [syncing, setSyncing] = React.useState(false);
  const [syncMsg, setSyncMsg] = React.useState<string | null>(null);
  const [syncErr, setSyncErr] = React.useState<string | null>(null);

  async function runSync() {
    setSyncing(true);
    setSyncMsg(null);
    setSyncErr(null);
    try {
      const s = await api.post<SyncSummary>(`/projects/${id}/sync`);
      const parts: string[] = [];
      if (s.files_synced) parts.push(`${s.files_synced} synced`);
      if (s.files_skipped) parts.push(`${s.files_skipped} skipped`);
      if (s.files_failed) parts.push(`${s.files_failed} failed`);
      if (s.equipment_created) parts.push(`${s.equipment_created} new equipment`);
      if (s.pfd_updates_applied) parts.push(`${s.pfd_updates_applied} PFD upd`);
      if (s.vendor_updates_applied) parts.push(`${s.vendor_updates_applied} vendor upd`);
      setSyncMsg(parts.length ? parts.join(" · ") : "nothing to do");
      mutate((k) => typeof k === "string" && k.includes(`/projects/${id}/`));
    } catch (e) {
      setSyncErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSyncing(false);
    }
  }

  const hasOneDrive = !!project?.onedrive_root_path || !!project?.onedrive_root_item_id;
  const hasSelection = (selection?.length || 0) > 0;
  const oneDriveReady = hasOneDrive && hasSelection;

  return (
    <div className="space-y-6">
      {/* ─── Page header strip ───────────────────────────────────────────── */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-ink-900">Dashboard</h2>
          <p className="text-xs text-ink-500">
            {oneDriveReady ? (
              <>
                {lastSync ? <>Last sync {relativeTime(lastSync)}</> : "Ready to sync"}
                {" · "}
                {files?.length ?? 0} file{(files?.length ?? 0) === 1 ? "" : "s"} cached
                {touchedBySync > 0 && (
                  <> · {touchedBySync} row{touchedBySync === 1 ? "" : "s"} updated by sync</>
                )}
              </>
            ) : !hasOneDrive ? (
              <>OneDrive folder not configured for this project.</>
            ) : (
              <>No OneDrive items selected yet — pick items on the OneDrive page.</>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/projects/${id}/equipment/new`} className="btn-ghost">
            <Plus className="h-4 w-4" /> Add equipment
          </Link>
          <Link href={`/projects/${id}/equipment/import`} className="btn-ghost">
            <Upload className="h-4 w-4" /> Import Excel
          </Link>
          {!hasOneDrive ? (
            <Link href={`/projects/${id}/onedrive`} className="btn-primary">
              <Cloud className="h-4 w-4" /> Set up OneDrive
            </Link>
          ) : !hasSelection ? (
            <Link href={`/projects/${id}/onedrive`} className="btn-primary">
              <Cloud className="h-4 w-4" /> Pick items to sync
            </Link>
          ) : (
            <button
              className="btn-primary"
              onClick={runSync}
              disabled={syncing}
            >
              <RefreshCcw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Syncing…" : "Run sync"}
            </button>
          )}
        </div>
      </div>

      {(syncMsg || syncErr) && (
        <div
          className={[
            "rounded-lg border px-3 py-2 text-xs",
            syncErr
              ? "border-rose-200 bg-rose-50 text-rose-700"
              : "border-emerald-200 bg-emerald-50 text-emerald-700",
          ].join(" ")}
        >
          {syncErr ? `Sync failed: ${syncErr}` : `Sync: ${syncMsg}`}
        </div>
      )}

      {/* ─── Section: Health overview ───────────────────────────────────── */}
      <SectionHeader title="Health" subtitle="At-a-glance counts with a 14-day trend." />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Equipment items"
          value={equipment ? equipment.length.toString() : "—"}
          sub={equipment ? `across ${moduleBuckets.length} module${moduleBuckets.length === 1 ? "" : "s"}` : undefined}
          badge={recentlyUpdated > 0 ? `${recentlyUpdated} updated 24h` : undefined}
          badgeTone="amber"
          href={`/projects/${id}/equipment`}
          icon={Wrench}
          tone="blue"
          spark={sparks.equipment}
        />
        <StatCard
          label="Files synced"
          value={files ? files.length.toString() : "—"}
          sub={lastSync ? `last ${relativeTime(lastSync)}` : "no sync yet"}
          href={`/projects/${id}/files`}
          icon={FileText}
          tone="green"
          spark={sparks.files}
        />
        <StatCard
          label="Sync coverage"
          value={
            equipment && equipment.length
              ? `${Math.round((touchedBySync / equipment.length) * 100)}%`
              : "—"
          }
          sub={
            equipment && equipment.length
              ? `${touchedBySync} of ${equipment.length} rows`
              : "no equipment yet"
          }
          href={`/projects/${id}/versions`}
          icon={Layers}
          tone="amber"
          spark={sparks.synced}
        />
        <StatCard
          label="Team"
          value={members ? members.length.toString() : "—"}
          sub={project ? `created ${formatDate(project.created_at)}` : undefined}
          href={`/projects/${id}/team`}
          icon={Activity}
          tone="violet"
        />
      </div>

      {/* ─── Section: Activity ──────────────────────────────────────────── */}
      <SectionHeader
        title="Activity"
        subtitle="Recent equipment changes and file syncs."
        action={
          <Link href={`/projects/${id}/versions`} className="btn-ghost">
            <Layers className="h-4 w-4" /> All versions
          </Link>
        }
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="px-5 py-3">
            {!equipment && !files && <Spinner />}
            {equipment && files && activity.length === 0 && (
              <div className="py-8 text-center">
                <div className="mx-auto mb-2 grid h-9 w-9 place-items-center rounded-full bg-ink-50 text-ink-400">
                  <Activity className="h-4 w-4" />
                </div>
                <div className="text-sm text-ink-700">No activity yet.</div>
                <div className="mt-0.5 text-xs text-ink-500">
                  Run a sync or add equipment manually to see updates here.
                </div>
              </div>
            )}
            {activity.length > 0 && (
              <GroupedActivity items={activity} router={router} />
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Top vendors" subtitle="Most equipment by vendor." />
          <div className="p-5">
            <TopVendors equipment={equipment} />
          </div>
        </Card>
      </div>

      {/* ─── Section: Distribution ──────────────────────────────────────── */}
      <SectionHeader
        title="Distribution"
        subtitle="How the MEL splits across modules, sources, and versions."
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Equipment by module"
            subtitle="Distribution across modules in the live MEL data."
            action={
              <Link href={`/projects/${id}/equipment`} className="btn-ghost">
                <Wrench className="h-4 w-4" /> Open table
              </Link>
            }
          />
          <div className="p-5">
            {moduleBuckets.length === 0 && (
              <EmptyHint text="No equipment yet. Add manually or run a sync." />
            )}
            {moduleBuckets.length > 0 && (
              <ul className="space-y-2">
                {moduleBuckets.slice(0, 12).map((b) => (
                  <li key={b.name} className="grid grid-cols-[80px_1fr_80px] items-center gap-3">
                    <span className="truncate text-xs font-medium text-ink-700">{b.name}</span>
                    <div className="h-2 overflow-hidden rounded-full bg-ink-100">
                      <div
                        className="h-full bg-brand-500"
                        style={{ width: `${b.pct}%` }}
                      />
                    </div>
                    <span className="text-right text-xs tabular-nums text-ink-600">
                      {b.count} <span className="text-ink-400">({b.pct}%)</span>
                    </span>
                  </li>
                ))}
                {moduleBuckets.length > 12 && (
                  <li className="pt-2 text-center text-[11px] text-ink-400">
                    + {moduleBuckets.length - 12} more module{moduleBuckets.length - 12 === 1 ? "" : "s"} — open the table to see all
                  </li>
                )}
              </ul>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="By source"
            subtitle="Where each equipment row last got its values."
          />
          <div className="p-5">
            <SourceDonut counts={sourceCounts} total={equipment?.length || 0} />
          </div>
        </Card>
      </div>

      {/* ─── Charts row: Activity timeline + Version distribution ───────── */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Activity (last 30 days)"
            subtitle="Equipment updates and files synced, bucketed by day."
            action={
              <span className="hidden items-center gap-3 text-[11px] text-ink-500 md:inline-flex">
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-brand-500" /> equipment updates
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" /> files synced
                </span>
              </span>
            }
          />
          <div className="px-2 py-3">
            <ActivityChart equipment={equipment} files={files} />
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Version distribution"
            subtitle="How many rows are still at v1 vs have been updated."
            action={<BarChart3 className="h-4 w-4 text-ink-400" />}
          />
          <div className="px-2 py-3">
            <VersionsChart equipment={equipment} />
          </div>
        </Card>
      </div>

      {/* ─── Section: Reference ─────────────────────────────────────────── */}
      <SectionHeader title="Reference" subtitle="Totals, document counts, and OneDrive selection." />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader title="Totals" subtitle="Aggregated from equipment rows." />
          <div className="space-y-3 p-5 text-sm">
            <Row label="Total dry weight"       value={`${totals.dry.toFixed(2)} MT`} />
            <Row label="Total operating weight" value={`${totals.ope.toFixed(2)} MT`} />
            <Row
              label="OneDrive folder"
              value={
                project?.onedrive_root_path ? (
                  <span className="font-mono text-[11px] text-ink-700">
                    {project.onedrive_root_path}
                  </span>
                ) : (
                  <span className="text-ink-400">not configured</span>
                )
              }
            />
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Documents"
            action={
              <Link href={`/projects/${id}/files`} className="btn-ghost">
                <FileText className="h-4 w-4" /> All files
              </Link>
            }
          />
          <div className="p-5 text-sm">
            <CountRow label="PFD Samples" value={countCategory(files, "PFD Samples")} />
            <CountRow label="Vendor Data" value={countCategory(files, "Vendor Data")} />
            <CountRow
              label="Other"
              value={
                (files?.length || 0) -
                countCategory(files, "PFD Samples") -
                countCategory(files, "Vendor Data")
              }
            />
          </div>
        </Card>

        <Card>
          <CardHeader
            title="OneDrive selection"
            action={
              <Link href={`/projects/${id}/onedrive`} className="btn-ghost">
                <Cloud className="h-4 w-4" /> Manage
              </Link>
            }
          />
          <div className="p-5 text-sm">
            <CountRow label="Items selected" value={selection?.length || 0} />
            <CountRow
              label="Folders"
              value={selection?.filter((s) => s.item_type === "folder").length || 0}
            />
            <CountRow
              label="Files"
              value={selection?.filter((s) => s.item_type === "file").length || 0}
            />
          </div>
        </Card>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

const sourceOrder = ["pfd", "vendor", "excel", "manual", "repair", "seed"];

function sourceTone(src: string | null | undefined): "blue" | "amber" | "green" | "violet" | "slate" | "red" {
  switch (src) {
    case "pfd":    return "amber";
    case "vendor": return "green";
    case "excel":  return "violet";
    case "manual": return "blue";
    case "repair": return "red";
    case "seed":
    default:       return "slate";
  }
}

function sourceBg(src: string): string {
  switch (src) {
    case "pfd":    return "bg-amber-500";
    case "vendor": return "bg-emerald-500";
    case "excel":  return "bg-violet-500";
    case "manual": return "bg-brand-500";
    case "repair": return "bg-rose-500";
    case "seed":
    default:       return "bg-ink-300";
  }
}

function relativeTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  const abs = Math.abs(Date.now() - t);
  if (abs < 60_000) return "just now";
  if (abs < 3_600_000) return `${Math.round(abs / 60_000)}m ago`;
  if (abs < 86_400_000) return `${Math.round(abs / 3_600_000)}h ago`;
  if (abs < 30 * 86_400_000) return `${Math.round(abs / 86_400_000)}d ago`;
  if (abs < 365 * 86_400_000) return `${Math.round(abs / (30 * 86_400_000))}mo ago`;
  return `${Math.round(abs / (365 * 86_400_000))}y ago`;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

function sumNumeric(items: Equipment[] | undefined, key: keyof Equipment): number {
  if (!items) return 0;
  return items.reduce((s, e) => {
    const v = e[key];
    if (typeof v !== "string" || !v) return s;
    const n = Number(v.replace(/[, ]/g, ""));
    return Number.isFinite(n) ? s + n : s;
  }, 0);
}

function groupBy<T>(arr: T[], key: (x: T) => string): Record<string, T[]> {
  const out: Record<string, T[]> = {};
  for (const item of arr) {
    const k = key(item);
    (out[k] ||= []).push(item);
  }
  return out;
}

function countCategory(files: ProjectFile[] | undefined, cat: string): number {
  if (!files) return 0;
  return files.filter((f) => f.folder_category === cat).length;
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-ink-500">{label}</span>
      <span className="font-medium text-ink-800">{value}</span>
    </div>
  );
}

function CountRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-ink-100 py-2 last:border-0">
      <span className="text-ink-500">{label}</span>
      <span className="font-semibold tabular-nums text-ink-800">{value}</span>
    </div>
  );
}

function EmptyHint({ text }: { text: string }) {
  return (
    <div className="py-8 text-center text-sm text-ink-500">{text}</div>
  );
}

function SectionHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-3 pt-2">
      <div>
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-500">
          {title}
        </h3>
        {subtitle && (
          <div className="mt-0.5 text-xs text-ink-400">{subtitle}</div>
        )}
      </div>
      {action}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Recent activity — grouped by date bucket (Today / Yesterday / Earlier)
// -----------------------------------------------------------------------------

type ActivityItem = {
  ts: string;
  kind: "equipment" | "file";
  title: React.ReactNode;
  sub: React.ReactNode;
  href: string;
  tone: "blue" | "amber" | "green" | "violet" | "slate" | "red";
};

function GroupedActivity({
  items,
  router,
}: {
  items: ActivityItem[];
  router: ReturnType<typeof useRouter>;
}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  // Bucket items by date label
  const groups: { label: string; items: ActivityItem[] }[] = [];
  for (const item of items) {
    const d = new Date(item.ts);
    d.setHours(0, 0, 0, 0);
    let label: string;
    if (d.getTime() === today.getTime()) label = "Today";
    else if (d.getTime() === yesterday.getTime()) label = "Yesterday";
    else
      label = d.toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
      });
    const bucket = groups.find((g) => g.label === label);
    if (bucket) bucket.items.push(item);
    else groups.push({ label, items: [item] });
  }

  return (
    <div className="space-y-3">
      {groups.map((g) => (
        <div key={g.label}>
          <div className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-wider text-ink-400">
            {g.label}
          </div>
          <ul className="divide-y divide-ink-100">
            {g.items.map((item, i) => (
              <li key={`${g.label}-${i}`}>
                <button
                  type="button"
                  onClick={() => router.push(item.href)}
                  className="flex w-full items-center gap-3 rounded-md py-2 px-1 text-left transition hover:bg-ink-50"
                >
                  <Badge tone={item.tone}>
                    {item.kind === "equipment" ? "EQ" : "FILE"}
                  </Badge>
                  <div className="min-w-0 flex-1 truncate text-sm text-ink-800">
                    {item.title}
                  </div>
                  <div className="hidden text-[11px] text-ink-500 sm:block">
                    {item.sub}
                  </div>
                  <div
                    className="text-[11px] text-ink-400"
                    title={new Date(item.ts).toLocaleString()}
                  >
                    {relativeTime(item.ts)}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

// -----------------------------------------------------------------------------
// StatCard — clickable KPI tile
// -----------------------------------------------------------------------------

const TONE_HEX: Record<string, string> = {
  blue:   "#2563eb",
  green:  "#10b981",
  amber:  "#f59e0b",
  violet: "#8b5cf6",
};

function StatCard({
  label,
  value,
  sub,
  badge,
  badgeTone,
  href,
  icon: Icon,
  tone,
  spark,
}: {
  label: string;
  value: string;
  sub?: string;
  badge?: string;
  badgeTone?: "amber" | "blue" | "green" | "slate" | "violet" | "red";
  href?: string;
  icon?: React.ComponentType<{ className?: string }>;
  tone?: "blue" | "green" | "amber" | "violet";
  spark?: number[]; // 14-day series; omit to hide the sparkline
}) {
  const color = TONE_HEX[tone || "blue"];
  const inner = (
    <div className="card relative overflow-hidden transition hover:border-ink-200 hover:shadow-md">
      <div className="flex items-start justify-between gap-2 p-4">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            {Icon && (
              <Icon className="h-3.5 w-3.5" style={{ color }} />
            )}
            <div className="text-[11px] font-medium uppercase tracking-wide text-ink-500">{label}</div>
          </div>
          <div className="mt-1 text-2xl font-semibold tabular-nums text-ink-900">
            {value}
          </div>
          {sub && <div className="mt-0.5 text-[11px] text-ink-500">{sub}</div>}
        </div>
        <div className="flex flex-col items-end gap-1">
          {badge && (
            <Badge tone={badgeTone || "amber"}>{badge}</Badge>
          )}
          {spark && spark.some((v) => v > 0) && (
            <Sparkline values={spark} color={color} />
          )}
        </div>
      </div>
    </div>
  );
  if (!href) return inner;
  return <Link href={href}>{inner}</Link>;
}

/**
 * Compact SVG sparkline — last N daily values as a smoothed line + a soft
 * fill below. Hides itself when every value is zero.
 */
function Sparkline({
  values,
  color,
  width = 84,
  height = 28,
}: {
  values: number[];
  color: string;
  width?: number;
  height?: number;
}) {
  if (values.length === 0) return null;
  const max = Math.max(...values, 1);
  const step = values.length > 1 ? width / (values.length - 1) : 0;
  const pts = values.map((v, i) => {
    const x = i * step;
    const y = height - (v / max) * (height - 4) - 2;
    return [x, y] as const;
  });
  const linePath = pts.map(([x, y], i) => (i === 0 ? `M${x},${y}` : `L${x},${y}`)).join(" ");
  const areaPath = `${linePath} L${width},${height} L0,${height} Z`;
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="block"
      aria-hidden
    >
      <path d={areaPath} fill={color} fillOpacity={0.08} />
      <path d={linePath} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      {/* End-point dot */}
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r={2} fill={color} />
    </svg>
  );
}

// -----------------------------------------------------------------------------
// Charts
// -----------------------------------------------------------------------------

const SOURCE_HEX: Record<string, string> = {
  pfd:    "#f59e0b", // amber-500
  vendor: "#10b981", // emerald-500
  excel:  "#8b5cf6", // violet-500
  manual: "#2563eb", // brand/blue-600
  repair: "#f43f5e", // rose-500
  seed:   "#cbd5e1", // slate-300
};

function SourceDonut({
  counts,
  total,
}: {
  counts: Record<string, number>;
  total: number;
}) {
  const data = sourceOrder
    .filter((s) => counts[s])
    .map((s) => ({ name: s, value: counts[s] }));

  if (data.length === 0 || total === 0) {
    return <EmptyHint text="No data yet." />;
  }

  return (
    <div>
      <div className="relative" style={{ height: 200 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={55}
              outerRadius={85}
              paddingAngle={2}
              stroke="#fff"
              strokeWidth={2}
            >
              {data.map((d) => (
                <Cell key={d.name} fill={SOURCE_HEX[d.name] || "#94a3b8"} />
              ))}
            </Pie>
            <Tooltip
              cursor={{ fill: "transparent" }}
              contentStyle={{
                borderRadius: 8,
                border: "1px solid #e2e8f0",
                fontSize: 12,
              }}
              formatter={(v: number, name: string) => [
                `${v} (${Math.round((v / total) * 100)}%)`,
                String(name).toUpperCase(),
              ]}
            />
          </PieChart>
        </ResponsiveContainer>
        {/* Center label */}
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="text-center">
            <div className="text-2xl font-semibold tabular-nums text-ink-900">{total}</div>
            <div className="text-[10px] uppercase tracking-wide text-ink-400">rows</div>
          </div>
        </div>
      </div>
      <ul className="mt-3 grid grid-cols-2 gap-1.5">
        {data.map((d) => {
          const pct = Math.round((d.value / total) * 100);
          return (
            <li key={d.name} className="flex items-center justify-between text-xs">
              <span className="inline-flex items-center gap-1.5">
                <span
                  className="h-2 w-2 rounded-sm"
                  style={{ background: SOURCE_HEX[d.name] || "#94a3b8" }}
                />
                <span className="font-mono uppercase text-ink-700">{d.name}</span>
              </span>
              <span className="tabular-nums text-ink-500">
                {d.value} <span className="text-ink-400">({pct}%)</span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ActivityChart({
  equipment,
  files,
}: {
  equipment: Equipment[] | undefined;
  files: ProjectFile[] | undefined;
}) {
  const data = React.useMemo(() => {
    // Build a 30-day buckets array, oldest to newest.
    const days: { date: string; key: string; equipment: number; files: number }[] = [];
    const todayUtc = new Date();
    todayUtc.setHours(0, 0, 0, 0);
    for (let i = 29; i >= 0; i--) {
      const d = new Date(todayUtc);
      d.setDate(todayUtc.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      days.push({
        date: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        key,
        equipment: 0,
        files: 0,
      });
    }
    const byKey = Object.fromEntries(days.map((d) => [d.key, d]));

    if (equipment) {
      for (const e of equipment) {
        if ((e.current_version ?? 1) < 2) continue;
        const k = e.updated_at?.slice(0, 10);
        if (k && byKey[k]) byKey[k].equipment += 1;
      }
    }
    if (files) {
      for (const f of files) {
        const k = f.last_synced_at?.slice(0, 10);
        if (k && byKey[k]) byKey[k].files += 1;
      }
    }
    return days;
  }, [equipment, files]);

  const isEmpty = data.every((d) => d.equipment === 0 && d.files === 0);

  if (isEmpty) {
    return (
      <div className="grid h-[220px] place-items-center">
        <div className="text-center text-xs text-ink-500">
          No activity in the last 30 days.
          <div className="mt-1 text-[11px] text-ink-400">
            Run a sync or update equipment to see daily activity here.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: 220 }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 16, left: -16, bottom: 0 }}>
          <defs>
            <linearGradient id="gradEq" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#2563eb" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#2563eb" stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="gradFile" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#10b981" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: "#94a3b8" }}
            tickLine={false}
            axisLine={{ stroke: "#e2e8f0" }}
            interval="preserveStartEnd"
            minTickGap={20}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "#94a3b8" }}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
            width={32}
          />
          <Tooltip
            contentStyle={{
              borderRadius: 8,
              border: "1px solid #e2e8f0",
              fontSize: 12,
            }}
            labelStyle={{ color: "#475569", fontWeight: 600 }}
          />
          <Area
            type="monotone"
            dataKey="equipment"
            name="Equipment updates"
            stroke="#2563eb"
            strokeWidth={2}
            fill="url(#gradEq)"
          />
          <Area
            type="monotone"
            dataKey="files"
            name="Files synced"
            stroke="#10b981"
            strokeWidth={2}
            fill="url(#gradFile)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function TopVendors({ equipment }: { equipment: Equipment[] | undefined }) {
  const rows = React.useMemo(() => {
    if (!equipment || equipment.length === 0) return [];
    const counts = new Map<string, number>();
    for (const e of equipment) {
      const v = (e.vendor || "").trim();
      if (!v || v === "-") continue;
      counts.set(v, (counts.get(v) || 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, count]) => ({ name, count }));
  }, [equipment]);

  if (rows.length === 0) {
    return (
      <div className="grid h-[180px] place-items-center">
        <div className="text-xs text-ink-500">No vendors recorded yet.</div>
      </div>
    );
  }

  const max = Math.max(...rows.map((r) => r.count), 1);

  return (
    <ul className="space-y-2">
      {rows.map((r) => {
        const pct = Math.round((r.count / max) * 100);
        return (
          <li key={r.name} className="grid grid-cols-[1fr_auto] items-center gap-2">
            <div className="min-w-0">
              <div className="flex items-center justify-between text-xs">
                <span className="truncate font-medium text-ink-700" title={r.name}>
                  {r.name}
                </span>
                <span className="tabular-nums text-ink-500">{r.count}</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink-100">
                <div className="h-full bg-violet-500" style={{ width: `${pct}%` }} />
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function VersionsChart({ equipment }: { equipment: Equipment[] | undefined }) {
  const data = React.useMemo(() => {
    if (!equipment || equipment.length === 0) return [];
    const buckets: Record<string, number> = { "v1": 0, "v2": 0, "v3": 0, "v4+": 0 };
    for (const e of equipment) {
      const v = e.current_version ?? 1;
      const key = v >= 4 ? "v4+" : `v${v}`;
      buckets[key] = (buckets[key] || 0) + 1;
    }
    return Object.entries(buckets)
      .filter(([, n]) => n > 0)
      .map(([version, count]) => ({ version, count }));
  }, [equipment]);

  if (data.length === 0) {
    return (
      <div className="grid h-[220px] place-items-center">
        <div className="text-xs text-ink-500">No equipment yet.</div>
      </div>
    );
  }

  const colorFor = (version: string) => (version === "v1" ? "#cbd5e1" : "#f59e0b");

  return (
    <div style={{ height: 220 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 16, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis
            dataKey="version"
            tick={{ fontSize: 11, fill: "#64748b" }}
            tickLine={false}
            axisLine={{ stroke: "#e2e8f0" }}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "#94a3b8" }}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
            width={32}
          />
          <Tooltip
            cursor={{ fill: "#f8fafc" }}
            contentStyle={{
              borderRadius: 8,
              border: "1px solid #e2e8f0",
              fontSize: 12,
            }}
            formatter={(v: number) => [`${v} rows`, "count"]}
          />
          <Bar dataKey="count" radius={[4, 4, 0, 0]}>
            {data.map((d) => (
              <Cell key={d.version} fill={colorFor(d.version)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
