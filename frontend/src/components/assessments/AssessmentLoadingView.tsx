"use client";

import AssessmentKnowledgeGraph from "@/components/assessments/AssessmentKnowledgeGraph";

type AssessmentLoadingViewProps = {
  activeNodeCount?: number;
};

export default function AssessmentLoadingView({ activeNodeCount = 8 }: AssessmentLoadingViewProps) {
  return (
    <section className="flex min-h-full items-center justify-center px-6 py-14">
      <div className="w-full max-w-4xl text-center">
        <h1 className="text-2xl font-extrabold uppercase tracking-normal text-cyan-200 md:text-3xl">
          Assessment in progress
        </h1>
        <div className="mt-4 inline-flex items-center gap-2 rounded-md border border-cyan-300/50 bg-cyan-300/10 px-3 py-1 text-[10px] font-extrabold uppercase tracking-normal text-cyan-100 shadow-[0_0_24px_rgba(34,211,238,0.18)]">
          <span className="h-1.5 w-1.5 rounded-full bg-cyan-200 shadow-[0_0_12px_rgba(103,232,249,0.9)]" />
          {activeNodeCount} active nodes
        </div>
        <AssessmentKnowledgeGraph className="mx-auto mt-8 max-w-3xl" heightClassName="h-[22rem] md:h-[28rem]" />
      </div>
    </section>
  );
}
