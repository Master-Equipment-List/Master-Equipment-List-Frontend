"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { notFound } from "next/navigation";
import useSWR from "swr";
import { ChevronLeft, Ship, Wrench } from "lucide-react";

import { WorkspaceTabs } from "@/components/WorkspaceTabs";
import { Badge } from "@/components/ui";
import { fetcher } from "@/lib/api";
import type { Project } from "@/lib/types";

type Workspace = "topside" | "marine";

/**
 * Workspace-scoped layout.
 *
 * Mounts under `/projects/[id]/[workspace]/...`. Adds the workspace
 * badge + tab bar that's specific to one chosen MEL. The parent
 * `/projects/[id]/layout.tsx` renders the project header above this.
 *
 * If the `workspace` path segment is anything other than "topside" or
 * "marine" (e.g. an old `/projects/2/equipment` URL that someone
 * bookmarked before the refactor — "equipment" would route here as
 * workspace="equipment") we render a 404 instead of pretending it's a
 * valid workspace.
 */
export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const idParam = params?.id;
  const wsParam = params?.workspace;
  const id = Number(Array.isArray(idParam) ? idParam[0] : idParam);
  const workspaceRaw = Array.isArray(wsParam) ? wsParam[0] : wsParam;
  if (workspaceRaw !== "topside" && workspaceRaw !== "marine") {
    notFound();
  }
  const workspace = workspaceRaw as Workspace;

  const { data: project } = useSWR<Project>(
    Number.isFinite(id) ? `/projects/${id}` : null,
    fetcher,
  );

  return (
    <>
      {/* Workspace strip: a thin row between the project header (rendered
          by the parent layout) and the workspace tabs. Carries the
          "back to workspaces" link + the workspace badge so users always
          know which MEL they're looking at. */}
      <div className="border-b border-ink-100 bg-white">
        <div className="mx-auto flex w-full max-w-[1400px] items-center gap-3 px-6 py-2">
          <Link
            href={`/projects/${id}`}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-ink-600 hover:bg-ink-50"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Workspaces
          </Link>
          <span className="text-ink-200">·</span>
          <Badge tone={workspace === "topside" ? "blue" : "violet"}>
            <span className="inline-flex items-center gap-1">
              {workspace === "topside" ? <Wrench className="h-3 w-3" /> : <Ship className="h-3 w-3" />}
              {workspace === "topside" ? "Topsides" : "Marine"}
            </span>
          </Badge>
          {project && (
            <span className="ml-1 truncate text-xs text-ink-500">
              {project.name}
            </span>
          )}
        </div>
        {Number.isFinite(id) && (
          <WorkspaceTabs projectId={id} workspace={workspace} />
        )}
      </div>

      {/* Padded content area. Sits below the workspace strip, on the
          slate body background (the strip itself is white). */}
      <main className="mx-auto w-full max-w-[1400px] px-6 py-6">
        {children}
      </main>
    </>
  );
}
