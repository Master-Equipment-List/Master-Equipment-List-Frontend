"use client";
import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import useSWR, { useSWRConfig } from "swr";
import { ArrowLeft, Save, Trash2 } from "lucide-react";

import { Card, CardHeader, ErrorBox, Field, Spinner } from "@/components/ui";
import { api, fetcher } from "@/lib/api";
import type { Project } from "@/lib/types";

/**
 * Project-wide settings.
 *
 * Lives at `/projects/[id]/settings` — OUTSIDE the workspace segment.
 * The fields edited here (name, description, client, facility, location,
 * delete-project) apply to the whole project, NOT to Topsides or Marine
 * individually. Per-workspace OneDrive bindings are configured on each
 * workspace's OneDrive page (`/projects/[id]/[workspace]/onedrive`) when
 * the user picks a folder — there's no reason to expose the raw IDs here.
 */
export default function ProjectSettingsPage() {
  const params = useParams();
  const router = useRouter();
  const id = Number(Array.isArray(params?.id) ? params.id[0] : params?.id);
  const { mutate } = useSWRConfig();

  const { data: project, error } = useSWR<Project>(`/projects/${id}`, fetcher);

  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [client, setClient] = React.useState("");
  const [facility, setFacility] = React.useState("");
  const [location, setLocation] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [saveErr, setSaveErr] = React.useState<string | null>(null);
  const [saveMsg, setSaveMsg] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!project) return;
    setName(project.name);
    setDescription(project.description || "");
    setClient(project.client || "");
    setFacility(project.facility || "");
    setLocation(project.location || "");
  }, [project]);

  async function save() {
    setSaving(true);
    setSaveErr(null);
    setSaveMsg(null);
    try {
      await api.patch<Project>(`/projects/${id}`, {
        name,
        description: description || null,
        client: client || null,
        facility: facility || null,
        location: location || null,
      });
      mutate(`/projects/${id}`);
      setSaveMsg("Saved.");
      setTimeout(() => setSaveMsg(null), 3000);
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function deleteProject() {
    if (!confirm("Delete this project? This removes both workspaces' equipment, files, versions, and audit history. This cannot be undone.")) return;
    try {
      await api.delete(`/projects/${id}`);
      router.replace("/projects");
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    }
  }

  if (error) {
    return (
      <main className="mx-auto w-full max-w-[1400px] px-6 py-6">
        <ErrorBox error={error} />
      </main>
    );
  }
  if (!project) {
    return (
      <main className="mx-auto w-full max-w-[1400px] px-6 py-6">
        <Spinner />
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-[1400px] space-y-4 px-6 py-6">
      <Link
        href={`/projects/${id}`}
        className="inline-flex items-center gap-1 text-xs text-ink-600 hover:underline"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to workspaces
      </Link>

      <div>
        <h1 className="text-xl font-semibold text-ink-900">Project settings</h1>
        <p className="mt-1 text-xs text-ink-500">
          These apply to the whole project — both Topsides and Marine workspaces share
          this metadata. To change a workspace&apos;s OneDrive folder, open its OneDrive tab.
        </p>
      </div>

      <Card>
        <CardHeader
          title="Metadata"
          subtitle="Display name, codes, and contact information."
        />
        <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2">
          <Field label="Name *">
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
          </Field>
          <Field label="Code (read-only)">
            <input className="input bg-ink-50" value={project.code || ""} readOnly />
          </Field>
          <div className="md:col-span-2">
            <Field label="Description">
              <textarea className="input min-h-[80px]" value={description} onChange={(e) => setDescription(e.target.value)} />
            </Field>
          </div>
          <Field label="Client">
            <input className="input" value={client} onChange={(e) => setClient(e.target.value)} />
          </Field>
          <Field label="Facility">
            <input className="input" value={facility} onChange={(e) => setFacility(e.target.value)} />
          </Field>
          <Field label="Location">
            <input className="input" value={location} onChange={(e) => setLocation(e.target.value)} />
          </Field>
        </div>

        {saveErr && (
          <div className="px-5 pb-3">
            <ErrorBox error={{ message: saveErr }} />
          </div>
        )}
        {saveMsg && (
          <div className="border-t border-emerald-100 bg-emerald-50 px-5 py-2 text-xs text-emerald-800">
            {saveMsg}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 border-t border-ink-100 p-4">
          <button className="btn-primary" onClick={save} disabled={saving || !name}>
            {saving && <Spinner className="text-white" />} <Save className="h-4 w-4" /> Save
          </button>
        </div>
      </Card>

      <Card className="border-rose-200">
        <CardHeader title="Danger zone" subtitle="Irreversible actions." />
        <div className="flex flex-wrap items-center justify-between gap-3 p-5">
          <div>
            <div className="text-sm font-medium text-ink-800">Delete this project</div>
            <div className="text-xs text-ink-500">
              Removes the project, all equipment from BOTH workspaces (Topsides + Marine), every
              synced file, every version snapshot, and the audit history. Cannot be undone.
            </div>
          </div>
          <button className="btn-danger" onClick={deleteProject}>
            <Trash2 className="h-4 w-4" /> Delete project
          </button>
        </div>
      </Card>
    </main>
  );
}
