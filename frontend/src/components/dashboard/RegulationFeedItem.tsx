import React from "react";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import RiskBadge from "@/components/dashboard/RiskBadge";
import StatusBadge from "@/components/ui/StatusBadge";
import { formatDate } from "@/lib/format";
import type { RegulationResponse } from "@/types/api";

interface RegulationFeedItemProps {
  regulation: RegulationResponse;
}

function sourceHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

/** Single row in the regulatory intelligence feed. */
export default function RegulationFeedItem({ regulation }: RegulationFeedItemProps) {
  return (
    <Link
      href={`/regulations/${regulation.id}`}
      className="flex items-start justify-between gap-4 px-4 py-4 hover:bg-slate-50/80 transition-colors"
    >
      <div className="min-w-0 space-y-1">
        <p className="text-sm font-semibold text-slate-800">{regulation.title}</p>
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
          <span
            className="text-blue-600 hover:underline inline-flex items-center gap-1"
            role="link"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              window.open(regulation.source_url, "_blank", "noopener");
            }}
          >
            {sourceHostname(regulation.source_url)}
            <ExternalLink className="h-3 w-3" />
          </span>
          <span>•</span>
          <span>Published {formatDate(regulation.published_date)}</span>
          {regulation.category && (
            <>
              <span>•</span>
              <span className="capitalize">{regulation.category}</span>
            </>
          )}
        </div>
      </div>
      <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
        {regulation.urgency ? (
          <RiskBadge level={regulation.urgency} />
        ) : (
          <StatusBadge label="Pending Analysis" tone="slate" />
        )}
        {regulation.relevant === true && <StatusBadge label="Relevant" tone="blue" />}
      </div>
    </Link>
  );
}
