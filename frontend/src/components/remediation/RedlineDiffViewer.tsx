import React from "react";
import clsx from "clsx";
import type { DiffContent } from "@/types/api";
import { Columns2, FileText } from "lucide-react";
import StatusBadge from "@/components/ui/StatusBadge";

interface RedlineDiffViewerProps {
  originalText: string;
  proposedText: string;
  diffContent: DiffContent | null;
}

function toLines(text: string): string[] {
  return text.split(/\r?\n/);
}

/**
 * Side-by-side redline view. Lines listed in diff_content.removed are
 * highlighted red/strikethrough in the original pane; lines in
 * diff_content.added are highlighted emerald in the proposed pane.
 */
export default function RedlineDiffViewer({
  originalText,
  proposedText,
  diffContent,
}: RedlineDiffViewerProps) {
  const removedSet = new Set((diffContent?.removed ?? []).map((line) => line.trim()));
  const addedSet = new Set((diffContent?.added ?? []).map((line) => line.trim()));

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600">
            <Columns2 className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-950">SOP redline comparison</p>
            <p className="text-xs text-slate-500">Original text against proposed remediation draft</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-600">
          <StatusBadge label="Added" tone="emerald" />
          <StatusBadge label="Deleted" tone="red" />
          <StatusBadge label="Citations" tone="blue" />
        </div>
      </div>
      <div className="grid grid-cols-1 border-b border-slate-200 text-xs font-semibold md:grid-cols-2">
        <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-4 py-2.5 text-slate-700 md:border-b-0 md:border-r">
          <FileText className="h-4 w-4 text-slate-400" />
          Current SOP
          <StatusBadge label="v2.1" tone="slate" />
        </div>
        <div className="flex items-center gap-2 bg-white px-4 py-2.5 text-slate-700">
          <FileText className="h-4 w-4 text-emerald-500" />
          Proposed SOP
          <StatusBadge label="v2.2" tone="emerald" />
        </div>
      </div>
      <div className="grid grid-cols-1 text-sm leading-relaxed md:grid-cols-2">
        <DiffPane lines={toLines(originalText)} highlightSet={removedSet} mode="removed" />
        <DiffPane lines={toLines(proposedText)} highlightSet={addedSet} mode="added" bordered={false} />
      </div>
      <div className="flex flex-wrap items-center gap-4 border-t border-slate-200 bg-slate-50 px-4 py-2.5 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded-sm bg-red-100" />Deleted</span>
        <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded-sm bg-emerald-100" />Added</span>
        <span>CIT-# citation reference</span>
      </div>
    </div>
  );
}

function DiffPane({
  lines,
  highlightSet,
  mode,
  bordered = true,
}: {
  lines: string[];
  highlightSet: Set<string>;
  mode: "removed" | "added";
  bordered?: boolean;
}) {
  return (
    <div
      className={clsx(
        "px-0 py-3 overflow-x-auto max-h-[calc(100vh-22rem)] min-h-[26rem] overflow-y-auto bg-white",
        bordered && "border-b border-slate-200 md:border-b-0 md:border-r"
      )}
    >
      {lines.map((line, idx) => {
        const highlighted = line.trim().length > 0 && highlightSet.has(line.trim());
        return (
          <div
            key={idx}
            className={clsx(
              "grid grid-cols-[2.75rem_1fr] gap-3 px-4 py-1.5 text-[13px] leading-6 whitespace-pre-wrap break-words",
              highlighted && mode === "removed" && "border-l-2 border-red-300 bg-red-50 text-red-700 line-through decoration-red-400",
              highlighted && mode === "added" && "border-l-2 border-emerald-400 bg-emerald-50 text-emerald-800",
              !highlighted && "text-slate-600"
            )}
          >
            <span className="select-none text-right text-slate-400">{idx + 1}</span>
            <span>{line || "\u00A0"}</span>
          </div>
        );
      })}
    </div>
  );
}
