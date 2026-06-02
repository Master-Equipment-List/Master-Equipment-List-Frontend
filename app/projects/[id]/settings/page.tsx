"use client";
import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import useSWR, { useSWRConfig } from "swr";
import { Save, Trash2 } from "lucide-react";

import { Card, CardHeader, ErrorBox, Field, Spinner } from "@/components/ui";
import { api, fetcher } from "@/lib/api";
import type { Project } from "@/lib/types";

export default function SettingsPage() {
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
  const [drivePath, setDrivePath] = React.useState("");
  const [driveItem, setDriveItem] = React.useState("");
  const [driveId, setDriveId] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [saveErr, setSaveErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!project) return;
    setName(project.name);
    setDescription(project.description || "");
    setClient(project.client || "");
    setFacility(project.facility || "");
    setLocation(project.location || "");
    setDrivePath(project.onedrive_root_path || "");
    setDriveItem(project.onedrive_root_item_id || "");
    setDriveId(project.onedrive_drive_id || "");
  }, [project]);

  async function save() {
    setSaving(true);
    setSaveErr(null);
    try {
      await api.patch<Project>(`/projects/${id}`, {
        name,
        description: description || null,
        client: client || null,
        facility: facility || null,
        location: location || null,
        onedrive_root_path: drivePath || null,
        onedrive_root_item_id: driveItem || null,
        onedrive_drive_id: driveId || null
      });
      mutate(`/projects/${id}`);
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function deleteProject() {
    if (!confirm("Delete this project? This will remove all equipment, files, and versions.")) return;
    try {
      await api.delete(`/projects/${id}`);
      router.replace("/projects");
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    }
  }

  if (error) return <ErrorBox error={error} />;
  if (!project) return <Spinner />;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title="Project settings" subtitle="Update metadata and OneDrive folder binding." />
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
          <Field label="Client"><input className="input" value={client} onChange={(e) => setClient(e.target.value)} /></Field>
          <Field label="Facility"><input className="input" value={facility} onChange={(e) => setFacility(e.target.value)} /></Field>
          <Field label="Location"><input className="input" value={location} onChange={(e) => setLocation(e.target.value)} /></Field>
        </div>
        <div className="border-t border-ink-100 p-5">
          <h4 className="mb-3 text-sm font-semibold text-ink-800">OneDrive binding</h4>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <Field label="Root path" hint="Sync is restricted to this subtree.">
                <input className="input font-mono text-xs" value={drivePath} onChange={(e) => setDrivePath(e.target.value)} />
              </Field>
            </div>
            <Field label="Root item id">
              <input className="input font-mono text-xs" value={driveItem} onChange={(e) => setDriveItem(e.target.value)} />
            </Field>
            <Field label="Drive id">
              <input className="input font-mono text-xs" value={driveId} onChange={(e) => setDriveId(e.target.value)} />
            </Field>
          </div>
        </div>

        {saveErr && <div className="px-5 pb-3"><ErrorBox error={{ message: saveErr }} /></div>}

        <div className="flex items-center justify-end gap-2 border-t border-ink-100 p-4">
          <button className="btn-primary" onClick={save} disabled={saving || !name}>
            {saving && <Spinner className="text-white" />} <Save className="h-4 w-4" /> Save
          </button>
        </div>
      </Card>

      <Card className="border-rose-200">
        <CardHeader title="Danger zone" subtitle="Irreversible actions." />
        <div className="flex items-center justify-between gap-3 p-5">
          <div>
            <div className="text-sm font-medium text-ink-800">Delete this project</div>
            <div className="text-xs text-ink-500">Removes the project, all equipment, files, versions, and audit history.</div>
          </div>
          <button className="btn-danger" onClick={deleteProject}>
            <Trash2 className="h-4 w-4" /> Delete project
          </button>
        </div>
      </Card>
    </div>
  );
}
