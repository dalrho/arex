"use client";

import React, { useEffect, useState } from "react";
import { Loader2, Shield, User as UserIcon, Users } from "lucide-react";
import StatusBadge from "@/components/ui/StatusBadge";
import {
  EmptyState,
  PageHeader,
  StatCard,
  WorkbenchCard,
} from "@/components/ui/Workbench";
import { listUsers } from "@/lib/apiClient";
import { formatDate } from "@/lib/format";
import type { UserResponse } from "@/types/api";

function roleTone(role: string): "blue" | "emerald" | "amber" | "slate" {
  const normalized = role.toLowerCase();
  if (normalized.includes("admin")) return "emerald";
  if (normalized.includes("qa") || normalized.includes("quality")) return "blue";
  if (normalized.includes("engineer") || normalized.includes("validation")) return "amber";
  return "slate";
}

function initialsFor(email: string): string {
  const local = email.split("@")[0] ?? "";
  const parts = local.split(/[._-]+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return local.slice(0, 2).toUpperCase() || "??";
}

/**
 * Users Page ("/users")
 * Read-only org user directory for role visibility and audit context.
 */
export default function UsersPage() {
  const [users, setUsers] = useState<UserResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    listUsers()
      .then((rows) => {
        rows.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        setUsers(rows);
      })
      .catch((err) => setLoadError(err instanceof Error ? err.message : "Failed to load users."))
      .finally(() => setLoading(false));
  }, []);

  const roleCounts = users.reduce<Record<string, number>>((acc, user) => {
    acc[user.role] = (acc[user.role] ?? 0) + 1;
    return acc;
  }, {});

  const summary = [
    {
      label: "Total Users",
      value: users.length,
      detail: "In this organization",
      icon: Users,
      tone: "blue" as const,
    },
    {
      label: "Distinct Roles",
      value: Object.keys(roleCounts).length,
      detail: "RBAC assignments",
      icon: Shield,
      tone: "emerald" as const,
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Organization Users"
        description="Authorized accounts scoped to this tenant. User management is read-only in the MVP."
      />

      {!loading && !loadError && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {summary.map((item) => (
            <StatCard
              key={item.label}
              label={item.label}
              value={item.value}
              detail={item.detail}
              icon={item.icon}
              tone={item.tone}
            />
          ))}
        </div>
      )}

      <WorkbenchCard>
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading users...
          </div>
        ) : loadError ? (
          <div className="px-4 py-16 text-center text-sm text-red-600">{loadError}</div>
        ) : users.length === 0 ? (
          <EmptyState
            title="No users found"
            description="Seed demo data or register users to populate this directory."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-200 text-xs font-bold text-slate-700">
                          {initialsFor(user.email)}
                        </span>
                        <span className="text-sm font-semibold text-slate-900">
                          {user.email.split("@")[0]}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">{user.email}</td>
                    <td className="px-4 py-3">
                      <StatusBadge label={user.role} tone={roleTone(user.role)} />
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500">{formatDate(user.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </WorkbenchCard>

      {!loading && !loadError && users.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
          <p className="flex items-center gap-2 font-semibold text-slate-800">
            <UserIcon className="h-4 w-4 text-slate-500" />
            Role distribution
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {Object.entries(roleCounts).map(([role, count]) => (
              <span
                key={role}
                className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700"
              >
                {role}: {count}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
