"use client";
import Link from "next/link";
import useSWR from "swr";
import { Cloud, MapPin, Plus, Ship, Wrench } from "lucide-react";

import { Badge, Card, EmptyState, ErrorBox, Spinner } from "@/components/ui";
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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((p) => (
            <Link key={p.id} href={`/projects/${p.id}`}>
              <Card className="h-full transition hover:border-brand-300 hover:shadow-md">
                <div className="flex items-start justify-between px-5 pt-5">
                  <div className="flex items-center gap-2">
                    {p.project_type === "topside" ? (
                      <Wrench className="h-4 w-4 text-brand-600" />
                    ) : (
                      <Ship className="h-4 w-4 text-brand-600" />
                    )}
                    <Badge tone={p.project_type === "topside" ? "blue" : "violet"}>
                      {p.project_type}
                    </Badge>
                  </div>
                  {p.code && (
                    <div className="font-mono text-[11px] uppercase tracking-wide text-ink-400">
                      {p.code}
                    </div>
                  )}
                </div>

                <div className="px-5 pb-5 pt-3">
                  <h3 className="text-sm font-semibold text-ink-900">{p.name}</h3>
                  {p.description && (
                    <p className="mt-1 line-clamp-2 text-xs text-ink-500">{p.description}</p>
                  )}
                  <div className="mt-4 space-y-1.5 text-xs text-ink-600">
                    {p.client && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-ink-400">Client:</span>
                        <span className="font-medium">{p.client}</span>
                      </div>
                    )}
                    {p.facility && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-ink-400">Facility:</span>
                        <span className="font-medium">{p.facility}</span>
                      </div>
                    )}
                    {p.location && (
                      <div className="flex items-center gap-1.5">
                        <MapPin className="h-3 w-3 text-ink-400" />
                        <span>{p.location}</span>
                      </div>
                    )}
                    {p.onedrive_root_path && (
                      <div className="flex items-center gap-1.5">
                        <Cloud className="h-3 w-3 text-ink-400" />
                        <span className="truncate font-mono text-[11px]">{p.onedrive_root_path}</span>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
