"use client";
import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import useSWR, { useSWRConfig } from "swr";
import { ArrowLeft, ArrowRight, CheckCircle2, FileText, PackagePlus, Sparkles } from "lucide-react";

import { Badge, Card, CardHeader, ErrorBox, Field, Spinner } from "@/components/ui";
import type { Paged } from "@/components/Pagination";
import { api, fetcher } from "@/lib/api";
import type { Equipment, FileExtraction, ProjectFile } from "@/lib/types";

export default function FileDetailPage() {
  const params = useParams();
  const projectId = Number(Array.isArray(params?.id) ? params.id[0] : params?.id);
  const fileId = Number(Array.isArray(params?.fileId) ? params.fileId[0] : params?.fileId);
  const { mutate } = useSWRConfig();
  // workspace lives in the URL PATH segment — used for the "back to
  // files" link below. (The fetched `file.workspace` is the truth for
  // the file's actual workspace; we use the URL segment for navigation.)
  const wsParam = params?.workspace;
  const wsRaw = Array.isArray(wsParam) ? wsParam[0] : wsParam;
  const workspace: "topside" | "marine" = wsRaw === "marine" ? "marine" : "topside";

  const { data: file, error: fErr } = useSWR<ProjectFile & { extractions?: FileExtraction[] }>(
    `/projects/${projectId}/files/${fileId}`,
    fetcher
  );
  const { data: extraction } = useSWR<FileExtraction>(
    `/projects/${projectId}/files/${fileId}/data`,
    fetcher
  );

  // Equipment list for THIS workspace — used by the "Apply vendor to ..."
  // dropdown when a vendor sheet's mapper couldn't pin down a tag. Needs
  // the full list for the dropdown, not one page — hence the large limit.
  const { data: equipmentPage } = useSWR<Paged<Equipment>>(
    file?.workspace
      ? `/projects/${projectId}/equipment?limit=5000&workspace=${file.workspace}`
      : null,
    fetcher,
  );
  const equipment = equipmentPage?.items;

  const [tab, setTab] = React.useState<"summary" | "text" | "tables" | "raw">("summary");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Link className="btn-ghost px-2" href={`/projects/${projectId}/${workspace}/files`}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
      </div>

      {fErr && <ErrorBox error={fErr} />}
      {!file && !fErr && <Spinner />}

      {file && (
        <Card>
          <CardHeader
            title={file.name}
            subtitle={file.onedrive_path}
            action={
              <div className="flex items-center gap-2">
                {file.folder_category && (
                  <Badge tone={file.folder_category === "PFD Samples" ? "amber" : "green"}>
                    {file.folder_category}
                  </Badge>
                )}
                <Badge tone="slate">{file.extension}</Badge>
              </div>
            }
          />
          <div className="grid grid-cols-2 gap-4 p-5 md:grid-cols-4">
            <Mini label="Mime" value={file.mime_type} />
            <Mini label="Size" value={file.size_bytes ? `${(file.size_bytes / 1024).toFixed(1)} KB` : null} />
            <Mini label="OneDrive modified" value={file.onedrive_modified_at ? new Date(file.onedrive_modified_at).toLocaleString() : null} />
            <Mini label="Last synced" value={file.last_synced_at ? new Date(file.last_synced_at).toLocaleString() : null} />
          </div>
        </Card>
      )}

      {file && extraction && file.folder_category === "Vendor Data" && (
        <ApplyVendorPanel
          projectId={projectId}
          file={file}
          extraction={extraction}
          equipment={equipment}
          onApplied={() => {
            mutate((k) => typeof k === "string" && k.includes(`/projects/${projectId}/`));
          }}
        />
      )}

      {extraction && (
        <Card>
          <CardHeader
            title="Extraction"
            subtitle={`Parsed by ${extraction.parser}${extraction.used_ocr ? " (OCR)" : ""}`}
            action={
              <Badge tone={extraction.status === "success" ? "green" : "red"}>
                {extraction.status}
              </Badge>
            }
          />
          <div className="border-b border-ink-100 px-5">
            <nav className="flex gap-1">
              {(["summary", "text", "tables", "raw"] as const).map((t) => (
                <button
                  key={t}
                  className={`tab-link ${tab === t ? "tab-link-active" : ""}`}
                  onClick={() => setTab(t)}
                >
                  {t}
                </button>
              ))}
            </nav>
          </div>
          <div className="p-5">
            {tab === "summary" && (
              <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
                <Mini label="Parser" value={extraction.parser} />
                <Mini label="Pages" value={extraction.pages?.toString() ?? null} />
                <Mini label="OCR used" value={extraction.used_ocr ? "Yes" : "No"} />
                <Mini label="Created" value={new Date(extraction.created_at).toLocaleString()} />
                {extraction.error && (
                  <div className="md:col-span-4">
                    <ErrorBox error={{ message: extraction.error }} />
                  </div>
                )}
              </div>
            )}
            {tab === "text" && (
              <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap rounded-lg bg-ink-50 p-3 font-mono text-[11px] leading-relaxed text-ink-700">
                {String((extraction.data as Record<string, unknown>).text ?? "(no text extracted)")}
              </pre>
            )}
            {tab === "tables" && (
              <Tables data={extraction.data} />
            )}
            {tab === "raw" && (
              <pre className="max-h-[60vh] overflow-auto rounded-lg bg-ink-950 p-3 font-mono text-[11px] leading-relaxed text-emerald-200">
                {JSON.stringify(extraction.data, null, 2)}
              </pre>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}

function Mini({ label, value }: { label: string; value: React.ReactNode | string | null }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-ink-400">{label}</div>
      <div className="mt-0.5 text-sm text-ink-800">{value || <span className="text-ink-300">—</span>}</div>
    </div>
  );
}

function Tables({ data }: { data: Record<string, unknown> }) {
  const tables = (data.tables || []) as unknown[][][];
  const sheets = data.sheets as Record<string, { rows: unknown[][] }> | undefined;

  if (sheets) {
    return (
      <div className="space-y-6">
        {Object.entries(sheets).map(([name, sheet]) => (
          <div key={name}>
            <h4 className="mb-2 text-sm font-semibold text-ink-800">{name}</h4>
            <Grid rows={sheet.rows.slice(0, 200)} />
            {sheet.rows.length > 200 && (
              <div className="mt-2 text-[11px] text-ink-500">
                Showing first 200 of {sheet.rows.length} rows.
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }

  if (tables.length === 0) {
    return <div className="text-sm text-ink-500"><FileText className="mr-1 inline h-3 w-3" /> No tables detected.</div>;
  }

  return (
    <div className="space-y-6">
      {tables.map((tbl, i) => (
        <div key={i}>
          <h4 className="mb-2 text-sm font-semibold text-ink-800">Table {i + 1}</h4>
          <Grid rows={tbl as unknown[][]} />
        </div>
      ))}
    </div>
  );
}

function Grid({ rows }: { rows: unknown[][] }) {
  return (
    <div className="max-h-[50vh] overflow-auto rounded-lg border border-ink-100">
      <table className="min-w-full text-xs">
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className={ri === 0 ? "bg-ink-50 font-semibold" : ""}>
              {row.map((cell, ci) => (
                <td key={ci} className="border-b border-ink-100 px-2 py-1 align-top text-ink-700">
                  {cell == null ? "" : String(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// -----------------------------------------------------------------------------
// ApplyVendorPanel — for Vendor Data files where the LLM mapper found fields
// but no usable client tag (or its tag didn't match an existing row). Lets the
// reviewer pick an existing equipment row OR create a new one with the
// extracted fields pre-applied.
// -----------------------------------------------------------------------------

const VENDOR_FIELD_LABELS: Record<string, string> = {
  absorbed_power_kw:     "Absorbed power (kW)",
  rated_power_kw:        "Rated power (kW)",
  length_m:              "Length L / T-T (m)",
  width_id_m:            "Width / Inside diameter (m)",
  height_tt_m:           "Height H / T-T (m)",
  dry_weight_mt:         "Dry weight (MT)",
  operating_weight_mt:   "Operating weight (MT)",
  hydrotest_weight_mt:   "Hydrotest weight (MT)",
  description:           "Description",
  vendor:                "Vendor",
  material:              "Material",
  design_press:          "Design pressure",
  design_temp:           "Design temperature",
  design_code:           "Design code",
  orientation:           "Orientation",
};

function ApplyVendorPanel({
  projectId,
  file,
  extraction,
  equipment,
  onApplied,
}: {
  projectId: number;
  file: ProjectFile;
  extraction: FileExtraction;
  equipment: Equipment[] | undefined;
  onApplied: () => void;
}) {
  const vendor = ((extraction.data as Record<string, unknown>).vendor || {}) as {
    client_equipment_tag?: string | null;
    fields?: Record<string, string | null>;
  };
  const detectedTag = (vendor.client_equipment_tag || "").trim();
  const fieldsObj = vendor.fields || {};
  const populated = Object.entries(fieldsObj).filter(([, v]) => v != null && v !== "");

  const matchingEq = React.useMemo(() => {
    if (!detectedTag || !equipment) return null;
    const norm = detectedTag.replace(/\s+/g, "").toUpperCase();
    return equipment.find(
      (e) =>
        e.client_tag.replace(/\s+/g, "").toUpperCase() === norm ||
        (e.old_tag && e.old_tag.replace(/\s+/g, "").toUpperCase() === norm),
    ) || null;
  }, [detectedTag, equipment]);

  const [mode, setMode] = React.useState<"existing" | "new">("existing");
  const [selectedId, setSelectedId] = React.useState<string>("");
  const [newTag, setNewTag] = React.useState<string>(detectedTag || "");

  React.useEffect(() => {
    if (matchingEq) setSelectedId(String(matchingEq.id));
  }, [matchingEq]);

  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<string | null>(null);

  if (populated.length === 0) {
    return (
      <Card>
        <CardHeader
          title="Apply vendor sheet to equipment"
          subtitle="No vendor fields were extracted from this file yet. Try Force re-sync from the OneDrive page."
          action={<Sparkles className="h-4 w-4 text-ink-400" />}
        />
      </Card>
    );
  }

  async function apply() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const body: Record<string, unknown> = {};
      if (mode === "existing") {
        if (!selectedId) {
          setError("Please pick an equipment row from the dropdown.");
          setBusy(false);
          return;
        }
        body.equipment_id = Number(selectedId);
      } else {
        if (!newTag.trim()) {
          setError("Please enter a client tag for the new equipment row.");
          setBusy(false);
          return;
        }
        body.new_client_tag = newTag.trim();
      }
      const r = await api.post<{ status: string; equipment_id: number; client_tag?: string; new_version_created?: boolean }>(
        `/projects/${projectId}/files/${file.id}/apply-vendor`,
        body,
      );
      if (r.status === "created") {
        setResult(`Created new equipment ${r.client_tag} with the extracted fields.`);
      } else if (r.new_version_created) {
        setResult(`Applied to existing equipment — new version snapshot recorded.`);
      } else {
        setResult(`Applied — no actual field changed (values already matched).`);
      }
      onApplied();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  let cardSubtitle: React.ReactNode;
  if (matchingEq) {
    cardSubtitle = (
      <>
        Detected tag <span className="font-mono">{detectedTag}</span> matches an existing equipment row — sync should
        already have applied these fields. You can re-apply or pick a different target.
      </>
    );
  } else if (detectedTag) {
    cardSubtitle = (
      <>
        Detected tag <span className="font-mono">{detectedTag}</span> doesn&apos;t match any equipment in the{" "}
        <strong>{file.workspace === "marine" ? "Marine" : "Topsides"}</strong> workspace. Pick a target row or create
        a new one.
      </>
    );
  } else {
    cardSubtitle = (
      <>
        The vendor mapper found <strong>{populated.length}</strong> fields but couldn&apos;t identify a project
        equipment tag in this document. Apply the fields to an existing row, or create a new equipment row.
      </>
    );
  }

  return (
    <Card>
      <CardHeader
        title="Apply vendor sheet to equipment"
        subtitle={cardSubtitle}
        action={<Sparkles className="h-4 w-4 text-amber-500" />}
      />
      <div className="space-y-4 p-5">
        <div>
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-500">
            Extracted fields
          </div>
          <div className="rounded-lg border border-ink-100 bg-ink-50/40 p-3">
            <dl className="grid grid-cols-1 gap-x-6 gap-y-1 text-xs md:grid-cols-2">
              {populated.map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3">
                  <dt className="text-ink-500">{VENDOR_FIELD_LABELS[k] || k}</dt>
                  <dd className="font-mono text-ink-800">{String(v)}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <button
            type="button"
            onClick={() => setMode("existing")}
            className={
              mode === "existing"
                ? "rounded-md border-2 border-brand-500 bg-brand-50 px-3 py-1.5 font-medium text-brand-800"
                : "rounded-md border border-ink-200 px-3 py-1.5 text-ink-700 hover:bg-ink-50"
            }
          >
            Apply to existing equipment
          </button>
          <button
            type="button"
            onClick={() => setMode("new")}
            className={
              mode === "new"
                ? "rounded-md border-2 border-brand-500 bg-brand-50 px-3 py-1.5 font-medium text-brand-800"
                : "rounded-md border border-ink-200 px-3 py-1.5 text-ink-700 hover:bg-ink-50"
            }
          >
            <PackagePlus className="mr-1 inline h-3 w-3" /> Create new equipment
          </button>
        </div>

        {mode === "existing" ? (
          <Field
            label={`Pick a ${file.workspace === "marine" ? "Marine" : "Topsides"} equipment row to update`}
            hint="Only rows in this workspace are shown. The extracted fields are merged into the selected row; richer existing values (e.g. ranges) are preserved by the version service."
          >
            <select
              className="input"
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              disabled={!equipment || busy}
            >
              <option value="">— select equipment —</option>
              {(equipment || [])
                .slice()
                .sort((a, b) => a.client_tag.localeCompare(b.client_tag))
                .map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.client_tag}
                    {e.description ? ` — ${e.description}` : ""}
                  </option>
                ))}
            </select>
          </Field>
        ) : (
          <Field
            label="New equipment client tag"
            hint="Follow your project's tag convention. The extracted fields will populate the row; equipment_type is inferred from the tag prefix."
          >
            <input
              className="input font-mono"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value.toUpperCase())}
              placeholder={file.workspace === "marine" ? "e.g. G-F4201" : "e.g. V-S78201"}
              disabled={busy}
            />
          </Field>
        )}

        {error && <ErrorBox error={{ message: error }} />}
        {result && (
          <div className="flex items-center gap-2 rounded-md bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
            <CheckCircle2 className="h-4 w-4" /> {result}
          </div>
        )}

        <div className="flex justify-end">
          <button
            className="btn-primary"
            onClick={apply}
            disabled={busy || (mode === "existing" ? !selectedId : !newTag.trim())}
          >
            <ArrowRight className="h-4 w-4" />
            {busy
              ? "Applying…"
              : mode === "existing"
              ? "Apply to selected equipment"
              : "Create equipment with these fields"}
          </button>
        </div>
      </div>
    </Card>
  );
}
