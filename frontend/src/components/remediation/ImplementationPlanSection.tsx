import React, { useMemo } from "react";
import { Circle, Loader2 } from "lucide-react";
import StatusBadge from "@/components/ui/StatusBadge";
import type { TaskResponse } from "@/types/api";

const DEPARTMENTS = ["Engineering", "Quality Assurance", "Training", "IT"] as const;

const TEAM_BY_DEPARTMENT: Record<string, string> = {
  Engineering: "Platform Team",
  IT: "Platform Team",
  "Quality Assurance": "QA Team",
  Training: "L&D Team",
};

function normalizeDepartment(value: string): string {
  return value.trim().toLowerCase();
}

function teamForDepartment(department: string): string {
  return TEAM_BY_DEPARTMENT[department] ?? `${department} Team`;
}

function statusLabel(status: string): string {
  return status.replace(/_/g, " ");
}

function priorityTone(priority: string): "red" | "amber" | undefined {
  const normalized = priority.toLowerCase();
  if (normalized === "critical" || normalized === "high") return "red";
  if (normalized === "medium") return "amber";
  return undefined;
}

interface ImplementationPlanSectionProps {
  tasks: TaskResponse[];
  loading: boolean;
}

export default function ImplementationPlanSection({ tasks, loading }: ImplementationPlanSectionProps) {
  const grouped = useMemo(() => {
    const map = new Map<string, TaskResponse[]>();
    for (const department of DEPARTMENTS) {
      map.set(department, []);
    }
    for (const task of tasks) {
      const match = DEPARTMENTS.find((department) => normalizeDepartment(department) === normalizeDepartment(task.department));
      if (match) {
        map.set(match, [...(map.get(match) ?? []), task]);
      }
    }
    return map;
  }, [tasks]);

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center gap-3 rounded-lg border border-slate-700 bg-[#081024] text-slate-400">
        <Loader2 className="h-5 w-5 animate-spin" />
        Loading implementation plan
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {DEPARTMENTS.map((department) => {
        const departmentTasks = grouped.get(department) ?? [];
        return (
          <section key={department} className="rounded-lg border border-slate-700 bg-[#081024]">
            <div className="border-b border-slate-700 px-6 py-4">
              <h3 className="text-sm font-extrabold uppercase text-slate-300">{department}</h3>
            </div>
            <div className="space-y-4 p-5">
              {departmentTasks.length === 0 ? (
                <p className="rounded-lg border border-dashed border-slate-800 px-4 py-8 text-center text-sm text-slate-500">
                  No tasks assigned
                </p>
              ) : (
                departmentTasks.map((task) => (
                  <article key={task.id} className="rounded-lg border border-slate-800 bg-[#040817] p-5">
                    <div className="flex items-start justify-between gap-4">
                      <h4 className="text-base font-extrabold leading-6 text-white">{task.title}</h4>
                      <StatusBadge label={task.priority} tone={priorityTone(task.priority)} />
                    </div>
                    <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500">
                      <span>{teamForDepartment(department)}</span>
                      <span>2 weeks</span>
                      <span className="inline-flex items-center gap-1.5">
                        <Circle className="h-2 w-2 fill-slate-500 text-slate-500" />
                        {statusLabel(task.status)}
                      </span>
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
