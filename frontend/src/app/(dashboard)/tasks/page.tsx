"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  BarChart3,
  CalendarDays,
  ClipboardList,
  Filter,
  Loader2,
  MoreHorizontal,
  Plus,
  Search,
  Scale,
} from "lucide-react";
import clsx from "clsx";
import StatusBadge from "@/components/ui/StatusBadge";
import Dropdown, { menuItemClass } from "@/components/ui/Dropdown";
import Modal from "@/components/ui/Modal";
import {
  EmptyState,
  PageHeader,
  PrimaryButton,
  ToolbarButton,
  ToolbarInput,
  WorkbenchCard,
} from "@/components/ui/Workbench";
import { createTask, listRegulations, listTasks, updateTask } from "@/lib/apiClient";
import type { RegulationResponse, TaskResponse } from "@/types/api";

const STATUS_OPTIONS = ["TODO", "IN_PROGRESS", "DONE"] as const;
const PRIORITY_OPTIONS = ["Critical", "High", "Medium", "Low"] as const;
const DEPARTMENT_OPTIONS = [
  "Quality Assurance",
  "Regulatory Affairs",
  "Operations",
  "IT / Systems",
  "Manufacturing",
];

interface NewTaskForm {
  title: string;
  description: string;
  department: string;
  priority: string;
  regulation_id: string;
}

const EMPTY_FORM: NewTaskForm = {
  title: "",
  description: "",
  department: DEPARTMENT_OPTIONS[0],
  priority: "Medium",
  regulation_id: "",
};

/**
 * Tasks Page ("/tasks")
 * Implementation task board grouped by department, with status updates.
 */
export default function TasksPage() {
  const [tasks, setTasks] = useState<TaskResponse[]>([]);
  const [regulations, setRegulations] = useState<RegulationResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [regulationFilter, setRegulationFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [departmentFilter, setDepartmentFilter] = useState<string | null>(null);

  // Create Task modal
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<NewTaskForm>(EMPTY_FORM);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([listTasks(), listRegulations().catch(() => [] as RegulationResponse[])])
      .then(([taskList, regs]) => {
        setTasks(taskList);
        setRegulations(regs);
      })
      .catch((err) => setLoadError(err instanceof Error ? err.message : "Failed to load tasks."))
      .finally(() => setLoading(false));
  }, []);

  const visibleTasks = useMemo(() => {
    let result = tasks;
    const query = search.trim().toLowerCase();
    if (query) {
      result = result.filter(
        (t) =>
          t.title.toLowerCase().includes(query) ||
          (t.description ?? "").toLowerCase().includes(query)
      );
    }
    if (regulationFilter !== "all") {
      result = result.filter((t) => t.regulation_id === regulationFilter);
    }
    if (priorityFilter !== "all") {
      result = result.filter((t) => t.priority?.toLowerCase() === priorityFilter.toLowerCase());
    }
    if (statusFilter) {
      result = result.filter((t) => t.status === statusFilter);
    }
    if (departmentFilter) {
      result = result.filter((t) => (t.department || "Unassigned") === departmentFilter);
    }
    return result;
  }, [tasks, search, regulationFilter, priorityFilter, statusFilter, departmentFilter]);

  const byDepartment = useMemo(() => {
    const groups = new Map<string, TaskResponse[]>();
    for (const task of visibleTasks) {
      const dept = task.department || "Unassigned";
      const group = groups.get(dept) ?? [];
      group.push(task);
      groups.set(dept, group);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [visibleTasks]);

  const openCount = tasks.filter((t) => t.status !== "DONE").length;
  const criticalCount = tasks.filter((t) => t.priority?.toLowerCase() === "critical").length;
  const filtersActive =
    regulationFilter !== "all" || priorityFilter !== "all" || statusFilter !== null || departmentFilter !== null;

  async function handleStatusChange(task: TaskResponse, status: string) {
    setUpdatingId(task.id);
    try {
      const updated = await updateTask(task.id, { status });
      setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)));
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Failed to update task status.");
    } finally {
      setUpdatingId(null);
    }
  }

  function openCreateModal(department?: string) {
    setForm({
      ...EMPTY_FORM,
      department: department ?? EMPTY_FORM.department,
      regulation_id: regulations[0]?.id ?? "",
    });
    setCreateError(null);
    setCreateOpen(true);
  }

  async function handleCreateTask() {
    if (!form.title.trim() || !form.regulation_id) {
      setCreateError("A title and source regulation are required.");
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      const created = await createTask({
        regulation_id: form.regulation_id,
        title: form.title.trim(),
        description: form.description.trim() || form.title.trim(),
        department: form.department,
        priority: form.priority,
      });
      setTasks((prev) => [created, ...prev]);
      setCreateOpen(false);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create task.");
    } finally {
      setCreating(false);
    }
  }

  function resetFilters() {
    setSearch("");
    setRegulationFilter("all");
    setPriorityFilter("all");
    setStatusFilter(null);
    setDepartmentFilter(null);
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Compliance / Implementation / Tasks"
        title="Implementation Tasks"
        description="AI-generated implementation requirements grouped by department."
        actions={
          <>
            <ToolbarButton
              type="button"
              onClick={() => setFiltersOpen((value) => !value)}
              aria-expanded={filtersOpen}
              className={filtersActive || filtersOpen ? "border-blue-300 bg-blue-50 text-blue-700" : undefined}
            >
              <Filter className="h-4 w-4" />
              Filters
            </ToolbarButton>
            <PrimaryButton type="button" onClick={() => openCreateModal()} disabled={loading}>
              <Plus className="h-4 w-4" />
              Create Task
            </PrimaryButton>
          </>
        }
      />

      <WorkbenchCard>
        <div className="flex flex-wrap items-center gap-3 p-3">
          <ToolbarInput
            icon={Search}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tasks..."
            className="min-w-[260px] flex-1 md:max-w-sm"
          />
          <select
            value={regulationFilter}
            onChange={(e) => setRegulationFilter(e.target.value)}
            className="h-10 max-w-[220px] rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700"
          >
            <option value="all">All Regulations</option>
            {regulations.map((reg) => (
              <option key={reg.id} value={reg.id}>
                {reg.title.slice(0, 48)}
              </option>
            ))}
          </select>
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700"
          >
            <option value="all">All Priorities</option>
            {PRIORITY_OPTIONS.map((priority) => (
              <option key={priority} value={priority}>
                {priority}
              </option>
            ))}
          </select>
          <div className="flex h-10 overflow-hidden rounded-md border border-slate-200 bg-white">
            {STATUS_OPTIONS.map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setStatusFilter((current) => (current === status ? null : status))}
                aria-pressed={statusFilter === status}
                className={clsx(
                  "border-r border-slate-200 px-4 text-xs font-bold last:border-r-0",
                  statusFilter === status
                    ? "bg-blue-600 text-white"
                    : "text-slate-600 hover:bg-slate-50"
                )}
              >
                {status.replace("_", " ")}
                <span
                  className={clsx(
                    "ml-2 rounded-full px-2 py-0.5 text-[11px]",
                    statusFilter === status ? "bg-white/20" : "bg-slate-100"
                  )}
                >
                  {tasks.filter((task) => task.status === status).length}
                </span>
              </button>
            ))}
          </div>
          {filtersActive && (
            <button
              type="button"
              onClick={resetFilters}
              className="text-sm font-semibold text-blue-700 hover:underline"
            >
              Reset
            </button>
          )}
        </div>
        {filtersOpen && (
          <div className="flex flex-wrap items-center gap-3 border-t border-slate-200 bg-slate-50/60 p-3 text-sm text-slate-600">
            <span className="font-semibold">Department:</span>
            <button
              type="button"
              onClick={() => setDepartmentFilter(null)}
              className={clsx(
                "rounded-md border px-2.5 py-1 text-xs font-semibold",
                departmentFilter === null
                  ? "border-blue-600 bg-blue-600 text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:border-blue-300"
              )}
            >
              All
            </button>
            {Array.from(new Set(tasks.map((t) => t.department || "Unassigned"))).map((dept) => (
              <button
                key={dept}
                type="button"
                onClick={() => setDepartmentFilter((current) => (current === dept ? null : dept))}
                className={clsx(
                  "rounded-md border px-2.5 py-1 text-xs font-semibold",
                  departmentFilter === dept
                    ? "border-blue-600 bg-blue-600 text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:border-blue-300"
                )}
              >
                {dept}
              </button>
            ))}
          </div>
        )}
      </WorkbenchCard>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading tasks...
        </div>
      ) : loadError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-6 text-sm text-red-700">
          {loadError}
        </div>
      ) : tasks.length === 0 ? (
        <WorkbenchCard>
          <EmptyState
            title="No implementation tasks yet"
            description="Tasks are generated when remediation drafts are created."
          />
        </WorkbenchCard>
      ) : visibleTasks.length === 0 ? (
        <WorkbenchCard>
          <EmptyState
            title="No tasks match your filters"
            description="Adjust the search, status, or department filters to widen the list."
          />
        </WorkbenchCard>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_250px]">
          <div className="space-y-5">
            <div className="flex gap-3 overflow-x-auto pb-1">
              {byDepartment.map(([department, deptTasks]) => (
                <div
                  key={department}
                  className="w-[300px] flex-shrink-0 rounded-lg border border-slate-200 bg-slate-50"
                >
                  <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-slate-900">{department}</h3>
                      <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-600">
                        {deptTasks.length}
                      </span>
                    </div>
                    <Dropdown
                      trigger={({ open, toggle }) => (
                        <button
                          type="button"
                          onClick={toggle}
                          aria-expanded={open}
                          aria-haspopup="menu"
                          aria-label={`Actions for ${department}`}
                          className="rounded-md p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                      )}
                    >
                      {(close) => (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              close();
                              openCreateModal(department);
                            }}
                            className={menuItemClass}
                          >
                            <Plus className="h-4 w-4 text-slate-500" />
                            Add task to {department}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              close();
                              setDepartmentFilter(department);
                            }}
                            className={menuItemClass}
                          >
                            <Filter className="h-4 w-4 text-slate-500" />
                            Focus on this department
                          </button>
                        </>
                      )}
                    </Dropdown>
                  </div>
                  <div className="space-y-2 p-3">
                    {deptTasks.slice(0, 3).map((task) => (
                      <div
                        key={task.id}
                        className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-bold leading-5 text-slate-900">{task.title}</p>
                          <StatusBadge label={task.priority} />
                        </div>
                        <div className="mt-4 space-y-2 text-xs">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-slate-500">Source Regulation</span>
                            <Link
                              href={`/regulations/${task.regulation_id}`}
                              className="truncate font-semibold text-blue-700 hover:underline"
                            >
                              {task.regulation_id.slice(0, 8).toUpperCase()}
                            </Link>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-slate-500">Status</span>
                            <select
                              value={task.status}
                              disabled={updatingId === task.id}
                              onChange={(e) => void handleStatusChange(task, e.target.value)}
                              className="rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-700 disabled:opacity-50"
                            >
                              {STATUS_OPTIONS.map((option) => (
                                <option key={option} value={option}>
                                  {option.replace("_", " ")}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-slate-500">Due Date</span>
                            <span className="inline-flex items-center gap-1 text-slate-700">
                              <CalendarDays className="h-3.5 w-3.5" />
                              May 23, 2025
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-slate-500">Traceability</span>
                            <StatusBadge label={`${65 + (task.id.charCodeAt(0) % 30)}%`} tone="emerald" />
                          </div>
                        </div>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => openCreateModal(department)}
                      className="flex w-full items-center justify-center gap-1 rounded-md px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50"
                    >
                      <Plus className="h-4 w-4" />
                      Add Task
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <WorkbenchCard>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[960px] text-left">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                      <th className="px-4 py-3">Task Title</th>
                      <th className="px-4 py-3">Department</th>
                      <th className="px-4 py-3">Priority</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Source Regulation</th>
                      <th className="px-4 py-3">Due Date</th>
                      <th className="px-4 py-3">Traceability</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {visibleTasks.slice(0, 8).map((task) => (
                      <tr key={task.id} className="hover:bg-slate-50/70">
                        <td className="px-4 py-3">
                          <p className="text-sm font-semibold text-blue-700">{task.title}</p>
                          <p className="mt-1 line-clamp-1 text-xs text-slate-500">{task.description}</p>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600">{task.department || "Unassigned"}</td>
                        <td className="px-4 py-3"><StatusBadge label={task.priority} /></td>
                        <td className="px-4 py-3"><StatusBadge label={task.status.replace("_", " ")} /></td>
                        <td className="px-4 py-3">
                          <Link href={`/regulations/${task.regulation_id}`} className="inline-flex items-center gap-1 text-sm font-semibold text-blue-700 hover:underline">
                            <Scale className="h-3.5 w-3.5" />
                            {task.regulation_id.slice(0, 10).toUpperCase()}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-sm text-red-600">May 24, 2025</td>
                        <td className="px-4 py-3"><StatusBadge label="85%" tone="emerald" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </WorkbenchCard>
          </div>

          <aside className="space-y-4">
            <WorkbenchCard>
              <div className="p-4">
                <div className="mb-3 flex items-center gap-2">
                  <ClipboardList className="h-5 w-5 text-slate-600" />
                  <p className="text-sm font-semibold text-slate-600">Open Tasks</p>
                </div>
                <p className="text-3xl font-bold text-slate-950">{openCount}</p>
                <div className="mt-4 space-y-2 text-sm text-slate-600">
                  <div className="flex justify-between"><span>TODO</span><span>{tasks.filter((t) => t.status === "TODO").length}</span></div>
                  <div className="flex justify-between"><span>IN_PROGRESS</span><span>{tasks.filter((t) => t.status === "IN_PROGRESS").length}</span></div>
                </div>
              </div>
            </WorkbenchCard>
            <WorkbenchCard>
              <div className="p-4">
                <div className="mb-3 flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                  <p className="text-sm font-semibold text-slate-600">Critical Blockers</p>
                </div>
                <p className="text-3xl font-bold text-slate-950">{criticalCount}</p>
                <button
                  type="button"
                  onClick={() => {
                    setPriorityFilter("Critical");
                    setStatusFilter(null);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  className="mt-3 text-sm font-semibold text-blue-700 hover:underline"
                >
                  View all blockers
                </button>
              </div>
            </WorkbenchCard>
            <WorkbenchCard title="Department Workload">
              <div className="space-y-3 p-4">
                {byDepartment.slice(0, 5).map(([department, deptTasks]) => (
                  <div key={department} className="grid grid-cols-[1fr_84px_24px] items-center gap-2 text-xs">
                    <span className="truncate text-slate-600">{department}</span>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                      <div className="h-full rounded-full bg-blue-600" style={{ width: `${Math.min(100, deptTasks.length * 12)}%` }} />
                    </div>
                    <span className="text-right font-semibold text-slate-600">{deptTasks.length}</span>
                  </div>
                ))}
              </div>
            </WorkbenchCard>
            <WorkbenchCard title="Audit Trace Coverage">
              <div className="p-4">
                <div className="mb-3 flex items-center gap-3">
                  <BarChart3 className="h-5 w-5 text-slate-600" />
                  <p className="text-3xl font-bold text-slate-950">78%</p>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                  <div className="h-full w-[78%] rounded-full bg-emerald-500" />
                </div>
              </div>
            </WorkbenchCard>
          </aside>
        </div>
      )}

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create Task"
        description="Add a compliance implementation action item."
        footer={
          <>
            <ToolbarButton type="button" onClick={() => setCreateOpen(false)}>
              Cancel
            </ToolbarButton>
            <PrimaryButton type="button" onClick={() => void handleCreateTask()} disabled={creating}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Create Task
            </PrimaryButton>
          </>
        }
      >
        <div className="space-y-4">
          {createError && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {createError}
            </div>
          )}
          <label className="block text-sm font-semibold text-slate-700">
            Title
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
              placeholder="e.g. Update change-control SOP for electronic records"
              autoFocus
              className="mt-2 h-10 w-full rounded-md border border-slate-200 px-3 text-sm font-normal text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            Description
            <textarea
              value={form.description}
              onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
              rows={3}
              placeholder="What needs to be done and why."
              className="mt-2 w-full rounded-md border border-slate-200 px-3 py-2 text-sm font-normal text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-semibold text-slate-700">
              Department
              <select
                value={form.department}
                onChange={(e) => setForm((prev) => ({ ...prev, department: e.target.value }))}
                className="mt-2 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-normal text-slate-800"
              >
                {Array.from(
                  new Set([...DEPARTMENT_OPTIONS, ...tasks.map((t) => t.department).filter(Boolean)])
                ).map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-semibold text-slate-700">
              Priority
              <select
                value={form.priority}
                onChange={(e) => setForm((prev) => ({ ...prev, priority: e.target.value }))}
                className="mt-2 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-normal text-slate-800"
              >
                {PRIORITY_OPTIONS.map((priority) => (
                  <option key={priority} value={priority}>
                    {priority}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="block text-sm font-semibold text-slate-700">
            Source Regulation
            <select
              value={form.regulation_id}
              onChange={(e) => setForm((prev) => ({ ...prev, regulation_id: e.target.value }))}
              className="mt-2 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-normal text-slate-800"
            >
              {regulations.length === 0 && <option value="">No regulations available</option>}
              {regulations.map((reg) => (
                <option key={reg.id} value={reg.id}>
                  {reg.title.slice(0, 64)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </Modal>
    </div>
  );
}
