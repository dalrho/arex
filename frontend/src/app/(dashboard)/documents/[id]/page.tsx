"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, FileText, Loader2 } from "lucide-react";
import DocumentVersionTag from "@/components/documents/DocumentVersionTag";
import { getDocument } from "@/lib/apiClient";
import { formatDateTime } from "@/lib/format";
import type { DocumentResponse } from "@/types/api";

/**
 * Document Detail Page ("/documents/[id]")
 * Metadata card for a single QMS document.
 */
export default function DocumentDetailPage({ params }: { params: { id: string } }) {
  const [doc, setDoc] = useState<DocumentResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getDocument(params.id)
      .then(setDoc)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load document."));
  }, [params.id]);

  if (error) {
    return (
      <div className="space-y-4">
        <BackLink />
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-6 text-sm text-red-700">{error}</div>
      </div>
    );
  }

  if (!doc) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading document...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <BackLink />
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
              <FileText className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">{doc.filename}</h1>
              <p className="text-xs text-slate-400 mt-0.5">Document ID: {doc.id}</p>
            </div>
          </div>
          <DocumentVersionTag version={doc.version} />
        </div>

        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div className="rounded-lg bg-slate-50 border border-slate-100 p-4">
            <dt className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Uploaded</dt>
            <dd className="mt-1 font-medium text-slate-800">{formatDateTime(doc.created_at)}</dd>
          </div>
          <div className="rounded-lg bg-slate-50 border border-slate-100 p-4">
            <dt className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Current Version</dt>
            <dd className="mt-1 font-medium text-slate-800">Revision {doc.version}</dd>
          </div>
          <div className="rounded-lg bg-slate-50 border border-slate-100 p-4 sm:col-span-2">
            <dt className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Tenant Scope</dt>
            <dd className="mt-1 font-mono text-xs text-slate-600">{doc.organization_id}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/documents"
      className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-blue-600"
    >
      <ArrowLeft className="h-4 w-4" /> Back to Documents
    </Link>
  );
}
