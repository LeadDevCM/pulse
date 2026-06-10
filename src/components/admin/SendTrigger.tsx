"use client";

import { useState, useEffect } from "react";
import Select from "@/components/ui/Select";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import { IconSend } from "@tabler/icons-react";

export default function SendTrigger() {
  const [clientId, setClientId] = useState("");
  const [clinicianId, setClinicianId] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [clients, setClients] = useState<{ id: string; name: string; clinicianId: string }[]>([]);
  const [templates, setTemplates] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const { addToast } = useToast();

  useEffect(() => {
    fetch("/api/admin/clients").then((r) => r.json()).then((d) => setClients(d.clients || [])).catch(() => {});
    fetch("/api/admin/templates").then((r) => r.json()).then((d) => setTemplates(d.templates || [])).catch(() => {});
  }, []);

  useEffect(() => {
    const client = clients.find((c) => c.id === clientId);
    if (client) setClinicianId(client.clinicianId);
  }, [clientId, clients]);

  const handleSend = async () => {
    if (!clientId || !clinicianId || !templateId) return;
    setLoading(true);
    const res = await fetch("/api/sms/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId, clinicianId, templateId }),
    });
    if (res.ok) {
      addToast("Survey SMS sent", "success");
      setClientId("");
    } else {
      addToast("Failed to send SMS", "error");
    }
    setLoading(false);
  };

  return (
    <Card>
      <div className="space-y-4">
        <Select
          label="Client"
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          options={[
            { value: "", label: "Select client..." },
            ...clients.map((c) => ({ value: c.id, label: c.name })),
          ]}
        />
        <Select
          label="Survey Template"
          value={templateId}
          onChange={(e) => setTemplateId(e.target.value)}
          options={[
            { value: "", label: "Select template..." },
            ...templates.map((t) => ({ value: t.id, label: t.name })),
          ]}
        />
        <Button onClick={handleSend} loading={loading} disabled={!clientId || !templateId}>
          <IconSend size={16} className="mr-2" /> Send Survey
        </Button>
      </div>
    </Card>
  );
}
