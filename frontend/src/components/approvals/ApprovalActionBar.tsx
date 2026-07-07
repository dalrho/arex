"use client";

import React, { useEffect, useState } from "react";
import { CheckCircle2, Edit3, Loader2, Lock, ShieldCheck, XCircle } from "lucide-react";
import { getCurrentUser, getToken } from "@/lib/apiClient";

const APPROVER_ROLES = ["QA Manager", "Org Admin"];

interface ApprovalActionBarProps {
  status: string;
  busy: boolean;
  onDecision: (decision: "APPROVED" | "REJECTED") => void;
  onRequestEdit: () => void;
}

/**
 * Floating sign-off bar for remediation review. Approve/Reject actions are
 * enabled only for pending drafts reviewed by a QA Manager or Org Admin.
 */
export default function ApprovalActionBar({ status, busy, onDecision, onRequestEdit }: ApprovalActionBarProps) {
  // Read auth state after mount to avoid SSR/client hydration mismatch.
  const [auth, setAuth] = useState<{ signedIn: boolean; canApprove: boolean }>({
    signedIn: false,
    canApprove: false,
  });

  useEffect(() => {
    const user = getCurrentUser();
    setAuth({
      signedIn: Boolean(getToken() && user),
      canApprove: Boolean(user && APPROVER_ROLES.includes(user.role)),
    });
  }, []);

  const isPending = status === "PENDING_REVIEW";
  const enabled = isPending && auth.signedIn && auth.canApprove && !busy;

  let disabledReason: string | null = null;
  if (!isPending) {
    disabledReason = `This draft has already been ${status.toLowerCase().replace("_", " ")}. No further sign-off actions are permitted.`;
  } else if (!auth.signedIn) {
    disabledReason = "Sign in to record an approval decision (21 CFR Part 11 requires an authenticated session).";
  } else if (!auth.canApprove) {
    disabledReason = "Only QA Manager or Org Admin roles can sign off on remediation drafts.";
  }

  return (
    <div className="sticky bottom-0 z-10 -mx-4 bg-gradient-to-t from-slate-100 via-slate-100/95 to-transparent px-4 pb-4 pt-2 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-lg shadow-slate-950/10 lg:flex-row lg:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-3 text-xs text-slate-500">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-700">
            <Lock className="h-4 w-4" />
          </div>
          <span className="leading-5">
            {disabledReason ??
              "Your decision will be recorded in the immutable audit trail and cannot be changed after signing."}
          </span>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:flex lg:flex-wrap lg:items-center">
          <button
            type="button"
            disabled={!enabled}
            onClick={() => onDecision("REJECTED")}
            className="inline-flex h-10 min-w-32 items-center justify-center gap-2 rounded-md border border-red-200 bg-white px-4 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
            Reject
          </button>
          <button
            type="button"
            disabled={!enabled}
            onClick={onRequestEdit}
            className="inline-flex h-10 min-w-36 items-center justify-center gap-2 rounded-md border border-blue-200 bg-white px-4 text-sm font-semibold text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Edit3 className="h-4 w-4" />
            Request Edit
          </button>
          <button
            type="button"
            disabled={!enabled}
            onClick={() => onDecision("APPROVED")}
            className="inline-flex h-10 min-w-48 items-center justify-center gap-2 rounded-md bg-emerald-700 px-5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Approve &amp; Sign
          </button>
        </div>
      </div>
    </div>
  );
}
