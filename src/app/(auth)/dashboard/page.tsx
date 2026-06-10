"use client";

import { useSession } from "next-auth/react";
import StatsOverview from "@/components/dashboard/StatsOverview";
import ResponseList from "@/components/dashboard/ResponseList";
import RoleGate from "@/components/layout/RoleGate";
import Card from "@/components/ui/Card";

export default function DashboardPage() {
  const { data: session } = useSession();
  const clinicianId = session?.user?.role === "clinician" ? session.user.clinicianId : undefined;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-text">Dashboard</h2>
        <p className="text-text-secondary mt-1">
          Welcome back, {session?.user?.name?.split(" ")[0] || "there"}
        </p>
      </div>

      <RoleGate allowedRoles={["owner", "office_manager"]}>
        <StatsOverview />
      </RoleGate>

      <RoleGate allowedRoles={["owner", "clinician"]}>
        <Card>
          <h3 className="text-lg font-semibold text-text mb-4">Recent Responses</h3>
          <ResponseList clinicianId={clinicianId} />
        </Card>
      </RoleGate>
    </div>
  );
}
