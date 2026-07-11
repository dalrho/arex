"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Loader2, MoreHorizontal, Plus, Search, RefreshCw } from "lucide-react";
import clsx from "clsx";
import Modal from "@/components/ui/Modal";
import StatusBadge from "@/components/ui/StatusBadge";
import { createTask, listRegulations, listTasks, updateTask, syncTasksToJira } from "@/lib/apiClient";
import type { RegulationResponse, TaskResponse } from "@/types/api";

const STATUSES = ["TODO", "IN_PROGRESS", "DONE"] as const;

function makeLocalId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<TaskResponse[]>([]);
  const [regulations, setRegulations] = useState<RegulationResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    description: "",
    department: "Engineering",
    priority: "High",
    regulation_id: "",
  });

  useEffect(() => {
    Promise.all([listTasks(), listRegulations()])
      .then(([taskRows, regulationRows]) => {
        setTasks(taskRows);
        setRegulations(regulationRows);
        setForm((current) => ({
          ...current,
          regulation_id: current.regulation_id || regulationRows[0]?.id || "",
        }));
      })
      .catch(() => {
        setTasks([]);
        setRegulations([]);
      })
      .finally(() => setLoading(false));
  }, []);

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    const activeTasks = tasks.filter((t) => t.status !== "REJECTED");
    if (!query) return activeTasks;
    return activeTasks.filter(
      (task) =>
        task.title.toLowerCase().includes(query) ||
        task.description.toLowerCase().includes(query) ||
        task.department.toLowerCase().includes(query)
    );
  }, [tasks, search]);

  const groups = useMemo(() => {
    const map = new Map<string, TaskResponse[]>();
    for (const task of visible) {
      const department = task.department || "Unassigned";
      map.set(department, [...(map.get(department) ?? []), task]);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [visible]);

  const openCount = tasks.filter((task) => task.status !== "DONE" && task.status !== "REJECTED").length;
  const departments = Array.from(new Set(tasks.filter((t) => t.status !== "REJECTED").map((task) => task.department || "Unassigned")));

  async function handleStatusChange(task: TaskResponse, status: string) {
    setUpdatingId(task.id);
    try {
      const updated = await updateTask(task.id, { status });
      setTasks((current) => current.map((item) => (item.id === task.id ? updated : item)));
    } catch {
      setTasks((current) => current.map((item) => (item.id === task.id ? { ...item, status } : item)));
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleCreate() {
    if (!form.title.trim() || !form.regulation_id) return;
    setCreating(true);
    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || form.title.trim(),
      department: form.department.trim() || "Unassigned",
      priority: form.priority,
      regulation_id: form.regulation_id,
    };

    try {
      const created = await createTask(payload);
      setTasks((current) => [created, ...current]);
    } catch {
      setTasks((current) => [
        {
          id: makeLocalId(),
          remediation_draft_id: null,
          status: "TODO",
          created_at: new Date().toISOString(),
          ...payload,
        },
        ...current,
      ]);
    } finally {
      setCreating(false);
      setCreateOpen(false);
      setForm({
        title: "",
        description: "",
        department: "Engineering",
        priority: "High",
        regulation_id: regulations[0]?.id || "",
      });
    }
  }

  async function handleSyncJira() {
    setSyncing(true);
    setSyncMessage(null);
    try {
      const res = await syncTasksToJira();
      setSyncMessage(res.message);
      setTimeout(() => {
        setSyncMessage(null);
      }, 5000);
    } catch {
      setSyncMessage("Failed to sync tasks to Jira.");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="h-full overflow-y-auto bg-[#020613]">
      <main className="px-6 py-6 md:px-10">
        <div className="mx-auto max-w-7xl">
          {syncMessage && (
            <div className={clsx(
              "mb-6 p-4 rounded-lg border flex items-center justify-between text-sm transition-all duration-300",
              syncMessage.includes("Failed") 
                ? "bg-rose-500/10 border-rose-500/30 text-rose-200" 
                : "bg-emerald-500/10 border-emerald-500/30 text-emerald-200"
            )}>
              <span>{syncMessage}</span>
              <button 
                type="button" 
                onClick={() => setSyncMessage(null)}
                className="text-slate-400 hover:text-white font-bold"
              >
                ✕
              </button>
            </div>
          )}
          <div className="mb-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.7fr)] lg:items-end">
            <div>
              <h1 className="text-2xl font-extrabold text-white">Implementation Tasks</h1>
              <div className="flex flex-wrap gap-4 mt-6">
                <button
                  type="button"
                  onClick={() => setCreateOpen(true)}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 text-sm font-bold text-white hover:bg-blue-500"
                >
                  <Plus className="h-5 w-5" />
                  Create Task
                </button>
                <button
                  type="button"
                  onClick={() => void handleSyncJira()}
                  disabled={syncing}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-700 bg-[#081024] px-6 text-sm font-bold text-slate-200 hover:bg-slate-900 disabled:opacity-60"
                >
                  {syncing ? <Loader2 className="h-5 w-5 animate-spin" /> : <RefreshCw className="h-5 w-5" />}
                  Sync to Jira
                </button>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-[190px_minmax(0,1fr)]">
              <div className="rounded-3xl border border-slate-700 bg-[#081024] p-5 text-center">
                <p className="text-xs font-extrabold text-slate-500">Open Tasks</p>
                <p className="mt-2 text-4xl font-extrabold text-white">{openCount}</p>
              </div>
              <div className="rounded-3xl border border-slate-700 bg-[#081024] p-5">
                <p className="text-xs font-extrabold text-slate-500">Department Workload</p>
                <div className="mt-3 border-t border-slate-800 pt-3 text-xs leading-7 text-slate-500">
                  {departments.length === 0 ? "No departments" : departments.join(" / ")}
                </div>
              </div>
            </div>
          </div>

          <div className="mb-8 border-t border-slate-700 pt-6">
            <div className="relative max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search tasks"
                className="h-11 w-full rounded-lg border border-slate-700 bg-[#081024] pl-10 pr-3 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-blue-500"
              />
            </div>
          </div>

          {loading ? (
            <div className="flex h-40 items-center justify-center gap-3 rounded-lg border border-slate-700 bg-[#081024] text-slate-400">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading tasks
            </div>
          ) : groups.length === 0 ? (
            <div className="rounded-lg border border-slate-700 bg-[#081024] px-6 py-16 text-center text-sm font-semibold text-slate-400">
              No tasks found
            </div>
          ) : (
            <div className="grid gap-6 lg:grid-cols-2 2xl:grid-cols-3">
              {groups.map(([department, departmentTasks]) => (
                <section key={department} className="rounded-3xl border border-slate-700 bg-[#081024]">
                  <div className="flex items-center justify-between border-b border-slate-700 px-6 py-5">
                    <h2 className="text-lg font-extrabold text-white">
                      {department}
                      <span className="ml-2 rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-400">
                        {departmentTasks.length}
                      </span>
                    </h2>
                    <MoreHorizontal className="h-5 w-5 text-slate-500" />
                  </div>
                  <div className="space-y-4 p-5">
                    {departmentTasks.map((task) => (
                      <article key={task.id} className="rounded-lg border border-slate-800 bg-[#040817] p-5">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <h3 className="text-base font-extrabold leading-6 text-white">{task.title}</h3>
                            <p className="mt-2 text-xs text-slate-400 leading-normal">{task.description}</p>
                          </div>
                          <div className="flex flex-col items-end gap-1.5 shrink-0">
                            <StatusBadge label={task.priority} tone={task.priority.toLowerCase() === "high" || task.priority.toLowerCase() === "critical" ? "red" : undefined} />
                            <StatusBadge
                              label={task.status.replace(/_/g, " ")}
                              tone={task.status === "PENDING_APPROVAL" ? "amber" : task.status === "DONE" ? "emerald" : "blue"}
                            />
                          </div>
                        </div>
                        <div className="mt-6 space-y-4 text-sm text-slate-400">
                          <TaskMeta label="Source Regulation" value={sourceTitle(task.regulation_id, regulations)} />
                          <TaskMeta label="Traceability" value={task.remediation_draft_id ? task.remediation_draft_id.slice(0, 8).toUpperCase() : "Manual task"} />
                          {task.jira_issue_key && (
                            <TaskMeta
                              label="Jira Ticket"
                              value={
                                task.jira_issue_url ? (
                                  <a
                                    href={task.jira_issue_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-cyan-400 hover:text-cyan-300 font-bold hover:underline inline-flex items-center gap-1"
                                  >
                                    {task.jira_issue_key}
                                    <span className="text-[10px]">↗</span>
                                  </a>
                                ) : (
                                  <span className="text-slate-300 font-semibold">{task.jira_issue_key}</span>
                                )
                              }
                            />
                          )}
                        </div>
                        {task.status === "PENDING_APPROVAL" ? (
                          <div className="mt-6 flex gap-2 w-full">
                            <button
                              type="button"
                              disabled={updatingId === task.id}
                              onClick={() => void handleStatusChange(task, "TODO")}
                              className="flex-1 h-8 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center justify-center gap-1.5"
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              disabled={updatingId === task.id}
                              onClick={() => void handleStatusChange(task, "REJECTED")}
                              className="flex-1 h-8 rounded-md bg-rose-600/20 hover:bg-rose-600/35 border border-rose-500/30 text-rose-200 text-xs font-bold transition flex items-center justify-center gap-1.5"
                            >
                              Reject
                            </button>
                          </div>
                        ) : (
                          <div className="mt-6 flex flex-wrap gap-2">
                            {STATUSES.map((status) => (
                              <button
                                key={status}
                                type="button"
                                disabled={updatingId === task.id}
                                onClick={() => void handleStatusChange(task, status)}
                                className={clsx(
                                  "h-8 rounded-md border px-2 text-xs font-bold",
                                  task.status === status
                                    ? "border-blue-500 bg-blue-500/15 text-blue-200"
                                    : "border-slate-700 text-slate-400 hover:bg-slate-900"
                                )}
                              >
                                {updatingId === task.id && task.status === status ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  status.replace("_", " ")
                                )}
                              </button>
                            ))}
                          </div>
                        )}
                      </article>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </main>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create Task"
        description="Create implementation work tied to a source regulation."
        footer={
          <>
            <button
              type="button"
              onClick={() => setCreateOpen(false)}
              className="h-10 rounded-md border border-slate-700 px-3 text-sm font-semibold text-slate-200 hover:bg-slate-900"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleCreate()}
              disabled={creating || !form.title.trim() || !form.regulation_id}
              className="inline-flex h-10 items-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-bold text-white hover:bg-blue-500 disabled:opacity-60"
            >
              {creating && <Loader2 className="h-4 w-4 animate-spin" />}
              Create
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Title" value={form.title} onChange={(value) => setForm((current) => ({ ...current, title: value }))} />
          <Field label="Description" value={form.description} onChange={(value) => setForm((current) => ({ ...current, description: value }))} textarea />
          <Field label="Department" value={form.department} onChange={(value) => setForm((current) => ({ ...current, department: value }))} />
          <div>
            <label className="text-xs font-bold uppercase text-slate-500">Priority</label>
            <select
              value={form.priority}
              onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value }))}
              className="mt-1 h-10 w-full rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
            >
              {["Critical", "High", "Medium", "Low"].map((priority) => (
                <option key={priority}>{priority}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-bold uppercase text-slate-500">Source Regulation</label>
            <select
              value={form.regulation_id}
              onChange={(event) => setForm((current) => ({ ...current, regulation_id: event.target.value }))}
              className="mt-1 h-10 w-full rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
            >
              {regulations.map((regulation) => (
                <option key={regulation.id} value={regulation.id}>
                  {regulation.title}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function TaskMeta({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <div className="mt-1 line-clamp-2 text-sm font-semibold text-slate-300">{value}</div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  textarea = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  textarea?: boolean;
}) {
  return (
    <div>
      <label className="text-xs font-bold uppercase text-slate-500">{label}</label>
      {textarea ? (
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          rows={4}
          className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
        />
      ) : (
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="mt-1 h-10 w-full rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
        />
      )}
    </div>
  );
}

function sourceTitle(regulationId: string, regulations: RegulationResponse[]): string {
  return regulations.find((regulation) => regulation.id === regulationId)?.title ?? `Regulation ${regulationId.slice(0, 8).toUpperCase()}`;
}
