"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import useSWR from "swr";
import {
  BarChart3,
  Cloud,
  FileText,
  Layers,
  ListChecks,
  Table,
  Users
} from "lucide-react";

import { cn } from "@/lib/cn";
import type { Paged } from "@/components/Pagination";
import { fetcher } from "@/lib/api";
import type { PendingChange } from "@/lib/types";

export function WorkspaceTabs({
  projectId,
  workspace,
}: {
  projectId: number;
  workspace: "topside" | "marine";
}) {
  const pathname = usePathname() || "";
  const base = `/projects/${projectId}/${workspace}`;

  // limit=1 — we only need `total`, not the actual rows, for the badge count.
  const { data: pending } = useSWR<Paged<PendingChange>>(
    `/projects/${projectId}/equipment/pending?workspace=${workspace}&limit=1`,
    fetcher,
  );
  const pendingCount = pending?.total ?? 0;

  const tabs = [
    { href: `${base}`,           label: "Dashboard", icon: BarChart3, exact: true },
    { href: `${base}/equipment`, label: "Equipment", icon: Table },
    { href: `${base}/pending`,   label: "Pending",   icon: ListChecks, badge: pendingCount },
    { href: `${base}/files`,     label: "Files",     icon: FileText },
    { href: `${base}/onedrive`,  label: "OneDrive",  icon: Cloud },
    { href: `${base}/versions`,  label: "Versions",  icon: Layers },
    { href: `${base}/team`,      label: "Team",      icon: Users },
    // "Settings" is project-wide, not workspace-scoped — it lives at
    // /projects/[id]/settings and is reached via the gear icon in the
    // project header (rendered by app/projects/[id]/layout.tsx).
  ];

  function active(href: string, exact?: boolean) {
    return exact
      ? pathname === href
      : pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <div className="overflow-x-auto border-b border-ink-100 bg-white">
      <nav className="mx-auto flex w-full max-w-[1400px] items-center gap-1 px-6">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <Link
              key={t.href}
              href={t.href}
              className={cn("tab-link", active(t.href, t.exact) && "tab-link-active")}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
              {!!t.badge && (
                <span className="ml-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                  {t.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
