"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function ImplementationPlanRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const regulationId = searchParams.get("regulation_id");

  useEffect(() => {
    if (regulationId) {
      router.replace(`/cases/${regulationId}/implementation`);
    } else {
      router.replace("/regulations");
    }
  }, [regulationId, router]);

  return (
    <div className="flex h-screen items-center justify-center bg-[#020613] text-slate-400">
      <div className="text-center">
        <p className="text-sm font-semibold uppercase tracking-wider">Redirecting to Case Workspace...</p>
      </div>
    </div>
  );
}
