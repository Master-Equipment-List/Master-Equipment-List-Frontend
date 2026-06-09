"use client";
import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import useSWR from "swr";
import { Download, Loader2, Plus, Upload } from "lucide-react";

import { EquipmentTable } from "@/components/EquipmentTable";
import { Badge, ErrorBox, Spinner } from "@/components/ui";
import { apiBase, fetcher } from "@/lib/api";
import type { Equipment } from "@/lib/types";

export default function EquipmentListPage() {
  const params = useParams();
  const id = Number(Array.isArray(params?.id) ? params.id[0] : params?.id);

  // workspace lives in the URL PATH now (/projects/[id]/[workspace]/...).
  // The parent `[workspace]/layout.tsx` already validated the segment, so
  // here we just narrow the param's type for TypeScript.
  const wsParam = params?.workspace;
  const wsRaw = Array.isArray(wsParam) ? wsParam[0] : wsParam;
  const workspace: "topside" | "marine" = wsRaw === "marine" ? "marine" : "topside";

  const { data, error, isLoading } = useSWR<Equipment[]>(
    `/projects/${id}/equipment?limit=5000&workspace=${workspace}`,
    fetcher,
  );

  // The IDs of rows the EquipmentTable is currently showing AFTER its
  // filters (search text, "Updated", "Version"). Lifted up so the Excel
  // button below downloads exactly what the table is showing, not the
  // full unfiltered dataset.
  const [filteredIds, setFilteredIds] = React.useState<number[]>([]);
  // Excel-button loading + error state. The export takes 1-3s on small
  // projects and up to ~10s on 1000-row exports, so the button needs to
  // visibly reflect the in-flight state.
  const [exporting, setExporting] = React.useState(false);
  const [exportErr, setExportErr] = React.useState<string | null>(null);

  // Treat "no filter applied" as the full set — in that case we skip
  // sending the `ids` body so the server returns everything. This also
  // gives the right behaviour when the table is still loading (rows
  // undefined → filteredIds [] → don't restrict).
  const isFiltering =
    !!data && filteredIds.length > 0 && filteredIds.length < data.length;

  async function downloadExcel() {
    setExporting(true);
    setExportErr(null);
    try {
      const access =
        typeof window !== "undefined" ? window.localStorage.getItem("mel.access_token") : null;
      const res = await fetch(
        `${apiBase()}/projects/${id}/export/excel?workspace=${workspace}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(access ? { Authorization: `Bearer ${access}` } : {}),
          },
          // When the user has a filter active, send the visible row IDs
          // so the export matches what they see. Otherwise send an
          // empty body and the server exports the whole workspace.
          body: JSON.stringify(isFiltering ? { ids: filteredIds } : {}),
        },
      );
      if (!res.ok) throw new Error(`Export failed (${res.status})`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `project_${id}_${workspace}_equipment_list.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setExportErr(e instanceof Error ? e.message : String(e));
    } finally {
      setExporting(false);
    }
  }

  // Button label changes when a filter is active so the user knows
  // they're downloading the filtered subset, not the whole list.
  const exportLabel = exporting
    ? "Exporting…"
    : isFiltering
    ? `Excel (${filteredIds.length})`
    : "Excel";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-ink-900">Equipment</h2>
            <Badge tone={workspace === "marine" ? "violet" : "blue"}>
              {workspace === "marine" ? "Marine" : "Topsides"}
            </Badge>
          </div>
          <p className="text-xs text-ink-500">
            Showing the <strong>{workspace === "marine" ? "Marine" : "Topsides"}</strong> MEL for this project — searchable, sortable, exportable.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="btn-secondary"
            onClick={downloadExcel}
            disabled={exporting || !data}
            title={
              isFiltering
                ? `Download the ${filteredIds.length} filtered row(s) as Excel`
                : "Download all equipment as Excel"
            }
          >
            {exporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {exportLabel}
          </button>
          <Link className="btn-secondary" href={`/projects/${id}/${workspace}/equipment/import`}>
            <Upload className="h-4 w-4" /> Import Excel
          </Link>
          <Link className="btn-primary" href={`/projects/${id}/${workspace}/equipment/new`}>
            <Plus className="h-4 w-4" /> Add Equipment
          </Link>
        </div>
      </div>

      {exportErr && <ErrorBox error={{ message: exportErr }} />}

      {isLoading && (
        <div className="grid place-items-center py-20"><Spinner className="h-6 w-6" /></div>
      )}
      {error && <ErrorBox error={error} />}
      {data && (
        <EquipmentTable
          projectId={id}
          rows={data}
          workspace={workspace}
          onFilteredIdsChange={setFilteredIds}
        />
      )}
    </div>
  );
}
