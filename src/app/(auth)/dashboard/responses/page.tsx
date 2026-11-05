"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import ResponseList from "@/components/dashboard/ResponseList";
import SentHistory from "@/components/dashboard/SentHistory";
import ClinicianFilter from "@/components/dashboard/ClinicianFilter";
import Card from "@/components/ui/Card";
import RoleGate from "@/components/layout/RoleGate";
import { useViewAs } from "@/lib/view-context";

type Tab = "responses" | "sent";

export default function ResponsesPage() {
  const { data: session } = useSession();
  const { viewingAs } = useViewAs();
  const [clinicianId, setClinicianId] = useState(
    viewingAs === "clinician" ? session?.user?.clinicianId || "" : ""
  );
  const [tab, setTab] = useState<Tab>("responses");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-text">Survey Responses</h2>
        <p className="text-text-secondary mt-1">
          View individual survey responses and sent history
        </p>
      </div>

      <RoleGate allowedRoles={["clinician"]}>
        <div className="bg-primary-light border border-primary/20 rounded-lg px-4 py-3 text-sm text-primary">
          Responses are anonymous — no personally identifiable information is displayed.
        </div>
      </RoleGate>

      <div className="flex items-end gap-4 flex-wrap">
        <RoleGate allowedRoles={["partner", "office_manager"]}>
          <div className="w-48">
            <ClinicianFilter value={clinicianId} onChange={setClinicianId} />
          </div>
        </RoleGate>

        <div className="flex rounded-lg border border-border overflow-hidden">
          <button
            onClick={() => setTab("responses")}
            className={`px-4 py-2 text-sm font-medium transition-colors ${tab === "responses" ? "bg-primary text-white" : "bg-white text-text-secondary hover:bg-bg-alt"}`}
          >
            Responses
          </button>
          <RoleGate allowedRoles={["partner", "office_manager"]}>
            <button
              onClick={() => setTab("sent")}
              className={`px-4 py-2 text-sm font-medium transition-colors border-l border-border ${tab === "sent" ? "bg-primary text-white" : "bg-white text-text-secondary hover:bg-bg-alt"}`}
            >
              Sent History
            </button>
          </RoleGate>
        </div>
      </div>

      <Card>
        {tab === "responses" ? (
          <ResponseList clinicianId={clinicianId || undefined} />
        ) : (
          <SentHistory clinicianId={clinicianId || undefined} />
        )}
      </Card>
    </div>
  );
}
