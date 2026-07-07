import React from "react";
import StatusBadge from "@/components/ui/StatusBadge";

interface DocumentVersionTagProps {
  version: number;
  className?: string;
}

/** Revision-control version tag, e.g. "v3". */
export default function DocumentVersionTag({ version, className }: DocumentVersionTagProps) {
  return <StatusBadge label={`v${version}`} tone="blue" className={className} />;
}
