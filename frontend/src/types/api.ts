export interface AuthUser {
  id: string;
  email: string;
  role: string;
  org_id: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user: AuthUser;
}

export interface DocumentResponse {
  id: string;
  organization_id: string;
  filename: string;
  file_path: string;
  version: number;
  created_at: string;
}

export interface RegulationResponse {
  id: string;
  source_url: string;
  title: string;
  published_date: string;
  raw_content: string;
  parsed_sections?: unknown;
  hash_value: string;
  status: string;
  created_at: string;
  relevant?: boolean | null;
  category?: string | null;
  urgency?: string | null;
  affected_business_areas?: string[] | null;
  rationale?: string | null;
}

export interface ImpactResponse {
  id: string;
  regulation_id: string;
  organization_id: string;
  risk_score: number;
  impact_level: string;
  rationale: string;
  affected_departments: string[];
  status: string;
  created_at: string;
}

export interface DiffContent {
  added: string[];
  removed: string[];
}

export type RemediationStatus = "PENDING_REVIEW" | "APPROVED" | "REJECTED";

export interface RemediationResponse {
  id: string;
  document_id: string;
  regulation_id: string;
  proposed_text: string;
  original_text: string;
  diff_content: DiffContent | null;
  status: RemediationStatus | string;
  reviewer_id: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export interface ApprovalRecordResponse {
  id: string;
  item_type: string;
  item_id: string;
  status: string;
  reviewer_id: string;
  timestamp: string;
  original_content?: unknown;
  final_content?: unknown;
}

export type TaskStatus = "TODO" | "IN_PROGRESS" | "DONE";

export interface TaskResponse {
  id: string;
  regulation_id: string;
  remediation_draft_id: string | null;
  title: string;
  description: string;
  department: string;
  priority: string;
  status: TaskStatus | string;
  created_at: string;
}

export interface TaskCreatePayload {
  regulation_id: string;
  remediation_draft_id?: string | null;
  title: string;
  description: string;
  department: string;
  priority?: string;
}

export interface TaskUpdatePayload {
  title?: string;
  description?: string;
  department?: string;
  priority?: string;
  status?: string;
}
