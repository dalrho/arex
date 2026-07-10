import type { AuthUser } from "@/types/api";

/** Derives a friendly display name from the account email. */
export function getAccountDisplayName(user: AuthUser | null, fallback = "QA"): string {
  if (!user?.email) return fallback;
  const local = user.email.split("@")[0] ?? user.email;
  const first = local.split(/[._-]/)[0] ?? local;
  if (first.length <= 3) return first.toUpperCase();
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

/** Formats an ISO timestamp as e.g. "May 15, 2025 10:24 AM". */
export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Formats an ISO timestamp as e.g. "May 15, 2025". */
export function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
