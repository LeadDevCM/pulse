"use client";

import { useState, useEffect } from "react";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import { IconSend } from "@tabler/icons-react";

export default function SendTrigger() {
  const [clientId, setClientId] = useState("");
  const [clientSearch, setClientSearch] = useState("");
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [clinicianId, setClinicianId] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [clients, setClients] = useState<{ id: string; name: string; clinicianId: string }[]>([]);
  const [templates, setTemplates] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const { addToast } = useToast();

  const filteredClients = clients.filter((c) =>
    c.name.toLowerCase().includes(clientSearch.toLowerCase())
  );

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
      setClientSearch("");
    } else {
      addToast("Failed to send SMS", "error");
    }
    setLoading(false);
  };

  return (
    <Card>
      <div className="space-y-4">
        <div className="relative">
          <Input
            label="Client"
            value={clientSearch}
            onChange={(e) => {
              setClientSearch(e.target.value);
              setClientId("");
              setShowClientDropdown(true);
            }}
            onFocus={() => setShowClientDropdown(true)}
            placeholder="Type to search..."
          />
          {showClientDropdown && clientSearch && filteredClients.length > 0 && (
            <div className="absolute z-10 left-0 right-0 top-full mt-1 bg-bg border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
              {filteredClients.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    setClientId(c.id);
                    setClientSearch(c.name);
                    setShowClientDropdown(false);
                  }}
                  className="w-full text-left px-3 py-2 text-sm text-text hover:bg-bg-alt transition-colors"
                >
                  {c.name}
                </button>
              ))}
            </div>
          )}
          {showClientDropdown && clientSearch && filteredClients.length === 0 && (
            <div className="absolute z-10 left-0 right-0 top-full mt-1 bg-bg border border-border rounded-lg shadow-lg px-3 py-2 text-sm text-text-secondary">
              No clients found
            </div>
          )}
        </div>
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
