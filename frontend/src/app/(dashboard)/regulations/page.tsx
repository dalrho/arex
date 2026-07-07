"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ExternalLink, FileText, Filter, Loader2, Play, Search, X } from "lucide-react";
import clsx from "clsx";
import RiskBadge from "@/components/dashboard/RiskBadge";
import StatusBadge from "@/components/ui/StatusBadge";
import {
  EmptyState,
  PageHeader,
  PrimaryButton,
  ToolbarButton,
  ToolbarInput,
  WorkbenchCard,
} from "@/components/ui/Workbench";
import { listRegulations } from "@/lib/apiClient";
import { formatDate } from "@/lib/format";
import type { RegulationResponse } from "@/types/api";

const SEVERITY_TABS = ["All", "Critical", "High", "Medium", "Low"] as const;
type SeverityTab = (typeof SEVERITY_TABS)[number];

/**
 * Regulations Page ("/regulations")
 * Regulatory intelligence feed with color-coded severity.
 */
export default function RegulationsPage() {
  const [regulations, setRegulations] = useState<RegulationResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<SeverityTab>("All");
  const [search, setSearch] = useState("");

  useEffect(() => {
    listRegulations()
      .then((regs) => {
        regs.sort(
          (a, b) => new Date(b.published_date).getTime() - new Date(a.published_date).getTime()
        );
        setRegulations(regs);
      })
      .catch((err) =>
        setLoadError(err instanceof Error ? err.message : "Failed to load regulations.")
      )
      .finally(() => setLoading(false));
  }, []);

  const countFor = (tab: SeverityTab) =>
    tab === "All"
      ? regulations.length
      : regulations.filter((r) => r.urgency?.toLowerCase() === tab.toLowerCase()).length;

  const filtered = useMemo(() => {
    let result = regulations;
    if (activeTab !== "All") {
      result = result.filter((r) => r.urgency?.toLowerCase() === activeTab.toLowerCase());
    }
    const query = search.trim().toLowerCase();
    if (query) {
      result = result.filter(
        (r) =>
          r.title.toLowerCase().includes(query) ||
          (r.category ?? "").toLowerCase().includes(query)
      );
    }
    return result;
  }, [regulations, activeTab, search]);

  const selected = filtered[0] ?? regulations[0];
  const riskScore =
    selected?.urgency?.toLowerCase() === "critical"
      ? 92
      : selected?.urgency?.toLowerCase() === "high"
        ? 78
        : selected?.urgency?.toLowerCase() === "medium"
          ? 54
          : 28;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Regulatory Intelligence"
        description="Monitor FDA updates, triage relevance, and assess compliance impact."
      />

      <div className="flex flex-wrap items-center gap-2">
        {SEVERITY_TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={clsx(
              "inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-semibold transition-colors",
              activeTab === tab
                ? "border-blue-600 bg-blue-600 text-white"
                : "border-slate-200 bg-white text-slate-700 hover:border-blue-300"
            )}
          >
            {tab}
            <span
              className={clsx(
                "rounded-md px-1.5 py-0.5 text-[11px]",
                activeTab === tab ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
              )}
            >
              {countFor(tab)}
            </span>
          </button>
        ))}
      </div>

      <div className="grid min-h-[640px] gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.9fr)]">
        <WorkbenchCard>
          <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 p-3">
            <ToolbarInput
              icon={Search}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search regulations, keywords, categories..."
              className="min-w-[260px] flex-1"
            />
            <select className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700">
              <option>Category</option>
            </select>
            <select className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700">
              <option>Relevance</option>
            </select>
            <ToolbarButton type="button">
              <Filter className="h-4 w-4" />
              Filters
            </ToolbarButton>
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading regulations...
            </div>
          ) : loadError ? (
            <div className="px-4 py-16 text-center text-sm text-red-600">{loadError}</div>
          ) : filtered.length === 0 ? (
            <EmptyState
              title="No regulations match the current filters"
              description="Try a broader search or switch severity tabs."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[780px] text-left">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                    <th className="px-4 py-3">Title</th>
                    <th className="px-4 py-3">Severity</th>
                    <th className="px-4 py-3">Relevance</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Published</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((regulation, index) => (
                    <tr
                      key={regulation.id}
                      className={clsx(
                        "hover:bg-slate-50/70",
                        index === 0 && "bg-blue-50/50 shadow-[inset_3px_0_0_#2563eb]"
                      )}
                    >
                      <td className="px-4 py-4">
                        <Link
                          href={`/regulations/${regulation.id}`}
                          className="font-semibold text-slate-900 hover:text-blue-700"
                        >
                          {regulation.title}
                        </Link>
                        <button
                          type="button"
                          onClick={() => window.open(regulation.source_url, "_blank", "noopener")}
                          className="mt-1 flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline"
                        >
                          federalregister.gov
                          <ExternalLink className="h-3 w-3" />
                        </button>
                      </td>
                      <td className="px-4 py-4">
                        {regulation.urgency ? (
                          <RiskBadge level={regulation.urgency} />
                        ) : (
                          <StatusBadge label="Pending Analysis" tone="slate" />
                        )}
                      </td>
                      <td className="px-4 py-4">
                        {regulation.relevant === true ? (
                          <StatusBadge label="Relevant" tone="emerald" />
                        ) : (
                          <StatusBadge label="Classified" tone="slate" />
                        )}
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-600">
                        {regulation.category ?? "Quality Systems"}
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-500">
                        {formatDate(regulation.published_date)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-xs text-slate-500">
                <span>1-{filtered.length} of {regulations.length}</span>
                <span>10 / page</span>
              </div>
            </div>
          )}
        </WorkbenchCard>

        <WorkbenchCard
          title="Impact Assessment"
          action={
            <button type="button" aria-label="Close impact assessment" className="text-slate-500 hover:text-slate-800">
              <X className="h-4 w-4" />
            </button>
          }
        >
          {!selected ? (
            <EmptyState title="No regulation selected" description="Select a regulation to view impact analysis." />
          ) : (
            <div className="space-y-4 p-4">
              <div>
                <h2 className="text-base font-bold text-slate-950">{selected.title}</h2>
                <button
                  type="button"
                  onClick={() => window.open(selected.source_url, "_blank", "noopener")}
                  className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline"
                >
                  {selected.source_url}
                  <ExternalLink className="h-3 w-3" />
                </button>
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                <div className="rounded-lg border border-slate-200 p-4">
                  <p className="text-sm font-bold text-slate-900">Risk Score</p>
                  <div className="mt-4 flex items-end gap-3">
                    <span className="text-5xl font-bold text-slate-950">{riskScore}</span>
                    <span className="pb-2 text-sm font-semibold text-red-600">High Risk</span>
                  </div>
                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200">
                    <div className="h-full rounded-full bg-red-500" style={{ width: `${riskScore}%` }} />
                  </div>
                  <p className="mt-3 text-xs leading-5 text-slate-500">
                    This regulation may require changes to policies, processes, and operational controls.
                  </p>
                </div>

                <div className="rounded-lg border border-slate-200 p-4">
                  <p className="text-sm font-bold text-slate-900">Affected Departments</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {(selected.affected_business_areas?.length
                      ? selected.affected_business_areas
                      : ["Quality", "Regulatory Affairs", "Operations", "IT / Systems"]
                    ).map((area) => (
                      <StatusBadge key={area} label={area} tone="blue" />
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                <div className="rounded-lg border border-slate-200 p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <p className="text-sm font-bold text-slate-900">Affected SOPs</p>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">6</span>
                  </div>
                  {["SOP-001 Quality Management System", "SOP-014 Corrective and Preventive Action", "SOP-023 Management Review", "SOP-050 Document and Record Control"].map((sop) => (
                    <div key={sop} className="flex items-center justify-between border-t border-slate-100 py-2 text-xs">
                      <span className="font-medium text-slate-700">{sop}</span>
                      <StatusBadge label="High" tone="red" />
                    </div>
                  ))}
                </div>

                <div className="rounded-lg border border-slate-200 p-4">
                  <p className="text-sm font-bold text-slate-900">Agent Rationale</p>
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    {selected.rationale ??
                      "The final rule strengthens requirements for quality-system controls and documented evidence. Current SOPs may require updates to clarify ownership, review timing, and traceability."}
                  </p>
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-bold text-slate-900">Semantic Match Confidence</p>
                    <p className="text-xs text-slate-500">Based on similarity between regulation text and controlled content.</p>
                  </div>
                  <p className="text-2xl font-bold text-slate-950">0.86</p>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
                  <div className="h-full w-[86%] rounded-full bg-emerald-500" />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <PrimaryButton type="button" className="w-full">
                  <Play className="h-4 w-4" />
                  Run Impact Assessment
                </PrimaryButton>
                <ToolbarButton type="button" className="w-full">
                  <FileText className="h-4 w-4" />
                  Generate Remediation Drafts
                </ToolbarButton>
              </div>
            </div>
          )}
        </WorkbenchCard>
      </div>
    </div>
  );
}
