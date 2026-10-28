"use client";

import { useState, useEffect } from "react";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import { IconSend, IconLink, IconCheck, IconX } from "@tabler/icons-react";

export default function SendTrigger() {
  const [clientId, setClientId] = useState("");
  const [clientSearch, setClientSearch] = useState("");
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [clinicianId, setClinicianId] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [clients, setClients] = useState<{ id: string; name: string; clinicianId: string }[]>([]);
  const [clinicians, setClinicians] = useState<{ id: string; name: string }[]>([]);
  const [templates, setTemplates] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [linkLoading, setLinkLoading] = useState(false);
  const [sendResult, setSendResult] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const { addToast } = useToast();

  const filteredClients = clients.filter((c) =>
    c.name.toLowerCase().includes(clientSearch.toLowerCase())
  );

  useEffect(() => {
    fetch("/api/admin/clients").then((r) => r.json()).then((d) => setClients(d.clients || [])).catch(() => {});
    fetch("/api/admin/clinicians").then((r) => r.json()).then((d) => setClinicians(d.clinicians || [])).catch(() => {});
    fetch("/api/admin/templates").then((r) => r.json()).then((d) => setTemplates(d.templates || [])).catch(() => {});
  }, []);

  useEffect(() => {
    const client = clients.find((c) => c.id === clientId);
    if (client?.clinicianId) setClinicianId(client.clinicianId);
  }, [clientId, clients]);

  const resetForm = () => {
    setClientId("");
    setClientSearch("");
    setClinicianId("");
    setGeneratedLink(null);
    setLinkCopied(false);
  };

  const handleSendError = (data: Record<string, string>) => {
    const messages: Record<string, string> = {
      client_opted_out: "This client has opted out of surveys",
      rate_limited: "This client was already sent a survey in the last 24 hours",
      client_not_found: "Client not found",
      missing_fields: "Missing required fields",
    };
    const msg = data.error === "sms_failed"
      ? `SMS failed: ${data.detail || "unknown error"}`
      : (messages[data.error] || "Failed to send");
    setSendResult({ type: "error", message: msg });
    addToast(msg, "error");
  };

  const handleSend = async () => {
    if (!clientId || !templateId) return;
    if (!clinicianId) {
      setSendResult({ type: "error", message: "Please select a clinician" });
      return;
    }
    const selectedClient = clients.find((c) => c.id === clientId);
    if (!confirm(`Send survey to ${selectedClient?.name || "this client"}?`)) return;

    setSendResult(null);
    setGeneratedLink(null);
    setLoading(true);
    const res = await fetch("/api/sms/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId, clinicianId, templateId }),
    });
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      if (data.consentRequested) {
        const name = selectedClient?.name || "client";
        const msg = data.prompted
          ? `Consent request texted to ${name}. The survey will send automatically when they reply YES.`
          : `${name} was already asked to reply YES. The survey will send when they do.`;
        setSendResult({ type: "success", message: msg });
        addToast("Awaiting YES reply", "success");
      } else {
        setSendResult({ type: "success", message: `Survey sent to ${selectedClient?.name || "client"}` });
        addToast("Survey SMS sent", "success");
      }
      resetForm();
    } else {
      const data = await res.json().catch(() => ({}));
      handleSendError(data);
    }
    setLoading(false);
  };

  const handleCopyLink = async () => {
    if (!clientId || !templateId) return;
    if (!clinicianId) {
      setSendResult({ type: "error", message: "Please select a clinician" });
      return;
    }

    setSendResult(null);
    setGeneratedLink(null);
    setLinkLoading(true);
    const res = await fetch("/api/sms/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId, clinicianId, templateId, linkOnly: true }),
    });
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      setGeneratedLink(data.surveyUrl);
      await navigator.clipboard.writeText(data.surveyUrl);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 3000);
      const selectedClient = clients.find((c) => c.id === clientId);
      setSendResult({ type: "success", message: `Survey link created for ${selectedClient?.name || "client"} — copied to clipboard` });
      addToast("Link copied to clipboard", "success");
    } else {
      const data = await res.json().catch(() => ({}));
      handleSendError(data);
    }
    setLinkLoading(false);
  };

  return (
    <Card>
      <div className="space-y-4">
        {sendResult && (
          <div className={`flex items-center justify-between px-4 py-3 rounded-lg text-sm font-medium ${
            sendResult.type === "success"
              ? "bg-green-50 border border-green-200 text-green-800"
              : "bg-red-50 border border-red-200 text-red-800"
          }`}>
            <span>{sendResult.message}</span>
            <button onClick={() => setSendResult(null)} className="ml-2 opacity-60 hover:opacity-100">
              <IconX size={16} />
            </button>
          </div>
        )}
        <div className="relative">
          <Input
            label="Client"
            value={clientSearch}
            onChange={(e) => {
              setClientSearch(e.target.value);
              setClientId("");
              setClinicianId("");
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
          label="Clinician"
          value={clinicianId}
          onChange={(e) => setClinicianId(e.target.value)}
          options={[
            { value: "", label: "Select clinician..." },
            ...clinicians.map((c) => ({ value: c.id, label: c.name })),
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
        <div className="flex gap-2">
          <Button onClick={handleSend} loading={loading} disabled={!clientId || !templateId}>
            <IconSend size={16} className="mr-2" /> Send SMS
          </Button>
          <Button onClick={handleCopyLink} loading={linkLoading} disabled={!clientId || !templateId} variant="secondary">
            {linkCopied ? <IconCheck size={16} className="mr-2" /> : <IconLink size={16} className="mr-2" />}
            {linkCopied ? "Copied!" : "Copy Link"}
          </Button>
        </div>
        {generatedLink && (
          <div className="flex items-center gap-2 px-3 py-2 bg-bg-alt border border-border rounded-lg">
            <input
              type="text"
              readOnly
              value={generatedLink}
              className="flex-1 bg-transparent text-sm text-text truncate outline-none"
              onFocus={(e) => e.target.select()}
            />
            <button
              onClick={() => {
                navigator.clipboard.writeText(generatedLink);
                setLinkCopied(true);
                setTimeout(() => setLinkCopied(false), 3000);
                addToast("Copied!", "success");
              }}
              className="shrink-0 px-2 py-1 text-xs font-medium text-primary hover:text-primary-dark transition-colors"
            >
              {linkCopied ? "Copied!" : "Copy"}
            </button>
          </div>
        )}
      </div>
    </Card>
  );
}
