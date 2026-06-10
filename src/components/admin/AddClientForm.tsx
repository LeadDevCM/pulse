"use client";

import { useState, useEffect } from "react";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Button from "@/components/ui/Button";

interface AddClientFormProps {
  onSuccess: () => void;
}

export default function AddClientForm({ onSuccess }: AddClientFormProps) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [clinicianId, setClinicianId] = useState("");
  const [clinicians, setClinicians] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/clinicians")
      .then((r) => r.json())
      .then((data) => setClinicians(data.clinicians || []))
      .catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !phone || !clinicianId) return;

    setLoading(true);
    setError("");

    const res = await fetch("/api/admin/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, phone, clinicianId }),
    });

    if (res.ok) {
      onSuccess();
    } else {
      setError("Failed to add client");
    }
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input label="Client Name" value={name} onChange={(e) => setName(e.target.value)} required />
      <Input label="Phone (E.164)" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+14355551234" required />
      <Select
        label="Clinician"
        value={clinicianId}
        onChange={(e) => setClinicianId(e.target.value)}
        options={[
          { value: "", label: "Select clinician..." },
          ...clinicians.map((c) => ({ value: c.id, label: c.name })),
        ]}
      />
      {error && <p className="text-sm text-error">{error}</p>}
      <Button type="submit" loading={loading} className="w-full">Add Client</Button>
    </form>
  );
}
