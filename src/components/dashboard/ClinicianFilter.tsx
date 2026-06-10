"use client";

import { useEffect, useState } from "react";
import Select from "@/components/ui/Select";

interface ClinicianFilterProps {
  value?: string;
  onChange: (clinicianId: string) => void;
  showAll?: boolean;
}

export default function ClinicianFilter({ value, onChange, showAll = true }: ClinicianFilterProps) {
  const [clinicians, setClinicians] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    fetch("/api/admin/clinicians")
      .then((r) => r.json())
      .then((data) => setClinicians(data.clinicians || []))
      .catch(() => {});
  }, []);

  const options = [
    ...(showAll ? [{ value: "", label: "All Clinicians" }] : []),
    ...clinicians.map((c) => ({ value: c.id, label: c.name })),
  ];

  return <Select label="Clinician" options={options} value={value || ""} onChange={(e) => onChange(e.target.value)} />;
}
