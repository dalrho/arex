import React from "react";
import clsx from "clsx";

export type BadgeTone = "emerald" | "amber" | "red" | "blue" | "slate";

const TONE_CLASSES: Record<BadgeTone, string> = {
  emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
  amber: "bg-amber-50 text-amber-700 border-amber-200",
  red: "bg-red-50 text-red-700 border-red-200",
  blue: "bg-blue-50 text-blue-700 border-blue-200",
  slate: "bg-slate-100 text-slate-700 border-slate-200",
};

/** Maps common backend status / severity strings to a badge tone. */
export function toneForStatus(value: string): BadgeTone {
  const normalized = value.toUpperCase().replace(/[\s-]+/g, "_");
  switch (normalized) {
    case "APPROVED":
    case "DONE":
    case "COMPLETE":
    case "LOW":
      return "emerald";
    case "PENDING_REVIEW":
    case "PENDING":
    case "TODO":
    case "MEDIUM":
      return "amber";
    case "REJECTED":
    case "CRITICAL":
    case "HIGH":
      return "red";
    case "IN_PROGRESS":
    case "NEW":
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
        "inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap",
        TONE_CLASSES[resolvedTone],
        className
      )}
    >
      {label}
    </span>
  );
}
