"use client";
import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import useSWR from "swr";
import { ArrowLeft, FileText } from "lucide-react";

import { Badge, Card, CardHeader, ErrorBox, Spinner } from "@/components/ui";
import { fetcher } from "@/lib/api";
import type { FileExtraction, ProjectFile } from "@/lib/types";

export default function FileDetailPage() {
  const params = useParams();
  const projectId = Number(Array.isArray(params?.id) ? params.id[0] : params?.id);
  const fileId = Number(Array.isArray(params?.fileId) ? params.fileId[0] : params?.fileId);

  const { data: file, error: fErr } = useSWR<ProjectFile & { extractions?: FileExtraction[] }>(
    `/projects/${projectId}/files/${fileId}`,
    fetcher
  );
  const { data: extraction } = useSWR<FileExtraction>(
    `/projects/${projectId}/files/${fileId}/data`,
    fetcher
  );

  const [tab, setTab] = React.useState<"summary" | "text" | "tables" | "raw">("summary");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Link className="btn-ghost px-2" href={`/projects/${projectId}/files`}>
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
