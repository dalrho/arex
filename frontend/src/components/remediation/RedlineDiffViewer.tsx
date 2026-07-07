import React from "react";
import clsx from "clsx";
import type { DiffContent } from "@/types/api";
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
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-xs font-semibold text-slate-500" htmlFor="compare-view">Compare view</label>
          <select id="compare-view" className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700">
            <option>Side-by-side</option>
            <option>Unified</option>
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-600">
          <span>Show changes</span>
          <StatusBadge label="Added" tone="emerald" />
          <StatusBadge label="Deleted" tone="red" />
          <StatusBadge label="Citations" tone="blue" />
        </div>
      </div>
      <div className="grid grid-cols-2 border-b border-slate-200 text-xs font-semibold">
        <div className="flex items-center gap-2 border-r border-slate-200 bg-slate-50 px-4 py-3 text-slate-700">
          Original SOP
          <StatusBadge label="v2.1" tone="slate" />
        </div>
        <div className="flex items-center gap-2 bg-slate-50 px-4 py-3 text-slate-700">
          AI Proposed Revision
          <StatusBadge label="v2.2" tone="emerald" />
        </div>
      </div>
      <div className="grid grid-cols-1 text-sm leading-relaxed md:grid-cols-2">
        <DiffPane lines={toLines(originalText)} highlightSet={removedSet} mode="removed" />
        <DiffPane lines={toLines(proposedText)} highlightSet={addedSet} mode="added" bordered={false} />
      </div>
      <div className="flex items-center gap-4 border-t border-slate-200 px-4 py-3 text-xs text-slate-500">
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
        "px-0 py-3 overflow-x-auto max-h-[34rem] overflow-y-auto",
        bordered && "border-r border-slate-200"
      )}
    >
      {lines.map((line, idx) => {
        const highlighted = line.trim().length > 0 && highlightSet.has(line.trim());
        return (
          <div
            key={idx}
            className={clsx(
              "grid grid-cols-[3rem_1fr] gap-3 px-4 py-1 whitespace-pre-wrap break-words text-[13px]",
              highlighted && mode === "removed" && "bg-red-50 text-red-700 line-through decoration-red-400",
              highlighted && mode === "added" && "bg-emerald-50 text-emerald-800",
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
