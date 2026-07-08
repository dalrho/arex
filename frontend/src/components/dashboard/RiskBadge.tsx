import React from "react";
import StatusBadge, { toneForStatus } from "@/components/ui/StatusBadge";

interface RiskBadgeProps {
  /** Urgency or impact level, e.g. "low" | "medium" | "high" | "critical". */
  level: string;
  className?: string;
}

/** Color-coded severity badge for regulation urgency and impact levels. */
export default function RiskBadge({ level, className }: RiskBadgeProps) {
  const label = level.charAt(0).toUpperCase() + level.slice(1).toLowerCase();
  return <StatusBadge label={label} tone={toneForStatus(level)} className={className} />;
}
