"use client";

import { useState, useEffect } from "react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Card from "@/components/ui/Card";
import Table from "@/components/ui/Table";
import { useToast } from "@/components/ui/Toast";
import { IconPlus, IconCalendarEvent, IconTrash } from "@tabler/icons-react";

interface BatchEntryDraft {
  clientId: string;
  clientName: string;
  clinicianId: string;
  appointmentTime: string;
  sendAfterMinutes: number;
}

export default function BatchScheduler() {
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [entries, setEntries] = useState<BatchEntryDraft[]>([]);
  const [clients, setClients] = useState<{ id: string; name: string; clinicianId: string }[]>([]);
  const [selectedClient, setSelectedClient] = useState("");
  const [clientSearch, setClientSearch] = useState("");
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [appointmentTime, setAppointmentTime] = useState("");
  const [delay, setDelay] = useState("30");
  const [loading, setLoading] = useState(false);
  const { addToast } = useToast();

  const filteredClients = clients.filter((c) =>
    c.name.toLowerCase().includes(clientSearch.toLowerCase())
  );

  useEffect(() => {
    fetch("/api/admin/clients").then((r) => r.json()).then((d) => setClients(d.clients || [])).catch(() => {});
  }, []);

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
    if (entries.length === 0) return;
    setLoading(true);
    const res = await fetch("/api/sms/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date,
        entries: entries.map((e) => ({
          clientId: e.clientId,
          clinicianId: e.clinicianId,
          appointmentTime: e.appointmentTime,
          sendAfterMinutes: e.sendAfterMinutes,
        })),
      }),
    });
    if (res.ok) {
      addToast(`Batch scheduled: ${entries.length} surveys`, "success");
      setEntries([]);
    } else {
      addToast("Failed to schedule batch", "error");
    }
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <Card>
        <div className="space-y-4">
          <Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
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
          <Button variant="secondary" onClick={addEntry} size="sm">
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
          <Button onClick={submitBatch} loading={loading}>
            <IconCalendarEvent size={16} className="mr-2" /> Schedule {entries.length} Surveys
          </Button>
        </>
      )}
    </div>
  );
}
