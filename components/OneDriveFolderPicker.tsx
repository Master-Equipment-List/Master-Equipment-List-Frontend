"use client";
import * as React from "react";
import useSWR from "swr";
import {
  ChevronRight,
  CornerUpLeft,
  Folder,
  Home,
  Share2,
  Check,
  HardDrive
} from "lucide-react";

import { Badge, Card, CardHeader, ErrorBox, Spinner } from "@/components/ui";
import { fetcher } from "@/lib/api";
import type { DriveItem } from "@/lib/types";

/** Selection emitted to the parent when the user clicks "Use this folder". */
export interface FolderSelection {
  path: string | null;
  item_id: string | null;
  drive_id: string | null;
  display_label: string;
}

interface Crumb {
  /** The item id of the folder we drilled INTO (null for drive root) */
  item_id: string | null;
  /** Drive id when we crossed into a shared drive via a shortcut */
  drive_id: string | null;
  /** Display label */
  label: string;
  /** Last-known path within the current drive (null after entering a shared drive) */
  path: string | null;
}

/** Folder browser. The parent passes `onPick` to receive whatever folder the
 * user lands on or explicitly selects. */
export function OneDriveFolderPicker({
  onPick,
  initialPath
}: {
  onPick: (s: FolderSelection) => void;
  initialPath?: string | null;
}) {
  const ROOT: Crumb = {
    item_id: null,
    drive_id: null,
    label: "My OneDrive",
    path: "/"
  };
  const [crumbs, setCrumbs] = React.useState<Crumb[]>([ROOT]);
  const current = crumbs[crumbs.length - 1];

  const [tab, setTab] = React.useState<"drive" | "shared">("drive");

  // Build the API URL for the current crumb.
  const driveUrl = (() => {
    const params = new URLSearchParams();
    if (current.item_id) params.set("item_id", current.item_id);
    if (current.drive_id) params.set("drive_id", current.drive_id);
    const qs = params.toString();
    return `/onedrive/me/browse${qs ? `?${qs}` : ""}`;
  })();

  const browseKey = tab === "drive" ? driveUrl : "/onedrive/me/shared";
  const { data: items, error, isLoading } = useSWR<DriveItem[]>(browseKey, fetcher);

  function drillInto(item: DriveItem) {
    if (item.type !== "folder") return;

    if (item.is_shortcut && item.remote_drive_id && item.remote_item_id) {
      // Crossing into a shared drive via a shortcut — switch drive context.
      setCrumbs((cs) => [
        ...cs,
        {
          item_id: item.remote_item_id!,
          drive_id: item.remote_drive_id!,
          label: item.name,
          path: null
        }
      ]);
      setTab("drive");
      return;
    }

    setCrumbs((cs) => [
      ...cs,
      {
        item_id: item.id,
        drive_id: current.drive_id,
        label: item.name,
        path: current.path != null ? joinPath(current.path, item.name) : null
      }
    ]);
  }

  function goTo(i: number) {
    setCrumbs((cs) => cs.slice(0, i + 1));
  }

  function goUp() {
    if (crumbs.length > 1) setCrumbs((cs) => cs.slice(0, cs.length - 1));
  }

  function pickCurrent() {
    onPick({
      item_id: current.item_id,
      drive_id: current.drive_id,
      path: current.path,
      display_label: crumbs.map((c) => c.label).join(" / ")
    });
  }

  function pickItem(item: DriveItem) {
    if (item.type !== "folder") return;
    if (item.is_shortcut && item.remote_drive_id && item.remote_item_id) {
      onPick({
        item_id: item.remote_item_id,
        drive_id: item.remote_drive_id,
        path: null,
        display_label: `My OneDrive / ${item.name} (shared)`
      });
      return;
    }
    onPick({
      item_id: null,
      drive_id: current.drive_id,
      path: current.path != null ? joinPath(current.path, item.name) : null,
      display_label: `${crumbs.map((c) => c.label).join(" / ")} / ${item.name}`
    });
  }

  React.useEffect(() => {
    // If parent passes an initialPath, ignore for now — picker always starts at root.
    // (Pre-populating navigation would require resolving the path to item ids.)
  }, [initialPath]);

  const isShared = tab === "shared";

  return (
    <Card>
      <CardHeader
        title="Pick a OneDrive folder"
        subtitle={
          <span>
            Currently browsing:{" "}
            <code className="font-mono text-[11px] text-ink-700">
              {crumbs.map((c) => c.label).join(" / ")}
              {current.path && current.drive_id == null && (
                <span className="ml-2 text-ink-400">({current.path})</span>
              )}
            </code>
          </span>
        }
        action={
          <button
            className="btn-primary"
            onClick={pickCurrent}
            disabled={crumbs.length === 1 && tab === "drive"}
            title="Use this folder as the project's OneDrive root"
          >
            <Check className="h-4 w-4" /> Use this folder
          </button>
        }
      />

      <div className="border-b border-ink-100 px-5">
        <nav className="flex gap-1">
          <button
            className={`tab-link ${tab === "drive" ? "tab-link-active" : ""}`}
            onClick={() => { setTab("drive"); setCrumbs([ROOT]); }}
          >
            <HardDrive className="h-3.5 w-3.5" /> My OneDrive
          </button>
          <button
            className={`tab-link ${tab === "shared" ? "tab-link-active" : ""}`}
            onClick={() => { setTab("shared"); }}
          >
            <Share2 className="h-3.5 w-3.5" /> Shared with me
          </button>
        </nav>
      </div>

      {!isShared && (
        <div className="flex items-center gap-2 border-b border-ink-100 px-5 py-2">
          <button
            className="btn-ghost px-2 py-1 text-xs"
            onClick={goUp}
            disabled={crumbs.length === 1}
          >
            <CornerUpLeft className="h-3.5 w-3.5" /> Up
          </button>
          <nav className="flex items-center gap-1 text-xs">
            {crumbs.map((c, i) => (
              <React.Fragment key={i}>
                {i > 0 && <ChevronRight className="h-3 w-3 text-ink-400" />}
                <button
                  className="rounded px-2 py-1 hover:bg-ink-100"
                  onClick={() => goTo(i)}
                >
                  {i === 0 ? <Home className="mr-1 inline h-3 w-3" /> : null}
                  {c.label}
                </button>
              </React.Fragment>
            ))}
          </nav>
        </div>
      )}

      {error && <div className="p-5"><ErrorBox error={error} /></div>}
      {isLoading && <div className="grid place-items-center py-10"><Spinner /></div>}

      {items && (
        <div className="overflow-auto max-h-[50vh]">
          <table className="min-w-full text-sm">
            <thead>
              <tr>
                <th className="table-th">Name</th>
                <th className="table-th">Type</th>
                <th className="table-th">Modified</th>
                <th className="table-th"></th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-sm text-ink-500">
                  {isShared ? "Nothing shared with you yet." : "Empty folder."}
                </td></tr>
              )}
              {items
                .filter((it) => it.type === "folder")  // folders first
                .concat(items.filter((it) => it.type !== "folder"))
                .map((item) => (
                <tr key={item.id} className="table-row-hover">
                  <td className="table-td">
                    <button
                      className="inline-flex items-center gap-2 text-ink-800 hover:text-brand-700"
                      onClick={() => drillInto(item)}
                      disabled={item.type !== "folder"}
                    >
                      <Folder className={`h-4 w-4 ${item.type === "folder" ? "text-amber-500" : "text-ink-300"}`} />
                      <span className={item.type === "folder" ? "font-medium" : ""}>{item.name}</span>
                      {item.is_shortcut && (
                        <Badge tone="violet" className="ml-1">shortcut</Badge>
                      )}
                    </button>
                  </td>
                  <td className="table-td">
                    <Badge tone={item.type === "folder" ? "amber" : "slate"}>{item.type}</Badge>
                  </td>
                  <td className="table-td text-[11px] text-ink-500">
                    {item.modified_at ? new Date(item.modified_at).toLocaleString() : "—"}
                  </td>
                  <td className="table-td text-right">
                    {item.type === "folder" && (
                      <button
                        className="btn-ghost text-brand-700 hover:bg-brand-50"
                        onClick={() => pickItem(item)}
                        title="Use this folder as project root"
                      >
                        <Check className="h-3.5 w-3.5" /> Use this
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function joinPath(base: string, name: string): string {
  if (!base || base === "/") return `/${name}`;
  return `${base.replace(/\/$/, "")}/${name}`;
}
