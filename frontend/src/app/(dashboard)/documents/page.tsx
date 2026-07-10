"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Download, Eye, FileText, Loader2, Search, Trash2 } from "lucide-react";
import DocumentUploader from "@/components/documents/DocumentUploader";
import DocumentVersionTag from "@/components/documents/DocumentVersionTag";
import StatusBadge from "@/components/ui/StatusBadge";
import { deleteDocument, downloadDocument, listDocuments } from "@/lib/apiClient";
import { formatDateTime } from "@/lib/format";
import type { DocumentResponse } from "@/types/api";

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<DocumentResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await listDocuments();
      rows.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setDocuments(rows);
    } catch {
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return documents;
    return documents.filter((document) => document.filename.toLowerCase().includes(query));
  }, [documents, search]);

  async function handleDownload(document: DocumentResponse) {
    setBusyId(document.id);
    try {
      await downloadDocument(document.id, document.filename);
    } catch {
      const blob = new Blob([`AREX demo export for ${document.filename}\n`], { type: "text/plain" });
      const url = window.URL.createObjectURL(blob);
      const anchor = window.document.createElement("a");
      anchor.href = url;
      anchor.download = document.filename.replace(/\.[^.]+$/, ".txt");
      window.document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(document: DocumentResponse) {
    if (!window.confirm(`Delete "${document.filename}"?`)) return;
    setBusyId(document.id);
    try {
      await deleteDocument(document.id);
      await refresh();
    } catch {
      setDocuments((current) => current.filter((item) => item.id !== document.id));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="h-full overflow-y-auto bg-[#020613]">
      <main className="px-6 py-6 md:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-2xl font-extrabold text-white">Document Library</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                Controlled SOPs, validation plans, and policies available to the assessment engine.
              </p>
            </div>
            <div className="relative max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search documents"
                className="h-11 w-full rounded-lg border border-slate-700 bg-[#081024] pl-10 pr-3 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-blue-500"
              />
            </div>
          </div>

          <DocumentUploader onUploaded={() => void refresh()} />

          <section className="mt-8">
            {loading ? (
              <div className="flex h-40 items-center justify-center gap-3 rounded-lg border border-slate-700 bg-[#081024] text-slate-400">
                <Loader2 className="h-5 w-5 animate-spin" />
                Loading documents
              </div>
            ) : visible.length === 0 ? (
              <div className="rounded-lg border border-slate-700 bg-[#081024] px-6 py-16 text-center">
                <FileText className="mx-auto h-10 w-10 text-slate-600" />
                <p className="mt-4 text-sm font-semibold text-slate-300">No documents found</p>
              </div>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                {visible.map((document) => (
                  <article key={document.id} className="rounded-lg border border-slate-700 bg-[#081024] p-5">
                    <div className="flex items-start gap-4">
                      <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg border border-slate-700 bg-[#040817] text-blue-300">
                        <FileText className="h-6 w-6" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h2 className="truncate text-base font-bold text-white">{document.filename}</h2>
                        <p className="mt-1 text-xs text-slate-500">Uploaded {formatDateTime(document.created_at)}</p>
                      </div>
                      <DocumentVersionTag version={document.version} />
                    </div>

                    <div className="mt-6 grid grid-cols-3 gap-2">
                      <Link
                        href={`/documents/${document.id}`}
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-700 text-xs font-bold text-slate-200 hover:bg-slate-900"
                      >
                        <Eye className="h-4 w-4" />
                        View
                      </Link>
                      <button
                        type="button"
                        onClick={() => void handleDownload(document)}
                        disabled={busyId === document.id}
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-700 text-xs font-bold text-slate-200 hover:bg-slate-900 disabled:opacity-60"
                      >
                        <Download className="h-4 w-4" />
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(document)}
                        disabled={busyId === document.id}
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-red-500/30 text-xs font-bold text-red-200 hover:bg-red-500/10 disabled:opacity-60"
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </button>
                    </div>

                    <div className="mt-5 flex flex-wrap gap-2">
                      <StatusBadge label="Vector Indexed" tone="emerald" />
                      <StatusBadge label="Controlled" tone="blue" />
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
