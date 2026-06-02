"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Activity, Bell, LayoutGrid, LogOut, Search, Users } from "lucide-react";

import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/cn";

export function TopNav() {
  const { user, logout } = useAuth();
  const pathname = usePathname() || "";
  const router = useRouter();

  if (!user) return null;

  const isAdmin = user.role === "admin" || user.is_superuser;

  function isActive(prefix: string) {
    return pathname === prefix || pathname.startsWith(prefix + "/");
  }

  return (
    <header className="sticky top-0 z-30 border-b border-ink-100 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-[1400px] items-center gap-4 px-6">
        <Link href="/projects" className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 text-white">
            <Activity className="h-4 w-4" />
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold text-ink-900">MEL Studio</div>
            <div className="text-[10px] uppercase tracking-wider text-ink-400">
              Master Equipment List
            </div>
          </div>
        </Link>

        <nav className="ml-6 flex items-center gap-1">
          <Link
            href="/projects"
            className={cn("btn-ghost", isActive("/projects") && "bg-ink-100 text-ink-900")}
          >
            <LayoutGrid className="h-4 w-4" /> Projects
          </Link>
          {isAdmin && (
            <Link
              href="/users"
              className={cn("btn-ghost", isActive("/users") && "bg-ink-100 text-ink-900")}
            >
              <Users className="h-4 w-4" /> Users
            </Link>
          )}
          {isAdmin && (
            <Link
              href="/admin/onedrive"
              className={cn("btn-ghost", isActive("/admin/onedrive") && "bg-ink-100 text-ink-900")}
            >
              <Activity className="h-4 w-4" /> OneDrive
            </Link>
          )}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <div className="relative hidden md:block">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
            <input
              className="input w-64 pl-8"
              placeholder="Search…"
              disabled
              title="Search coming soon"
            />
          </div>
          <button className="btn-ghost relative" aria-label="Notifications" disabled>
            <Bell className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-2">
            <div
              className="grid h-8 w-8 place-items-center rounded-full bg-ink-200 text-xs font-semibold text-ink-700"
              title={user.email}
            >
              {initials(user.full_name || user.email)}
            </div>
            <button
              className="btn-ghost"
              onClick={() => { logout(); router.replace("/login"); }}
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
