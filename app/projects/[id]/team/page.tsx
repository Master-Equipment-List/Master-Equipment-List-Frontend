"use client";
import * as React from "react";
import { useParams } from "next/navigation";
import useSWR, { useSWRConfig } from "swr";
import { Trash2, UserPlus } from "lucide-react";

import { Badge, Card, CardHeader, ErrorBox, Field, Spinner } from "@/components/ui";
import { api, fetcher } from "@/lib/api";
import type { ProjectMember, ProjectRole, User } from "@/lib/types";

export default function TeamPage() {
  const params = useParams();
  const id = Number(Array.isArray(params?.id) ? params.id[0] : params?.id);
  const { mutate } = useSWRConfig();

  const { data: members, error: mErr } = useSWR<ProjectMember[]>(
    `/projects/${id}/members`,
    fetcher
  );
  const { data: users } = useSWR<User[]>("/users", fetcher);

  const [userId, setUserId] = React.useState<number | "">("");
  const [role, setRole] = React.useState<ProjectRole>("viewer");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function addMember(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.post(`/projects/${id}/members`, { user_id: userId, role });
      mutate(`/projects/${id}/members`);
      setUserId("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function remove(memberUserId: number) {
    if (!confirm("Remove this member?")) return;
    try {
      await api.delete(`/projects/${id}/members/${memberUserId}`);
      mutate(`/projects/${id}/members`);
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    }
  }

  const userById = (users || []).reduce<Record<number, User>>((acc, u) => {
    acc[u.id] = u; return acc;
  }, {});

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-ink-900">Team</h2>
        <p className="text-xs text-ink-500">Project-level access control. Admins can manage members.</p>
      </div>

      {mErr && <ErrorBox error={mErr} />}
      {!members && !mErr && <Spinner />}

      {members && (
        <Card>
          <CardHeader title={`${members.length} members`} />
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr>
                  <th className="table-th">Name</th>
                  <th className="table-th">Email</th>
                  <th className="table-th">Role</th>
                  <th className="table-th"></th>
                </tr>
              </thead>
              <tbody>
                {members.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-sm text-ink-500">
                      No members yet.
                    </td>
                  </tr>
                )}
                {members.map((m) => {
                  const u = userById[m.user_id];
                  return (
                    <tr key={m.id} className="table-row-hover">
                      <td className="table-td">{u?.full_name || `User #${m.user_id}`}</td>
                      <td className="table-td text-ink-500">{u?.email || "—"}</td>
                      <td className="table-td">
                        <Badge tone={m.role === "admin" ? "blue" : m.role === "editor" ? "green" : "slate"}>
                          {m.role}
                        </Badge>
                      </td>
                      <td className="table-td text-right">
                        <button
                          className="btn-ghost text-rose-600 hover:bg-rose-50"
                          onClick={() => remove(m.user_id)}
                          title="Remove"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Card>
        <CardHeader title="Add member" subtitle="Pick a user account and assign a project role." />
        <form onSubmit={addMember} className="grid grid-cols-1 gap-3 p-5 md:grid-cols-[1fr_140px_auto]">
          <Field label="User">
            <select
              className="input"
              value={userId}
              onChange={(e) => setUserId(e.target.value ? Number(e.target.value) : "")}
              required
            >
              <option value="">Select a user</option>
              {(users || []).map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name} — {u.email}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Role">
            <select className="input" value={role} onChange={(e) => setRole(e.target.value as ProjectRole)}>
              <option value="viewer">Viewer</option>
              <option value="editor">Editor</option>
              <option value="admin">Admin</option>
            </select>
          </Field>
          <div className="flex items-end">
            <button className="btn-primary w-full" type="submit" disabled={!userId || submitting}>
              <UserPlus className="h-4 w-4" /> Add
            </button>
          </div>
          {error && <div className="md:col-span-3"><ErrorBox error={{ message: error }} /></div>}
        </form>
      </Card>
    </div>
  );
}
