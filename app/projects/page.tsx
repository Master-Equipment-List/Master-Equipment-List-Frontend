"use client";
import Link from "next/link";
import useSWR from "swr";
import { Cloud, MapPin, Plus, Ship, Wrench } from "lucide-react";

import { EmptyState, ErrorBox, Spinner } from "@/components/ui";
import { cn } from "@/lib/cn";
import { fetcher } from "@/lib/api";
import { RequireAuth } from "@/lib/auth";
import type { Project } from "@/lib/types";

export default function ProjectsPage() {
  return (
    <RequireAuth>
      <Page />
    </RequireAuth>
  );
}

function Page() {
  const { data, error, isLoading } = useSWR<Project[]>("/projects", fetcher);

  return (
    <main className="mx-auto w-full max-w-[1400px] px-6 py-6">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-ink-900">Projects</h1>
          <p className="text-sm text-ink-500">
            All Topside &amp; Marine MEL projects you have access to.
          </p>
        </div>
        <Link className="btn-primary" href="/projects/new">
          <Plus className="h-4 w-4" /> New Project
        </Link>
      </header>

      {isLoading && (
        <div className="grid place-items-center py-16">
          <Spinner className="h-6 w-6" />
        </div>
      )}
      {error && <ErrorBox error={error} />}

      {data && data.length === 0 && (
        <EmptyState
          title="No projects yet"
          body="Create your first Topside or Marine project. You'll then point it at a OneDrive folder, pick the files to sync, and the system will extract the equipment list."
          action={
            <Link className="btn-primary" href="/projects/new">
              <Plus className="h-4 w-4" /> Create Project
            </Link>
          }
        />
      )}

      {data && data.length > 0 && (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((p, i) => (
            <ProjectCard key={p.id} project={p} accentIndex={i} />
          ))}
        </div>
      )}
    </main>
  );
}

// One accent identity per project — cycled by grid position so the same
// project always lands on the same color (stable across reloads), and
// neighbors in the grid rarely repeat. Purely decorative: never used to
// convey status/meaning, so it's safe to be arbitrary.
const ACCENTS = [
  { bar: "from-brand-400 to-brand-600",   glow: "group-hover:shadow-brand-200/60",   avatar: "bg-brand-50 text-brand-700 ring-brand-200" },
  { bar: "from-violet-400 to-violet-600", glow: "group-hover:shadow-violet-200/60", avatar: "bg-violet-50 text-violet-700 ring-violet-200" },
  { bar: "from-emerald-400 to-emerald-600", glow: "group-hover:shadow-emerald-200/60", avatar: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  { bar: "from-amber-400 to-amber-600",   glow: "group-hover:shadow-amber-200/60",   avatar: "bg-amber-50 text-amber-700 ring-amber-200" },
  { bar: "from-rose-400 to-rose-600",     glow: "group-hover:shadow-rose-200/60",     avatar: "bg-rose-50 text-rose-700 ring-rose-200" },
  { bar: "from-cyan-400 to-cyan-600",     glow: "group-hover:shadow-cyan-200/60",     avatar: "bg-cyan-50 text-cyan-700 ring-cyan-200" },
];

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

function ProjectCard({ project: p, accentIndex }: { project: Project; accentIndex: number }) {
  const accent = ACCENTS[accentIndex % ACCENTS.length];

  // A project now potentially hosts BOTH workspaces. A workspace counts as
  // "ready" once it has an OneDrive root configured. The old single
  // `project_type` column is irrelevant in the new flow.
  const topsideReady = !!(
    p.topside_onedrive_root_path ||
    p.topside_onedrive_root_item_id ||
    p.onedrive_root_path ||       // legacy single-root fallback
    p.onedrive_root_item_id
  );
  const marineReady = !!(p.marine_onedrive_root_path || p.marine_onedrive_root_item_id);

  const topsidePath = p.topside_onedrive_root_path || (!p.marine_onedrive_root_path ? p.onedrive_root_path : null);

  return (
    <Link href={`/projects/${p.id}`} className="group block h-full">
      <div
        className={cn(
          "relative flex h-full flex-col overflow-hidden rounded-xl border border-ink-100 bg-white shadow-card",
          "transition-all duration-200 ease-out",
          "group-hover:-translate-y-0.5 group-hover:border-transparent group-hover:shadow-lg",
          accent.glow,
        )}
      >
        {/* Accent top bar — the card's one splash of color/personality. */}
        <div className={cn("h-1.5 w-full bg-gradient-to-r", accent.bar)} />

        <div className="flex items-start justify-between gap-2 px-5 pt-4">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-bold ring-1",
                accent.avatar,
              )}
            >
              {initials(p.name)}
            </div>
            <div className="min-w-0">
              <h3 className="truncate text-sm font-semibold text-ink-900">{p.name}</h3>
              {p.code && (
                <div className="font-mono text-[10px] uppercase tracking-wider text-ink-400">
                  {p.code}
                </div>
              )}
            </div>
          </div>

          {/* Workspace readiness — compact icon chips instead of full
              pill labels, colored when configured, outlined when not. */}
          <div className="flex shrink-0 items-center gap-1">
            <span
              title={topsideReady ? "Topsides workspace is configured" : "Topsides workspace not configured yet"}
              className={cn(
                "grid h-6 w-6 place-items-center rounded-full ring-1",
                topsideReady ? "bg-brand-50 text-brand-600 ring-brand-200" : "text-ink-300 ring-ink-200",
              )}
            >
              <Wrench className="h-3 w-3" />
            </span>
            <span
              title={marineReady ? "Marine workspace is configured" : "Marine workspace not configured yet"}
              className={cn(
                "grid h-6 w-6 place-items-center rounded-full ring-1",
                marineReady ? "bg-violet-50 text-violet-600 ring-violet-200" : "text-ink-300 ring-ink-200",
              )}
            >
              <Ship className="h-3 w-3" />
            </span>
          </div>
        </div>

        <div className="flex flex-1 flex-col px-5 pb-5 pt-3">
          {p.description && (
            <p className="line-clamp-2 text-xs text-ink-500">{p.description}</p>
          )}

          <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
            {p.client && (
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-wide text-ink-400">Client</div>
                <div className="truncate font-medium text-ink-700">{p.client}</div>
              </div>
            )}
            {p.facility && (
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-wide text-ink-400">Facility</div>
                <div className="truncate font-medium text-ink-700">{p.facility}</div>
              </div>
            )}
          </div>

          {p.location && (
            <div className="mt-1.5 flex items-center gap-1.5 text-xs text-ink-500">
              <MapPin className="h-3 w-3 text-ink-400" />
              {p.location}
            </div>
          )}

          {/* OneDrive roots — pushed to the bottom of the card as a
              distinct "connected source" strip. */}
          {(topsidePath || p.marine_onedrive_root_path) && (
            <div className="mt-auto space-y-1 pt-3">
              {topsidePath && (
                <div
                  className="flex items-center gap-1.5 rounded-md bg-ink-50 px-2 py-1 text-[11px] text-ink-500"
                  title="Topsides OneDrive root"
                >
                  <Cloud className="h-3 w-3 shrink-0 text-brand-400" />
                  <span className="truncate font-mono">{topsidePath}</span>
                </div>
              )}
              {p.marine_onedrive_root_path && (
                <div
                  className="flex items-center gap-1.5 rounded-md bg-ink-50 px-2 py-1 text-[11px] text-ink-500"
                  title="Marine OneDrive root"
                >
                  <Cloud className="h-3 w-3 shrink-0 text-violet-400" />
                  <span className="truncate font-mono">{p.marine_onedrive_root_path}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
