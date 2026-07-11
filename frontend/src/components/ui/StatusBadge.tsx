import React from "react";
import clsx from "clsx";

export type BadgeTone = "emerald" | "amber" | "red" | "blue" | "slate";

const TONE_CLASSES: Record<BadgeTone, string> = {
  emerald: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  amber: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  red: "border-red-500/30 bg-red-500/10 text-red-300",
  blue: "border-blue-500/30 bg-blue-500/10 text-blue-300",
  slate: "border-slate-600 bg-slate-800/80 text-slate-300",
};

export function toneForStatus(value: string): BadgeTone {
  const normalized = value.toUpperCase().replace(/[\s-]+/g, "_");
  switch (normalized) {
    case "APPROVED":
    case "DONE":
    case "COMPLETE":
    case "LOW":
    case "ANALYSIS_COMPLETE":
      return "emerald";
    case "PENDING_REVIEW":
    case "PENDING":
    case "TODO":
    case "MEDIUM":
    case "PENDING_ANALYSIS":
    case "UNDER_REVIEW":
    case "NEEDS_REVISION":
      return "amber";
    case "REJECTED":
    case "CRITICAL":
    case "HIGH":
      return "red";
    case "IN_PROGRESS":
    case "NEW":
    case "DRAFT":
      return "blue";
    default:
      return "slate";
  }
}

interface StatusBadgeProps {
  label: string;
  tone?: BadgeTone;
  className?: string;
}

export default function StatusBadge({ label, tone, className }: StatusBadgeProps) {
  const resolvedTone = tone ?? toneForStatus(label);
  return (
    <span
      className={clsx(
        "inline-flex whitespace-nowrap rounded-md border px-2 py-0.5 text-[11px] font-semibold",
        TONE_CLASSES[resolvedTone],
        className
      )}
    >
      {label}
    </span>
  );
}
