"use client";
import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import useSWR from "swr";
import { ArrowRight, CheckCircle2, Cloud, Ship, Wrench } from "lucide-react";

import { fetcher } from "@/lib/api";
import type { Project } from "@/lib/types";

/**
 * Workspace picker — the landing page when entering a project.
 *
 * Users must pick "Topsides" or "Marine" before they see the actual
 * MEL. Both workspaces live under one project shell but each has its
 * own OneDrive folder, equipment list, files, and sync state.
 *
 * Picking a card navigates to `/projects/[id]/[workspace]` (path-based,
 * no query strings). That route is wrapped by
 * `app/projects/[id]/[workspace]/layout.tsx`, which is where the
 * workspace badge + tab bar live — so this picker page stays clean of
 * workspace-specific chrome.
 */
export default function ProjectWorkspacePicker() {
  const params = useParams();
  const id = Number(Array.isArray(params?.id) ? params.id[0] : params?.id);
  const { data: project } = useSWR<Project>(
    Number.isFinite(id) ? `/projects/${id}` : null,
    fetcher,
  );

  return (
    <main className="mx-auto w-full max-w-[1400px] space-y-6 px-6 py-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-900">
          {project ? (
            <>
              Welcome to <span className="text-brand-700">{project.name}</span>
            </>
          ) : (
            "Open this project"
          )}
        </h1>
        <p className="mt-1 text-sm text-ink-500">
          Pick the workspace you want to work in. Topsides and Marine each have their own
          OneDrive folder, equipment list, files, and sync — they share only the project shell
          and team.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <WorkspaceCard
          id={id}
          workspace="topside"
          title="Topsides"
          icon={Wrench}
          tone="blue"
          configured={!!(project?.topside_onedrive_root_path || project?.topside_onedrive_root_item_id)}
          description="Process equipment list — flare KO drums, pumps, vessels, heat exchangers, heaters. PFD + P&ID + Vendor Data sync."
          oneDrivePath={project?.topside_onedrive_root_path || null}
        />
        <WorkspaceCard
          id={id}
          workspace="marine"
          title="Marine"
          icon={Ship}
          tone="violet"
          configured={!!(project?.marine_onedrive_root_path || project?.marine_onedrive_root_item_id)}
          description="Marine equipment list — mooring, hull, deck machinery, life-saving. Independent OneDrive folder + sync from Topsides."
          oneDrivePath={project?.marine_onedrive_root_path || null}
        />
      </div>

      <div className="rounded-lg border border-ink-100 bg-white p-4 text-xs text-ink-500">
        <strong className="text-ink-700">Tip:</strong> you can switch workspaces any time
        using the tabs once you&apos;re inside one. To change project-wide settings
        (name, team, OneDrive bindings), use the workspace tabs &rarr; Settings.
      </div>
    </main>
  );
}

function WorkspaceCard({
  id,
  workspace,
  title,
  icon: Icon,
  tone,
  configured,
  description,
  oneDrivePath,
}: {
  id: number;
  workspace: "topside" | "marine";
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: "blue" | "violet";
  configured: boolean;
  description: string;
  oneDrivePath: string | null;
}) {
  const ringColor = tone === "blue" ? "ring-brand-200" : "ring-violet-200";
  const iconBg = tone === "blue" ? "bg-brand-50 text-brand-600" : "bg-violet-50 text-violet-600";

  return (
    <Link
      href={`/projects/${id}/${workspace}`}
      className={`group block rounded-xl border-2 border-ink-100 bg-white p-6 transition hover:shadow-lg hover:border-ink-200 hover:ring-4 ${ringColor}`}
    >
      <div className="flex items-start gap-3">
        <div className={`grid h-10 w-10 place-items-center rounded-lg ${iconBg}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-ink-900">{title}</h3>
            {configured ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                <CheckCircle2 className="h-3 w-3" /> configured
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                needs setup
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-ink-600">{description}</p>
          {oneDrivePath && (
            <div className="mt-2 inline-flex items-center gap-1 rounded bg-ink-50 px-2 py-1 font-mono text-[11px] text-ink-700">
              <Cloud className="h-3 w-3 text-ink-400" /> {oneDrivePath}
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-end text-xs font-medium text-ink-500 transition group-hover:text-brand-700">
        Open {title}
        <ArrowRight className="ml-1 h-3.5 w-3.5" />
      </div>
    </Link>
  );
}
