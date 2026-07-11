"use client";

import React, { useCallback, useEffect, useState } from "react";
import { AlertTriangle, BarChart3, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { getAdminStats, resetApplicationData } from "@/lib/apiClient";
import type { DataStats } from "@/types/api";

export default function DataManagementPage() {
  const [stats, setStats] = useState<DataStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetInput, setResetInput] = useState("");
  const [resetting, setResetting] = useState(false);
  const [resetMsg, setResetMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    setLoading(true);
    try {
      const s = await getAdminStats();
      setStats(s);
    } catch {
      setError("Could not load data statistics. Ensure the backend is running.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadStats(); }, [loadStats]);

  async function handleReset() {
    if (resetInput !== "RESET") return;
    setResetting(true);
    try {
      const res = await resetApplicationData();
      setResetMsg(res.message);
      setResetOpen(false);
      setResetInput("");
      void loadStats();
    } catch (e: any) {
      setError(e?.message || "Reset failed.");
    } finally {
      setResetting(false);
    }
  }

  return (
    <div className="min-h-full overflow-y-auto bg-[#020613] px-6 py-8 md:px-10">
      <div className="mx-auto max-w-3xl space-y-8">
        {/* Header */}
        <div>
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-400">Settings</span>
          <h1 className="mt-1 text-2xl font-extrabold text-white">Data Management</h1>
          <p className="mt-1 text-sm text-slate-400">
            View your regulatory database statistics and reset the application to a clean state.
          </p>
        </div>

        {resetMsg && (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200 flex justify-between">
            <span>{resetMsg}</span>
            <button onClick={() => setResetMsg(null)} className="ml-4 text-emerald-400 hover:text-white">✕</button>
          </div>
        )}
        {error && (
          <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200 flex justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="ml-4 text-rose-400 hover:text-white">✕</button>
          </div>
        )}

        {/* Application Data Stats */}
        <section className="rounded-2xl border border-slate-700 bg-[#081024] p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-blue-400" />
              <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-200">Application Data</h2>
            </div>
            <button
              onClick={() => void loadStats()}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-700"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>

          {loading ? (
            <div className="flex items-center gap-2 text-slate-400 py-4">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading statistics…
            </div>
          ) : stats ? (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              {[
                { label: "Regulations", value: stats.total_regulations },
                { label: "Compliance Cases", value: stats.total_compliance_cases },
                { label: "Knowledge Base Docs", value: stats.total_knowledge_base_documents },
                { label: "Impact Assessments", value: stats.total_impact_assessments },
                { label: "Remediation Drafts", value: stats.total_remediation_drafts },
                { label: "Implementation Tasks", value: stats.total_implementation_tasks },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-xl border border-slate-800 bg-[#040816] p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
                  <p className="mt-1 text-2xl font-extrabold text-white">{value}</p>
                </div>
              ))}
            </div>
          ) : null}
        </section>


        {/* Danger Zone */}
        <section className="rounded-2xl border border-rose-500/30 bg-rose-500/5 p-6 space-y-5">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-rose-400" />
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-rose-300">Danger Zone</h2>
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-200">Reset Workspace</h3>
            <p className="mt-1 text-xs text-slate-400">
              Permanently delete all workspace data. This action is irreversible.
            </p>
          </div>
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start justify-between">
            <div className="grid gap-6 sm:grid-cols-2 text-xs">
              <div>
                <p className="font-bold text-rose-300 uppercase tracking-wider mb-2">This will permanently delete:</p>
                <ul className="space-y-1 text-slate-300 list-disc list-inside">
                  <li>Regulations</li>
                  <li>Uploaded regulation documents</li>
                  <li>Company knowledge base documents</li>
                  <li>Compliance cases</li>
                  <li>AI-generated impact assessments</li>
                  <li>Remediation drafts</li>
                  <li>Implementation plans</li>
                  <li>Implementation tasks</li>
                  <li>Audit logs</li>
                  <li>Notifications</li>
                  <li>Vector embeddings</li>
                </ul>
              </div>
              <div>
                <p className="font-bold text-slate-400 uppercase tracking-wider mb-2">The following will NOT be deleted:</p>
                <ul className="space-y-1 text-slate-400 list-disc list-inside">
                  <li>User accounts</li>
                  <li>Organization profile</li>
                  <li>Roles & permissions</li>
                  <li>System settings</li>
                  <li>API keys</li>
                </ul>
              </div>
            </div>
            <button
              onClick={() => setResetOpen(true)}
              className="shrink-0 mt-4 sm:mt-0 inline-flex items-center gap-2 rounded-lg border border-rose-500/40 bg-rose-500/10 px-5 py-2.5 text-sm font-bold text-rose-300 hover:bg-rose-500/20 transition"
            >
              <Trash2 className="h-4 w-4" /> Reset Workspace
            </button>
          </div>
        </section>
      </div>

      {/* Reset Confirmation Dialog */}
      {resetOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4">
          <div className="w-full max-w-lg rounded-2xl border border-rose-500/30 bg-[#0d0a14] p-8 shadow-2xl space-y-6">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-500/15 border border-rose-500/30">
                <AlertTriangle className="h-5 w-5 text-rose-400" />
              </span>
              <h3 className="text-lg font-extrabold text-white">Reset Workspace</h3>
            </div>
            <div className="space-y-4">
              <p className="text-sm text-slate-300 leading-6">
                Are you absolutely sure you want to reset the workspace? This will permanently wipe all uploaded compliance files, cases, and records.
              </p>
              <div className="grid gap-4 sm:grid-cols-2 text-xs rounded-xl bg-black/40 p-4 border border-slate-800">
                <div>
                  <p className="font-bold text-rose-300 uppercase tracking-wider mb-2">Deletes permanently:</p>
                  <ul className="space-y-1 text-slate-400 list-disc list-inside">
                    <li>Regulations & docs</li>
                    <li>Knowledge base</li>
                    <li>Compliance cases</li>
                    <li>AI assessments</li>
                    <li>Remediations & tasks</li>
                    <li>Audit logs & alerts</li>
                    <li>Vector embeddings</li>
                  </ul>
                </div>
                <div>
                  <p className="font-bold text-slate-400 uppercase tracking-wider mb-2">Preserves:</p>
                  <ul className="space-y-1 text-slate-500 list-disc list-inside">
                    <li>User accounts</li>
                    <li>Org profile</li>
                    <li>Permissions</li>
                    <li>System settings</li>
                    <li>API keys</li>
                  </ul>
                </div>
              </div>
              <p className="text-sm font-bold text-rose-400">This action cannot be undone.</p>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                Type <span className="text-white font-mono">RESET</span> to confirm
              </label>
              <input
                type="text"
                value={resetInput}
                onChange={(e) => setResetInput(e.target.value)}
                placeholder="RESET"
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:border-rose-500/60 focus:outline-none"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => { setResetOpen(false); setResetInput(""); }}
                className="flex-1 rounded-lg border border-slate-700 bg-slate-800 py-2.5 text-sm font-bold text-slate-300 hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleReset()}
                disabled={resetInput !== "RESET" || resetting}
                className="flex-1 rounded-lg bg-rose-600 py-2.5 text-sm font-bold text-white hover:bg-rose-500 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {resetting && <Loader2 className="h-4 w-4 animate-spin" />}
                Reset Workspace
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
