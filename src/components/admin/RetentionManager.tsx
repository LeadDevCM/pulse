"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Select from "@/components/ui/Select";
import Input from "@/components/ui/Input";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import AddClientForm from "./AddClientForm";
import {
  IconSearch,
  IconCheck,
  IconLoader2,
  IconChevronDown,
  IconChevronUp,
  IconPlus,
  IconUpload,
  IconTrash,
  IconTrashX,
  IconArrowUp,
  IconArrowDown,
  IconArrowsSort,
} from "@tabler/icons-react";
import { useToast } from "@/components/ui/Toast";

interface ClientItem {
  id: string;
  firstName: string;
  lastName: string;
  name: string;
  email?: string;
  phone: string;
  clinicianId: string;
  optedInAt: string;
  optedOut?: boolean;
  smsConsent?: "pending" | "confirmed";
  smsApproved?: boolean;
  status?: string;
  frequency?: string;
  startDate?: string;
  lastApptDate?: string;
  terminationReason?: string;
  notes?: string;
  lastSurveySentAt?: string | null;
}

interface ClinicianItem {
  id: string;
  name: string;
}

interface CsvParsedClient {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  clinicianName: string;
  status: string;
  frequency: string;
  startDate: string;
}

type SavingState = "idle" | "saving" | "saved";
type ImportStep = "upload" | "preview" | "importing" | "results";
type SortKey = "name" | "smsApproved" | "clinician" | "status" | "frequency" | "startDate" | "lastApptDate" | "lastSurveySentAt" | "terminationReason";
type SortDir = "asc" | "desc";

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "terminated", label: "Terminated" },
];

const FREQUENCY_OPTIONS = [
  { value: "", label: "—" },
  { value: "weekly", label: "Weekly" },
  { value: "every_other_week", label: "Every Other Week" },
  { value: "monthly", label: "Monthly" },
  { value: "as_needed", label: "As Needed" },
  { value: "never_seen", label: "Never Seen" },
];

const TERMINATION_OPTIONS = [
  { value: "", label: "—" },
  { value: "Client achieved goals", label: "Achieved goals" },
  { value: "Client-no communication", label: "No communication" },
  { value: "Client requested", label: "Client requested" },
  { value: "Referred out", label: "Referred out" },
  { value: "Insurance/financial", label: "Insurance/financial" },
  { value: "Clinician recommendation", label: "Clinician rec." },
  { value: "Other", label: "Other" },
];

const cellSelect =
  "w-full px-2 py-1.5 text-sm border border-transparent rounded bg-transparent text-text hover:border-border focus:border-primary focus:ring-1 focus:ring-primary/30 focus:outline-none transition-colors cursor-pointer appearance-none";
const cellInput =
  "w-full px-2 py-1.5 text-sm border border-transparent rounded bg-transparent text-text hover:border-border focus:border-primary focus:ring-1 focus:ring-primary/30 focus:outline-none transition-colors";

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') { current += '"'; i++; }
        else inQuotes = false;
      } else current += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ",") { fields.push(current.trim()); current = ""; }
      else current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

function extractEmail(raw: string): string {
  if (!raw) return "";
  const match = raw.match(/[\w.+-]+@[\w.-]+\.\w+/);
  return match ? match[0] : "";
}

export default function RetentionManager() {
  const [clients, setClients] = useState<ClientItem[]>([]);
  const [clinicians, setClinicians] = useState<ClinicianItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [clinicianFilter, setClinicianFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [savingRows, setSavingRows] = useState<Record<string, SavingState>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [purging, setPurging] = useState(false);
  const { addToast } = useToast();

  // Import state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importStep, setImportStep] = useState<ImportStep>("upload");
  const [parsedClients, setParsedClients] = useState<CsvParsedClient[]>([]);
  const [skippedClients, setSkippedClients] = useState<{ name: string; reason: string }[]>([]);
  const [importResults, setImportResults] = useState<{ imported: number; skipped: number; errors: string[] } | null>(null);

  const loadClients = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch("/api/admin/clients").then((r) => r.json()),
      fetch("/api/admin/clinicians").then((r) => r.json()),
    ])
      .then(([clientData, clinicianData]) => {
        setClients(clientData.clients || []);
        setClinicians(clinicianData.clinicians || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => { loadClients(); }, [loadClients]);

  const clinicianMap = Object.fromEntries(clinicians.map((c) => [c.id, c.name]));

  const filtered = clients.filter((c) => {
    if (clinicianFilter && c.clinicianId !== clinicianFilter) return false;
    if (statusFilter) {
      const s = c.status || "active";
      if (s !== statusFilter) return false;
    }
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return c.name.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q) || c.phone?.includes(q);
  });

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <IconArrowsSort size={13} className="inline ml-0.5 opacity-0 group-hover/th:opacity-40" />;
    return sortDir === "asc"
      ? <IconArrowUp size={13} className="inline ml-0.5 text-primary" />
      : <IconArrowDown size={13} className="inline ml-0.5 text-primary" />;
  };

  const sorted = [...filtered].sort((a, b) => {
    const dir = sortDir === "asc" ? 1 : -1;
    switch (sortKey) {
      case "name": return dir * a.lastName.localeCompare(b.lastName) || dir * a.firstName.localeCompare(b.firstName);
      case "smsApproved": return dir * (Number(a.smsApproved ?? 0) - Number(b.smsApproved ?? 0));
      case "clinician": return dir * (clinicianMap[a.clinicianId] || "").localeCompare(clinicianMap[b.clinicianId] || "");
      case "status": return dir * (a.status || "active").localeCompare(b.status || "active");
      case "frequency": return dir * (a.frequency || "").localeCompare(b.frequency || "");
      case "startDate": return dir * (a.startDate || "").localeCompare(b.startDate || "");
      case "lastApptDate": return dir * (a.lastApptDate || "").localeCompare(b.lastApptDate || "");
      case "lastSurveySentAt": return dir * (a.lastSurveySentAt || "").localeCompare(b.lastSurveySentAt || "");
      case "terminationReason": return dir * (a.terminationReason || "").localeCompare(b.terminationReason || "");
      default: return 0;
    }
  });

  const counts = filtered.reduce(
    (acc, c) => {
      const s = c.status || "active";
      if (s === "active") acc.active++;
      else if (s === "inactive") acc.inactive++;
      else if (s === "terminated") acc.terminated++;
      return acc;
    },
    { active: 0, inactive: 0, terminated: 0 }
  );
  const total = counts.active + counts.inactive + counts.terminated;
  const retentionDenom = counts.active + counts.terminated;
  const retentionRate = retentionDenom > 0 ? Math.round((counts.active / retentionDenom) * 100) : 0;

  const saveField = useCallback(
    async (clientId: string, updates: Record<string, string | undefined>) => {
      setSavingRows((prev) => ({ ...prev, [clientId]: "saving" }));
      try {
        const res = await fetch(`/api/admin/clients/${clientId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        });
        if (res.ok) {
          const data = await res.json();
          setClients((prev) => prev.map((c) => (c.id === clientId ? { ...c, ...data.client } : c)));
          setSavingRows((prev) => ({ ...prev, [clientId]: "saved" }));
          setTimeout(() => setSavingRows((prev) => ({ ...prev, [clientId]: "idle" })), 1500);
        } else {
          addToast("Failed to save", "error");
          setSavingRows((prev) => ({ ...prev, [clientId]: "idle" }));
        }
      } catch {
        addToast("Network error", "error");
        setSavingRows((prev) => ({ ...prev, [clientId]: "idle" }));
      }
    },
    [addToast]
  );

  const updateLocal = (id: string, field: string, value: string) => {
    setClients((prev) => prev.map((c) => (c.id === id ? { ...c, [field]: value } : c)));
  };

  const handleSelectChange = (clientId: string, field: string, value: string) => {
    updateLocal(clientId, field, value);
    const updates: Record<string, string | undefined> = { [field]: value || undefined };
    if (field === "status" && value !== "terminated") {
      updateLocal(clientId, "terminationReason", "");
      updates.terminationReason = undefined;
    }
    saveField(clientId, updates);
  };

  const handleBlurSave = (clientId: string, field: string, value: string) => {
    saveField(clientId, { [field]: value || undefined });
  };

  const removeClient = async (id: string) => {
    if (!confirm("Remove this client?")) return;
    const res = await fetch(`/api/admin/clients/${id}`, { method: "DELETE" });
    if (res.ok) {
      addToast("Client removed", "success");
      setClients((prev) => prev.filter((c) => c.id !== id));
      if (expandedId === id) setExpandedId(null);
    } else addToast("Failed to remove client", "error");
  };

  const purgeAllClients = async () => {
    if (!confirm("This will permanently remove ALL clients. Continue?")) return;
    if (!confirm("Are you sure? This cannot be undone.")) return;
    setPurging(true);
    try {
      const res = await fetch("/api/admin/clients/purge", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        addToast(`${data.purged} client(s) purged`, "success");
        loadClients();
      } else addToast("Failed to purge clients", "error");
    } catch { addToast("Network error", "error"); }
    setPurging(false);
  };

  // CSV import
  const resetImport = () => {
    setImportStep("upload");
    setParsedClients([]);
    setSkippedClients([]);
    setImportResults(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      if (!text) return;
      const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
      if (lines.length < 2) { addToast("CSV file appears empty", "error"); return; }

      const headerFields = parseCsvLine(lines[0]);
      const headers = headerFields.map((h) => h.toLowerCase().replace(/[^a-z]/g, ""));

      const firstNameIdx = headers.findIndex((h) => h === "firstname");
      const lastNameIdx = headers.findIndex((h) => h === "lastname");
      const nameIdx = headers.findIndex((h) => h === "name" || h === "clientname" || h === "fullname");
      const emailIdx = headers.findIndex((h) => h === "email" || h === "emailaddress");
      const phoneIdx = headers.findIndex((h) => h === "phonenumber" || h === "phone" || h === "mobile" || h === "cell");
      const clinicianIdx = headers.findIndex((h) => h === "clinician" || h === "therapist" || h === "provider" || h === "counselor");
      const statusIdx = headers.findIndex((h) => h === "status");
      const frequencyIdx = headers.findIndex((h) => h === "frequency" || h === "schedule");
      const startDateIdx = headers.findIndex((h) => h === "startdate" || h === "start");

      const hasSplitName = firstNameIdx !== -1 && lastNameIdx !== -1;
      if (!hasSplitName && nameIdx === -1) {
        addToast("CSV needs 'First Name' + 'Last Name' columns, or a single 'Name' column", "error");
        return;
      }

      const valid: CsvParsedClient[] = [];
      const skipped: { name: string; reason: string }[] = [];

      for (let i = 1; i < lines.length; i++) {
        const fields = parseCsvLine(lines[i]);
        let firstName = "", lastName = "";
        if (hasSplitName) {
          firstName = fields[firstNameIdx]?.trim() || "";
          lastName = fields[lastNameIdx]?.trim() || "";
        } else {
          const parts = (fields[nameIdx]?.trim() || "").split(/\s+/);
          firstName = parts[0] || "";
          lastName = parts.slice(1).join(" ") || "";
        }
        if (!firstName && !lastName) continue;
        if (!firstName || !lastName) {
          skipped.push({ name: `${firstName} ${lastName}`.trim(), reason: "Missing first or last name" });
          continue;
        }

        valid.push({
          firstName,
          lastName,
          email: emailIdx >= 0 ? extractEmail(fields[emailIdx] || "") : "",
          phone: phoneIdx >= 0 ? (fields[phoneIdx]?.trim() || "") : "",
          clinicianName: clinicianIdx >= 0 ? (fields[clinicianIdx]?.trim() || "") : "",
          status: statusIdx >= 0 ? (fields[statusIdx]?.trim().toLowerCase() || "") : "",
          frequency: frequencyIdx >= 0 ? (fields[frequencyIdx]?.trim().toLowerCase().replace(/\s+/g, "_") || "") : "",
          startDate: startDateIdx >= 0 ? (fields[startDateIdx]?.trim() || "") : "",
        });
      }
      setParsedClients(valid);
      setSkippedClients(skipped);
      setImportStep("preview");
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    setImportStep("importing");
    try {
      const res = await fetch("/api/admin/clients/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clients: parsedClients }),
      });
      if (res.ok) {
        const data = await res.json();
        setImportResults({ imported: data.imported ?? 0, skipped: data.skipped ?? 0, errors: data.errors ?? [] });
        setImportStep("results");
        loadClients();
      } else {
        addToast("Import failed", "error");
        setImportStep("preview");
      }
    } catch {
      addToast("Network error", "error");
      setImportStep("preview");
    }
  };

  if (loading) return <div className="text-center py-12 text-text-secondary">Loading...</div>;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-48">
          <Select
            label="Clinician"
            value={clinicianFilter}
            onChange={(e) => setClinicianFilter(e.target.value)}
            options={[{ value: "", label: "All Clinicians" }, ...clinicians.filter((c) => c.name).map((c) => ({ value: c.id, label: c.name }))]}
          />
        </div>
        <div className="w-36">
          <Select
            label="Status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            options={[{ value: "", label: "All Statuses" }, ...STATUS_OPTIONS]}
          />
        </div>
        <div className="relative flex-1 min-w-[180px]">
          <label className="block text-sm font-medium text-text mb-1">Search</label>
          <div className="relative">
            <IconSearch size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Find a client..."
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-border bg-white text-text placeholder:text-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors text-sm"
            />
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={purgeAllClients} size="sm" variant="danger" loading={purging} disabled={clients.length === 0}>
            <IconTrashX size={16} className="mr-1" /> Purge
          </Button>
          <Button onClick={() => { resetImport(); setShowImport(true); }} size="sm" variant="secondary">
            <IconUpload size={16} className="mr-1" /> Import
          </Button>
          <Button onClick={() => setShowAdd(true)} size="sm">
            <IconPlus size={16} className="mr-1" /> Add Client
          </Button>
        </div>
      </div>

      {/* Summary bar */}
      <div className="flex flex-wrap items-center gap-4 bg-white border border-border rounded-lg px-4 py-3">
        <span className="text-sm text-text"><span className="font-semibold">{total}</span> clients</span>
        <Badge variant="success">{counts.active} Active</Badge>
        <Badge variant="warning">{counts.inactive} Inactive</Badge>
        <Badge variant="error">{counts.terminated} Terminated</Badge>
        <span className="ml-auto text-sm font-semibold text-text">
          Retention:{" "}
          <span className={retentionRate >= 80 ? "text-green-600" : retentionRate >= 60 ? "text-amber-600" : "text-red-600"}>
            {retentionRate}%
          </span>
        </span>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="text-center py-8 text-text-secondary">
          {clients.length === 0 ? "No clients yet. Add one or import a CSV." : "No clients match your filters."}
        </div>
      ) : (
        <div className="bg-white border border-border rounded-xl shadow-sm overflow-x-auto">
          <table className="w-full text-sm table-fixed">
            <colgroup>
              <col className="w-9" />
              <col style={{ width: "180px" }} />
              <col className="w-12" />
              {!clinicianFilter && <col style={{ width: "160px" }} />}
              <col style={{ width: "110px" }} />
              <col style={{ width: "110px" }} />
              <col className="w-9" />
            </colgroup>
            <thead>
              <tr className="border-b border-border bg-bg-alt">
                <th className="px-2 py-2.5" />
                <th className="text-left px-3 py-2.5 font-medium text-text-secondary whitespace-nowrap cursor-pointer select-none group/th" onClick={() => toggleSort("name")}>Client<SortIcon col="name" /></th>
                <th className="text-center px-1 py-2.5 font-medium text-text-secondary whitespace-nowrap cursor-pointer select-none group/th" title="Approved for SMS" onClick={() => toggleSort("smsApproved")}>SMS<SortIcon col="smsApproved" /></th>
                {!clinicianFilter && <th className="text-left px-2 py-2.5 font-medium text-text-secondary whitespace-nowrap cursor-pointer select-none group/th" onClick={() => toggleSort("clinician")}>Clinician<SortIcon col="clinician" /></th>}
                <th className="text-left px-2 py-2.5 font-medium text-text-secondary whitespace-nowrap cursor-pointer select-none group/th" onClick={() => toggleSort("status")}>Status<SortIcon col="status" /></th>
                <th className="text-left px-2 py-2.5 font-medium text-text-secondary whitespace-nowrap cursor-pointer select-none group/th" onClick={() => toggleSort("lastSurveySentAt")}>Last Survey<SortIcon col="lastSurveySentAt" /></th>
                <th className="px-2 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sorted.map((c) => {
                const status = c.status || "active";
                const saving = savingRows[c.id] || "idle";
                const isExpanded = expandedId === c.id;
                const colCount = clinicianFilter ? 6 : 7;
                return (
                  <>
                    <tr key={c.id} className="group hover:bg-bg-alt/50 transition-colors">
                      <td className="px-2 py-2">
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : c.id)}
                          className="p-0.5 text-text-secondary hover:text-text transition-colors"
                        >
                          {isExpanded ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}
                        </button>
                      </td>
                      <td className="px-3 py-2 font-medium text-text truncate">
                        <button onClick={() => setExpandedId(isExpanded ? null : c.id)} className="text-left hover:text-primary transition-colors truncate block w-full">
                          {c.lastName}, {c.firstName}
                        </button>
                      </td>
                      <td className="px-1 py-1 text-center">
                        <button
                          onClick={() => {
                            const next = !c.smsApproved;
                            setClients((prev) => prev.map((cl) => (cl.id === c.id ? { ...cl, smsApproved: next } : cl)));
                            saveField(c.id, { smsApproved: String(next) });
                          }}
                          className={`inline-flex items-center justify-center w-6 h-6 rounded border transition-colors ${c.smsApproved ? "bg-green-100 border-green-400 text-green-700" : "bg-surface border-border text-text-secondary/30 hover:border-border-dark"}`}
                          title={c.smsApproved ? "SMS approved — click to revoke" : "Not approved for SMS — click to approve"}
                        >
                          {c.smsApproved && <IconCheck size={14} />}
                        </button>
                      </td>
                      {!clinicianFilter && (
                        <td className="px-1 py-1">
                          <select value={c.clinicianId || ""} onChange={(e) => handleSelectChange(c.id, "clinicianId", e.target.value)} className={cellSelect}>
                            <option value="">—</option>
                            {clinicians.filter((cl) => cl.name).map((cl) => <option key={cl.id} value={cl.id}>{cl.name}</option>)}
                          </select>
                        </td>
                      )}
                      <td className="px-1 py-1">
                        <select
                          value={status}
                          onChange={(e) => handleSelectChange(c.id, "status", e.target.value)}
                          className={`${cellSelect} ${status === "active" ? "text-green-700" : status === "inactive" ? "text-amber-700" : "text-red-700"} font-medium`}
                        >
                          {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      </td>
                      <td className="px-2 py-1 text-sm text-text-secondary">
                        {c.lastSurveySentAt ? new Date(c.lastSurveySentAt).toLocaleDateString() : <span className="text-text-secondary/40">—</span>}
                      </td>
                      <td className="px-2 py-1 text-center">
                        {saving === "saving" && <IconLoader2 size={14} className="text-primary animate-spin" />}
                        {saving === "saved" && <IconCheck size={14} className="text-green-500" />}
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr key={`${c.id}-detail`}>
                        <td colSpan={colCount} className="p-0">
                          <div className="border-t border-border bg-bg-alt/30 px-4 py-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl">
                              <div>
                                <label className="block text-xs font-medium text-text-secondary mb-1">Email</label>
                                <input
                                  type="email"
                                  value={c.email || ""}
                                  onChange={(e) => updateLocal(c.id, "email", e.target.value)}
                                  onBlur={(e) => handleBlurSave(c.id, "email", e.target.value)}
                                  placeholder="No email on file"
                                  className="w-full px-3 py-2 rounded-lg border border-border bg-white text-text text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-text-secondary mb-1">Phone</label>
                                <input
                                  type="tel"
                                  value={c.phone || ""}
                                  onChange={(e) => updateLocal(c.id, "phone", e.target.value)}
                                  onBlur={(e) => handleBlurSave(c.id, "phone", e.target.value)}
                                  placeholder="+14355551234"
                                  className="w-full px-3 py-2 rounded-lg border border-border bg-white text-text text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
                                />
                              </div>
                              <div className="md:col-span-2">
                                <label className="block text-xs font-medium text-text-secondary mb-1">Notes</label>
                                <textarea
                                  value={c.notes || ""}
                                  onChange={(e) => updateLocal(c.id, "notes", e.target.value)}
                                  onBlur={(e) => handleBlurSave(c.id, "notes", e.target.value)}
                                  rows={3}
                                  placeholder="Add notes about this client..."
                                  className="w-full px-3 py-2 rounded-lg border border-border bg-white text-text text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors resize-y"
                                />
                              </div>
                              <div className="md:col-span-2 flex items-center gap-4 pt-1">
                                <div className="flex flex-wrap gap-2 text-xs text-text-secondary">
                                  <span>Opted in: {new Date(c.optedInAt).toLocaleDateString()}</span>
                                  {c.optedOut && <Badge variant="error">Opted out</Badge>}
                                  {c.smsConsent === "confirmed" && <Badge variant="success">SMS Confirmed</Badge>}
                                  {c.smsConsent === "pending" && <Badge variant="warning">SMS Pending</Badge>}
                                </div>
                                <button
                                  onClick={() => removeClient(c.id)}
                                  className="ml-auto flex items-center gap-1 text-xs text-error hover:text-red-700 transition-colors"
                                >
                                  <IconTrash size={14} /> Remove Client
                                </button>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Client Modal */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add Client">
        <AddClientForm onSuccess={() => { setShowAdd(false); loadClients(); addToast("Client added", "success"); }} />
      </Modal>

      {/* Import CSV Modal */}
      <Modal open={showImport} onClose={() => { setShowImport(false); resetImport(); }} title="Import Clients from CSV">
        {importStep === "upload" && (
          <div className="space-y-4">
            <p className="text-sm text-text-secondary">
              Upload a CSV with at least <span className="font-medium text-text">First Name</span> and{" "}
              <span className="font-medium text-text">Last Name</span> (or a single <span className="font-medium text-text">Name</span> column).
              All other columns are optional: Phone, Email, Clinician, Status, Frequency, Start Date.
            </p>
            <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
              <IconUpload size={32} className="mx-auto mb-3 text-text-secondary" />
              <p className="text-sm text-text-secondary mb-3">Select a .csv file</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                className="block mx-auto text-sm text-text-secondary file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary file:text-white hover:file:bg-primary-dark file:cursor-pointer file:transition-colors"
              />
            </div>
          </div>
        )}
        {importStep === "preview" && (
          <div className="space-y-4">
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1.5">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-green-500" />
                <span className="text-text">{parsedClients.length} ready to import</span>
              </div>
              {skippedClients.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-500" />
                  <span className="text-text-secondary">{skippedClients.length} will be skipped</span>
                </div>
              )}
            </div>
            {skippedClients.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-xs font-medium text-amber-800 mb-1">Skipped:</p>
                <ul className="text-xs text-amber-700 space-y-0.5">
                  {skippedClients.map((s, i) => <li key={i}>{s.name} — {s.reason}</li>)}
                </ul>
              </div>
            )}
            {parsedClients.length > 0 && (
              <div className="max-h-48 overflow-y-auto border border-border rounded-lg">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-bg-alt border-b border-border">
                      <th className="px-3 py-2 text-left font-medium text-text-secondary">Name</th>
                      <th className="px-3 py-2 text-left font-medium text-text-secondary">Clinician</th>
                      <th className="px-3 py-2 text-left font-medium text-text-secondary">Phone</th>
                      <th className="px-3 py-2 text-left font-medium text-text-secondary">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {parsedClients.map((c, i) => (
                      <tr key={i}>
                        <td className="px-3 py-1.5 text-text">{c.firstName} {c.lastName}</td>
                        <td className="px-3 py-1.5 text-text-secondary">{c.clinicianName || "—"}</td>
                        <td className="px-3 py-1.5 text-text-secondary">{c.phone || "—"}</td>
                        <td className="px-3 py-1.5 text-text-secondary">{c.status || "active"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={resetImport}>Back</Button>
              <Button size="sm" onClick={handleImport} disabled={parsedClients.length === 0}>
                Import {parsedClients.length} Client{parsedClients.length !== 1 ? "s" : ""}
              </Button>
            </div>
          </div>
        )}
        {importStep === "importing" && (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-3" />
            <p className="text-sm text-text-secondary">Importing clients...</p>
          </div>
        )}
        {importStep === "results" && importResults && (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
              <p className="text-lg font-semibold text-green-800">{importResults.imported} imported</p>
              {importResults.skipped > 0 && <p className="text-sm text-amber-700 mt-1">{importResults.skipped} skipped</p>}
            </div>
            {importResults.errors.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 max-h-32 overflow-y-auto">
                <p className="text-xs font-medium text-amber-800 mb-1">Notes:</p>
                <ul className="text-xs text-amber-700 space-y-0.5">
                  {importResults.errors.map((err, i) => <li key={i}>{err}</li>)}
                </ul>
              </div>
            )}
            <div className="flex justify-end">
              <Button size="sm" onClick={() => { setShowImport(false); resetImport(); }}>Done</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
