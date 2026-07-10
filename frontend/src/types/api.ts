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

export interface AuditHistoryEvent {
  event_type: string;
  description: string;
  timestamp: string;
  user: string;
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
  // Source tracking
  source?: string | null;           // "FDA_API" | "DOCUMENT_UPLOAD"
  document_number?: string | null;
  effective_date?: string | null;
  summary?: string | null;
  regulatory_authority?: string | null;
  category?: string | null;
  // AI verdicts
  relevant?: boolean | null;
  urgency?: string | null;
  affected_business_areas?: string[] | null;
  rationale?: string | null;
  audit_history?: AuditHistoryEvent[] | null;
}

export interface AffectedDocument {
  document_id: string;
  document_name: string;
  document_type: string;
  affected_sections: string;
  explanation: string;
  confidence_score: number;
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
  affected_documents?: AffectedDocument[];
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
  explanation?: string | null;
  requires_tasks?: boolean | null;
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

export interface DataStats {
  total_regulations: number;
  total_documents: number;
  total_compliance_cases: number;
  total_knowledge_base_documents: number;
  total_impact_assessments: number;
  total_remediation_drafts: number;
  total_implementation_tasks: number;
}

export interface ResetResponse {
  status: string;
  message: string;
  deleted: Record<string, number>;
}
