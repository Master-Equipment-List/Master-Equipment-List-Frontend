"use client";
import * as React from "react";
import { cn } from "@/lib/cn";

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("card", className)}>{children}</div>;
}
export function CardPad({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("card card-pad", className)}>{children}</div>;
}
export function CardHeader({
  title,
  subtitle,
  action
}: { title: string; subtitle?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between border-b border-ink-100 px-5 py-4">
      <div>
        <h3 className="text-sm font-semibold text-ink-900">{title}</h3>
        {subtitle && <div className="mt-0.5 text-xs text-ink-500">{subtitle}</div>}
      </div>
      {action}
    </div>
  );
}

export type Tone = "slate" | "blue" | "green" | "amber" | "red" | "violet";

export function Badge({
  tone = "slate",
  children,
  className
}: {
  tone?: Tone;
  children: React.ReactNode;
  className?: string;
}) {
  const map: Record<Tone, string> = {
    slate: "badge-slate",
    blue: "badge-blue",
    green: "badge-green",
    amber: "badge-amber",
    red: "badge-red",
    violet: "badge-violet"
  };
  return <span className={cn(map[tone], className)}>{children}</span>;
}

export function StatusDot({ tone = "slate" }: { tone?: Tone }) {
  const map: Record<Tone, string> = {
    slate: "bg-ink-300",
    blue: "bg-brand-500",
    green: "bg-emerald-500",
    amber: "bg-amber-500",
    red: "bg-rose-500",
    violet: "bg-violet-500"
  };
  return <span className={cn("h-2 w-2 rounded-full", map[tone])} />;
}

export function EmptyState({
  title,
  body,
  action
}: { title: string; body?: string; action?: React.ReactNode }) {
  return (
    <div className="grid place-items-center rounded-xl border border-dashed border-ink-200 bg-white p-12 text-center">
      <div>
        <h3 className="text-sm font-semibold text-ink-800">{title}</h3>
        {body && <p className="mx-auto mt-1 max-w-md text-xs text-ink-500">{body}</p>}
        {action && <div className="mt-4">{action}</div>}
      </div>
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cn("h-4 w-4 animate-spin text-ink-400", className)} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function ErrorBox({ error }: { error: unknown }) {
  const message =
    error && typeof error === "object" && "message" in error
      ? String((error as { message: unknown }).message)
      : "Something went wrong.";
  return (
    <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
      {message}
    </div>
  );
}

export function KPI({ label, value, hint, tone }: {
  label: string; value: React.ReactNode; hint?: string; tone?: Tone;
}) {
  return (
    <div className="kpi">
      <div className="flex items-center gap-2">
        {tone && <StatusDot tone={tone} />}
        <div className="kpi-label">{label}</div>
      </div>
      <div className="kpi-value">{value}</div>
      {hint && <div className="kpi-delta text-ink-500">{hint}</div>}
    </div>
  );
}

export function Field({
  label, htmlFor, children, hint
}: { label: string; htmlFor?: string; children: React.ReactNode; hint?: string }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="label">{label}</label>
      {children}
      {hint && <p className="mt-1 text-[11px] text-ink-500">{hint}</p>}
    </div>
  );
}

/**
 * App-styled confirmation modal — replaces window.confirm so destructive
 * actions look intentional and can carry rich body content + a busy state
 * while the action is in flight.
 *
 * Usage:
 *   const [open, setOpen] = React.useState(false);
 *   const [busy, setBusy] = React.useState(false);
 *   <ConfirmModal
 *     open={open}
 *     title="Remove file"
 *     description={<p>Are you sure?</p>}
 *     confirmLabel="Delete"
 *     tone="red"
 *     busy={busy}
 *     onClose={() => setOpen(false)}
 *     onConfirm={async () => { setBusy(true); ...; setBusy(false); setOpen(false); }}
 *   />
 */
export function ConfirmModal({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "blue",
  busy = false,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "blue" | "red";
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  // ESC to close (unless we're mid-action).
  React.useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy) onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, busy, onClose]);

  // Lock background scroll while the modal is open.
  React.useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  if (!open) return null;

  const confirmClass = tone === "red" ? "btn-danger" : "btn-primary";

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-ink-900/40 p-4 backdrop-blur-[1px]"
      onMouseDown={(e) => {
        // Only close when the backdrop itself is clicked, not the modal body.
        if (e.target === e.currentTarget && !busy) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-xl bg-white shadow-2xl ring-1 ring-ink-200"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="border-b border-ink-100 px-5 py-4">
          <h3 id="confirm-modal-title" className="text-sm font-semibold text-ink-900">
            {title}
          </h3>
        </div>
        {description && (
          <div className="px-5 py-4 text-sm text-ink-700">{description}</div>
        )}
        <div className="flex items-center justify-end gap-2 border-t border-ink-100 bg-ink-50 px-5 py-3">
          <button
            className="btn-ghost"
            onClick={onClose}
            disabled={busy}
            type="button"
          >
            {cancelLabel}
          </button>
          <button
            className={confirmClass}
            onClick={onConfirm}
            disabled={busy}
            type="button"
            autoFocus
          >
            {busy && <Spinner className="text-white" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
