"use client";
import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import useSWR from "swr";
import { Layers } from "lucide-react";

import { Badge, Card, CardHeader, ErrorBox, Spinner } from "@/components/ui";
import { Pagination, usePagination, type Paged } from "@/components/Pagination";
import { fetcher } from "@/lib/api";
import type { Equipment } from "@/lib/types";

export default function VersionsOverview() {
  const params = useParams();
  const id = Number(Array.isArray(params?.id) ? params.id[0] : params?.id);

  const wsParam = params?.workspace;
  const wsRaw = Array.isArray(wsParam) ? wsParam[0] : wsParam;
  const workspace: "topside" | "marine" = wsRaw === "marine" ? "marine" : "topside";

  const { limit, offset, setLimit, setOffset, qs } = usePagination(50);

  // Sorted by version count server-side now — no client-side sort/slice
  // needed, the API returns exactly the page we ask for in that order.
  const { data: page, error, isLoading } = useSWR<Paged<Equipment>>(
    `/projects/${id}/equipment?workspace=${workspace}&sort_by=current_version&sort_dir=desc&${qs}`,
    fetcher
  );
  const data = page?.items;

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
          <CardHeader title={`${page?.total ?? data.length} equipment items`} action={<div className="text-xs text-ink-500"><Layers className="mr-1 inline h-3 w-3" /> sorted by version count</div>} />
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
                {data.map((e) => (
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
          <Pagination
            total={page?.total ?? 0}
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
