"use client";

import { useState } from "react";
import TrendChart from "@/components/dashboard/TrendChart";
import ClinicianFilter from "@/components/dashboard/ClinicianFilter";
import Card from "@/components/ui/Card";
import Select from "@/components/ui/Select";
import RoleGate from "@/components/layout/RoleGate";
import { useViewAs } from "@/lib/view-context";

export default function TrendsPage() {
  const { viewingAs } = useViewAs();
  const [clinicianId, setClinicianId] = useState(
    viewingAs === "clinician" ? "" : ""
  );
  const [days, setDays] = useState("30");
  const [groupBy, setGroupBy] = useState("day");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-text">Trends</h2>
        <p className="text-text-secondary mt-1">Average ratings over time</p>
      </div>

      <div className="flex flex-wrap gap-4 items-end">
        <RoleGate allowedRoles={["owner"]}>
          <div className="w-48">
            <ClinicianFilter value={clinicianId} onChange={setClinicianId} />
          </div>
        </RoleGate>
        <div className="w-36">
          <Select
            label="Period"
            value={days}
            onChange={(e) => setDays(e.target.value)}
            options={[
              { value: "7", label: "Last 7 days" },
              { value: "30", label: "Last 30 days" },
              { value: "90", label: "Last 90 days" },
            ]}
          />
        </div>
        <div className="w-36">
          <Select
            label="Group by"
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value)}
            options={[
              { value: "day", label: "Daily" },
              { value: "week", label: "Weekly" },
              { value: "month", label: "Monthly" },
            ]}
          />
        </div>
      </div>

      <Card>
        <TrendChart
          clinicianId={clinicianId || undefined}
          days={Number(days)}
          groupBy={groupBy as "day" | "week" | "month"}
        />
      </Card>
    </div>
  );
}
