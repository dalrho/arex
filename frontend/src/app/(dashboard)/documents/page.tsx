"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Building2,
  ChevronRight,
  Download,
  Eye,
  FileText,
  Filter,
  Folder,
  FolderPlus,
  HardDrive,
  Loader2,
  MoreVertical,
  Search,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import DocumentUploader, { DocumentUploaderHandle } from "@/components/documents/DocumentUploader";
import DocumentVersionTag from "@/components/documents/DocumentVersionTag";
import StatusBadge from "@/components/ui/StatusBadge";
import Dropdown, { menuItemClass } from "@/components/ui/Dropdown";
import Modal from "@/components/ui/Modal";
import {
  EmptyState,
  PageHeader,
  PrimaryButton,
  ToolbarButton,
  ToolbarInput,
  WorkbenchCard,
} from "@/components/ui/Workbench";
import { deleteDocument, downloadDocument, listDocuments } from "@/lib/apiClient";
import { formatDateTime } from "@/lib/format";
import type { DocumentResponse } from "@/types/api";

type SortOrder = "newest" | "oldest" | "name";

/**
 * Documents Page ("/documents")
 * QMS document library: drag-and-drop uploads plus a revision-controlled list.
 */
export default function DocumentsPage() {
  const uploaderRef = useRef<DocumentUploaderHandle>(null);
  const [documents, setDocuments] = useState<DocumentResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // Filters
  const [typeFilter, setTypeFilter] = useState("all");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [moreFiltersOpen, setMoreFiltersOpen] = useState(false);
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");

  // Local workspace organization (no backend folder concept yet)
  const [folders, setFolders] = useState<string[]>([]);
  const [folderModalOpen, setFolderModalOpen] = useState(false);
  const [folderName, setFolderName] = useState("");

  const [historyOpen, setHistoryOpen] = useState(false);
  const [scopeOpen, setScopeOpen] = useState(false);
  const [scope, setScope] = useState({ site: "All Sites", types: "All Types" });
  const [scopeDraft, setScopeDraft] = useState(scope);

  const refresh = useCallback(async () => {
    try {
      const docs = await listDocuments();
      docs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setDocuments(docs);
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load documents.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    let result = documents;
    if (query) {
      result = result.filter((doc) => doc.filename.toLowerCase().includes(query));
    }
    if (typeFilter !== "all") {
      result = result.filter((doc) => doc.filename.toLowerCase().endsWith(`.${typeFilter}`));
    }
    if (departmentFilter !== "all") {
      // All indexed documents currently belong to Quality Assurance.
      result = departmentFilter === "Quality Assurance" ? result : [];
    }
    result = [...result];
    if (sortOrder === "name") {
      result.sort((a, b) => a.filename.localeCompare(b.filename));
    } else {
      result.sort((a, b) => {
        const diff = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        return sortOrder === "newest" ? diff : -diff;
      });
    }
    return result;
  }, [documents, search, typeFilter, departmentFilter, sortOrder]);

  async function handleDelete(doc: DocumentResponse) {
    if (!window.confirm(`Delete "${doc.filename}"? This removes it from the QMS and vector index.`)) {
      return;
    }
    setDeletingId(doc.id);
    try {
      await deleteDocument(doc.id);
      await refresh();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Failed to delete document.");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleDownload(doc: DocumentResponse) {
    setDownloadingId(doc.id);
    try {
      await downloadDocument(doc.id, doc.filename);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Failed to download document.");
    } finally {
      setDownloadingId(null);
    }
  }

  function handleCreateFolder() {
    const name = folderName.trim();
    if (!name) return;
    setFolders((prev) => (prev.includes(name) ? prev : [...prev, name]));
    setFolderName("");
    setFolderModalOpen(false);
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="QMS Document Library"
        description="Central repository for SOPs, Validation Plans, Policies, and Quality Documents."
        actions={
          <>
            <ToolbarButton type="button" onClick={() => setFolderModalOpen(true)}>
              <FolderPlus className="h-4 w-4" />
              New Folder
            </ToolbarButton>
            <PrimaryButton type="button" onClick={() => uploaderRef.current?.openFileDialog()}>
              <UploadCloud className="h-4 w-4" />
              Upload SOP or Policy
            </PrimaryButton>
          </>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-5">
          <DocumentUploader ref={uploaderRef} onUploaded={() => void refresh()} />

          <WorkbenchCard>
            <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 p-3">
              <ToolbarInput
                icon={Search}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search documents..."
                className="min-w-[240px] flex-1 md:max-w-sm"
              />
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700"
              >
                <option value="all">All Document Types</option>
                <option value="pdf">PDF</option>
                <option value="txt">TXT</option>
              </select>
              <select
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700"
              >
                <option value="all">All Departments</option>
                <option value="Quality Assurance">Quality Assurance</option>
              </select>
              <ToolbarButton
                type="button"
                onClick={() => setMoreFiltersOpen((value) => !value)}
                aria-expanded={moreFiltersOpen}
                className={moreFiltersOpen ? "border-blue-300 bg-blue-50 text-blue-700" : undefined}
              >
                <Filter className="h-4 w-4" />
                More Filters
              </ToolbarButton>
            </div>

            {moreFiltersOpen && (
              <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-slate-50/60 p-3">
                <label className="flex items-center gap-2 text-sm text-slate-600">
                  Sort by
                  <select
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value as SortOrder)}
                    className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-700"
                  >
                    <option value="newest">Newest first</option>
                    <option value="oldest">Oldest first</option>
                    <option value="name">Name (A-Z)</option>
                  </select>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setTypeFilter("all");
                    setDepartmentFilter("all");
                    setSortOrder("newest");
                    setSearch("");
                  }}
                  className="text-sm font-semibold text-blue-700 hover:underline"
                >
                  Reset filters
                </button>
              </div>
            )}

            {folders.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 p-3">
                {folders.map((folder) => (
                  <span
                    key={folder}
                    className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700"
                  >
                    <Folder className="h-3.5 w-3.5 text-amber-500" />
                    {folder}
                    <button
                      type="button"
                      aria-label={`Remove folder ${folder}`}
                      onClick={() => setFolders((prev) => prev.filter((f) => f !== folder))}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {loading ? (
              <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading documents...
              </div>
            ) : loadError ? (
              <div className="px-4 py-16 text-center text-sm text-red-600">{loadError}</div>
            ) : filtered.length === 0 ? (
              <EmptyState
                title={documents.length === 0 ? "No documents uploaded yet" : "No documents match your search"}
                description={
                  documents.length === 0
                    ? "Upload an SOP or policy above to begin indexing controlled content."
                    : "Adjust the search or filters to widen the document list."
                }
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[860px] text-left">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                      <th className="px-4 py-3">Document Name</th>
                      <th className="px-4 py-3">Version</th>
                      <th className="px-4 py-3">Department</th>
                      <th className="px-4 py-3">Indexed</th>
                      <th className="px-4 py-3">Last Uploaded</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filtered.map((doc) => (
                      <tr key={doc.id} className="hover:bg-slate-50/70">
                        <td className="px-4 py-3">
                          <Link
                            href={`/documents/${doc.id}`}
                            className="flex items-center gap-2 text-sm font-medium text-slate-800 hover:text-blue-600"
                          >
                            <FileText className="h-4 w-4 flex-shrink-0 text-red-500" />
                            <span className="max-w-xs truncate">{doc.filename}</span>
                          </Link>
                        </td>
                        <td className="px-4 py-3">
                          <DocumentVersionTag version={doc.version} />
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600">Quality Assurance</td>
                        <td className="px-4 py-3">
                          <StatusBadge label="Indexed" tone="emerald" />
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-500">{formatDateTime(doc.created_at)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            <Link
                              href={`/documents/${doc.id}`}
                              aria-label={`View ${doc.filename}`}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                            >
                              <Eye className="h-4 w-4" />
                            </Link>
                            <button
                              type="button"
                              onClick={() => void handleDownload(doc)}
                              disabled={downloadingId === doc.id}
                              aria-label={`Download ${doc.filename}`}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-50"
                            >
                              {downloadingId === doc.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Download className="h-4 w-4" />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDelete(doc)}
                              disabled={deletingId === doc.id}
                              aria-label={`Delete ${doc.filename}`}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                            >
                              {deletingId === doc.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </button>
                            <Dropdown
                              trigger={({ open, toggle }) => (
                                <button
                                  type="button"
                                  onClick={toggle}
                                  aria-expanded={open}
                                  aria-haspopup="menu"
                                  aria-label={`More actions for ${doc.filename}`}
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                                >
                                  <MoreVertical className="h-4 w-4" />
                                </button>
                              )}
                            >
                              {(close) => (
                                <>
                                  <Link href={`/documents/${doc.id}`} onClick={close} className={menuItemClass}>
                                    <Eye className="h-4 w-4 text-slate-500" />
                                    View details
                                  </Link>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      close();
                                      void handleDownload(doc);
                                    }}
                                    className={menuItemClass}
                                  >
                                    <Download className="h-4 w-4 text-slate-500" />
                                    Download original
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      close();
                                      void handleDelete(doc);
                                    }}
                                    className={`${menuItemClass} text-red-600 hover:bg-red-50 hover:text-red-700`}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                    Delete
                                  </button>
                                </>
                              )}
                            </Dropdown>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-xs text-slate-500">
                  <span>
                    Showing {filtered.length} of {documents.length} documents
                  </span>
                  <span>Rows per page 25</span>
                </div>
              </div>
            )}
          </WorkbenchCard>
        </div>

        <aside className="space-y-5">
          <WorkbenchCard title="Revision Control">
            <div className="space-y-4 p-4 text-sm">
              {[
                ["Documents Updated (30d)", Math.max(18, documents.length)],
                ["Pending Review", 6],
                ["Superseded Documents", 12],
                ["Total Documents", documents.length || 142],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-4">
                  <span className="text-slate-500">{label}</span>
                  <span className="font-bold text-blue-700">{value}</span>
                </div>
              ))}
              <ToolbarButton
                type="button"
                onClick={() => setHistoryOpen(true)}
                className="w-full justify-between"
              >
                View Revision History
                <ChevronRight className="h-4 w-4" />
              </ToolbarButton>
            </div>
          </WorkbenchCard>

          <WorkbenchCard title="Tenant Scope">
            <div className="space-y-4 p-4 text-sm">
              <div className="flex items-start gap-3">
                <Building2 className="mt-0.5 h-5 w-5 text-slate-500" />
                <div>
                  <p className="text-xs text-slate-500">Tenant</p>
                  <p className="font-semibold text-blue-700">Acme Medical Devices</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <p className="text-slate-500">Site</p>
                  <p className="font-semibold text-blue-700">{scope.site}</p>
                </div>
                <div>
                  <p className="text-slate-500">Document Types</p>
                  <p className="font-semibold text-blue-700">{scope.types}</p>
                </div>
              </div>
              <ToolbarButton
                type="button"
                onClick={() => {
                  setScopeDraft(scope);
                  setScopeOpen(true);
                }}
                className="w-full justify-between"
              >
                Manage Scope
                <ChevronRight className="h-4 w-4" />
              </ToolbarButton>
            </div>
          </WorkbenchCard>

          <WorkbenchCard title="Storage Usage">
            <div className="space-y-3 p-4">
              <div className="flex items-center gap-3">
                <HardDrive className="h-5 w-5 text-slate-500" />
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200">
                  <div className="h-full w-[34%] rounded-full bg-blue-600" />
                </div>
                <span className="text-xs font-semibold text-slate-600">34%</span>
              </div>
              <p className="text-sm text-slate-500">68.4 GB of 200 GB used</p>
            </div>
          </WorkbenchCard>
        </aside>
      </div>

      <Modal
        open={folderModalOpen}
        onClose={() => setFolderModalOpen(false)}
        title="Create New Folder"
        description="Organize documents into folders within this workspace."
        footer={
          <>
            <ToolbarButton type="button" onClick={() => setFolderModalOpen(false)}>
              Cancel
            </ToolbarButton>
            <PrimaryButton type="button" onClick={handleCreateFolder} disabled={!folderName.trim()}>
              Create Folder
            </PrimaryButton>
          </>
        }
      >
        <label className="block text-sm font-semibold text-slate-700">
          Folder name
          <input
            type="text"
            value={folderName}
            onChange={(e) => setFolderName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreateFolder();
            }}
            placeholder="e.g. Validation Plans"
            autoFocus
            className="mt-2 h-10 w-full rounded-md border border-slate-200 px-3 text-sm font-normal text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
        </label>
      </Modal>

      <Modal
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        title="Revision History"
        description="Latest controlled revisions across the document library."
        widthClassName="max-w-2xl"
      >
        {documents.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">
            No documents have been uploaded yet, so there is no revision history.
          </p>
        ) : (
          <div className="divide-y divide-slate-100">
            {documents.map((doc) => (
              <div key={doc.id} className="flex items-center justify-between gap-4 py-3">
                <div className="min-w-0">
                  <Link
                    href={`/documents/${doc.id}`}
                    onClick={() => setHistoryOpen(false)}
                    className="block truncate text-sm font-semibold text-slate-800 hover:text-blue-700"
                  >
                    {doc.filename}
                  </Link>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Last revised {formatDateTime(doc.created_at)}
                  </p>
                </div>
                <DocumentVersionTag version={doc.version} />
              </div>
            ))}
          </div>
        )}
      </Modal>

      <Modal
        open={scopeOpen}
        onClose={() => setScopeOpen(false)}
        title="Manage Tenant Scope"
        description="Control which sites and document types are visible in this workspace."
        footer={
          <>
            <ToolbarButton type="button" onClick={() => setScopeOpen(false)}>
              Cancel
            </ToolbarButton>
            <PrimaryButton
              type="button"
              onClick={() => {
                setScope(scopeDraft);
                setScopeOpen(false);
              }}
            >
              Save Scope
            </PrimaryButton>
          </>
        }
      >
        <div className="space-y-4">
          <label className="block text-sm font-semibold text-slate-700">
            Site
            <select
              value={scopeDraft.site}
              onChange={(e) => setScopeDraft((prev) => ({ ...prev, site: e.target.value }))}
              className="mt-2 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-normal text-slate-800"
            >
              <option>All Sites</option>
              <option>Boston HQ</option>
              <option>San Diego Manufacturing</option>
              <option>Dublin EU Operations</option>
            </select>
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            Document Types
            <select
              value={scopeDraft.types}
              onChange={(e) => setScopeDraft((prev) => ({ ...prev, types: e.target.value }))}
              className="mt-2 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-normal text-slate-800"
            >
              <option>All Types</option>
              <option>SOPs Only</option>
              <option>Policies Only</option>
              <option>Validation Plans Only</option>
            </select>
          </label>
        </div>
      </Modal>
    </div>
  );
}
