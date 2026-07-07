import React from "react";
import type { LucideIcon } from "lucide-react";
import clsx from "clsx";

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description: string;
  actions?: React.ReactNode;
}

export function PageHeader({ eyebrow, title, description, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        {eyebrow && (
          <p className="mb-1 text-xs font-medium text-slate-500">{eyebrow}</p>
        )}
        <h1 className="text-2xl font-bold tracking-normal text-slate-950">{title}</h1>
        <p className="mt-1 text-sm text-slate-600">{description}</p>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

interface WorkbenchCardProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  action?: React.ReactNode;
}

export function WorkbenchCard({ children, className, title, action }: WorkbenchCardProps) {
  return (
    <section className={clsx("rounded-lg border border-slate-200 bg-white shadow-sm", className)}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
          {title && <h2 className="text-sm font-bold text-slate-950">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

interface StatCardProps {
  label: string;
  value: string | number;
  detail: string;
  icon: LucideIcon;
  tone?: "blue" | "emerald" | "amber" | "red" | "slate";
}

const STAT_TONES = {
  blue: "bg-blue-50 text-blue-600 border-blue-100",
  emerald: "bg-emerald-50 text-emerald-600 border-emerald-100",
  amber: "bg-amber-50 text-amber-600 border-amber-100",
  red: "bg-red-50 text-red-600 border-red-100",
  slate: "bg-slate-100 text-slate-600 border-slate-200",
};

export function StatCard({ label, value, detail, icon: Icon, tone = "blue" }: StatCardProps) {
  return (
    <WorkbenchCard className="p-4">
      <div className="flex items-center gap-4">
        <div className={clsx("flex h-12 w-12 items-center justify-center rounded-lg border", STAT_TONES[tone])}>
          <Icon className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-500">{label}</p>
          <p className="text-2xl font-bold leading-tight text-slate-950">{value}</p>
          <p className="text-xs font-medium text-slate-500">{detail}</p>
        </div>
      </div>
    </WorkbenchCard>
  );
}

interface ToolbarInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon: LucideIcon;
}

export function ToolbarInput({ icon: Icon, className, ...props }: ToolbarInputProps) {
  return (
    <div className={clsx("relative", className)}>
      <Icon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        {...props}
        className="h-10 w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
      />
    </div>
  );
}

export function ToolbarButton({
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={clsx(
        "inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
    >
      {children}
    </button>
  );
}

export function PrimaryButton({
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={clsx(
        "inline-flex h-10 items-center justify-center gap-2 rounded-md border border-blue-600 bg-blue-600 px-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
    >
      {children}
    </button>
  );
}

interface EmptyStateProps {
  title: string;
  description: string;
}

export function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <div className="px-4 py-14 text-center">
      <p className="text-sm font-semibold text-slate-700">{title}</p>
      <p className="mt-1 text-sm text-slate-500">{description}</p>
    </div>
  );
}
