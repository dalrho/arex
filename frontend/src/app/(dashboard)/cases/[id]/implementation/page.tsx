"use client";

import React, { Suspense, useEffect, useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Loader2, ArrowLeft, RefreshCw, AlertCircle, CheckCircle2, ClipboardCheck, ArrowUpRight } from "lucide-react";
import clsx from "clsx";
import StatusBadge from "@/components/ui/StatusBadge";
import { generateImplementationTasks, syncTasksToJira, updateTask, listTasks, getRegulation } from "@/lib/apiClient";
import type { TaskResponse } from "@/types/api";

function CaseImplementationPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const regulationId = params.id;
  const shouldRegenerate = searchParams.get("regenerate") === "true";

  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<TaskResponse[]>([]);
  const [regulation, setRegulation] = useState<any>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [approvingAll, setApprovingAll] = useState(false);

  useEffect(() => {
    if (!regulationId) {
      router.push("/regulations");
      return;
    }

    async function loadOrGenerateTasks() {
      try {
        setLoading(true);
        setError(null);

        try {
          const reg = await getRegulation(regulationId);
          setRegulation(reg);
        } catch (regErr) {
          console.error("Failed to load regulation info:", regErr);
        }

        // Unless we explicitly request regeneration, try to fetch existing tasks first
        if (!shouldRegenerate) {
          const allTasks = await listTasks();
          const existing = allTasks.filter((t) => t.regulation_id === regulationId && t.status !== "REJECTED");
          if (existing.length > 0) {
            setTasks(existing);
            setLoading(false);
            return;
          }
        }

        // Otherwise generate/regenerate tasks
        const res = await generateImplementationTasks(regulationId);
        
        if (res.requires_tasks === false) {
          // If no tasks are required, redirect back to regulations with a success message
          const msg = encodeURIComponent(res.message || "Policy revision completed successfully. No implementation tasks are required.");
          router.push(`/regulations?success_msg=${msg}`);
          return;
        }

        setTasks(res.tasks || []);
      } catch (err: any) {
        setError(err.message || "Failed to generate implementation tasks.");
      } finally {
        setLoading(false);
      }
    }

    void loadOrGenerateTasks();
  }, [regulationId, shouldRegenerate, router]);

  // Group tasks by department
  const groups = useMemo(() => {
    const map = new Map<string, TaskResponse[]>();
    for (const task of tasks) {
      const department = task.department || "Unassigned";
      map.set(department, [...(map.get(department) ?? []), task]);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [tasks]);

  const pendingCount = tasks.filter((t) => t.status === "PENDING_APPROVAL").length;
  const approvedCount = tasks.filter((t) => t.status === "TODO" || t.status === "IN_PROGRESS" || t.status === "DONE").length;

  async function handleApproveTask(task: TaskResponse) {
    try {
      const updated = await updateTask(task.id, { status: "TODO" });
      setTasks((current) => current.map((t) => (t.id === task.id ? updated : t)));
    } catch {
      setTasks((current) => current.map((t) => (t.id === task.id ? { ...t, status: "TODO" } : t)));
    }
  }

  async function handleRejectTask(task: TaskResponse) {
    try {
      const updated = await updateTask(task.id, { status: "REJECTED" });
      setTasks((current) => current.map((t) => (t.id === task.id ? updated : t)));
    } catch {
      setTasks((current) => current.map((t) => (t.id === task.id ? { ...t, status: "REJECTED" } : t)));
    }
  }

  async function handleApproveAll() {
    setApprovingAll(true);
    try {
      const pendingTasks = tasks.filter((t) => t.status === "PENDING_APPROVAL");
      await Promise.all(
        pendingTasks.map((t) => updateTask(t.id, { status: "TODO" }))
      );
      setTasks((current) =>
        current.map((t) => (t.status === "PENDING_APPROVAL" ? { ...t, status: "TODO" } : t))
      );
    } catch {
      setTasks((current) =>
        current.map((t) => (t.status === "PENDING_APPROVAL" ? { ...t, status: "TODO" } : t))
      );
    } finally {
      setApprovingAll(false);
    }
  }

  async function handleSyncJira() {
    setSyncing(true);
    setSyncMessage(null);
    try {
      const res = await syncTasksToJira();
      setSyncMessage(res.message);
    } catch {
      setSyncMessage("Failed to sync tasks to Jira.");
    } finally {
      setSyncing(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#020613] text-slate-400">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin text-blue-500 mx-auto" />
          <p className="mt-4 text-sm font-semibold uppercase tracking-wider">
            {shouldRegenerate ? "Regenerating Operational Tasks..." : "Loading Implementation Plan..."}
          </p>
          <p className="mt-2 text-xs text-slate-500">Analyzing compliance changes and department workloads.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-[#020613]">
      <main className="px-6 py-6 md:px-10">
        <div className="mx-auto max-w-7xl">
          
          <Link href="/regulations" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-blue-300 mb-6">
            <ArrowLeft className="h-4 w-4" />
            Back to Case Regulations
          </Link>

          {syncMessage && (
            <div className={clsx(
              "mb-6 p-4 rounded-lg border flex items-center justify-between text-sm transition-all duration-300",
              syncMessage.includes("Failed") 
                ? "bg-rose-500/10 border-rose-500/30 text-rose-200" 
                : "bg-emerald-500/10 border-emerald-500/30 text-emerald-200"
            )}>
              <span className="font-semibold">{syncMessage}</span>
              <button 
                type="button" 
                onClick={() => setSyncMessage(null)}
                className="text-slate-400 hover:text-white font-bold ml-4"
              >
                ✕
              </button>
            </div>
          )}

          {error && (
            <div className="mb-6 p-4 rounded-lg border bg-rose-500/10 border-rose-500/30 text-rose-250 flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-rose-400 shrink-0" />
              <div>
                <p className="font-bold text-white">Error Generating Tasks</p>
                <p className="text-xs text-slate-400 mt-1">{error}</p>
              </div>
            </div>
          )}

          <div className="mb-8 flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <div>
              <p className="text-xs font-extrabold uppercase text-blue-500 tracking-wider">Compliance Case Stage</p>
              <h1 className="text-3xl font-extrabold text-white mt-2">Implementation Planning</h1>
              
              <div className="flex flex-wrap gap-4 mt-6">
                <button
                  type="button"
                  onClick={() => void handleApproveAll()}
                  disabled={approvingAll || pendingCount === 0 || regulation?.status === "Closed"}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 text-sm font-bold text-white hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {approvingAll ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}
                  Approve All Tasks
                </button>
                <button
                  type="button"
                  onClick={() => void handleSyncJira()}
                  disabled={syncing || approvedCount === 0 || regulation?.status === "Closed"}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-700 bg-[#081024] px-6 text-sm font-bold text-slate-200 hover:bg-slate-900 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {syncing ? <Loader2 className="h-5 w-5 animate-spin" /> : <ArrowUpRight className="h-5 w-5" />}
                  Push to Jira
                </button>
              </div>
            </div>

            <div className="grid gap-4 grid-cols-2 min-w-[280px]">
              <div className="rounded-2xl border border-slate-700 bg-[#081024] p-5 text-center shadow-lg">
                <p className="text-xs font-bold uppercase text-slate-500">Pending Approval</p>
                <p className="mt-2 text-3xl font-extrabold text-yellow-400">{pendingCount}</p>
              </div>
              <div className="rounded-2xl border border-slate-700 bg-[#081024] p-5 text-center shadow-lg">
                <p className="text-xs font-bold uppercase text-slate-500">Approved (Ready)</p>
                <p className="mt-2 text-3xl font-extrabold text-emerald-400">{approvedCount}</p>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-700 pt-6">
            {groups.length === 0 ? (
              <div className="rounded-xl border border-slate-800 bg-[#081024] px-6 py-16 text-center text-slate-400">
                <ClipboardCheck className="h-12 w-12 text-slate-600 mx-auto mb-4" />
                <p className="font-bold text-white">No Tasks Generated</p>
                <p className="text-xs text-slate-500 mt-2">No operational tasks were outputted by the compliance AI engine.</p>
              </div>
            ) : (
              <div className="grid gap-8 lg:grid-cols-2 2xl:grid-cols-3">
                {groups.map(([department, deptTasks]) => (
                  <section key={department} className="rounded-2xl border border-slate-700 bg-[#081024] overflow-hidden shadow-lg">
                    <div className="flex items-center justify-between border-b border-slate-700 bg-[#0c1836] px-6 py-4">
                      <h2 className="text-base font-extrabold text-white">
                        {department}
                        <span className="ml-2 rounded-full bg-slate-900 px-2 py-0.5 text-xs text-slate-400 font-bold">
                          {deptTasks.length}
                        </span>
                      </h2>
                    </div>
                    
                    <div className="space-y-4 p-5">
                      {deptTasks.map((task) => (
                        <article key={task.id} className={clsx(
                          "rounded-xl border p-5 transition-all duration-200",
                          task.status === "PENDING_APPROVAL" ? "border-yellow-500/20 bg-[#0d162a]" : 
                          task.status === "REJECTED" ? "border-rose-500/10 bg-slate-900/50 opacity-60" : "border-slate-800 bg-[#040817]"
                        )}>
                          <div className="flex flex-col gap-4">
                            <div>
                              <div className="flex items-center justify-between gap-3">
                                <h3 className="text-sm font-bold leading-5 text-white">{task.title}</h3>
                                <StatusBadge label={task.priority} tone={task.priority.toLowerCase() === "high" || task.priority.toLowerCase() === "critical" ? "red" : undefined} />
                              </div>
                              <p className="mt-2 text-xs text-slate-400 leading-relaxed">{task.description}</p>
                            </div>

                            <div className="flex items-center justify-between gap-3 border-t border-slate-800/80 pt-3 mt-1">
                              <span className="text-[10px] font-bold text-slate-500 uppercase">
                                Status: {task.status.replace(/_/g, " ")}
                              </span>
                              
                              {task.status === "PENDING_APPROVAL" ? (
                                <div className="flex gap-2">
                                  <button
                                    type="button"
                                    onClick={() => void handleApproveTask(task)}
                                    disabled={regulation?.status === "Closed"}
                                    className="px-3 py-1 rounded bg-emerald-600 text-xs font-bold text-white transition hover:bg-emerald-500 disabled:opacity-50"
                                  >
                                    Approve
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => void handleRejectTask(task)}
                                    disabled={regulation?.status === "Closed"}
                                    className="px-3 py-1 rounded bg-rose-600 text-xs font-bold text-white transition hover:bg-rose-500 disabled:opacity-50"
                                  >
                                    Reject
                                  </button>
                                </div>
                              ) : (
                                <span className={clsx(
                                  "text-xs font-bold px-2 py-0.5 rounded",
                                  task.status === "REJECTED" ? "text-rose-400 bg-rose-450/10" : "text-emerald-400 bg-emerald-450/10"
                                )}>
                                  {task.status === "REJECTED" ? "Rejected" : "Approved"}
                                </span>
                              )}
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </div>

        </div>
      </main>
    </div>
  );
}

export default function CaseImplementationPageWrapper({ params }: { params: { id: string } }) {
  return (
    <Suspense
      fallback={
        <div className="flex h-full items-center justify-center bg-[#020613] text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      }
    >
      <CaseImplementationPage params={params} />
    </Suspense>
  );
}
