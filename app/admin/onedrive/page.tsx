"use client";
import * as React from "react";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import { CheckCircle2, Cloud, ExternalLink, Loader2, Plug, Unplug } from "lucide-react";

import { Badge, Card, CardHeader, ErrorBox, Spinner } from "@/components/ui";
import { api, fetcher } from "@/lib/api";
import { RequireAuth, useAuth } from "@/lib/auth";

interface OneDriveStatus {
  connected: boolean;
  account_email?: string | null;
  tenant_id?: string | null;
  expires_at?: string | null;
  scope?: string | null;
  has_refresh_token?: boolean;
}

export default function OneDriveAdminPage() {
  return (
    <RequireAuth>
      <Inner />
    </RequireAuth>
  );
}

function Inner() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.is_superuser;
  const params = useSearchParams();
  const status = params.get("status");
  const message = params.get("message");

  const { data: connStatus, mutate, isLoading } = useSWR<OneDriveStatus>(
    isAdmin ? "/onedrive/status" : null,
    fetcher
  );

  const [starting, setStarting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [disconnecting, setDisconnecting] = React.useState(false);

  async function startOAuth() {
    setStarting(true);
    setError(null);
    try {
      const { authorization_url } = await api.get<{ authorization_url: string; state: string }>(
        "/onedrive/oauth/start"
      );
      window.location.href = authorization_url;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStarting(false);
    }
  }

  async function disconnect() {
    if (!confirm("Disconnect OneDrive? All projects lose access until reconnected.")) return;
    setDisconnecting(true);
    try {
      await api.delete("/onedrive/disconnect");
      mutate();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setDisconnecting(false);
    }
  }

  if (!isAdmin) {
    return (
      <main className="mx-auto w-full max-w-[900px] px-6 py-10">
        <ErrorBox error={{ message: "Admin access required." }} />
      </main>
    );
  }

  const isConnected = connStatus?.connected;
  const expiresAt = connStatus?.expires_at ? new Date(connStatus.expires_at) : null;
  const expired = expiresAt ? expiresAt.getTime() < Date.now() : false;

  return (
    <main className="mx-auto w-full max-w-[900px] px-6 py-8 space-y-4">
      <header>
        <h1 className="text-xl font-semibold text-ink-900">OneDrive (Organization)</h1>
        <p className="text-sm text-ink-500">
          One organization-level Microsoft 365 identity is used to access OneDrive.
          Per-project access is restricted to the configured project root path.
        </p>
      </header>

      {status === "connected" && (
        <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" />
          <div>
            <div className="text-sm font-semibold text-emerald-800">OneDrive connected.</div>
            <div className="text-xs text-emerald-700">
              The organization-level access token is stored. Project syncs can now reach OneDrive.
            </div>
          </div>
        </div>
      )}
      {status === "error" && (
        <ErrorBox error={{ message: message || "OneDrive connection failed." }} />
      )}

      {isLoading && <Spinner />}

      {connStatus && (
        <Card>
          <CardHeader
            title="Connection status"
            action={
              <Badge tone={isConnected ? (expired ? "amber" : "green") : "slate"}>
                {isConnected ? (expired ? "expired" : "connected") : "not connected"}
              </Badge>
            }
          />
          <div className="space-y-3 p-5 text-sm">
            {isConnected ? (
              <>
                <Row label="Tenant" value={connStatus.tenant_id || "—"} mono />
                <Row label="Account" value={connStatus.account_email || "—"} />
                <Row
                  label="Expires at"
                  value={
                    expiresAt
                      ? `${expiresAt.toLocaleString()} ${expired ? "(expired)" : ""}`
                      : "—"
                  }
                />
                <Row label="Refresh token" value={connStatus.has_refresh_token ? "stored" : "missing"} />
                <Row label="Scope" value={connStatus.scope || "—"} mono small />
                <div className="flex flex-wrap items-center gap-2 pt-2">
                  <button
                    className="btn-secondary"
                    onClick={startOAuth}
                    disabled={starting}
                    title="Re-run consent to refresh tokens"
                  >
                    {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plug className="h-4 w-4" />}
                    Re-authenticate
                  </button>
                  <button
                    className="btn-danger"
                    onClick={disconnect}
                    disabled={disconnecting}
                  >
                    {disconnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unplug className="h-4 w-4" />}
                    Disconnect
                  </button>
                </div>
              </>
            ) : (
              <div className="text-ink-600">
                Not connected yet. Click <strong>Connect OneDrive</strong> below.
              </div>
            )}
          </div>
        </Card>
      )}

      {!isConnected && (
        <Card>
          <CardHeader title="Connect OneDrive" subtitle="Sign in with your organization's Microsoft 365 admin account." />
          <div className="p-5 text-sm text-ink-700">
            <p>
              Clicking <strong>Connect</strong> redirects you to Microsoft's OAuth consent screen.
              On approval, the backend stores the access &amp; refresh tokens and uses them for every
              project sync.
            </p>
            <p className="mt-2 text-xs text-ink-500">
              Make sure these env vars are set in the backend <code>.env</code>:
              <span className="ml-1 font-mono">MS_TENANT_ID</span>,{" "}
              <span className="font-mono">MS_CLIENT_ID</span>,{" "}
              <span className="font-mono">MS_CLIENT_SECRET</span>,{" "}
              <span className="font-mono">MS_REDIRECT_URI</span>.
            </p>

            {error && <div className="mt-3"><ErrorBox error={{ message: error }} /></div>}

            <div className="mt-4 flex items-center gap-2">
              <button className="btn-primary" onClick={startOAuth} disabled={starting}>
                {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Cloud className="h-4 w-4" />}
                Connect OneDrive
              </button>
              <a
                href="https://learn.microsoft.com/en-us/azure/active-directory/develop/quickstart-register-app"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-ghost"
              >
                Azure setup guide <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>
        </Card>
      )}

      {error && isConnected && <ErrorBox error={{ message: error }} />}
    </main>
  );
}

function Row({
  label, value, mono, small
}: { label: string; value: React.ReactNode; mono?: boolean; small?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-ink-100 pb-2 last:border-0 last:pb-0">
      <span className="text-ink-500">{label}</span>
      <span
        className={[
          "text-ink-800",
          mono ? "font-mono" : "",
          small ? "text-[11px]" : "text-sm",
          "break-all text-right"
        ].join(" ")}
      >
        {value}
      </span>
    </div>
  );
}
