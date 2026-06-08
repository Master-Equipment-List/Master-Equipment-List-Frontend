"use client";
import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import useSWR from "swr";
import { Layers } from "lucide-react";

import { Badge, Card, CardHeader, ErrorBox, Spinner } from "@/components/ui";
import { fetcher } from "@/lib/api";
import type { Equipment } from "@/lib/types";

export default function VersionsOverview() {
  const params = useParams();
  const id = Number(Array.isArray(params?.id) ? params.id[0] : params?.id);

  const wsParam = params?.workspace;
  const wsRaw = Array.isArray(wsParam) ? wsParam[0] : wsParam;
  const workspace: "topside" | "marine" = wsRaw === "marine" ? "marine" : "topside";

  const { data, error, isLoading } = useSWR<Equipment[]>(
    `/projects/${id}/equipment?limit=5000&workspace=${workspace}`,
    fetcher
  );

  const sorted = React.useMemo(() => {
    if (!data) return [];
    return [...data].sort((a, b) => (b.current_version || 0) - (a.current_version || 0));
  }, [data]);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-ink-900">Versions overview</h2>
        <p className="text-xs text-ink-500">
          Equipment with the most updates — pick a row to see version history and field-level diffs.
        </p>
      </div>

      {isLoading && <Spinner />}
      {error && <ErrorBox error={error} />}

      {data && (
        <Card>
          <CardHeader title={`${data.length} equipment items`} action={<div className="text-xs text-ink-500"><Layers className="mr-1 inline h-3 w-3" /> sorted by version count</div>} />
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr>
                  <th className="table-th">Tag</th>
                  <th className="table-th">Description</th>
                  <th className="table-th">Current version</th>
                  <th className="table-th">Last source</th>
                  <th className="table-th">Updated</th>
                </tr>
              </thead>
              <tbody>
                {sorted.slice(0, 200).map((e) => (
                  <tr key={e.id} className="table-row-hover">
                    <td className="table-td font-mono text-xs">
                      <Link
                        href={`/projects/${id}/${workspace}/equipment/${e.id}`}
                        className="text-brand-700 hover:underline"
                      >
                        {e.client_tag}
                      </Link>
                    </td>
                    <td className="table-td">{e.description}</td>
                    <td className="table-td tabular-nums">v{e.current_version}</td>
                    <td className="table-td">
                      {e.last_source ? <Badge tone={sourceTone(e.last_source)}>{e.last_source}</Badge> : "—"}
                    </td>
                    <td className="table-td text-[11px] text-ink-500">{new Date(e.updated_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

function sourceTone(src: string): "blue" | "amber" | "green" | "violet" | "slate" {
  switch (src) {
    case "pfd": return "amber";
    case "pid": return "blue";
    case "vendor": return "green";
    case "seed": return "slate";
    case "manual": return "blue";
    case "excel": return "violet";
    default: return "slate";
  }
}
