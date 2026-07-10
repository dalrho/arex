import type {
  DocumentResponse,
  ImpactResponse,
  RegulationResponse,
  RemediationResponse,
  TaskResponse,
} from "@/types/api";

export const DEMO_REGULATION_ID = "11111111-1111-4111-8111-111111111111";
export const DEMO_DOCUMENT_ID = "22222222-2222-4222-8222-222222222222";
export const DEMO_REMEDIATION_ID = "33333333-3333-4333-8333-333333333333";

export const demoRegulations: RegulationResponse[] = [
  {
    id: DEMO_REGULATION_ID,
    source_url: "https://www.federalregister.gov",
    title: "FDA Mandatory Multi-Factor Authentication and Session Idle Timeout Requirements (2026)",
    published_date: "2026-07-01T09:00:00.000Z",
    raw_content:
      "FDA regulated systems must enforce multi-factor authentication, session idle timeout controls, unique user identification, and complete audit trails for electronic records and signatures.",
    hash_value: "demo-fda-mfa-session-timeout-2026",
    status: "PENDING_ANALYSIS",
    created_at: "2026-07-01T09:00:00.000Z",
    relevant: true,
    category: "Electronic Records and Signatures",
    urgency: "High",
    affected_business_areas: ["Quality Assurance", "Validation", "IT"],
    rationale:
      "The update affects validation procedures for systems that generate, modify, maintain, or approve regulated electronic records.",
  },
  {
    id: "44444444-4444-4444-8444-444444444444",
    source_url: "https://www.federalregister.gov",
    title: "FDA Guidance on Electronic Signature Review Intervals for Validated QMS Platforms",
    published_date: "2026-06-24T09:00:00.000Z",
    raw_content:
      "Organizations should periodically review electronic signature configuration, audit trail coverage, and reviewer authorization for validated quality systems.",
    hash_value: "demo-fda-signature-review-2026",
    status: "ANALYSIS_COMPLETE",
    created_at: "2026-06-24T09:00:00.000Z",
    relevant: true,
    category: "Validation",
    urgency: "Medium",
    affected_business_areas: ["Quality Assurance"],
    rationale:
      "The guidance maps to existing SOP controls and requires documented review evidence for Part 11 readiness.",
  },
];

export const demoImpact: ImpactResponse = {
  id: "55555555-5555-4555-8555-555555555555",
  regulation_id: DEMO_REGULATION_ID,
  organization_id: "9280d0d8-5527-4632-bd92-4fcf05c75462",
  risk_score: 86,
  impact_level: "High",
  rationale:
    "The regulation directly impacts the validated QMS authentication boundary. Validation SOP section 3.2 covers audit trail requirements, but the current procedure does not explicitly require a 15 minute idle timeout, MFA revalidation, or periodic session control review. The system should update access control procedures and create implementation tasks for IT and Quality Assurance.",
  affected_departments: ["Quality Assurance", "Validation", "IT"],
  status: "COMPLETE",
  created_at: "2026-07-09T08:00:00.000Z",
};

export const demoDocuments: DocumentResponse[] = [
  {
    id: DEMO_DOCUMENT_ID,
    organization_id: "9280d0d8-5527-4632-bd92-4fcf05c75462",
    filename: "Validation SOP - Electronic Records and Signatures.txt",
    file_path: "demo/validation-sop-electronic-records.txt",
    version: 2,
    created_at: "2026-07-03T10:30:00.000Z",
  },
  {
    id: "66666666-6666-4666-8666-666666666666",
    organization_id: "9280d0d8-5527-4632-bd92-4fcf05c75462",
    filename: "CSV Validation Plan.txt",
    file_path: "demo/csv-validation-plan.txt",
    version: 1,
    created_at: "2026-06-28T11:20:00.000Z",
  },
  {
    id: "77777777-7777-4777-8777-777777777777",
    organization_id: "9280d0d8-5527-4632-bd92-4fcf05c75462",
    filename: "Access Control Policy.txt",
    file_path: "demo/access-control-policy.txt",
    version: 3,
    created_at: "2026-06-18T14:10:00.000Z",
  },
];

export const demoDocumentContent: Record<string, string> = {
  [DEMO_DOCUMENT_ID]: `STANDARD OPERATING PROCEDURE: SOP-101
TITLE: ELECTRONIC RECORDS AND SYSTEM ACCESS CONTROL
VERSION: 2

1.0 PURPOSE
This procedure establishes the administrative, technical, and physical controls to ensure system security, access control, and electronic record integrity under FDA 21 CFR Part 11.

2.0 SCOPE
This SOP applies to all computer systems, network domains, and software tools that generate, maintain, modify, retrieve, or transmit quality records.

3.0 SYSTEM ACCESS CONTROLS
3.1 Password Complexity: User passwords must be a minimum of 8 characters, containing at least one uppercase letter, one lowercase letter, one numeric digit, and one special character.
3.2 Session Timeout: Computer terminals and software applications must automatically log out a user or lock the display terminal after 30 minutes of continuous keyboard or mouse inactivity.
3.3 Account Lockout: If a user enters an incorrect password three (3) consecutive times, the system will automatically lock the user account for 30 minutes.
3.4 User Privileges: All write, modification, and approval privileges are strictly restricted according to user roles.

4.0 ELECTRONIC SIGNATURES
4.1 Dual-Factor Signature: The execution of an electronic signature requires the input of two distinct identification components.
4.2 Signature Manifestation: Every electronically signed document must visually display the printed name of the signer, date and time stamp, and the meaning associated with the signature.`,
  "66666666-6666-4666-8666-666666666666": `COMPUTER SYSTEM VALIDATION PLAN
TITLE: CSV Validation Plan for QMS Platform
VERSION: 1

1.0 PURPOSE
Define the validation strategy, test protocols, and acceptance criteria for the validated quality management system platform.

2.0 SCOPE
Applies to all GxP-critical modules including document control, training records, CAPA management, and electronic signatures.

3.0 VALIDATION APPROACH
3.1 Risk Assessment: A risk-based approach per GAMP 5 Category 4 shall be applied.
3.2 Installation Qualification (IQ): Verify hardware, software installation, and configuration against specifications.
3.3 Operational Qualification (OQ): Execute test scripts to confirm functional requirements are met.
3.4 Performance Qualification (PQ): Demonstrate consistent performance in the production environment.

4.0 ACCEPTANCE CRITERIA
All test cases must pass with documented evidence. Deviations require investigation and resolution before release.`,
  "77777777-7777-4777-8777-777777777777": `ACCESS CONTROL POLICY
TITLE: Enterprise Access Control and Identity Management
VERSION: 3

1.0 PURPOSE
Establish requirements for user identity management, role-based access control, and periodic access reviews across validated systems.

2.0 SCOPE
Applies to all employees, contractors, and system administrators with access to regulated electronic records.

3.0 ACCESS CONTROL REQUIREMENTS
3.1 Unique User Identification: Each user must have a unique identifier; shared accounts are prohibited.
3.2 Role-Based Access: Access privileges are granted based on job function and approved by department managers.
3.3 Multi-Factor Authentication: MFA is required for all remote access and privileged accounts.
3.4 Periodic Review: User access rights must be reviewed quarterly by system owners and Quality Assurance.

4.0 SESSION MANAGEMENT
4.1 Idle Timeout: Sessions must lock after 15 minutes of inactivity on validated systems.
4.2 Concurrent Sessions: Users may not maintain more than one active session on production systems.`,
};

export function getDemoDocumentContent(id: string): string {
  return (
    demoDocumentContent[id] ??
    `AREX demo document content for ${id}.\n\nThis controlled source document is available for assessment and remediation workflows.`
  );
}

export const demoRemediations: RemediationResponse[] = [
  {
    id: DEMO_REMEDIATION_ID,
    document_id: DEMO_DOCUMENT_ID,
    regulation_id: DEMO_REGULATION_ID,
    original_text:
      "Users must authenticate before accessing validated systems. Audit trails must capture regulated record changes and reviewer decisions.\n\nElectronic signatures must be attributable to a single individual and must not be shared across accounts. Session controls should prevent unauthorized reuse of authenticated terminals in production areas.",
    proposed_text:
      "Users must authenticate with multi-factor authentication before accessing validated systems. Sessions must lock after 15 minutes of inactivity. Audit trails must capture regulated record changes, session events, and reviewer decisions.\n\nElectronic signatures must be attributable to a single individual, require re-authentication at signing, and must not be shared across accounts. Session controls must prevent unauthorized reuse of authenticated terminals in production areas.",
    diff_content: {
      removed: [
        "Users must authenticate before accessing validated systems. Audit trails must capture regulated record changes and reviewer decisions.",
      ],
      added: [
        "Users must authenticate with multi-factor authentication before accessing validated systems. Sessions must lock after 15 minutes of inactivity. Audit trails must capture regulated record changes, session events, and reviewer decisions.",
      ],
    },
    status: "PENDING_REVIEW",
    reviewer_id: null,
    reviewed_at: null,
    created_at: "2026-07-09T08:12:00.000Z",
  },
];

export function demoRemediationForRegulation(regulationId: string): RemediationResponse {
  const existing = demoRemediations.find((draft) => draft.regulation_id === regulationId);
  if (existing) return existing;

  const base = demoRemediations[0];
  return {
    ...base,
    id: `demo-remediation-${regulationId}`,
    regulation_id: regulationId,
  };
}

export function demoRemediationsForRegulation(regulationId: string): RemediationResponse[] {
  const existing = demoRemediations.filter((draft) => draft.regulation_id === regulationId);
  return existing.length > 0 ? existing : [demoRemediationForRegulation(regulationId)];
}

export function demoRemediationForId(remediationId: string): RemediationResponse | null {
  const existing = demoRemediations.find((draft) => draft.id === remediationId);
  if (existing) return existing;

  const syntheticPrefix = "demo-remediation-";
  if (remediationId.startsWith(syntheticPrefix)) {
    return demoRemediationForRegulation(remediationId.slice(syntheticPrefix.length));
  }

  return null;
}

export const demoTasks: TaskResponse[] = [
  {
    id: "88888888-8888-4888-8888-888888888888",
    regulation_id: DEMO_REGULATION_ID,
    remediation_draft_id: DEMO_REMEDIATION_ID,
    title: "Implement cryptographic audit log hashing (SHA-256)",
    description: "Add tamper-evident hashing to audit trail storage and verify integrity during periodic reviews.",
    department: "Engineering",
    priority: "Critical",
    status: "TODO",
    created_at: "2026-07-09T08:20:00.000Z",
  },
  {
    id: "88888888-8888-4888-8888-888888888889",
    regulation_id: DEMO_REGULATION_ID,
    remediation_draft_id: DEMO_REMEDIATION_ID,
    title: "Configure session idle timeout to 15 minutes on validation systems",
    description:
      "Update validated QMS authentication settings, capture evidence, and link the change to the revised SOP section.",
    department: "Engineering",
    priority: "Critical",
    status: "TODO",
    created_at: "2026-07-09T08:21:00.000Z",
  },
  {
    id: "99999999-9999-4999-8999-999999999999",
    regulation_id: DEMO_REGULATION_ID,
    remediation_draft_id: DEMO_REMEDIATION_ID,
    title: "Update SOP validation evidence for MFA controls",
    description: "Revise validation package to include MFA test scripts and acceptance criteria.",
    department: "Quality Assurance",
    priority: "Critical",
    status: "TODO",
    created_at: "2026-07-09T08:22:00.000Z",
  },
  {
    id: "99999999-9999-4999-8999-999999999998",
    regulation_id: DEMO_REGULATION_ID,
    remediation_draft_id: DEMO_REMEDIATION_ID,
    title: "Conduct periodic access review for validated systems",
    description: "Execute quarterly access review and document findings for Part 11 readiness.",
    department: "Quality Assurance",
    priority: "High",
    status: "TODO",
    created_at: "2026-07-09T08:23:00.000Z",
  },
  {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    regulation_id: DEMO_REGULATION_ID,
    remediation_draft_id: DEMO_REMEDIATION_ID,
    title: "Deliver MFA and session timeout training for GxP users",
    description: "Update training curriculum and assign completion tracking for all regulated users.",
    department: "Training",
    priority: "Critical",
    status: "TODO",
    created_at: "2026-07-09T08:24:00.000Z",
  },
  {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaab",
    regulation_id: DEMO_REGULATION_ID,
    remediation_draft_id: DEMO_REMEDIATION_ID,
    title: "Publish refresher module on electronic signature controls",
    description: "Create short-form training for signature re-authentication requirements.",
    department: "Training",
    priority: "High",
    status: "TODO",
    created_at: "2026-07-09T08:25:00.000Z",
  },
  {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    regulation_id: DEMO_REGULATION_ID,
    remediation_draft_id: DEMO_REMEDIATION_ID,
    title: "Implement Multi-Factor Authentication in Active Directory",
    description: "Configure directory integration and mandate MFA enrollment for GxP validated servers.",
    department: "IT",
    priority: "Critical",
    status: "TODO",
    created_at: "2026-07-09T08:26:00.000Z",
  },
  {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbc",
    regulation_id: DEMO_REGULATION_ID,
    remediation_draft_id: DEMO_REMEDIATION_ID,
    title: "Deploy session lock policy across validated workstations",
    description: "Push group policy updates for 15-minute idle lock on production validation endpoints.",
    department: "IT",
    priority: "Critical",
    status: "TODO",
    created_at: "2026-07-09T08:27:00.000Z",
  },
];

export function demoImpactForRegulation(regulationId: string): ImpactResponse {
  return {
    ...demoImpact,
    regulation_id: regulationId,
  };
}
