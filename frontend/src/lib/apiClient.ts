import type {
  ApprovalRecordResponse,
  AuthUser,
  DataStats,
  DocumentResponse,
  ImpactResponse,
  LoginResponse,
  RegulationResponse,
  RemediationResponse,
  ResetResponse,
  TaskCreatePayload,
  TaskResponse,
  TaskUpdatePayload,
  DocumentVersionResponse,
  DocumentAnnotationResponse,
} from "@/types/api";

export interface AIStatusResponse {
  mode: "online" | "offline" | "hackathon" | "developer";
  provider: string;
  model: string | null;
  embedding_model: string | null;
  inference_label: string;
  cumulative_tokens: number;
  prompt_tokens: number;
  completion_tokens: number;
  gemini_key_configured: boolean;
  fireworks_key_configured: boolean;
  reason: string | null;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL
  ? `${process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, "")}/api/v1`
  : "/api/v1";
const DEFAULT_TENANT_ID = "9280d0d8-5527-4632-bd92-4fcf05c75462";

const TOKEN_KEY = "arex_token";
const USER_KEY = "arex_user";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function getCurrentUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function setSession(token: string, user: AuthUser): void {
  window.localStorage.setItem(TOKEN_KEY, token);
  window.localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession(): void {
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(USER_KEY);
}

export function getTenantId(): string {
  return getCurrentUser()?.org_id ?? DEFAULT_TENANT_ID;
}

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function buildHeaders(extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = {
    "X-Tenant-ID": getTenantId(),
    ...extra,
  };
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

async function parseError(res: Response): Promise<ApiError> {
  let message = `Request failed with status ${res.status}`;
  try {
    const body = await res.json();
    if (typeof body?.detail === "string") message = body.detail;
  } catch {
    // Keep the status-based fallback for non-JSON error bodies.
  }
  return new ApiError(res.status, message);
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const mergedInit: RequestInit = {
    ...init,
    cache: "no-store",
  };

  if (mergedInit.headers) {
    mergedInit.headers = {
      ...mergedInit.headers,
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Pragma": "no-cache",
      "Expires": "0",
    };
  } else {
    mergedInit.headers = {
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Pragma": "no-cache",
      "Expires": "0",
    };
  }

  const res = await fetch(`${API_BASE}${path}`, mergedInit);
  if (!res.ok) throw await parseError(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

function getJson<T>(path: string): Promise<T> {
  return request<T>(path, { headers: buildHeaders() });
}

function sendJson<T>(path: string, method: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method,
    headers: buildHeaders({ "Content-Type": "application/json" }),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export function login(email: string, password: string): Promise<LoginResponse> {
  return request<LoginResponse>("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
}

export function listDocuments(): Promise<DocumentResponse[]> {
  return getJson("/documents");
}

export function getDocument(id: string): Promise<DocumentResponse> {
  return getJson(`/documents/${id}`);
}

export function uploadDocument(file: File): Promise<DocumentResponse> {
  const formData = new FormData();
  formData.append("file", file);
  return request<DocumentResponse>("/documents", {
    method: "POST",
    headers: buildHeaders(),
    body: formData,
  });
}

export function deleteDocument(id: string): Promise<void> {
  return request<void>(`/documents/${id}`, {
    method: "DELETE",
    headers: buildHeaders(),
  });
}

export async function fetchDocumentBlob(id: string): Promise<Blob> {
  const res = await fetch(`${API_BASE}/documents/${id}/download`, {
    headers: buildHeaders(),
  });
  if (!res.ok) throw await parseError(res);
  return res.blob();
}

export async function downloadDocument(id: string, filename: string): Promise<void> {
  triggerBlobDownload(await fetchDocumentBlob(id), filename);
}

export function listRegulations(): Promise<RegulationResponse[]> {
  return getJson("/regulations");
}

export function getRegulation(id: string): Promise<RegulationResponse> {
  return getJson(`/regulations/${id}`);
}

export function deleteRegulation(id: string): Promise<void> {
  return request<void>(`/regulations/${id}`, {
    method: "DELETE",
    headers: buildHeaders(),
  });
}

export function getImpactForRegulation(regulationId: string): Promise<ImpactResponse> {
  return getJson(`/impact/regulation/${regulationId}`);
}

export function runImpactAssessment(regulationId: string): Promise<ImpactResponse> {
  return sendJson(`/impact/regulation/${regulationId}/assess`, "POST");
}

export function preScanMatchedDocuments(regulationId: string): Promise<{ id: string; filename: string }[]> {
  return getJson(`/impact/regulation/${regulationId}/pre_scan`);
}

export function listRemediations(regulationId?: string): Promise<RemediationResponse[]> {
  const query = regulationId ? `?regulation_id=${regulationId}` : "";
  return getJson(`/remediation${query}`);
}

export function getRemediation(id: string): Promise<RemediationResponse> {
  return getJson(`/remediation/${id}`);
}

export function updateRemediation(
  id: string,
  proposedText: string,
  comments?: string
): Promise<RemediationResponse> {
  return sendJson(`/remediation/${id}`, "PUT", {
    proposed_text: proposedText,
    comments: comments,
  });
}

export function resetRemediation(id: string): Promise<RemediationResponse> {
  return sendJson(`/remediation/${id}/reset`, "POST");
}

export function generateRemediationDrafts(
  regulationId: string,
  documentIds?: string[]
): Promise<RemediationResponse[]> {
  const body = documentIds ? { document_ids: documentIds } : undefined;
  return sendJson(`/remediation/regulation/${regulationId}`, "POST", body);
}


export function submitApprovalDecision(
  remediationId: string,
  decision: string
): Promise<ApprovalRecordResponse> {
  return sendJson(`/approvals/remediation/${remediationId}`, "POST", { decision });
}

export function listTasks(): Promise<TaskResponse[]> {
  return getJson("/tasks");
}

export function createTask(payload: TaskCreatePayload): Promise<TaskResponse> {
  return sendJson("/tasks", "POST", payload);
}

export function updateTask(id: string, payload: TaskUpdatePayload): Promise<TaskResponse> {
  return sendJson(`/tasks/${id}`, "PUT", payload);
}



function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
}

export function syncTasksToJira(): Promise<{ message: string; jira_response: any }> {
  return sendJson("/tasks/sync-jira", "POST");
}

export function generateImplementationTasks(
  regulationId: string
): Promise<{ requires_tasks: boolean; tasks: TaskResponse[]; message: string }> {
  return sendJson("/tasks/generate", "POST", { regulation_id: regulationId });
}

export function updateRegulationStatus(
  regulationId: string,
  status: string
): Promise<RegulationResponse> {
  return sendJson(`/regulations/${regulationId}/status`, "PATCH", { status });
}

export function getAiStatus(): Promise<AIStatusResponse> {
  return getJson<AIStatusResponse>("/ai-status");
}

// ---------------------------------------------------------------------------
// Regulation document upload
// ---------------------------------------------------------------------------

export interface UploadRegulationPayload {
  file: File;
  title: string;
  regulatory_authority: string;
  document_number?: string;
  published_date?: string;
  category?: string;
  effective_date?: string;
  summary?: string;
}

export function uploadRegulation(payload: UploadRegulationPayload): Promise<RegulationResponse> {
  const formData = new FormData();
  formData.append("file", payload.file);
  formData.append("title", payload.title);
  formData.append("regulatory_authority", payload.regulatory_authority);
  if (payload.document_number) formData.append("document_number", payload.document_number);
  if (payload.published_date) formData.append("published_date", payload.published_date);
  if (payload.category) formData.append("category", payload.category);
  if (payload.effective_date) formData.append("effective_date", payload.effective_date);
  if (payload.summary) formData.append("summary", payload.summary);
  return request<RegulationResponse>("/regulations/upload", {
    method: "POST",
    headers: buildHeaders(),
    body: formData,
  });
}

export function fetchRegulationsFromFDA(limit?: number): Promise<{ status: string; ingested_count: number }> {
  const params = limit ? `?limit=${limit}` : "";
  return sendJson(`/regulations/poll${params}`, "POST");
}

// ---------------------------------------------------------------------------
// Admin / Data Management
// ---------------------------------------------------------------------------

export function getAdminStats(): Promise<DataStats> {
  return getJson<DataStats>("/admin/stats");
}

export function resetApplicationData(): Promise<ResetResponse> {
  return sendJson<ResetResponse>("/admin/reset", "POST", { confirmation: "RESET" });
}

export function listDocumentVersions(documentId: string): Promise<DocumentVersionResponse[]> {
  return getJson(`/documents/${documentId}/versions`);
}

export async function fetchDocumentVersionBlob(id: string, version: number): Promise<Blob> {
  const res = await fetch(`${API_BASE}/documents/${id}/versions/${version}/download`, {
    headers: buildHeaders(),
  });
  if (!res.ok) throw await parseError(res);
  return res.blob();
}

export async function downloadDocumentVersion(id: string, version: number, filename: string): Promise<void> {
  triggerBlobDownload(await fetchDocumentVersionBlob(id, version), filename);
}

export function getDocumentAnnotations(documentId: string): Promise<DocumentAnnotationResponse[]> {
  return getJson(`/documents/${documentId}/annotations`);
}

export function getDocumentVersionAnnotations(
  documentId: string,
  versionNumber: number
): Promise<DocumentAnnotationResponse[]> {
  return getJson(`/documents/${documentId}/versions/${versionNumber}/annotations`);
}
