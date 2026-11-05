"use client";

import { useState, useEffect, useCallback } from "react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Card from "@/components/ui/Card";
import Table from "@/components/ui/Table";
import Badge from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { IconPlus, IconCalendarEvent, IconTrash, IconRefresh } from "@tabler/icons-react";

interface BatchEntryDraft {
  clientId: string;
  clientName: string;
  clinicianId: string;
  appointmentTime: string;
  sendAfterMinutes: number;
}

interface BatchStatus {
  id: string;
  date: string;
  templateId?: string;
  templateName?: string;
  createdAt: string;
  total: number;
  sent: number;
  failed: number;
  pending: number;
  complete: boolean;
}

export default function BatchScheduler() {
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [templateId, setTemplateId] = useState("");
  const [entries, setEntries] = useState<BatchEntryDraft[]>([]);
  const [clients, setClients] = useState<{ id: string; name: string; clinicianId: string; smsApproved?: boolean }[]>([]);
  const [templates, setTemplates] = useState<{ id: string; name: string }[]>([]);
  const [selectedClient, setSelectedClient] = useState("");
  const [clientSearch, setClientSearch] = useState("");
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [appointmentTime, setAppointmentTime] = useState("");
  const [delay, setDelay] = useState("30");
  const [loading, setLoading] = useState(false);
  const [batchQueue, setBatchQueue] = useState<BatchStatus[]>([]);
  const { addToast } = useToast();

  const filteredClients = clients.filter((c) =>
    c.smsApproved && c.name.toLowerCase().includes(clientSearch.toLowerCase())
  );

  const loadBatches = useCallback(async () => {
    try {
      const res = await fetch("/api/sms/batch");
      if (res.ok) {
        const data = await res.json();
        setBatchQueue(data.batches || []);
      }
    } catch { /* best-effort */ }
  }, []);

  useEffect(() => {
    fetch("/api/admin/clients").then((r) => r.json()).then((d) => setClients(d.clients || [])).catch(() => {});
    fetch("/api/admin/templates").then((r) => r.json()).then((d) => {
      const t = d.templates || [];
      setTemplates(t);
      if (t.length > 0 && !templateId) setTemplateId(t[0].id);
    }).catch(() => {});
    loadBatches();
  }, []);

  // Poll incomplete batches
  useEffect(() => {
    const hasIncomplete = batchQueue.some((b) => !b.complete);
    if (!hasIncomplete) return;
    const interval = setInterval(loadBatches, 5000);
    return () => clearInterval(interval);
  }, [batchQueue, loadBatches]);

  const addEntry = () => {
    const client = clients.find((c) => c.id === selectedClient);
    if (!client || !appointmentTime) return;
    setEntries([...entries, {
      clientId: client.id,
      clientName: client.name,
      clinicianId: client.clinicianId,
      appointmentTime,
      sendAfterMinutes: Number(delay),
    }]);
    setSelectedClient("");
    setClientSearch("");
    setAppointmentTime("");
  };

  const removeEntry = (index: number) => {
    setEntries(entries.filter((_, i) => i !== index));
  };

  const submitBatch = async () => {
    if (entries.length === 0 || !templateId) return;
    setLoading(true);
    const res = await fetch("/api/sms/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date,
        templateId,
        entries: entries.map((e) => ({
          clientId: e.clientId,
          clinicianId: e.clinicianId,
          appointmentTime: e.appointmentTime,
          sendAfterMinutes: e.sendAfterMinutes,
        })),
      }),
    });
    if (res.ok) {
      const selectedTemplate = templates.find((t) => t.id === templateId);
      addToast(`Batch scheduled: ${entries.length} ${selectedTemplate?.name || ""} surveys`, "success");
      setEntries([]);
      loadBatches();
    } else {
      addToast("Failed to schedule batch", "error");
    }
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      {/* Batch queue */}
      {batchQueue.length > 0 && (
        <Card>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-semibold text-text">Scheduled Batches</h3>
              <button onClick={loadBatches} className="p-1 text-text-secondary hover:text-text transition-colors" title="Refresh">
                <IconRefresh size={16} />
              </button>
            </div>
            <div className="space-y-2">
              {batchQueue.map((b) => (
                <div key={b.id} className="flex items-center gap-3 px-3 py-2 bg-bg-alt/50 rounded-lg text-sm">
                  <span className="font-medium text-text min-w-[90px]">{b.date}</span>
                  {b.templateName && <Badge variant="default">{b.templateName}</Badge>}
                  <div className="flex items-center gap-2 ml-auto">
                    <Badge variant="success">{b.sent} sent</Badge>
                    {b.failed > 0 && <Badge variant="error">{b.failed} failed</Badge>}
                    {b.pending > 0 && <Badge variant="warning">{b.pending} pending</Badge>}
                    {!b.complete && <span className="text-xs text-primary animate-pulse">Processing...</span>}
                    {b.complete && <span className="text-xs text-green-600">Complete</span>}
                  </div>
                  <div className="w-24">
                    <div className="w-full bg-bg-alt rounded-full h-1.5">
                      <div
                        className="bg-primary rounded-full h-1.5 transition-all duration-500"
                        style={{ width: `${b.total > 0 ? ((b.sent + b.failed) / b.total) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      <Card>
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            <Select
              label="Survey Template"
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              options={templates.map((t) => ({ value: t.id, label: t.name }))}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="relative">
              <Input
                label="Client"
                value={clientSearch}
                onChange={(e) => {
                  setClientSearch(e.target.value);
                  setSelectedClient("");
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
                        setSelectedClient(c.id);
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
            <Input label="Appt Time" type="time" value={appointmentTime} onChange={(e) => setAppointmentTime(e.target.value)} />
            <Input label="Delay (min)" type="number" value={delay} onChange={(e) => setDelay(e.target.value)} />
          </div>
          <Button variant="secondary" onClick={addEntry} size="sm" disabled={!selectedClient || !appointmentTime}>
            <IconPlus size={16} className="mr-1" /> Add to Batch
          </Button>
        </div>
      </Card>

      {entries.length > 0 && (
        <>
          <Table headers={["Client", "Appt Time", "Send After", ""]}>
            {entries.map((e, i) => (
              <tr key={i} className="hover:bg-bg-alt">
                <td className="px-4 py-3 text-sm">{e.clientName}</td>
                <td className="px-4 py-3 text-sm">{e.appointmentTime}</td>
                <td className="px-4 py-3 text-sm">{e.sendAfterMinutes} min</td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => removeEntry(i)} className="text-text-secondary hover:text-error">
                    <IconTrash size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </Table>
          <Button onClick={submitBatch} loading={loading} disabled={!templateId}>
            <IconCalendarEvent size={16} className="mr-2" /> Schedule {entries.length} Surveys
          </Button>
        </>
      )}
    </div>
  );
}
