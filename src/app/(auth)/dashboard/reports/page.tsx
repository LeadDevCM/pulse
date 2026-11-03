"use client";

import ClinicianReport from "@/components/dashboard/ClinicianReport";

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-text">Clinician Reports</h2>
        <p className="text-text-secondary mt-1">
          Per-clinician survey performance and retention summary
        </p>
      </div>

      <ClinicianReport />
    </div>
  );
}
