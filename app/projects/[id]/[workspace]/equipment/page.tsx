"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import useSWR from "swr";
import { Download, Plus, Upload } from "lucide-react";

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

  function downloadExcel() {
    const access =
      typeof window !== "undefined" ? window.localStorage.getItem("mel.access_token") : null;
    fetch(`${apiBase()}/projects/${id}/export/excel?workspace=${workspace}`, {
      headers: access ? { Authorization: `Bearer ${access}` } : undefined
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Export failed (${res.status})`);
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `project_${id}_${workspace}_equipment_list.xlsx`;
        a.click();
        URL.revokeObjectURL(url);
      })
      .catch((e) => alert(e.message));
  }

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
          <button className="btn-secondary" onClick={downloadExcel}>
            <Download className="h-4 w-4" /> Excel
          </button>
          <Link className="btn-secondary" href={`/projects/${id}/${workspace}/equipment/import`}>
            <Upload className="h-4 w-4" /> Import Excel
          </Link>
          <Link className="btn-primary" href={`/projects/${id}/${workspace}/equipment/new`}>
            <Plus className="h-4 w-4" /> Add Equipment
          </Link>
        </div>
      </div>

      {isLoading && (
        <div className="grid place-items-center py-20"><Spinner className="h-6 w-6" /></div>
      )}
      {error && <ErrorBox error={error} />}
      {data && <EquipmentTable projectId={id} rows={data} workspace={workspace} />}
    </div>
  );
}
