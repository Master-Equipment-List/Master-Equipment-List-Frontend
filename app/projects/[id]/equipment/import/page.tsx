"use client";
import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, FileSpreadsheet, Upload, Check, Loader2, X } from "lucide-react";

import { Badge, Card, CardHeader, ErrorBox, Spinner } from "@/components/ui";
import { apiBase } from "@/lib/api";
import { RequireAuth } from "@/lib/auth";

type Mode = "skip_existing" | "update_existing";
type Status = "new" | "existing" | "invalid";

interface PreviewRow {
  row_number: number;
  client_tag: string | null;
  status: Status;
  reason?: string | null;
  fields?: Record<string, unknown> | null;
  raw_extra?: Record<string, unknown> | null;
}

interface PreviewResponse {
  total_rows: number;
  new: number;
  existing: number;
  invalid: number;
  commit: boolean;
  mode: Mode;
  preview: PreviewRow[];
  preview_truncated?: boolean;
  // commit response also adds:
  created?: number;
  updated?: number;
  skipped?: number;
  errors?: Array<{ row_number: number; tag: string | null; error: string }>;
}

export default function ImportEquipmentPage() {
  return (
    <RequireAuth>
      <Inner />
    </RequireAuth>
  );
}

function Inner() {
  const router = useRouter();
  const params = useParams();
  const projectId = Number(Array.isArray(params?.id) ? params.id[0] : params?.id);

  const [file, setFile] = React.useState<File | null>(null);
  const [sheetName, setSheetName] = React.useState("");
  const [mode, setMode] = React.useState<Mode>("skip_existing");
  const [preview, setPreview] = React.useState<PreviewResponse | null>(null);
  const [committed, setCommitted] = React.useState<PreviewResponse | null>(null);
  const [busy, setBusy] = React.useState<"preview" | "commit" | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [dragActive, setDragActive] = React.useState(false);

  async function send(commit: boolean): Promise<PreviewResponse | null> {
    if (!file) return null;
    const fd = new FormData();
    fd.append("file", file);
    const qs = new URLSearchParams();
    if (sheetName.trim()) qs.set("sheet_name", sheetName.trim());
    qs.set("commit", commit ? "true" : "false");
    qs.set("mode", mode);

    const access =
      typeof window !== "undefined" ? window.localStorage.getItem("mel.access_token") : null;
    const res = await fetch(
      `${apiBase()}/projects/${projectId}/equipment/import?${qs.toString()}`,
      {
        method: "POST",
        body: fd,
        headers: access ? { Authorization: `Bearer ${access}` } : undefined,
      },
    );
    // The backend may return a Python traceback as plain text on unhandled
    // 5xx — we must NOT call res.json() blindly or we get the cryptic
    // "Unexpected token 'T'…" SyntaxError from the JSON parser.
    const raw = await res.text();
    let data: PreviewResponse | { detail?: string } | null = null;
    try { data = raw ? (JSON.parse(raw) as PreviewResponse) : null; } catch { /* not JSON */ }
    if (!res.ok) {
      const detail = (data as { detail?: string } | null)?.detail;
      const snippet = raw ? raw.split("\n").slice(0, 6).join(" ").slice(0, 400) : "";
      throw new Error(detail || snippet || `Import failed (${res.status})`);
    }
    return data as PreviewResponse;
  }

  async function runPreview() {
    if (!file) return;
    setBusy("preview");
    setError(null);
    setCommitted(null);
    try {
      const r = await send(false);
      setPreview(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  async function runCommit() {
    if (!file || !preview) return;
    setBusy("commit");
    setError(null);
    try {
      const r = await send(true);
      setCommitted(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  function chooseFile(f: File | null) {
    setFile(f);
    setPreview(null);
    setCommitted(null);
    setError(null);
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragActive(false);
    const f = e.dataTransfer.files?.[0];
    if (f) chooseFile(f);
  }

  return (
    <main className="space-y-4">
      <Link className="btn-ghost px-2" href={`/projects/${projectId}/equipment`}>
        <ArrowLeft className="h-4 w-4" /> Back to equipment
      </Link>

      <header>
        <h1 className="text-xl font-semibold text-ink-900">Import equipment from Excel</h1>
        <p className="text-sm text-ink-500">
          Upload an Equipment List (.xlsx) file. The parser auto-detects the
          header row by looking for the <code>CLIENT EQUIPMENT TAG</code> column.
          A preview is shown before any changes are written to the project.
        </p>
      </header>

      <Card>
        <CardHeader title="1. Choose file" />
        <div className="p-5 space-y-3">
          <div
            className={[
              "rounded-xl border-2 border-dashed p-8 text-center transition",
              dragActive ? "border-brand-500 bg-brand-50/40" : "border-ink-200 hover:border-ink-300",
            ].join(" ")}
            onDragEnter={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={(e) => { e.preventDefault(); setDragActive(false); }}
            onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
            onDrop={onDrop}
          >
            <FileSpreadsheet className="mx-auto h-10 w-10 text-ink-300" />
            <div className="mt-2 text-sm text-ink-700">
              {file
                ? <span><strong>{file.name}</strong> ({(file.size / 1024).toFixed(1)} KB)</span>
                : <span>Drag and drop an Excel file here, or click below to choose</span>}
            </div>
            <div className="mt-3 flex items-center justify-center gap-2">
              <label className="btn-secondary cursor-pointer">
                <Upload className="h-4 w-4" /> {file ? "Replace file" : "Choose file…"}
                <input
                  type="file"
                  accept=".xlsx,.xlsm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  className="hidden"
                  onChange={(e) => chooseFile(e.target.files?.[0] || null)}
                />
              </label>
              {file && (
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => chooseFile(null)}
                >
                  <X className="h-4 w-4" /> Clear
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="label">Sheet name (optional)</label>
              <input
                className="input"
                placeholder="Auto-detect — usually 'EQUIPMENT LIST'"
                value={sheetName}
                onChange={(e) => setSheetName(e.target.value)}
              />
              <p className="mt-1 text-[11px] text-ink-500">
                Leave blank to let the parser pick the sheet with the largest used range.
              </p>
            </div>
            <div>
              <label className="label">Conflict policy (for existing tags)</label>
              <select
                className="input"
                value={mode}
                onChange={(e) => setMode(e.target.value as Mode)}
              >
                <option value="skip_existing">Skip — leave existing rows alone</option>
                <option value="update_existing">Update — patch fields from the Excel row</option>
              </select>
              <p className="mt-1 text-[11px] text-ink-500">
                New rows are always created. This only changes what happens when a
                <code className="mx-1 font-mono">client_tag</code>
                in the file already exists in this project.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              className="btn-primary"
              disabled={!file || busy !== null}
              onClick={runPreview}
            >
              {busy === "preview" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Parse &amp; preview
            </button>
          </div>
        </div>
      </Card>

      {error && <ErrorBox error={{ message: error }} />}

      {preview && (
        <Card>
          <CardHeader
            title="2. Preview"
            subtitle={`Parsed ${preview.total_rows} row(s) from the file. Nothing has been written yet.`}
            action={
              <button
                className="btn-primary"
                disabled={busy !== null || preview.new + preview.existing === 0}
                onClick={runCommit}
              >
                {busy === "commit" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Import {preview.new + (mode === "update_existing" ? preview.existing : 0)} row(s)
              </button>
            }
          />
          <div className="grid grid-cols-2 gap-4 p-5 md:grid-cols-4">
            <Mini label="Total parsed" value={preview.total_rows} />
            <Mini label="New" value={preview.new} tone="green" />
            <Mini label="Existing" value={preview.existing} tone="amber" />
            <Mini label="Invalid" value={preview.invalid} tone="red" />
          </div>

          <div className="border-t border-ink-100 overflow-auto max-h-[60vh]">
            <table className="min-w-full text-sm">
              <thead>
                <tr>
                  <th className="table-th">#</th>
                  <th className="table-th">Client tag</th>
                  <th className="table-th">Description</th>
                  <th className="table-th">Module</th>
                  <th className="table-th">Vendor</th>
                  <th className="table-th">Dry / Ope (MT)</th>
                  <th className="table-th">Status</th>
                </tr>
              </thead>
              <tbody>
                {preview.preview.map((r) => (
                  <tr key={r.row_number} className="table-row-hover">
                    <td className="table-td text-xs text-ink-500">{r.row_number}</td>
                    <td className="table-td font-mono">{r.client_tag ?? <span className="text-ink-300">—</span>}</td>
                    <td className="table-td">{f(r, "description")}</td>
                    <td className="table-td">{f(r, "module")}</td>
                    <td className="table-td">{f(r, "vendor")}</td>
                    <td className="table-td tabular-nums">
                      {f(r, "dry_weight_mt")} / {f(r, "operating_weight_mt")}
                    </td>
                    <td className="table-td">
                      {r.status === "new" && <Badge tone="green">new</Badge>}
                      {r.status === "existing" && <Badge tone="amber">existing</Badge>}
                      {r.status === "invalid" && (
                        <span title={r.reason || undefined}>
                          <Badge tone="red">invalid</Badge>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {preview.preview_truncated && (
              <div className="border-t border-ink-100 p-3 text-center text-[11px] text-ink-500">
                Preview limited to first 200 rows — full file will be imported on commit.
              </div>
            )}
          </div>
        </Card>
      )}

      {committed && (
        <Card>
          <CardHeader title="3. Imported" subtitle="The Excel rows have been written to the project." />
          <div className="grid grid-cols-2 gap-4 p-5 md:grid-cols-4">
            <Mini label="Created" value={committed.created ?? 0} tone="green" />
            <Mini label="Updated" value={committed.updated ?? 0} tone="blue" />
            <Mini label="Skipped" value={committed.skipped ?? 0} tone="slate" />
            <Mini label="Errors" value={(committed.errors || []).length} tone="red" />
          </div>
          {committed.errors && committed.errors.length > 0 && (
            <div className="border-t border-ink-100 p-5">
              <div className="mb-2 text-xs font-medium text-rose-700">Error details</div>
              <ul className="space-y-1 text-xs text-rose-700">
                {committed.errors.map((e, i) => (
                  <li key={i}>
                    Row {e.row_number} — <span className="font-mono">{e.tag}</span>: {e.error}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="border-t border-ink-100 p-4 text-right">
            <button
              className="btn-primary"
              onClick={() => router.push(`/projects/${projectId}/equipment`)}
            >
              <Check className="h-4 w-4" /> Go to equipment list
            </button>
          </div>
        </Card>
      )}
    </main>
  );
}

function f(row: PreviewRow, key: string): React.ReactNode {
  const v = row.fields?.[key];
  if (v == null || v === "") return <span className="text-ink-300">—</span>;
  return <span className="line-clamp-1">{String(v)}</span>;
}

function Mini({
  label, value, tone,
}: { label: string; value: number | string; tone?: "green" | "amber" | "red" | "blue" | "slate" }) {
  const ring =
    tone === "green" ? "text-emerald-700" :
    tone === "amber" ? "text-amber-700" :
    tone === "red"   ? "text-rose-700"   :
    tone === "blue"  ? "text-brand-700"  : "text-ink-800";
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-ink-400">{label}</div>
      <div className={`mt-0.5 text-2xl font-semibold tabular-nums ${ring}`}>{value}</div>
    </div>
  );
}
