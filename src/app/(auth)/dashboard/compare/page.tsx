"use client";

import ClinicianCompare from "@/components/dashboard/ClinicianCompare";

export default function ComparePage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-text">Clinician Comparison</h2>
        <p className="text-text-secondary mt-1">
          Side-by-side performance across all rating questions
        </p>
      </div>

      <ClinicianCompare />
    </div>
  );
}
