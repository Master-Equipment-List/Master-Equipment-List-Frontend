"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Cloud,
  FileText,
  Layers,
  Settings,
  Table,
  Users
} from "lucide-react";

import { cn } from "@/lib/cn";

export function WorkspaceTabs({
  projectId,
  workspace,
}: {
  projectId: number;
  workspace: "topside" | "marine";
}) {
  const pathname = usePathname() || "";
  const base = `/projects/${projectId}/${workspace}`;

  const tabs = [
    { href: `${base}`,           label: "Dashboard", icon: BarChart3, exact: true },
    { href: `${base}/equipment`, label: "Equipment", icon: Table },
    { href: `${base}/files`,     label: "Files",     icon: FileText },
    { href: `${base}/onedrive`,  label: "OneDrive",  icon: Cloud },
    { href: `${base}/versions`,  label: "Versions",  icon: Layers },
    { href: `${base}/team`,      label: "Team",      icon: Users },
    { href: `${base}/settings`,  label: "Settings",  icon: Settings },
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
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
