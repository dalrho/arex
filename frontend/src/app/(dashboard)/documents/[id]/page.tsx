"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Download,
  FileText,
  GitCompare,
  History,
  Loader2,
  AlertCircle,
  CheckCircle,
  MessageSquare,
  Bookmark,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import {
  getDocument,
  listDocumentVersions,
  downloadDocumentVersion,
  getDocumentVersionAnnotations,
} from "@/lib/apiClient";
import { formatDateTime } from "@/lib/format";
import type { DocumentResponse, DocumentVersionResponse, DocumentAnnotationResponse } from "@/types/api";

export default function DocumentDetailPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();

  const [document, setDocument] = useState<DocumentResponse | null>(null);
  const [versions, setVersions] = useState<DocumentVersionResponse[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<DocumentVersionResponse | null>(null);
  const [annotations, setAnnotations] = useState<DocumentAnnotationResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingAnnotations, setLoadingAnnotations] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Compare mode state
  const [compareMode, setCompareMode] = useState(false);
  const [compareVersion, setCompareVersion] = useState<DocumentVersionResponse | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const doc = await getDocument(id);
      setDocument(doc);

      const vers = await listDocumentVersions(id);
      // Sort: highest version first
      vers.sort((a, b) => b.version - a.version);
      setVersions(vers);

      // Select latest version by default
      if (vers.length > 0) {
        setSelectedVersion(vers[0]);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to load document version history.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Load annotations when selected version changes
  useEffect(() => {
    if (!selectedVersion) return;

    async function loadAnnotations() {
      setLoadingAnnotations(true);
      try {
        const annots = await getDocumentVersionAnnotations(id, selectedVersion!.version);
        setAnnotations(annots);
      } catch {
        setAnnotations([]);
      } finally {
        setLoadingAnnotations(false);
      }
    }

    void loadAnnotations();
  }, [id, selectedVersion]);

  const handleDownloadVersion = async (v: DocumentVersionResponse) => {
    try {
      await downloadDocumentVersion(id, v.version, v.filename);
    } catch (err: any) {
      alert(err?.message || "Failed to download version file.");
    }
  };

  // Simple text comparison / diff function
  const renderTextDiff = (text1: string, text2: string) => {
    const lines1 = text1.split("\n");
    const lines2 = text2.split("\n");

    // Unified diff display logic (mock-ish or simple line comparison)
    // To make it look gorgeous, let's display changes inline or line by line
    return (
      <div className="space-y-1 font-mono text-xs text-slate-300">
        {lines2.map((line, idx) => {
          const matchingLine = lines1[idx];
          if (matchingLine === line) {
            return (
              <div key={idx} className="px-2 py-0.5 text-slate-400">
                {line}
              </div>
            );
          } else if (matchingLine === undefined) {
            return (
              <div key={idx} className="bg-emerald-950/40 px-2 py-0.5 text-emerald-300 border-l-2 border-emerald-500">
                + {line}
              </div>
            );
          } else {
            return (
              <div key={idx} className="space-y-1 border-l-2 border-amber-500 bg-amber-950/20">
                <div className="bg-red-950/40 px-2 py-0.5 text-red-300 line-through">
                  - {matchingLine}
                </div>
                <div className="bg-emerald-950/40 px-2 py-0.5 text-emerald-300">
                  + {line}
                </div>
              </div>
            );
          }
        })}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-[#020613] text-slate-400">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          <p className="text-sm">Loading GxP Version History...</p>
        </div>
      </div>
    );
  }

  if (error || !document) {
    return (
      <div className="flex h-full items-center justify-center bg-[#020613] px-6 text-slate-400">
        <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-6 text-center max-w-md">
          <AlertCircle className="mx-auto h-12 w-12 text-red-400 mb-4" />
          <h3 className="text-lg font-bold text-white mb-2">Error Loading Document</h3>
          <p className="text-sm text-slate-400 mb-4">{error || "Document not found"}</p>
          <Link
            href="/documents"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-xs font-bold text-white hover:bg-blue-700"
          >
            <ArrowLeft className="h-4 w-4" /> Return to Library
          </Link>
        </div>
      </div>
    );
  }

  const isPdf = document.filename.toLowerCase().endsWith(".pdf");

  return (
    <div className="h-full overflow-y-auto bg-[#020613]">
      <main className="px-6 py-6 md:px-10">
        <div className="mx-auto max-w-7xl">
          {/* Header */}
          <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/documents"
                className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-700 bg-[#081024] text-slate-400 hover:text-white"
              >
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-extrabold text-white">{document.filename}</h1>
                  <span className="rounded bg-blue-900/60 px-2 py-0.5 text-xs font-semibold text-blue-300 border border-blue-700/50">
                    v{document.version}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  Document ID: <code className="text-slate-500">{document.id}</code>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => selectedVersion && void handleDownloadVersion(selectedVersion)}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-700 bg-[#081024] px-4 text-xs font-bold text-slate-200 hover:bg-slate-900"
              >
                <Download className="h-4 w-4" />
                Download Selected
              </button>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-12">
            {/* Version List Sidebar */}
            <section className="lg:col-span-4 rounded-xl border border-slate-800 bg-[#081024]/50 p-5 backdrop-blur-sm">
              <div className="mb-4 flex items-center gap-2 text-sm font-bold text-white">
                <History className="h-4 w-4 text-blue-400" />
                <h2>GxP Version History</h2>
              </div>
              <p className="mb-4 text-xs text-slate-400 leading-relaxed">
                Immutable trail of revisions. PDF revisions overlay highlight reviews, while DOCX files patch the text.
              </p>

              <div className="space-y-3">
                {versions.map((v) => {
                  const isSelected = selectedVersion?.version === v.version;
                  const isCompareTarget = compareVersion?.version === v.version;
                  return (
                    <div
                      key={v.id}
                      onClick={() => {
                        if (compareMode) {
                          setCompareVersion(v);
                        } else {
                          setSelectedVersion(v);
                        }
                      }}
                      className={`relative cursor-pointer rounded-lg border p-3.5 transition-all ${
                        isSelected && !compareMode
                          ? "border-blue-500 bg-blue-950/20"
                          : isCompareTarget && compareMode
                          ? "border-amber-500 bg-amber-950/20"
                          : "border-slate-800 bg-[#040817] hover:border-slate-700"
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs font-extrabold ${
                                v.version === 1
                                  ? "bg-slate-800 text-slate-300"
                                  : "bg-indigo-950 text-indigo-300 border border-indigo-700/40"
                              }`}
                            >
                              Version {v.version}
                            </span>
                            {v.version === document.version && (
                              <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-950/50 px-1.5 py-0.5 rounded border border-emerald-900/30">
                                Current
                              </span>
                            )}
                          </div>
                          <h3 className="mt-2 truncate text-xs font-bold text-slate-200">
                            {v.filename}
                          </h3>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleDownloadVersion(v);
                          }}
                          className="text-slate-500 hover:text-white"
                          title="Download this version"
                        >
                          <Download className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="mt-3 border-t border-slate-900 pt-2">
                        <p className="text-[11px] text-slate-400">
                          <span className="font-semibold text-slate-300">Reason:</span> {v.reason_for_revision}
                        </p>
                        <p className="mt-1 text-[10px] text-slate-500">
                          {formatDateTime(v.created_at)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Document Viewer Workspace */}
            <section className="lg:col-span-8 space-y-6">
              {/* Toolbar */}
              <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-[#081024]/30 px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">Viewing:</span>
                  <span className="text-xs font-extrabold text-white">
                    {compareMode
                      ? `Comparing v${compareVersion?.version || "?"} and v${selectedVersion?.version}`
                      : `Version ${selectedVersion?.version || "?"}`}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setCompareMode(!compareMode);
                      if (!compareMode) {
                        // Default second version to v1 if current selected is v2
                        const nextCompare = versions.find((v) => v.version !== selectedVersion?.version) || null;
                        setCompareVersion(nextCompare);
                      }
                    }}
                    className={`inline-flex h-8 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-bold transition-all ${
                      compareMode
                        ? "bg-amber-600 hover:bg-amber-700 text-white"
                        : "border border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800"
                    }`}
                  >
                    <GitCompare className="h-3.5 w-3.5" />
                    {compareMode ? "Exit Compare" : "Compare Versions"}
                  </button>
                </div>
              </div>

              {compareMode ? (
                /* Compare Layout */
                <div className="rounded-xl border border-slate-800 bg-[#081024]/50 p-6 backdrop-blur-sm">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <GitCompare className="h-4 w-4 text-amber-400" />
                      Revisions Comparison Workspace
                    </h3>
                    <span className="text-xs text-slate-500">
                      Red = Removed ({compareVersion ? `v${compareVersion.version}` : ""}), Green = Added ({selectedVersion ? `v${selectedVersion.version}` : ""})
                    </span>
                  </div>

                  <div className="rounded-lg border border-slate-900 bg-[#040817] p-4 max-h-[500px] overflow-y-auto">
                    {compareVersion && selectedVersion
                      ? renderTextDiff(compareVersion.parsed_text || "", selectedVersion.parsed_text || "")
                      : <p className="text-xs text-slate-500 text-center">Select versions to compare in the sidebar.</p>}
                  </div>
                </div>
              ) : (
                /* Single Version Viewer & Annotations */
                <div className="space-y-6">
                  {/* PDF Overlay Review Highlights Display */}
                  {isPdf && (
                    <div className="rounded-xl border border-slate-800 bg-[#081024]/50 p-6 backdrop-blur-sm">
                      <div className="mb-4 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Sparkles className="h-4 w-4 text-blue-400" />
                          <h3 className="text-sm font-bold text-white">
                            PDF Overlay Review Copy
                          </h3>
                        </div>
                        <span className="rounded-full bg-emerald-950/60 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-400 border border-emerald-800/40">
                          GxP Immutable Template v1
                        </span>
                      </div>

                      <p className="mb-6 text-xs leading-relaxed text-slate-400">
                        In compliance with FDA GxP guidelines, the original binary PDF layout, fonts, and graphics remain unchanged. Overlaid highlights below show recommended remediation drafts for audit review:
                      </p>

                      {loadingAnnotations ? (
                        <div className="flex h-32 items-center justify-center gap-2 text-xs text-slate-500">
                          <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                          Extracting annotations from PDF template...
                        </div>
                      ) : annotations.length === 0 ? (
                        <div className="rounded-lg border border-dashed border-slate-800 bg-[#040817] py-12 text-center text-slate-500">
                          <CheckCircle className="mx-auto h-8 w-8 text-slate-600 mb-2" />
                          <p className="text-xs font-semibold">No annotations found in this version.</p>
                          <p className="text-[11px] text-slate-600 mt-1">This version is identical to the original SOP template.</p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                            Remediation Recommendations ({annotations.length})
                          </div>
                          {annotations.map((annot) => {
                            // Determine border/text classes based on comment type
                            let borderClass = "border-amber-500 bg-amber-950/10";
                            let iconColor = "text-amber-400";
                            let typeLabel = "Replacement suggestion";

                            if (annot.title.toLowerCase().includes("deletion")) {
                              borderClass = "border-red-500 bg-red-950/10";
                              iconColor = "text-red-400";
                              typeLabel = "Deletion suggestion";
                            } else if (annot.title.toLowerCase().includes("insertion")) {
                              borderClass = "border-emerald-500 bg-emerald-950/10";
                              iconColor = "text-emerald-400";
                              typeLabel = "Insertion suggestion";
                            }

                            return (
                              <div
                                key={annot.id}
                                className={`rounded-lg border p-4.5 transition-all ${borderClass}`}
                              >
                                <div className="flex items-start justify-between">
                                  <div className="flex items-center gap-2">
                                    <MessageSquare className={`h-4 w-4 ${iconColor}`} />
                                    <span className="text-xs font-extrabold text-white">
                                      {annot.title}
                                    </span>
                                  </div>
                                  <span className="text-[10px] font-bold text-slate-500 uppercase">
                                    Page {annot.page} • {typeLabel}
                                  </span>
                                </div>

                                <div className="mt-3 grid gap-3 text-xs md:grid-cols-2">
                                  {annot.section && annot.section !== "N/A" && (
                                    <div className="col-span-2">
                                      <span className="font-semibold text-slate-400">Section Number:</span>{" "}
                                      <span className="rounded bg-slate-900 px-1.5 py-0.5 font-mono text-[10px] text-blue-300">
                                        {annot.section}
                                      </span>
                                    </div>
                                  )}

                                  <div className="rounded border border-slate-900 bg-slate-950/60 p-2.5">
                                    <span className="block text-[10px] font-extrabold uppercase text-slate-500 mb-1">
                                      Original Text (Highlighted)
                                    </span>
                                    <p className="text-slate-300 italic font-mono text-[11px] leading-relaxed">
                                      &ldquo;{annot.original_text}&rdquo;
                                    </p>
                                  </div>

                                  <div className="rounded border border-slate-900 bg-slate-950/60 p-2.5">
                                    <span className="block text-[10px] font-extrabold uppercase text-slate-500 mb-1">
                                      Proposed Revision Overlay
                                    </span>
                                    <p className="text-emerald-300 font-mono text-[11px] leading-relaxed">
                                      {annot.proposed_text}
                                    </p>
                                  </div>

                                  {annot.justification && (
                                    <div className="col-span-2 rounded border border-slate-900 bg-slate-950/60 p-2.5">
                                      <span className="block text-[10px] font-extrabold uppercase text-slate-500 mb-1">
                                        Justification / Audit Rationale
                                      </span>
                                      <p className="text-slate-300 leading-relaxed">
                                        {annot.justification}
                                      </p>
                                    </div>
                                  )}

                                  {annot.regulation_reference && (
                                    <div className="col-span-2 flex items-center gap-2 text-[11px]">
                                      <Bookmark className="h-3 w-3 text-indigo-400" />
                                      <span className="font-semibold text-slate-400">Compliance Reference:</span>
                                      <span className="text-indigo-300 font-medium">
                                        {annot.regulation_reference}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Standard Document Raw Text Display */}
                  <div className="rounded-xl border border-slate-800 bg-[#081024]/50 p-6 backdrop-blur-sm">
                    <div className="mb-4 flex items-center justify-between">
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <FileText className="h-4 w-4 text-blue-400" />
                        Plain Text View ({selectedVersion?.filename})
                      </h3>
                      <span className="text-xs text-slate-500">
                        Total length: {selectedVersion?.parsed_text?.length || 0} characters
                      </span>
                    </div>

                    <div className="rounded-lg border border-slate-900 bg-[#040817] p-4 max-h-[400px] overflow-y-auto font-mono text-xs text-slate-400 whitespace-pre-wrap leading-relaxed">
                      {selectedVersion?.parsed_text || "No text content available."}
                    </div>
                  </div>
                </div>
              )}
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
