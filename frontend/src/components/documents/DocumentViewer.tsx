"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AlertCircle, FileText, Loader2, RotateCcw } from "lucide-react";

interface DocumentViewerProps {
  filename: string;
  blob: Blob | null;
  loading: boolean;
  error: string | null;
  onRetry?: () => void;
}

function getFileKind(filename: string): "pdf" | "text" | "unknown" {
  const ext = filename.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return "pdf";
  if (ext === "txt") return "text";
  return "unknown";
}

export default function DocumentViewer({
  filename,
  blob,
  loading,
  error,
  onRetry,
}: DocumentViewerProps) {
  const fileKind = useMemo(() => getFileKind(filename), [filename]);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);

  useEffect(() => {
    setObjectUrl(null);
    setTextContent(null);
    setRenderError(null);

    if (!blob) return;

    if (fileKind === "pdf") {
      const url = window.URL.createObjectURL(blob);
      setObjectUrl(url);
      return () => window.URL.revokeObjectURL(url);
    }

    if (fileKind === "text" || fileKind === "unknown") {
      let cancelled = false;
      void blob.text().then(
        (text) => {
          if (!cancelled) setTextContent(text);
        },
        () => {
          if (!cancelled) setRenderError("Unable to read document content.");
        }
      );
      return () => {
        cancelled = true;
      };
    }
  }, [blob, fileKind]);

  if (loading) {
    return (
      <section className="flex min-h-[500px] flex-col items-center justify-center rounded-lg border border-slate-700 bg-[#081024] px-6 py-12 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-slate-500" />
        <p className="mt-4 text-sm font-semibold text-slate-400">Loading document preview</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="flex min-h-[500px] flex-col items-center justify-center rounded-lg border border-slate-700 bg-[#081024] px-6 py-12 text-center">
        <AlertCircle className="h-10 w-10 text-red-400" />
        <p className="mt-4 text-sm font-semibold text-slate-200">Unable to load document</p>
        <p className="mt-2 max-w-md text-sm text-slate-500">{error}</p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-6 inline-flex h-10 items-center gap-2 rounded-lg border border-slate-700 px-4 text-xs font-bold text-slate-200 hover:bg-slate-900"
          >
            <RotateCcw className="h-4 w-4" />
            Retry
          </button>
        )}
      </section>
    );
  }

  if (renderError) {
    return (
      <section className="flex min-h-[500px] flex-col items-center justify-center rounded-lg border border-slate-700 bg-[#081024] px-6 py-12 text-center">
        <AlertCircle className="h-10 w-10 text-red-400" />
        <p className="mt-4 text-sm font-semibold text-slate-200">{renderError}</p>
      </section>
    );
  }

  if (fileKind === "pdf" && objectUrl) {
    return (
      <section className="overflow-hidden rounded-lg border border-slate-700 bg-[#081024]">
        <div className="border-b border-slate-800 px-4 py-3">
          <p className="text-xs font-extrabold uppercase text-slate-500">Document preview</p>
        </div>
        <iframe
          src={objectUrl}
          title={filename}
          className="min-h-[500px] w-full bg-white"
        />
      </section>
    );
  }

  if (textContent !== null) {
    return (
      <section className="overflow-hidden rounded-lg border border-slate-700 bg-[#081024]">
        <div className="border-b border-slate-800 px-4 py-3">
          <p className="text-xs font-extrabold uppercase text-slate-500">Document preview</p>
        </div>
        <pre className="max-h-[70vh] min-h-[500px] overflow-auto whitespace-pre-wrap break-words p-6 font-mono text-sm leading-relaxed text-slate-200">
          {textContent}
        </pre>
      </section>
    );
  }

  return (
    <section className="flex min-h-[500px] flex-col items-center justify-center rounded-lg border border-slate-700 bg-[#081024] px-6 py-12 text-center">
      <FileText className="h-14 w-14 text-slate-600" />
      <p className="mt-5 text-base font-bold text-slate-200">No preview available</p>
      <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">
        This file type cannot be previewed inline. Use Download to inspect the source file.
      </p>
    </section>
  );
}
