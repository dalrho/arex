"use client";

import { useEffect, useState } from "react";
import AssessmentKnowledgeGraph from "@/components/assessments/AssessmentKnowledgeGraph";
import { listDocuments } from "@/lib/apiClient";

type AssessmentLoadingViewProps = {
  activeNodeCount?: number;
  regulationTitle?: string;
  documents?: { id: string; filename: string }[];
};

export default function AssessmentLoadingView({
  activeNodeCount,
  regulationTitle = "Regulation Update",
  documents: initialDocuments,
}: AssessmentLoadingViewProps) {
  const [allDocs, setAllDocs] = useState<{ id: string; filename: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [affectedCount, setAffectedCount] = useState(0);

  useEffect(() => {
    let active = true;
    listDocuments()
      .then((docs) => {
        if (!active) return;
        if (docs && docs.length > 0) {
          setAllDocs(docs.map((d) => ({ id: d.id, filename: d.filename })));
        } else {
          // Fallback if empty
          setAllDocs([
            { id: "sop101", filename: "SOP-101.txt" },
            { id: "sop102", filename: "SOP-102.txt" },
            { id: "sop103", filename: "SOP-103.txt" },
            { id: "sop104", filename: "SOP-104.txt" },
          ]);
        }
      })
      .catch(() => {
        if (!active) return;
        setAllDocs([
          { id: "sop101", filename: "SOP-101.txt" },
          { id: "sop102", filename: "SOP-102.txt" },
          { id: "sop103", filename: "SOP-103.txt" },
          { id: "sop104", filename: "SOP-104.txt" },
        ]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const affectedDocs = initialDocuments || [];
  const isFirstRun = affectedDocs.length === 0;

  return (
    <section className="flex min-h-full items-center justify-center px-6 py-14">
      <div className="w-full max-w-4xl text-center">
        <h1 className="text-2xl font-extrabold uppercase tracking-normal text-cyan-200 md:text-3xl">
          Assessment in progress
        </h1>
        <div className="mt-4 inline-flex items-center gap-2 rounded-md border border-cyan-300/50 bg-cyan-300/10 px-3 py-1 text-[10px] font-extrabold uppercase tracking-normal text-cyan-100 shadow-[0_0_24px_rgba(34,211,238,0.18)]">
          <span className="h-1.5 w-1.5 rounded-full bg-cyan-200 shadow-[0_0_12px_rgba(103,232,249,0.9)] animate-pulse" />
          {isFirstRun ? (
            allDocs.length > 0 ? (
              `Scanning ${affectedCount} / ${allDocs.length} files`
            ) : (
              `Scanning ${affectedCount} files`
            )
          ) : (
            `${affectedCount} files affected`
          )}
        </div>
        <AssessmentKnowledgeGraph
          className="mx-auto mt-8 max-w-3xl"
          heightClassName="h-[22rem] md:h-[28rem]"
          allDocuments={allDocs}
          affectedDocuments={affectedDocs}
          regulationTitle={regulationTitle}
          onProgress={setAffectedCount}
        />
      </div>
    </section>
  );
}
