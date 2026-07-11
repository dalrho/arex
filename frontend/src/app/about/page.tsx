import React from "react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { FadeIn } from "@/components/ui/FadeIn";

const BRAND_LOGO_SRC = "/brand/arex-logo.png";

export const metadata: Metadata = {
  description:
    "AI-powered regulatory intelligence, document remediation, and compliance workflow tracking for FDA 21 CFR Part 11.",
};

const CAPABILITIES = [
  {
    title: "Document Ingestion",
    description:
      "Upload SOPs, validation plans, and policies. Documents are parsed, chunked, and embedded into a searchable knowledge base.",
  },
  {
    title: "Regulatory Monitoring",
    description:
      "Continuously polls FDA sources—Federal Register API and FDA.gov guidance pages—to detect new and updated regulations automatically.",
  },
  {
    title: "AI Classification",
    description:
      "A regulatory intelligence agent classifies each update by relevance, category, and urgency so teams focus on what matters.",
  },
  {
    title: "Impact Analysis",
    description:
      "Semantic search and deterministic risk scoring identify which company documents and departments are affected by a regulation.",
  },
  {
    title: "Remediation Drafts",
    description:
      "An AI remediation agent produces redline drafts with citations grounded in actual document text and regulation clauses.",
  },
  {
    title: "Implementation Tasks",
    description:
      "Cross-functional action items are generated for Engineering, QA, IT, and Training teams, traceable to source regulations.",
  },
  {
    title: "Approval Workflow",
    description:
      "Every AI recommendation requires explicit human approve, edit, or reject action before it is considered final.",
  },
  {
    title: "Audit Trail",
    description:
      "Immutable, append-only audit logs record every approval decision, agent invocation, and system action for compliance review.",
  },
  {
    title: "Exports",
    description:
      "Approved SOP revisions and compliance reports can be exported as PDF or Word documents for distribution and filing.",
  },
];

const BUILT_FOR = [
  {
    role: "QA Managers",
    description: "Monitor regulatory changes, review impact assessments, and approve remediation drafts.",
  },
  {
    role: "Validation Engineers",
    description: "Receive concrete implementation tasks and track cross-functional compliance work.",
  },
  {
    role: "Regulatory Affairs Specialists",
    description: "Stay ahead of FDA 21 CFR Part 11 guidance with automated monitoring and classification.",
  },
  {
    role: "Quality Systems Administrators",
    description: "Manage document versioning, user access, and organizational compliance posture.",
  },
];

const TECH_STACK = [
  "FastAPI",
  "PostgreSQL",
  "Qdrant",
  "LangGraph",
  "Qwen3 8B",
  "BGE-M3",
  "Next.js 14",
  "Tailwind CSS",
  "Docker Compose",
];

const WORKFLOW_STEPS = [
  { label: "Monitor", detail: "Poll FDA sources for new guidance" },
  { label: "Classify", detail: "AI assesses relevance and urgency" },
  { label: "Assess Impact", detail: "Identify affected SOPs and departments" },
  { label: "Draft Remediation", detail: "AI produces cited redline revisions" },
  { label: "Generate Tasks", detail: "Cross-functional action items created" },
  { label: "Human Approval", detail: "Reviewer approves, edits, or rejects" },
  { label: "Export", detail: "Approved content exported as PDF or Word" },
];

/**
 * About Page ("/about")
 * Public product overview explaining AREX capabilities, architecture, and compliance design.
 */
export default function AboutPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-950 to-brand-900 text-white">
      <FadeIn onMount direction="down">
        <header className="border-b border-slate-800/60 bg-slate-950/40 backdrop-blur-sm">
          <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
            <Link
              href="/"
              className="text-sm font-medium text-slate-400 transition-colors hover:text-white"
            >
              &larr; Back to Home
            </Link>
            <Link
              href="/login"
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold transition-all hover:bg-blue-700 hover:-translate-y-0.5 active:translate-y-0"
            >
              Access Platform
            </Link>
          </div>
        </header>
      </FadeIn>

      <div className="mx-auto max-w-4xl space-y-16 px-6 py-12 md:py-16">
        {/* Hero */}
        <section className="space-y-6 text-center">
          <div className="motion-safe:opacity-0 motion-safe:animate-scale-in">
            <Image
              src={BRAND_LOGO_SRC}
              alt="AREX"
              width={200}
              height={59}
              priority
              className="mx-auto h-auto w-40 object-contain shadow-2xl shadow-blue-950/40 motion-safe:animate-subtle-float motion-safe:[animation-delay:700ms] md:w-48"
            />
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-800/50 px-3 py-1 text-xs font-semibold tracking-wide text-brand-100 motion-safe:opacity-0 motion-safe:animate-fade-in-up motion-safe:[animation-delay:100ms]">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
            FDA 21 CFR Part 11 Regulatory Intelligence
          </div>
          <p className="mx-auto max-w-2xl text-lg text-slate-300 motion-safe:opacity-0 motion-safe:animate-fade-in-up motion-safe:[animation-delay:300ms]">
            AREX is a regulatory intelligence platform that automates compliance
            mapping for FDA 21 CFR Part 11—enforcing safety-critical compliance through
            decoupled agentic LLM remediation and deterministic database audit logs.
          </p>
        </section>

        {/* The Challenge */}
        <FadeIn>
          <section className="space-y-4">
            <h2 className="text-2xl font-bold">The Challenge</h2>
            <div className="rounded-xl border border-slate-700 bg-slate-800/30 p-6 text-slate-300 transition-colors duration-300 hover:border-slate-600 hover:bg-slate-800/40">
            <p>
              Regulated life-sciences teams face a constant stream of FDA guidance updates.
              Manually monitoring Federal Register publications, assessing which SOPs are
              affected, and drafting compliant revisions is slow, error-prone, and
              resource-intensive.
            </p>
            <p className="mt-4">
              Under FDA 21 CFR Part 11, AI cannot autonomously write, edit, or sign off on
              standard operating procedures. Every change requires explicit human review
              with a complete, immutable audit trail. AREX is built around this
              constraint—not in spite of it.
            </p>
          </div>
          </section>
        </FadeIn>

        {/* What AREX Does */}
        <FadeIn>
          <section className="space-y-4">
            <h2 className="text-2xl font-bold">What AREX Does</h2>
            <p className="text-slate-300">
              AREX provides end-to-end regulatory intelligence—from detecting FDA
              updates to exporting approved document revisions. The platform combines
              deterministic backend services with AI agents orchestrated through LangGraph,
              always keeping humans in control of final decisions.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
              {WORKFLOW_STEPS.map((step, index) => (
                <React.Fragment key={step.label}>
                  <span className="rounded-lg border border-slate-600 bg-slate-800/50 px-3 py-1.5 text-xs font-semibold text-brand-100 transition-colors duration-300 hover:border-slate-500 hover:bg-slate-800/70">
                    {step.label}
                  </span>
                  {index < WORKFLOW_STEPS.length - 1 && (
                    <span className="text-slate-600" aria-hidden="true">
                      &rarr;
                    </span>
                  )}
                </React.Fragment>
              ))}
            </div>
          </section>
        </FadeIn>

        {/* Platform Capabilities */}
        <FadeIn>
          <section className="space-y-6">
            <h2 className="text-2xl font-bold">Platform Capabilities</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {CAPABILITIES.map((cap, index) => (
                <FadeIn key={cap.title} delay={index * 50}>
                  <div className="h-full rounded-xl border border-slate-700 bg-slate-800/30 p-5 transition-all duration-300 hover:border-slate-600 hover:bg-slate-800/40 hover:-translate-y-0.5">
                    <h3 className="mb-2 font-semibold text-white">{cap.title}</h3>
                    <p className="text-sm leading-relaxed text-slate-400">{cap.description}</p>
                  </div>
                </FadeIn>
              ))}
            </div>
          </section>
        </FadeIn>

        {/* How It Works */}
        <FadeIn>
          <section className="space-y-4">
            <h2 className="text-2xl font-bold">How It Works</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {WORKFLOW_STEPS.map((step, index) => (
                <FadeIn key={step.label} delay={index * 60}>
                  <div className="flex h-full items-start gap-3 rounded-xl border border-slate-700 bg-slate-800/30 p-4 transition-all duration-300 hover:border-slate-600 hover:bg-slate-800/40">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold">
                      {index + 1}
                    </span>
                    <div>
                      <h3 className="font-semibold text-white">{step.label}</h3>
                      <p className="mt-1 text-sm text-slate-400">{step.detail}</p>
                    </div>
                  </div>
                </FadeIn>
              ))}
            </div>
          </section>
        </FadeIn>

        {/* Safety by Design */}
        <FadeIn>
          <section className="space-y-4">
            <h2 className="text-2xl font-bold">Safety by Design</h2>
            <div className="space-y-4 rounded-xl border border-slate-700 bg-slate-800/30 p-6 transition-colors duration-300 hover:border-slate-600 hover:bg-slate-800/40">
            <div>
              <h3 className="mb-1 font-semibold text-emerald-400">
                Deterministic vs. Agentic Separation
              </h3>
              <p className="text-sm text-slate-400">
                Traditional backend services handle RBAC, database transactions, and
                rule-based compliance scoring. The AI layer performs complex reasoning but
                has zero direct access to modify canonical system states without human
                intervention.
              </p>
            </div>
            <div>
              <h3 className="mb-1 font-semibold text-emerald-400">
                Human-in-the-Loop Workflow
              </h3>
              <p className="text-sm text-slate-400">
                All remediation drafts remain in a pending review state until an authorized
                reviewer explicitly approves, edits, or rejects them. Only approved content
                can be exported or committed to the active knowledge base.
              </p>
            </div>
            <div>
              <h3 className="mb-1 font-semibold text-emerald-400">
                Immutable Audit Logs
              </h3>
              <p className="text-sm text-slate-400">
                Every approval decision, agent invocation, and system action is recorded in
                append-only audit logs—never overwritten—meeting the traceability
                requirements of 21 CFR Part 11 itself.
              </p>
            </div>
            <div>
              <h3 className="mb-1 font-semibold text-emerald-400">
                Multi-Tenant Isolation
              </h3>
              <p className="text-sm text-slate-400">
                Role-based access control and per-organization data scoping across
                PostgreSQL and Qdrant prevent cross-tenant data leaks.
              </p>
            </div>
          </div>
          </section>
        </FadeIn>

        {/* Architecture Overview */}
        <FadeIn>
          <section className="space-y-4">
            <h2 className="text-2xl font-bold">Architecture Overview</h2>
            <div className="rounded-xl border border-slate-700 bg-slate-800/30 p-6 text-slate-300 transition-colors duration-300 hover:border-slate-600 hover:bg-slate-800/40">
            <p className="mb-4">
              AREX uses a decoupled architecture to maintain high availability,
              security, and strict data validation:
            </p>
            <ul className="space-y-3 text-sm">
              <li className="flex items-start gap-2">
                <span className="mt-1 text-blue-400">&bull;</span>
                <span>
                  <strong className="text-white">Next.js Frontend</strong> — Dashboard,
                  document manager, regulatory feed, remediation diff views, and approval
                  queue.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 text-blue-400">&bull;</span>
                <span>
                  <strong className="text-white">FastAPI Backend</strong> — REST API with
                  JWT auth, RBAC, and deterministic compliance services.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 text-blue-400">&bull;</span>
                <span>
                  <strong className="text-white">PostgreSQL</strong> — Primary
                  transaction database for organizations, users, documents, audit logs, and
                  approval records.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 text-blue-400">&bull;</span>
                <span>
                  <strong className="text-white">LangGraph + Qdrant</strong> — AI
                  orchestration layer with vector embeddings (BGE-M3) enabling RAG retrieval
                  for context-grounded agent suggestions.
                </span>
              </li>
            </ul>
          </div>
          </section>
        </FadeIn>

        {/* Built For */}
        <FadeIn>
          <section className="space-y-6">
            <h2 className="text-2xl font-bold">Built For</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {BUILT_FOR.map((persona, index) => (
                <FadeIn key={persona.role} delay={index * 70}>
                  <div className="h-full rounded-xl border border-slate-700 bg-slate-800/30 p-5 transition-all duration-300 hover:border-slate-600 hover:bg-slate-800/40 hover:-translate-y-0.5">
                    <h3 className="mb-2 font-semibold text-white">{persona.role}</h3>
                    <p className="text-sm text-slate-400">{persona.description}</p>
                  </div>
                </FadeIn>
              ))}
            </div>
          </section>
        </FadeIn>

        {/* Technology */}
        <FadeIn>
          <section className="space-y-4">
            <h2 className="text-2xl font-bold">Technology</h2>
            <div className="flex flex-wrap gap-2">
              {TECH_STACK.map((tech, index) => (
                <FadeIn key={tech} delay={index * 40} direction="none">
                  <span className="inline-block rounded-lg border border-slate-600 bg-slate-800/50 px-3 py-1.5 text-sm font-medium text-slate-300 transition-colors duration-300 hover:border-slate-500 hover:bg-slate-800/70">
                    {tech}
                  </span>
                </FadeIn>
              ))}
            </div>
          </section>
        </FadeIn>

        {/* CTA Footer */}
        <FadeIn>
          <section className="space-y-6 border-t border-slate-800 pt-12 text-center">
            <h2 className="text-2xl font-bold">Ready to get started?</h2>
            <p className="text-slate-400">
              Sign in to your organization&apos;s workspace to begin monitoring regulations
              and managing compliance workflows.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <Link
                href="/login"
                className="rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold shadow-lg transition-all hover:bg-blue-700 hover:shadow-blue-600/20 hover:-translate-y-0.5 active:translate-y-0"
              >
                Access Platform
              </Link>
              <Link
                href="/"
                className="rounded-lg border border-slate-700 px-6 py-3 text-sm font-semibold transition-all hover:bg-slate-800/40 hover:-translate-y-0.5 active:translate-y-0"
              >
                Back to Home
              </Link>
            </div>
          </section>
        </FadeIn>
      </div>
    </main>
  );
}
