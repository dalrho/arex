import type {
  ApprovalRecordResponse,
  AuthUser,
  DocumentResponse,
  ImpactResponse,
  LoginResponse,
  RegulationResponse,
  RemediationResponse,
  TaskCreatePayload,
  TaskResponse,
  TaskUpdatePayload,
} from "@/types/api";

export interface AIStatusResponse {
  mode: "online" | "offline";
  model: string | null;
  embedding_model: string | null;
  gemini_key_configured: boolean;
  reason: string | null;
}

const API_BASE = "/api/v1";
const DEFAULT_TENANT_ID = "9280d0d8-5527-4632-bd92-4fcf05c75462";

const TOKEN_KEY = "sentinel_token";
const USER_KEY = "sentinel_user";

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
  const res = await fetch(`${API_BASE}${path}`, init);
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

export function getImpactForRegulation(regulationId: string): Promise<ImpactResponse> {
  return getJson(`/impact/regulation/${regulationId}`);
}

export function runImpactAssessment(regulationId: string): Promise<ImpactResponse> {
  return sendJson(`/impact/regulation/${regulationId}/assess`, "POST");
}

export function listRemediations(): Promise<RemediationResponse[]> {
  return getJson("/remediation");
}

export function getRemediation(id: string): Promise<RemediationResponse> {
  return getJson(`/remediation/${id}`);
}

export function updateRemediation(
  id: string,
  proposedText: string
): Promise<RemediationResponse> {
  return sendJson(`/remediation/${id}`, "PUT", { proposed_text: proposedText });
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
  decision: "APPROVED" | "REJECTED"
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

export async function downloadRemediationExport(
  remediationId: string,
  format: "pdf" | "docx"
): Promise<void> {
  const res = await fetch(`${API_BASE}/exports/remediation/${remediationId}/${format}`, {
    headers: buildHeaders(),
  });
  if (!res.ok) throw await parseError(res);

  const disposition = res.headers.get("Content-Disposition") ?? "";
  const match = disposition.match(/filename=([^;]+)/);
  const filename = match ? match[1].trim() : `remediation-report.${format}`;
  triggerBlobDownload(await res.blob(), filename);
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
