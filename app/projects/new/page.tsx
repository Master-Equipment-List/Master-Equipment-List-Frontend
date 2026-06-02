"use client";
import * as React from "react";
import { useRouter } from "next/navigation";

import { Card, CardHeader, ErrorBox, Field, Spinner } from "@/components/ui";
import { api } from "@/lib/api";
import { RequireAuth } from "@/lib/auth";
import type { Project } from "@/lib/types";

// The backend Project model still requires a project_type enum value, so
// every new project is implicitly created as "topside" (the only flavor
// the UI exposes). If we ever bring the picker back, just turn this back
// into a useState<ProjectType>.
const DEFAULT_PROJECT_TYPE = "topside" as const;

export default function NewProjectPage() {
  return (
    <RequireAuth>
      <Inner />
    </RequireAuth>
  );
}

function Inner() {
  const router = useRouter();
  const [name, setName] = React.useState("");
  const [code, setCode] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [client, setClient] = React.useState("");
  const [facility, setFacility] = React.useState("");
  const [location, setLocation] = React.useState("");
  const [drivePath, setDrivePath] = React.useState("");
  const [driveItem, setDriveItem] = React.useState("");
  const [driveId, setDriveId] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const created = await api.post<Project>("/projects", {
        name,
        project_type: DEFAULT_PROJECT_TYPE,
        code: code || null,
        description: description || null,
        client: client || null,
        facility: facility || null,
        location: location || null,
        onedrive_root_path: drivePath || null,
        onedrive_root_item_id: driveItem || null,
        onedrive_drive_id: driveId || null
      });
      router.replace(`/projects/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-8">
      <h1 className="text-xl font-semibold text-ink-900">New project</h1>
      <p className="mt-1 text-sm text-ink-500">
        Create a project and point it at the OneDrive folder you want to sync.
      </p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <Card>
          <CardHeader title="Basics" subtitle="Required fields are shown with *" />
          <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2">
            <Field label="Name *">
              <input className="input" required value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="Project code">
              <input className="input" value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. 20171-SPOG" />
            </Field>
            <div className="md:col-span-2">
              <Field label="Description">
                <textarea
                  className="input min-h-[80px]"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </Field>
            </div>
            <Field label="Client">
              <input className="input" value={client} onChange={(e) => setClient(e.target.value)} placeholder="ONGC, PTTEP…" />
            </Field>
            <Field label="Facility">
              <input className="input" value={facility} onChange={(e) => setFacility(e.target.value)} placeholder="FPSO A1, Kikeh FPSO…" />
            </Field>
            <Field label="Location" hint="Typically comes from FPSO GA — e.g. INDIA, MALAYSIA.">
              <input className="input" value={location} onChange={(e) => setLocation(e.target.value)} />
            </Field>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="OneDrive folder"
            subtitle="Restrict sync to a specific subtree. The app cannot browse outside this root."
          />
          <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2">
            <div className="md:col-span-2">
              <Field
                label="OneDrive root path"
                hint='e.g. "/Documents/Topside-20171" — used to look up the folder by path on first browse.'
              >
                <input className="input font-mono text-xs" value={drivePath} onChange={(e) => setDrivePath(e.target.value)} placeholder="/Documents/Project-XYZ" />
              </Field>
            </div>
            <Field label="OneDrive root item id (optional)" hint="If you already know the item id, paste it here.">
              <input className="input font-mono text-xs" value={driveItem} onChange={(e) => setDriveItem(e.target.value)} />
            </Field>
            <Field label="Drive id (optional)" hint="Leave blank for the connected account's default drive.">
              <input className="input font-mono text-xs" value={driveId} onChange={(e) => setDriveId(e.target.value)} />
            </Field>
          </div>
        </Card>

        {error && <ErrorBox error={{ message: error }} />}

        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={() => router.back()}>Cancel</button>
          <button className="btn-primary" type="submit" disabled={submitting || !name}>
            {submitting && <Spinner className="text-white" />}
            Create project
          </button>
        </div>
      </form>
    </main>
  );
}

