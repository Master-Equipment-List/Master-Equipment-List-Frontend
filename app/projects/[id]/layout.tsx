"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import useSWR from "swr";
import { ChevronLeft } from "lucide-react";

import { ErrorBox, Spinner } from "@/components/ui";
import { fetcher } from "@/lib/api";
import { RequireAuth } from "@/lib/auth";
import type { Project } from "@/lib/types";

/**
 * Project-level layout.
 *
 * This layout wraps EVERYTHING under /projects/[id], including the
 * workspace picker (`/projects/[id]`) and every workspace-scoped page
 * (`/projects/[id]/[workspace]/...`). It deliberately renders only the
 * project header + "back to projects" link — the workspace tab bar and
 * the workspace badge live in `[workspace]/layout.tsx` so they only
 * appear once the user has actually picked a workspace.
 *
 * This separation is what makes back-navigation natural:
 *   /projects/2/marine/equipment/2553
 *     → /projects/2/marine/equipment   (workspace layout still wraps this)
 *     → /projects/2/marine              (workspace layout still wraps this)
 *     → /projects/2                     (workspace picker, NO tabs)
 *     → /projects                       (project list)
 */
export default function ProjectLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <Inner>{children}</Inner>
    </RequireAuth>
  );
}

function Inner({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const idParam = params?.id;
  const projectId = Array.isArray(idParam) ? idParam[0] : idParam;
  const id = Number(projectId);
  const { data: project, error, isLoading } = useSWR<Project>(
    Number.isFinite(id) ? `/projects/${id}` : null,
    fetcher,
  );

  return (
    <>
      <div className="border-b border-ink-100 bg-white">
        <div className="mx-auto flex w-full max-w-[1400px] items-center justify-between gap-4 px-6 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/projects" className="btn-ghost px-2 py-1">
              <ChevronLeft className="h-4 w-4" />
            </Link>
            {isLoading && <Spinner />}
            {project && (
              <div className="min-w-0">
                <h2 className="truncate text-base font-semibold text-ink-900">{project.name}</h2>
                <div className="mt-0.5 flex items-center gap-3 text-[11px] text-ink-500">
                  {project.code && <span className="font-mono uppercase tracking-wider">{project.code}</span>}
                  {project.client && <span>{project.client}</span>}
                  {project.facility && <span>· {project.facility}</span>}
                  {project.location && <span>· {project.location}</span>}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {error && (
        <main className="mx-auto w-full max-w-[1400px] px-6 py-6">
          <ErrorBox error={error} />
        </main>
      )}

      {/* No outer <main> here: each route below renders its OWN main with
          appropriate padding. The picker (app/projects/[id]/page.tsx)
          and the workspace layout (app/projects/[id]/[workspace]/layout.tsx)
          each wrap their content in <main>. Putting one here would
          push the workspace strip (tabs + badge) inwards, breaking the
          flush-bar look. */}
      {children}
    </>
  );
}
