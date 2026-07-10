"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Download, FileText, Loader2 } from "lucide-react";
import DocumentVersionTag from "@/components/documents/DocumentVersionTag";
import DocumentViewer from "@/components/documents/DocumentViewer";
import { downloadDocument, fetchDocumentBlob, getDocument } from "@/lib/apiClient";
import { formatDateTime } from "@/lib/format";
import type { DocumentResponse } from "@/types/api";

export default function DocumentDetailPage({ params }: { params: { id: string } }) {
  const [document, setDocument] = useState<DocumentResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const loadPreview = useCallback(async (doc: DocumentResponse) => {
    setPreviewLoading(true);
    setPreviewError(null);
    setPreviewBlob(null);
    try {
      const blob = await fetchDocumentBlob(doc.id, true);
      setPreviewBlob(blob);
    } catch {
      setPreviewError("Failed to fetch document content preview.");
    } finally {
      setPreviewLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    getDocument(params.id)
      .then(setDocument)
      .catch(() => setDocument(null))
      .finally(() => setLoading(false));
  }, [params.id]);

  useEffect(() => {
    if (!document) return;
    void loadPreview(document);
  }, [document, loadPreview]);

  async function handleDownload() {
    if (!document) return;
    setDownloading(true);
    try {
      await downloadDocument(document.id, document.filename);
    } catch {
      alert("Failed to download document file.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="h-full overflow-y-auto bg-[#020613]">
      <main className="px-6 py-6 md:px-10">
        <div className="mx-auto max-w-5xl">
          <Link href="/documents" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-blue-300">
            <ArrowLeft className="h-4 w-4" />
            Back to documents
          </Link>

          {loading || !document ? (
            <div className="mt-10 flex h-40 items-center justify-center gap-3 rounded-lg border border-slate-700 bg-[#081024] text-slate-400">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading document
            </div>
          ) : (
            <div className="mt-8 space-y-6">
              <div className="flex flex-col gap-5 rounded-lg border border-slate-700 bg-[#081024] p-6 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-3">
                    <FileText className="h-7 w-7 flex-shrink-0 text-blue-300" />
                    <h2 className="truncate text-2xl font-extrabold text-white">{document.filename}</h2>
                  </div>
                  <p className="mt-3 text-sm text-slate-400">Uploaded {formatDateTime(document.created_at)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleDownload()}
                  disabled={downloading}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 text-sm font-bold text-white hover:bg-blue-500 disabled:opacity-60"
                >
                  {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  Download
                </button>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <Meta label="Version" value={<DocumentVersionTag version={document.version} />} />
                <Meta label="Document ID" value={document.id.slice(0, 8).toUpperCase()} />
                <Meta label="Storage Path" value={document.file_path} />
              </div>

              <DocumentViewer
                filename={document.filename}
                blob={previewBlob}
                loading={previewLoading}
                error={previewError}
                parsedText={document.parsed_text}
                onRetry={() => void loadPreview(document)}
              />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-700 bg-[#081024] p-5">
      <p className="text-xs font-extrabold uppercase text-slate-500">{label}</p>
      <div className="mt-2 truncate text-sm font-semibold text-slate-200">{value}</div>
    </div>
  );
}
