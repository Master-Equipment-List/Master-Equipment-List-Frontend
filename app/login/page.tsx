"use client";
import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";

import { useAuth } from "@/lib/auth";

/**
 * Next.js 14 requires any page that calls `useSearchParams()` to be
 * wrapped in a <Suspense> boundary at the page level — otherwise
 * `next build`'s static prerender step bails with
 * "useSearchParams() should be wrapped in a suspense boundary".
 *
 * The inner component owns all the auth / form logic; this outer
 * shell just provides the boundary so prerendering can stream
 * the static parts first and resolve the search-params during
 * hydration.
 */
export default function LoginPage() {
  return (
    <React.Suspense fallback={<LoginSkeleton />}>
      <LoginPageInner />
    </React.Suspense>
  );
}

function LoginPageInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { login, user, loading } = useAuth();

  const [email, setEmail] = React.useState("admin@example.com");
  const [password, setPassword] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const next = params.get("next") || "/projects";

  React.useEffect(() => {
    if (!loading && user) router.replace(next);
  }, [loading, user, next, router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await login(email, password);
      router.replace(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="grid min-h-[calc(100vh-3.5rem)] place-items-center px-4">
      <div className="w-full max-w-md">
        {/* Brand mark — Shapoorji Pallonji OIL & GAS logo + " | MEL ".
            Same layout as TopNav so the user sees a consistent identity
            from sign-in through the rest of the app. items-end so the
            divider + "MEL" wordmark line up against the logo's bottom
            baseline, matching the styled brand row used in the header. */}
        <div className="mb-6 flex items-end justify-center gap-3 pb-1">
          <Image
            src="/images/SP-Oil-Gas.png"
            alt="Shapoorji Pallonji OIL & GAS"
            width={200}
            height={56}
            priority
            className="h-12 w-auto object-contain"
          />
          <span aria-hidden className="mb-1 h-8 w-px bg-ink-200" />
          <span className="mb-0.5 text-3xl font-bold leading-none tracking-tight text-ink-900">
            MEL
          </span>
        </div>

        <div className="card card-pad">
          <h1 className="text-base font-semibold text-ink-900">Sign in</h1>
          <p className="mt-1 text-xs text-ink-500">
            Use the credentials configured in the backend <code>.env</code>.
          </p>

          <form onSubmit={onSubmit} className="mt-5 space-y-3">
            <div>
              <label className="label" htmlFor="email">Email</label>
              <input
                id="email"
                className="input"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="label" htmlFor="password">Password</label>
              <input
                id="password"
                className="input"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {error && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                {error}
              </div>
            )}

            <button className="btn-primary w-full" type="submit" disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Sign in
            </button>
          </form>

          <p className="mt-4 text-[11px] text-ink-500">
            Backend:{" "}
            <code className="text-ink-700">
              {process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/api/v1"}
            </code>
          </p>
        </div>

        <p className="mt-3 text-center text-[11px] text-ink-400">
          <Link href="/" className="hover:underline">← back</Link>
        </p>
      </div>
    </main>
  );
}

function LoginSkeleton() {
  // Minimal placeholder used while the Suspense boundary is unresolved.
  // Matches the visual shape of the real form so there's no layout shift.
  return (
    <main className="grid min-h-[calc(100vh-3.5rem)] place-items-center px-4">
      <div className="w-full max-w-md">
        <div className="card card-pad opacity-60">
          <div className="h-5 w-24 animate-pulse rounded bg-ink-100" />
          <div className="mt-5 space-y-3">
            <div className="h-9 w-full animate-pulse rounded bg-ink-100" />
            <div className="h-9 w-full animate-pulse rounded bg-ink-100" />
            <div className="h-9 w-full animate-pulse rounded bg-ink-100" />
          </div>
        </div>
      </div>
    </main>
  );
}
