"use client";

import React, { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { CheckCircle2, FileText, Info, Loader2, UploadCloud, X, XCircle } from "lucide-react";
import clsx from "clsx";
import { uploadDocument } from "@/lib/apiClient";
import StatusBadge from "@/components/ui/StatusBadge";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

type UploadStatus = "uploading" | "indexed" | "failed";

interface UploadItem {
  id: string;
  filename: string;
  size: number;
  status: UploadStatus;
  error?: string;
}

interface DocumentUploaderProps {
  onUploaded: () => void;
}

export interface DocumentUploaderHandle {
  openFileDialog: () => void;
}

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

const DocumentUploader = forwardRef<DocumentUploaderHandle, DocumentUploaderProps>(
  function DocumentUploader({ onUploaded }, ref) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [dragActive, setDragActive] = useState(false);
    const [items, setItems] = useState<UploadItem[]>([]);

    useImperativeHandle(ref, () => ({
      openFileDialog: () => inputRef.current?.click(),
    }));

    function updateItem(id: string, patch: Partial<UploadItem>) {
      setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
    }

    async function handleFiles(files: FileList | File[]) {
      for (const file of Array.from(files)) {
        const id = `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const ext = file.name.toLowerCase().split(".").pop();

        if (ext !== "pdf" && ext !== "txt") {
          setItems((prev) => [
            ...prev,
            { id, filename: file.name, size: file.size, status: "failed", error: "Only PDF and TXT files are allowed." },
          ]);
          continue;
        }
        if (file.size > MAX_FILE_SIZE) {
          setItems((prev) => [
            ...prev,
            { id, filename: file.name, size: file.size, status: "failed", error: "File exceeds the 10 MB limit." },
          ]);
          continue;
        }

        setItems((prev) => [...prev, { id, filename: file.name, size: file.size, status: "uploading" }]);
        try {
          await uploadDocument(file);
          updateItem(id, { status: "indexed" });
          onUploaded();
        } catch (err) {
          updateItem(id, {
            status: "failed",
            error: err instanceof Error ? err.message : "Upload failed.",
          });
        }
      }
    }

    function onDrop(event: React.DragEvent<HTMLDivElement>) {
      event.preventDefault();
      setDragActive(false);
      if (event.dataTransfer.files?.length) void handleFiles(event.dataTransfer.files);
    }

    return (
      <div className="rounded-lg border border-dashed border-slate-700 bg-slate-950/55 p-5">
        <div
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={onDrop}
          className={clsx(
            "grid cursor-pointer grid-cols-1 gap-6 rounded-md px-2 py-3 text-center transition-colors xl:grid-cols-[260px_1fr] xl:text-left",
            dragActive ? "bg-blue-500/10" : "hover:bg-slate-900/70"
          )}
        >
          <div className="flex flex-col items-center justify-center border-b border-slate-800 pb-6 xl:border-b-0 xl:border-r xl:pb-0 xl:pr-8">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-blue-500/20 bg-blue-500/10">
              <UploadCloud className="h-8 w-8 text-blue-300" />
            </div>
            <p className="text-sm font-bold text-white">Upload SOP or Policy</p>
            <p className="mt-2 text-xs text-slate-500">Drag and drop files here, or click to browse.</p>
            <p className="mt-3 inline-flex items-center gap-1 text-xs text-slate-500">
              PDF, TXT &le; 10 MB each
              <Info className="h-3.5 w-3.5" />
            </p>
          </div>

          <div className="min-w-0 overflow-x-auto">
            <div className="min-w-[620px]">
              <div className="mb-3 grid grid-cols-[minmax(260px,1fr)_120px_130px_28px] items-center gap-4 px-2 text-xs font-semibold text-slate-500">
                <span>Document</span>
                <span>File Validation</span>
                <span>Vector Indexing</span>
                <span />
              </div>
              <div className="space-y-2">
                {items.length === 0 ? (
                  <div className="rounded-md border border-slate-800 bg-slate-950 px-4 py-6 text-center text-sm text-slate-500">
                    Upload progress will appear here after files are selected.
                  </div>
                ) : (
                  items.map((item) => (
                    <div
                      key={item.id}
                      className="grid grid-cols-[minmax(260px,1fr)_120px_130px_28px] items-center gap-4 rounded-md border border-slate-800 bg-slate-950 px-2 py-2"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 flex-shrink-0 text-slate-500" />
                          <p className="truncate text-sm font-medium text-slate-100">{item.filename}</p>
                        </div>
                        <p className="mt-1 pl-6 text-xs text-slate-500">
                          {formatSize(item.size)}
                          {item.error ? ` - ${item.error}` : ""}
                        </p>
                      </div>
                      {item.status === "failed" ? (
                        <StatusBadge label="Invalid" tone="red" />
                      ) : (
                        <StatusBadge label="Valid" tone="emerald" />
                      )}
                      {item.status === "uploading" && (
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-300">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Indexing
                        </span>
                      )}
                      {item.status === "indexed" && (
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-300">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Indexed
                        </span>
                      )}
                      {item.status === "failed" && (
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-300">
                          <XCircle className="h-3.5 w-3.5" /> Failed
                        </span>
                      )}
                      <button
                        type="button"
                        aria-label="Dismiss upload row"
                        onClick={(event) => {
                          event.stopPropagation();
                          setItems((prev) => prev.filter((i) => i.id !== item.id));
                        }}
                        className="text-slate-500 hover:text-slate-300"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.txt"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) void handleFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>
      </div>
    );
  }
);

DocumentUploader.displayName = "DocumentUploader";

export default DocumentUploader;
