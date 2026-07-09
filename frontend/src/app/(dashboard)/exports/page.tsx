"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Box, Download, FileText, Loader2, RefreshCw } from "lucide-react";
import StatusBadge from "@/components/ui/StatusBadge";
import { downloadRemediationExport, listRemediations } from "@/lib/apiClient";
import { demoRegulations, demoRemediations } from "@/lib/demoData";
import type { RemediationResponse } from "@/types/api";

const exportRows = [
  { label: "Export Compliance Report", format: "pdf" as const, icon: FileText },
  { label: "Export Updated SOP", format: "pdf" as const, icon: FileText },
  { label: "Export Full Audit Bundle", format: "pdf" as const, icon: FileText },
  { label: "Export Word Document", format: "docx" as const, icon: FileText },
  { label: "Download Implementation Tasks", format: "pdf" as const, icon: Box },
];

export default function ExportsPage() {
  const [drafts, setDrafts] = useState<RemediationResponse[]>(demoRemediations);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    listRemediations()
      .then((rows) => setDrafts(rows.length > 0 ? rows : demoRemediations))
      .catch(() => setDrafts(demoRemediations))
      .finally(() => setLoading(false));
  }, []);

  const exportDraft = useMemo(
    () => drafts.find((draft) => draft.status === "APPROVED") ?? drafts[0] ?? demoRemediations[0],
    [drafts]
  );

  async function handleDownload(label: string, format: "pdf" | "docx") {
    setDownloading(label);
    try {
      await downloadRemediationExport(exportDraft.id, format);
    } catch {
      const blob = new Blob([`Sentinel OS demo package: ${label}\n`], { type: "text/plain" });
      const url = window.URL.createObjectURL(blob);
      const anchor = window.document.createElement("a");
      anchor.href = url;
      anchor.download = `${label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}.${format}`;
      window.document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
    } finally {
      setDownloading(null);
    }
  }

  return (
    <div className="flex h-full min-w-0 bg-[#020613]">
      <div className="min-w-0 flex-1 overflow-y-auto">
        <main className="px-6 py-6 md:px-10">
          <div className="mx-auto max-w-4xl">
            <Link href="/regulations" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-blue-300">
              <ArrowLeft className="h-4 w-4" />
              Back to Regulatory Updates
            </Link>

            <h1 className="mt-6 text-2xl font-extrabold text-white">Export Package</h1>

            <section className="mt-8 space-y-4">
              {loading ? (
                <div className="flex h-20 items-center gap-3 rounded-2xl border border-slate-700 bg-[#081024] px-7 text-slate-400">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Preparing export package
                </div>
              ) : exportRows.map((row) => {
                const Icon = row.icon;
                return (
                  <button
                    key={row.label}
                    type="button"
                    onClick={() => void handleDownload(row.label, row.format)}
                    disabled={downloading === row.label}
                    className="group flex h-20 w-full items-center gap-6 rounded-2xl border border-slate-700 bg-[#081024] px-7 text-left transition hover:border-blue-500 disabled:opacity-60"
                  >
                    <Icon className="h-7 w-7 text-slate-500 group-hover:text-blue-300" />
                    <span className="min-w-0 flex-1 text-2xl font-medium text-white">{row.label}</span>
                    <span className="inline-flex items-center gap-2 text-sm font-bold uppercase text-slate-500">
                      {downloading === row.label ? <Loader2 className="h-4 w-4 animate-spin" /> : row.format}
                      <Download className="h-5 w-5" />
                    </span>
                  </button>
                );
              })}
            </section>
          </div>
        </main>
      </div>

      <aside className="hidden w-shell-rail flex-shrink-0 overflow-y-auto border-l border-slate-700 bg-[#020613] px-6 py-6 xl:block">
        <div className="mb-6 flex justify-end">
          <button
            type="button"
            className="inline-flex h-10 items-center gap-3 rounded-lg bg-blue-600 px-7 text-sm font-bold text-white hover:bg-blue-500"
          >
            <RefreshCw className="h-5 w-5" />
            Fetch
          </button>
        </div>
        <div className="space-y-5">
          {demoRegulations.map((regulation, index) => (
            <article key={regulation.id} className="rounded-lg border border-slate-700 bg-slate-800/90 p-4">
              <h2 className="line-clamp-3 text-sm font-extrabold uppercase leading-5 text-white">{regulation.title}</h2>
              <p className="mt-2 text-xs font-medium text-slate-400">{regulation.source_url.replace(/^https?:\/\//, "")}</p>
              <div className="mt-3">
                <StatusBadge label={index === 0 ? "Pending Analysis" : "Analysis Complete"} tone={index === 0 ? "amber" : "emerald"} />
              </div>
            </article>
          ))}
        </div>
      </aside>
    </div>
  );
}
