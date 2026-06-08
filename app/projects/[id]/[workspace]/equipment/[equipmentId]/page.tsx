"use client";
import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import useSWR from "swr";
import {
  ArrowLeft,
  ChevronRight,
  ExternalLink,
  FileText,
  Gauge,
  History,
  Ruler,
  Tag,
  Weight,
  Zap,
} from "lucide-react";

import { Badge, Card, CardHeader, ErrorBox, Spinner } from "@/components/ui";
import { fetcher } from "@/lib/api";
import type {
  Equipment,
  EquipmentDiff,
  EquipmentVersion,
  ProjectFile,
} from "@/lib/types";

// -----------------------------------------------------------------------------
// Field schema — keys + human labels + section groups
// -----------------------------------------------------------------------------

const FIELD_LABELS: Record<string, string> = {
  rev_no: "Revision",
  old_tag: "Old Tag",
  client_tag: "Client Tag",
  description: "Description",
  vendor: "Vendor",
  equipment_type: "Type",
  module: "Module",
  design_code: "Design Code",
  orientation: "Orientation",
  material: "Material",
  configuration: "Configuration",
  location: "Location",
  operating_press: "Operating Pressure (barg)",
  operating_temp: "Operating Temp (°C)",
  design_press: "Design Pressure (barg)",
  design_temp: "Design Temp (°C)",
  design_flow: "Design Flow (m³/hr)",
  pump_capacity: "Pump / Compressor Capacity",
  heat_exchanger_duty_kw: "Heat Exchanger Duty (kW)",
  liquid_fill: "Liquid Fill",
  absorbed_power_kw: "Absorbed Power (kW)",
  rated_power_kw: "Rated Power (kW)",
  length_m: "Length L / T-T (m)",
  width_id_m: "Width / Inside Diameter (m)",
  height_tt_m: "Height H / T-T (m)",
  dry_weight_mt: "Dry Weight (MT)",
  operating_weight_mt: "Operating Weight (MT)",
  hydrotest_weight_mt: "Hydrotest Weight (MT)",
  total_dry_weight_mt: "Total Dry Weight (MT)",
  total_operating_weight_mt: "Total Operating Weight (MT)",
  pid: "P&ID",
  remarks: "Remarks",
  lifecycle_status: "Lifecycle Status",
  data: "Extra Data",
};

const SECTIONS: { title: string; icon: React.ComponentType<{ className?: string }>; fields: string[] }[] = [
  {
    title: "Identification",
    icon: Tag,
    fields: ["rev_no", "old_tag", "vendor", "equipment_type", "module", "design_code", "orientation", "location", "configuration", "lifecycle_status"],
  },
  {
    title: "Material & Process",
    icon: Gauge,
    fields: ["material", "operating_press", "operating_temp", "design_press", "design_temp", "design_flow", "pump_capacity", "heat_exchanger_duty_kw", "liquid_fill"],
  },
  {
    title: "Dimensions",
    icon: Ruler,
    fields: ["length_m", "width_id_m", "height_tt_m"],
  },
  {
    title: "Weights",
    icon: Weight,
    fields: ["dry_weight_mt", "operating_weight_mt", "hydrotest_weight_mt", "total_dry_weight_mt", "total_operating_weight_mt"],
  },
  {
    title: "Power",
    icon: Zap,
    fields: ["absorbed_power_kw", "rated_power_kw"],
  },
  {
    title: "References",
    icon: FileText,
    fields: ["pid", "remarks"],
  },
];

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function lifecycleTone(status: string | null | undefined): "green" | "amber" | "red" | "slate" {
  if (!status) return "slate";
  const s = status.toUpperCase();
  // When multiple flags are set ("REFURBISHED / NEW") the most "alarming"
  // one wins: SCRAPPED (red) > REFURBISHED (amber) > NEW (green).
  if (s.includes("SCRAPPED")) return "red";
  if (s.includes("REFURBISHED")) return "amber";
  if (s.includes("NEW")) return "green";
  return "slate";
}

function sourceTone(src: string | null | undefined): "blue" | "amber" | "green" | "violet" | "slate" | "red" {
  switch (src) {
    case "pfd":    return "amber";
    case "pid":    return "blue";
    case "vendor": return "green";
    case "seed":   return "slate";
    case "manual": return "blue";
    case "excel":  return "violet";
    case "repair": return "red";
    default:       return "slate";
  }
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

function fieldLabel(key: string) {
  return FIELD_LABELS[key] || key;
}

function emptyVal(v: unknown): boolean {
  return v === null || v === undefined || v === "" || v === "-";
}

function formatVal(v: unknown): string {
  if (emptyVal(v)) return "—";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

// -----------------------------------------------------------------------------
// Page
// -----------------------------------------------------------------------------

export default function EquipmentDetailPage() {
  const params = useParams();
  const projectId = Number(Array.isArray(params?.id) ? params.id[0] : params?.id);
  const equipmentId = Number(
    Array.isArray(params?.equipmentId) ? params.equipmentId[0] : params?.equipmentId
  );
  // workspace is part of the URL path. The parent layout has already
  // validated it; here we just narrow the type for back-link URLs.
  const wsParam = params?.workspace;
  const wsRaw = Array.isArray(wsParam) ? wsParam[0] : wsParam;
  const workspace: "topside" | "marine" = wsRaw === "marine" ? "marine" : "topside";

  const eqUrl = `/projects/${projectId}/equipment/${equipmentId}`;
  const versionsUrl = `/projects/${projectId}/equipment/${equipmentId}/versions`;

  const { data: equipment, error: eqErr, isLoading: eqLoading } = useSWR<Equipment>(eqUrl, fetcher);
  const { data: versions } = useSWR<EquipmentVersion[]>(versionsUrl, fetcher);

  // Source file (the file that produced the latest change) — fetched only when
  // the equipment has a last_source_file_id so we can show "View source PDF".
  const sourceFileUrl = equipment?.last_source_file_id
    ? `/projects/${projectId}/files/${equipment.last_source_file_id}`
    : null;
  const { data: sourceFile } = useSWR<ProjectFile>(sourceFileUrl, fetcher);

  // Compare-versions controls (kept, but moved to a secondary card).
  const [fromV, setFromV] = React.useState<number | "">("");
  const [toV, setToV] = React.useState<number | "">("");
  React.useEffect(() => {
    if (versions && versions.length > 1 && fromV === "" && toV === "" && equipment) {
      setFromV(versions[0].version_no);
      setToV(equipment.current_version);
    }
  }, [versions, equipment, fromV, toV]);
  const diffUrl =
    fromV !== "" && toV !== "" && fromV !== toV
      ? `/projects/${projectId}/equipment/${equipmentId}/diff?from=${fromV}&to=${toV}`
      : null;
  const { data: diff } = useSWR<EquipmentDiff>(diffUrl, fetcher);

  // ---------- Section card render -------------------------------------------
  function renderSection(spec: typeof SECTIONS[number]) {
    if (!equipment) return null;
    const Icon = spec.icon;
    const visibleFields = spec.fields.filter((k) => !emptyVal((equipment as unknown as Record<string, unknown>)[k]));
    if (visibleFields.length === 0) return null;
    return (
      <div key={spec.title} className="rounded-xl border border-ink-100 bg-white">
        <div className="flex items-center gap-2 border-b border-ink-100 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-ink-600">
          <Icon className="h-3.5 w-3.5" />
          {spec.title}
        </div>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibleFields.map((k) => {
            const v = (equipment as unknown as Record<string, unknown>)[k];
            return (
              <div key={k}>
                <dt className="text-[11px] uppercase tracking-wide text-ink-400">
                  {fieldLabel(k)}
                </dt>
                <dd className="mt-0.5 text-sm text-ink-800">
                  {formatVal(v)}
                </dd>
              </div>
            );
          })}
        </dl>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Link className="btn-ghost px-2" href={`/projects/${projectId}/${workspace}/equipment`}>
          <ArrowLeft className="h-4 w-4" /> Back to equipment
        </Link>
        {equipment && (
          <div className="flex items-center gap-1.5 text-xs text-ink-500">
            <History className="h-3.5 w-3.5" />
            {versions?.length ?? 0} versions
          </div>
        )}
      </div>

      {eqLoading && <div className="grid place-items-center py-20"><Spinner className="h-6 w-6" /></div>}
      {eqErr && <ErrorBox error={eqErr} />}

      {equipment && (
        <>
          {/* Hero banner ------------------------------------------------------ */}
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-4 p-5">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="font-mono text-xl font-semibold text-ink-900">
                    {equipment.client_tag}
                  </h1>
                  {equipment.module && (
                    <Badge tone="slate">{equipment.module}</Badge>
                  )}
                  {equipment.equipment_type && (
                    <Badge tone="blue">{equipment.equipment_type}</Badge>
                  )}
                  {equipment.lifecycle_status && (
                    <Badge tone={lifecycleTone(equipment.lifecycle_status)}>
                      {equipment.lifecycle_status}
                    </Badge>
                  )}
                </div>
                {equipment.description && (
                  <p className="mt-1 text-sm text-ink-700">{equipment.description}</p>
                )}
                {equipment.old_tag && (
                  <p className="mt-1 text-[11px] text-ink-500">
                    Old tag: <span className="font-mono text-ink-700">{equipment.old_tag}</span>
                  </p>
                )}
              </div>
              <div className="text-right">
                <div className="flex items-center justify-end gap-2">
                  <Badge tone="blue">v{equipment.current_version}</Badge>
                  {equipment.last_source && (
                    <Badge tone={sourceTone(equipment.last_source)}>
                      {equipment.last_source}
                    </Badge>
                  )}
                </div>
                <div className="mt-1 text-[11px] text-ink-500" title={equipment.updated_at}>
                  Updated {relativeTime(equipment.updated_at)}
                </div>
                {sourceFile && (
                  <Link
                    href={`/projects/${projectId}/${workspace}/files/${sourceFile.id}`}
                    className="mt-1 inline-flex items-center gap-1 text-[11px] text-brand-700 hover:underline"
                  >
                    <FileText className="h-3 w-3" />
                    <span className="max-w-[260px] truncate">{sourceFile.name}</span>
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                )}
              </div>
            </div>
          </Card>

          {/* Field sections --------------------------------------------------- */}
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {SECTIONS.map(renderSection)}
          </div>

          {/* Version timeline ------------------------------------------------- */}
          <Card>
            <CardHeader
              title="Version history"
              subtitle="Every PFD / vendor / manual update creates an immutable snapshot. The diff against the previous version is computed and shown inline."
            />
            <div className="p-5">
              {!versions && <Spinner />}
              {versions && versions.length === 0 && (
                <div className="text-xs text-ink-500">No history yet.</div>
              )}
              {versions && versions.length > 0 && (
                <VersionTimeline
                  versions={versions}
                  projectId={projectId}
                  workspace={workspace}
                />
              )}
            </div>
          </Card>

          {/* Compare versions (secondary) ------------------------------------- */}
          {versions && versions.length > 1 && (
            <Card>
              <CardHeader
                title="Compare any two versions"
                subtitle="Use this if you want to compare non-adjacent versions (e.g. v1 vs the current). Adjacent diffs are already shown in the timeline above."
                action={
                  <div className="flex items-center gap-2">
                    <select
                      className="input w-24 text-xs"
                      value={fromV}
                      onChange={(e) => setFromV(Number(e.target.value))}
                    >
                      {versions.map((v) => (
                        <option key={v.id} value={v.version_no}>v{v.version_no}</option>
                      ))}
                    </select>
                    <ChevronRight className="h-4 w-4 text-ink-400" />
                    <select
                      className="input w-24 text-xs"
                      value={toV}
                      onChange={(e) => setToV(Number(e.target.value))}
                    >
                      {versions.map((v) => (
                        <option key={v.id} value={v.version_no}>v{v.version_no}</option>
                      ))}
                    </select>
                  </div>
                }
              />
              <div className="p-5">
                {!diff && <Spinner />}
                {diff && Object.keys(diff.fields).length === 0 && (
                  <div className="text-xs text-ink-500">
                    No field-level differences between v{diff.from_version} and v{diff.to_version}.
                  </div>
                )}
                {diff && Object.keys(diff.fields).length > 0 && (
                  <DiffTable diff={diff} />
                )}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Version timeline
// -----------------------------------------------------------------------------

function VersionTimeline({
  versions,
  projectId,
  workspace,
}: {
  versions: EquipmentVersion[];
  projectId: number;
  workspace: "topside" | "marine";
}) {
  // Sort newest → oldest for the timeline (latest at the top).
  const sorted = React.useMemo(
    () => [...versions].sort((a, b) => b.version_no - a.version_no),
    [versions],
  );

  // Track which versions have their diff panel expanded.
  const [expanded, setExpanded] = React.useState<Record<number, boolean>>(() => {
    // Auto-expand the latest one so the user sees the latest change immediately.
    if (sorted.length > 0) return { [sorted[0].id]: true };
    return {};
  });

  return (
    <ol className="relative">
      <div
        aria-hidden
        className="absolute left-[15px] top-2 bottom-2 w-px bg-ink-100"
      />
      {sorted.map((v, idx) => {
        const prev = sorted[idx + 1]; // the version just before this one
        const isLatest = idx === 0;
        const open = !!expanded[v.id];
        const tone = sourceTone(v.source);
        const fields = v.changed_fields || [];
        return (
          <li key={v.id} className="relative pb-4 pl-10">
            {/* Node circle */}
            <span
              className={`absolute left-2 top-1.5 h-3 w-3 rounded-full ring-2 ring-white ${
                isLatest ? "bg-brand-500" : "bg-ink-300"
              }`}
            />

            <div className="rounded-lg border border-ink-100 bg-white">
              <button
                type="button"
                onClick={() => setExpanded((s) => ({ ...s, [v.id]: !s[v.id] }))}
                className="flex w-full items-center justify-between gap-3 rounded-t-lg px-4 py-3 hover:bg-ink-50"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={tone}>
                    v{v.version_no} · {v.source}
                  </Badge>
                  {isLatest && <Badge tone="blue">Latest</Badge>}
                  <span className="text-xs text-ink-600">
                    {fields.length === 0
                      ? "initial snapshot"
                      : `${fields.length} field${fields.length === 1 ? "" : "s"} changed`}
                  </span>
                </div>
                <div className="text-right">
                  <div className="text-[11px] text-ink-500" title={new Date(v.created_at).toLocaleString()}>
                    {relativeTime(v.created_at)}
                  </div>
                  {v.source_file_id && (
                    <Link
                      href={`/projects/${projectId}/${workspace}/files/${v.source_file_id}`}
                      className="text-[11px] text-brand-700 hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      view source file →
                    </Link>
                  )}
                </div>
              </button>

              {open && (
                <div className="border-t border-ink-100 p-4">
                  {v.note && (
                    <div className="mb-3 rounded-md bg-ink-50 px-3 py-2 text-xs text-ink-600">
                      {v.note}
                    </div>
                  )}
                  {fields.length === 0 ? (
                    <div className="text-xs text-ink-500">
                      Initial snapshot — no prior version to diff against.
                    </div>
                  ) : (
                    <InlineDiff
                      changedFields={fields}
                      currentSnapshot={v.snapshot}
                      prevSnapshot={prev?.snapshot}
                      prevLabel={prev ? `v${prev.version_no}` : "—"}
                      currentLabel={`v${v.version_no}`}
                    />
                  )}
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function InlineDiff({
  changedFields,
  currentSnapshot,
  prevSnapshot,
  prevLabel,
  currentLabel,
}: {
  changedFields: string[];
  currentSnapshot: Record<string, unknown>;
  prevSnapshot: Record<string, unknown> | undefined;
  prevLabel: string;
  currentLabel: string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-ink-100 text-[11px] uppercase tracking-wide text-ink-500">
            <th className="py-1 pr-3 text-left font-medium">Field</th>
            <th className="py-1 pr-3 text-left font-medium">{prevLabel}</th>
            <th className="py-1 text-left font-medium">{currentLabel}</th>
          </tr>
        </thead>
        <tbody>
          {changedFields.map((f) => {
            const before = prevSnapshot ? prevSnapshot[f] : undefined;
            const after = currentSnapshot[f];
            return (
              <tr key={f} className="border-b border-ink-50 last:border-b-0">
                <td className="py-2 pr-3 align-top text-xs text-ink-700">
                  {fieldLabel(f)}
                </td>
                <td className="py-2 pr-3 align-top">
                  <DiffCell value={before} variant="from" />
                </td>
                <td className="py-2 align-top">
                  <DiffCell value={after} variant="to" />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Diff cell + Compare-versions diff table
// -----------------------------------------------------------------------------

function DiffCell({ value, variant }: { value: unknown; variant: "from" | "to" }) {
  const display = formatVal(value);
  const empty = display === "—";
  const tone = empty
    ? "bg-ink-50 text-ink-400"
    : variant === "from"
    ? "bg-rose-50 text-rose-700 ring-1 ring-rose-100"
    : "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100";
  return (
    <span className={`inline-block max-w-[40ch] truncate rounded px-2 py-0.5 text-xs ${tone}`}>
      {display}
    </span>
  );
}

function DiffTable({ diff }: { diff: EquipmentDiff }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-ink-100 text-[11px] uppercase tracking-wide text-ink-500">
            <th className="py-1 pr-3 text-left font-medium">Field</th>
            <th className="py-1 pr-3 text-left font-medium">v{diff.from_version}</th>
            <th className="py-1 text-left font-medium">v{diff.to_version}</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(diff.fields).map(([field, { from, to }]) => (
            <tr key={field} className="border-b border-ink-50 last:border-b-0">
              <td className="py-2 pr-3 align-top text-xs text-ink-700">
                {fieldLabel(field)}
              </td>
              <td className="py-2 pr-3 align-top">
                <DiffCell value={from} variant="from" />
              </td>
              <td className="py-2 align-top">
                <DiffCell value={to} variant="to" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

