"use client";
import * as React from "react";
import useSWR, { useSWRConfig } from "swr";
import { Plus, UserCog } from "lucide-react";

import { Badge, Card, CardHeader, ErrorBox, Field, Spinner } from "@/components/ui";
import { api, fetcher } from "@/lib/api";
import { RequireAuth, useAuth } from "@/lib/auth";
import type { User } from "@/lib/types";

export default function UsersPage() {
  return (
    <RequireAuth>
      <Inner />
    </RequireAuth>
  );
}

function Inner() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.is_superuser;

  if (!isAdmin) {
    return (
      <main className="mx-auto w-full max-w-[1400px] px-6 py-10">
        <ErrorBox error={{ message: "Admin access required." }} />
      </main>
    );
  }

  return <UsersAdmin />;
}

function UsersAdmin() {
  const { data: users, error } = useSWR<User[]>("/users", fetcher);
  const { mutate } = useSWRConfig();

  const [showCreate, setShowCreate] = React.useState(false);

  return (
    <main className="mx-auto w-full max-w-[1400px] px-6 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-ink-900">Users</h1>
          <p className="text-sm text-ink-500">Admin user management.</p>
        </div>
        <button className="btn-primary" onClick={() => setShowCreate((s) => !s)}>
          <Plus className="h-4 w-4" /> New user
        </button>
      </div>

      {showCreate && <CreateUserForm onCreated={() => { mutate("/users"); setShowCreate(false); }} />}

      {error && <ErrorBox error={error} />}
      {!users && !error && <Spinner />}

      {users && (
        <Card>
          <CardHeader title={`${users.length} users`} />
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr>
                  <th className="table-th">Name</th>
                  <th className="table-th">Email</th>
                  <th className="table-th">Role</th>
                  <th className="table-th">Status</th>
                  <th className="table-th">Created</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="table-row-hover">
                    <td className="table-td font-medium">{u.full_name}</td>
                    <td className="table-td text-ink-500">{u.email}</td>
                    <td className="table-td">
                      <Badge tone={u.role === "admin" ? "blue" : "slate"}>{u.role}</Badge>
                      {u.is_superuser && <Badge tone="violet" className="ml-1">superuser</Badge>}
                    </td>
                    <td className="table-td">
                      <Badge tone={u.is_active ? "green" : "red"}>
                        {u.is_active ? "active" : "inactive"}
                      </Badge>
                    </td>
                    <td className="table-td text-[11px] text-ink-500">{new Date(u.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </main>
  );
}

function CreateUserForm({ onCreated }: { onCreated: () => void }) {
  const [email, setEmail] = React.useState("");
  const [fullName, setFullName] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [role, setRole] = React.useState<"user" | "admin">("user");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await api.post("/auth/register", { email, full_name: fullName, password, role });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader title="Create user" subtitle="Admin-only. The user can sign in immediately." />
      <form onSubmit={submit} className="grid grid-cols-1 gap-3 p-5 md:grid-cols-2">
        <Field label="Email *"><input type="email" className="input" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        <Field label="Full name *"><input className="input" required value={fullName} onChange={(e) => setFullName(e.target.value)} /></Field>
        <Field label="Password *" hint="At least 6 characters.">
          <input type="password" className="input" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Field label="Role">
          <select className="input" value={role} onChange={(e) => setRole(e.target.value as "user" | "admin")}>
            <option value="user">User</option>
            <option value="admin">Admin</option>
          </select>
        </Field>
        {error && <div className="md:col-span-2"><ErrorBox error={{ message: error }} /></div>}
        <div className="md:col-span-2 flex justify-end">
          <button className="btn-primary" type="submit" disabled={submitting}>
            <UserCog className="h-4 w-4" /> Create user
          </button>
        </div>
      </form>
    </Card>
  );
}
