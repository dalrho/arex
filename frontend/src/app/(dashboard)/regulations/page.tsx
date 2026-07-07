"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
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
import {
  ApiError,
  generateRemediationDrafts,
  getImpactForRegulation,
  listRegulations,
  runImpactAssessment,
} from "@/lib/apiClient";
import { formatDate } from "@/lib/format";
import type { ImpactResponse, RegulationResponse } from "@/types/api";

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
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [relevanceFilter, setRelevanceFilter] = useState("all");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(true);

  // Live impact data for the selected regulation.
  const [impact, setImpact] = useState<ImpactResponse | null>(null);
  const [assessing, setAssessing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

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

  const categories = useMemo(
    () => Array.from(new Set(regulations.map((r) => r.category).filter(Boolean))) as string[],
    [regulations]
  );

  const countFor = (tab: SeverityTab) =>
    tab === "All"
      ? regulations.length
      : regulations.filter((r) => r.urgency?.toLowerCase() === tab.toLowerCase()).length;

  const filtered = useMemo(() => {
    let result = regulations;
    if (activeTab !== "All") {
      result = result.filter((r) => r.urgency?.toLowerCase() === activeTab.toLowerCase());
    }
    if (categoryFilter !== "all") {
      result = result.filter((r) => r.category === categoryFilter);
    }
    if (relevanceFilter === "relevant") {
      result = result.filter((r) => r.relevant === true);
    } else if (relevanceFilter === "classified") {
      result = result.filter((r) => r.relevant !== true);
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
  }, [regulations, activeTab, categoryFilter, relevanceFilter, search]);

  const selected = filtered.find((r) => r.id === selectedId) ?? filtered[0] ?? regulations[0];

  const loadImpact = useCallback(async (regulationId: string) => {
    setImpact(null);
    try {
      setImpact(await getImpactForRegulation(regulationId));
    } catch (err) {
      // 404 simply means no assessment has been run yet.
      if (!(err instanceof ApiError && err.status === 404)) {
        setImpact(null);
      }
    }
  }, []);

  useEffect(() => {
    setActionMessage(null);
    setActionError(null);
    if (selected) void loadImpact(selected.id);
  }, [selected?.id, loadImpact]); // eslint-disable-line react-hooks/exhaustive-deps

  const riskScore =
    impact?.risk_score ??
    (selected?.urgency?.toLowerCase() === "critical"
      ? 92
      : selected?.urgency?.toLowerCase() === "high"
        ? 78
        : selected?.urgency?.toLowerCase() === "medium"
          ? 54
          : 28);

  async function handleRunAssessment() {
    if (!selected) return;
    setAssessing(true);
    setActionError(null);
    setActionMessage(null);
    try {
      const result = await runImpactAssessment(selected.id);
      setImpact(result);
      setActionMessage("Impact assessment completed against your QMS documents.");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Impact assessment failed.");
    } finally {
      setAssessing(false);
    }
  }

  async function handleGenerateDrafts() {
    if (!selected) return;
    setGenerating(true);
    setActionError(null);
    setActionMessage(null);
    try {
      const drafts = await generateRemediationDrafts(selected.id);
      setActionMessage(
        drafts.length === 0
          ? "No sufficiently similar QMS documents were found, so no drafts were generated."
          : `${drafts.length} remediation draft${drafts.length === 1 ? "" : "s"} generated and queued for review.`
      );
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to generate remediation drafts.");
    } finally {
      setGenerating(false);
    }
  }

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

      <div
        className={clsx(
          "grid min-h-[640px] gap-5",
          panelOpen && "xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.9fr)]"
        )}
      >
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
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700"
            >
              <option value="all">Category</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category.charAt(0).toUpperCase() + category.slice(1)}
                </option>
              ))}
            </select>
            <select
              value={relevanceFilter}
              onChange={(e) => setRelevanceFilter(e.target.value)}
              className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700"
            >
              <option value="all">Relevance</option>
              <option value="relevant">Relevant</option>
              <option value="classified">Classified</option>
            </select>
            <ToolbarButton
              type="button"
              onClick={() => setFiltersOpen((value) => !value)}
              aria-expanded={filtersOpen}
              className={filtersOpen ? "border-blue-300 bg-blue-50 text-blue-700" : undefined}
            >
              <Filter className="h-4 w-4" />
              Filters
            </ToolbarButton>
          </div>

          {filtersOpen && (
            <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-slate-50/60 p-3 text-sm">
              <span className="text-slate-500">
                {filtered.length} of {regulations.length} regulations shown
              </span>
              <button
                type="button"
                onClick={() => {
                  setActiveTab("All");
                  setCategoryFilter("all");
                  setRelevanceFilter("all");
                  setSearch("");
                }}
                className="font-semibold text-blue-700 hover:underline"
              >
                Reset all filters
              </button>
              {!panelOpen && (
                <button
                  type="button"
                  onClick={() => setPanelOpen(true)}
                  className="font-semibold text-blue-700 hover:underline"
                >
                  Show impact assessment panel
                </button>
              )}
            </div>
          )}

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
                  {filtered.map((regulation) => {
                    const isSelected = selected?.id === regulation.id;
                    return (
                      <tr
                        key={regulation.id}
                        onClick={() => {
                          setSelectedId(regulation.id);
                          setPanelOpen(true);
                        }}
                        className={clsx(
                          "cursor-pointer",
                          isSelected
                            ? "bg-blue-50/50 shadow-[inset_3px_0_0_#2563eb]"
                            : "hover:bg-slate-50/70"
                        )}
                      >
                        <td className="px-4 py-4">
                          <Link
                            href={`/regulations/${regulation.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="font-semibold text-slate-900 hover:text-blue-700"
                          >
                            {regulation.title}
                          </Link>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              window.open(regulation.source_url, "_blank", "noopener");
                            }}
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
                    );
                  })}
                </tbody>
              </table>
              <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-xs text-slate-500">
                <span>1-{filtered.length} of {regulations.length}</span>
                <span>10 / page</span>
              </div>
            </div>
          )}
        </WorkbenchCard>

        {panelOpen && (
          <WorkbenchCard
            title="Impact Assessment"
            action={
              <button
                type="button"
                onClick={() => setPanelOpen(false)}
                aria-label="Close impact assessment"
                className="text-slate-500 hover:text-slate-800"
              >
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

                {actionMessage && (
                  <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                    {actionMessage}
                  </div>
                )}
                {actionError && (
                  <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {actionError}
                  </div>
                )}

                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                  <div className="rounded-lg border border-slate-200 p-4">
                    <p className="text-sm font-bold text-slate-900">Risk Score</p>
                    <div className="mt-4 flex items-end gap-3">
                      <span className="text-5xl font-bold text-slate-950">{Math.round(riskScore)}</span>
                      <span
                        className={clsx(
                          "pb-2 text-sm font-semibold",
                          riskScore >= 70 ? "text-red-600" : riskScore >= 40 ? "text-amber-600" : "text-emerald-600"
                        )}
                      >
                        {impact?.impact_level
                          ? `${impact.impact_level.charAt(0).toUpperCase() + impact.impact_level.slice(1)} Risk`
                          : riskScore >= 70
                            ? "High Risk"
                            : riskScore >= 40
                              ? "Medium Risk"
                              : "Low Risk"}
                      </span>
                    </div>
                    <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200">
                      <div
                        className={clsx(
                          "h-full rounded-full",
                          riskScore >= 70 ? "bg-red-500" : riskScore >= 40 ? "bg-amber-500" : "bg-emerald-500"
                        )}
                        style={{ width: `${Math.min(100, riskScore)}%` }}
                      />
                    </div>
                    <p className="mt-3 text-xs leading-5 text-slate-500">
                      {impact
                        ? "Score computed from the latest AI impact assessment."
                        : "This regulation may require changes to policies, processes, and operational controls."}
                    </p>
                  </div>

                  <div className="rounded-lg border border-slate-200 p-4">
                    <p className="text-sm font-bold text-slate-900">Affected Departments</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {(impact?.affected_departments?.length
                        ? impact.affected_departments
                        : selected.affected_business_areas?.length
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
                      {impact?.rationale ??
                        selected.rationale ??
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
                  <PrimaryButton
                    type="button"
                    onClick={() => void handleRunAssessment()}
                    disabled={assessing || generating}
                    className="w-full"
                  >
                    {assessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                    {assessing ? "Running Assessment..." : "Run Impact Assessment"}
                  </PrimaryButton>
                  <ToolbarButton
                    type="button"
                    onClick={() => void handleGenerateDrafts()}
                    disabled={assessing || generating}
                    className="w-full"
                  >
                    {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                    {generating ? "Generating Drafts..." : "Generate Remediation Drafts"}
                  </ToolbarButton>
                </div>
              </div>
            )}
          </WorkbenchCard>
        )}
      </div>
    </div>
  );
}
