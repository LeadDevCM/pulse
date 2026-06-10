"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import ResponseList from "@/components/dashboard/ResponseList";
import ClinicianFilter from "@/components/dashboard/ClinicianFilter";
import Card from "@/components/ui/Card";
import RoleGate from "@/components/layout/RoleGate";
import { useViewAs } from "@/lib/view-context";

export default function ResponsesPage() {
  const { data: session } = useSession();
  const { viewingAs } = useViewAs();
  const [clinicianId, setClinicianId] = useState(
    viewingAs === "clinician" ? session?.user?.clinicianId || "" : ""
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-text">Survey Responses</h2>
        <p className="text-text-secondary mt-1">
          View individual survey responses
        </p>
      </div>

      <div className="bg-primary-light border border-primary/20 rounded-lg px-4 py-3 text-sm text-primary">
        Responses are anonymous — no personally identifiable information is displayed.
      </div>

      <RoleGate allowedRoles={["owner"]}>
        <div className="max-w-xs">
          <ClinicianFilter value={clinicianId} onChange={setClinicianId} />
        </div>
      </RoleGate>

      <Card>
        <ResponseList clinicianId={clinicianId || undefined} />
      </Card>
    </div>
  );
}
