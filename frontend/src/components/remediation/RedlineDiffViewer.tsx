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

export default function RedlineDiffViewer({
  originalText,
  proposedText,
  diffContent,
}: RedlineDiffViewerProps) {
  const removedSet = new Set((diffContent?.removed ?? []).map((line) => line.trim()));
  const addedSet = new Set((diffContent?.added ?? []).map((line) => line.trim()));

  return (
    <div className="overflow-hidden rounded-lg border border-slate-700 bg-slate-950/55">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 bg-slate-950 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md border border-slate-700 bg-slate-900 text-slate-300">
            <Columns2 className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-white">SOP redline comparison</p>
            <p className="text-xs text-slate-500">Original text against proposed remediation draft</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">
          <StatusBadge label="Added" tone="emerald" />
          <StatusBadge label="Deleted" tone="red" />
          <StatusBadge label="Citations" tone="blue" />
        </div>
      </div>
      <div className="grid grid-cols-1 border-b border-slate-800 text-xs font-semibold md:grid-cols-2">
        <div className="flex items-center gap-2 border-b border-slate-800 bg-slate-950 px-4 py-2.5 text-slate-300 md:border-b-0 md:border-r">
          <FileText className="h-4 w-4 text-slate-500" />
          Current SOP
          <StatusBadge label="Original" tone="slate" />
        </div>
        <div className="flex items-center gap-2 bg-slate-950 px-4 py-2.5 text-slate-300">
          <FileText className="h-4 w-4 text-emerald-300" />
          Proposed SOP
          <StatusBadge label="Draft" tone="emerald" />
        </div>
      </div>
      <div className="grid grid-cols-1 text-sm leading-relaxed md:grid-cols-2">
        <DiffPane lines={toLines(originalText)} highlightSet={removedSet} mode="removed" />
        <DiffPane lines={toLines(proposedText)} highlightSet={addedSet} mode="added" bordered={false} />
      </div>
      <div className="flex flex-wrap items-center gap-4 border-t border-slate-800 bg-slate-950 px-4 py-2.5 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded-sm bg-red-500/20" />Deleted</span>
        <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded-sm bg-emerald-500/20" />Added</span>
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
        "max-h-[calc(100vh-22rem)] min-h-[24rem] overflow-x-auto overflow-y-auto bg-slate-950 px-0 py-3",
        bordered && "border-b border-slate-800 md:border-b-0 md:border-r"
      )}
    >
      {lines.map((line, idx) => {
        const highlighted = line.trim().length > 0 && highlightSet.has(line.trim());
        return (
          <div
            key={idx}
            className={clsx(
              "grid grid-cols-[2.75rem_1fr] gap-3 whitespace-pre-wrap break-words px-4 py-1.5 text-[13px] leading-6",
              highlighted && mode === "removed" && "border-l-2 border-red-400 bg-red-500/10 text-red-200 line-through decoration-red-300",
              highlighted && mode === "added" && "border-l-2 border-emerald-400 bg-emerald-500/10 text-emerald-100",
              !highlighted && "text-slate-400"
            )}
          >
            <span className="select-none text-right text-slate-600">{idx + 1}</span>
            <span>{line || "\u00A0"}</span>
          </div>
        );
      })}
    </div>
  );
}
