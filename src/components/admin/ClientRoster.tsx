"use client";

import { useEffect, useState, useRef } from "react";
import Table from "@/components/ui/Table";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import AddClientForm from "./AddClientForm";
import { IconEye, IconEyeOff, IconPencil, IconPlus, IconSearch, IconTrash, IconTrashX, IconUpload } from "@tabler/icons-react";
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
}

interface CsvParsedClient {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  clinicianName: string;
}

interface CsvSkippedClient {
  name: string;
  reason: string;
}

type ImportStep = "upload" | "preview" | "importing" | "results";

function extractEmail(raw: string): string {
  if (!raw) return "";
  const match = raw.match(/[\w.+-]+@[\w.-]+\.\w+/);
  return match ? match[0] : "";
}

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        fields.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
  }
  fields.push(current.trim());
  return fields;
}

export default function ClientRoster() {
  const [clients, setClients] = useState<ClientItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editingClient, setEditingClient] = useState<ClientItem | null>(null);
  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editClinicianId, setEditClinicianId] = useState("");
  const [editClinicians, setEditClinicians] = useState<{ id: string; name: string }[]>([]);
  const [editSaving, setEditSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [clinicianFilter, setClinicianFilter] = useState("");
  const [clinicians, setClinicians] = useState<{ id: string; name: string }[]>([]);
  const [visiblePhiIds, setVisiblePhiIds] = useState<Set<string>>(new Set());
  const { addToast } = useToast();

  const togglePhi = (id: string) => {
    setVisiblePhiIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const clinicianMap = Object.fromEntries(clinicians.map((c) => [c.id, c.name]));

  const filteredClients = clients.filter((c) => {
    if (clinicianFilter && c.clinicianId !== clinicianFilter) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return c.name.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q) || c.phone.includes(q);
  });

  const [purging, setPurging] = useState(false);

  const purgeAllClients = async () => {
    if (!confirm("This will permanently remove ALL clients from the roster. Continue?")) return;
    if (!confirm("Are you sure? This cannot be undone.")) return;
    setPurging(true);
    try {
      const res = await fetch("/api/admin/clients/purge", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        addToast(`${data.purged} client(s) purged`, "success");
        loadClients();
      } else {
        addToast("Failed to purge clients", "error");
      }
    } catch {
      addToast("Network error", "error");
    }
    setPurging(false);
  };

  // CSV import state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importStep, setImportStep] = useState<ImportStep>("upload");
  const [parsedClients, setParsedClients] = useState<CsvParsedClient[]>([]);
  const [skippedClients, setSkippedClients] = useState<CsvSkippedClient[]>([]);
  const [importResults, setImportResults] = useState<{
    imported: number;
    skipped: number;
    errors: string[];
  } | null>(null);

  const loadClients = () => {
    setLoading(true);
    fetch("/api/admin/clients")
      .then((r) => r.json())
      .then((data) => {
        setClients(data.clients || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    loadClients();
    fetch("/api/admin/clinicians").then((r) => r.json()).then((d) => setClinicians(d.clinicians || [])).catch(() => {});
  }, []);

  const removeClient = async (id: string) => {
    if (!confirm("Remove this client from the survey roster?")) return;
    const res = await fetch(`/api/admin/clients/${id}`, { method: "DELETE" });
    if (res.ok) {
      addToast("Client removed", "success");
      loadClients();
    } else {
      addToast("Failed to remove client", "error");
    }
  };

  const openEdit = (client: ClientItem) => {
    setEditingClient(client);
    setEditFirstName(client.firstName);
    setEditLastName(client.lastName);
    setEditEmail(client.email || "");
    setEditPhone(client.phone);
    setEditClinicianId(client.clinicianId);
    fetch("/api/admin/clinicians")
      .then((r) => r.json())
      .then((data) => setEditClinicians(data.clinicians || []))
      .catch(() => {});
  };

  const closeEdit = () => {
    setEditingClient(null);
    setEditFirstName("");
    setEditLastName("");
    setEditEmail("");
    setEditPhone("");
    setEditClinicianId("");
  };

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClient) return;
    setEditSaving(true);
    try {
      const res = await fetch(`/api/admin/clients/${editingClient.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: editFirstName,
          lastName: editLastName,
          email: editEmail || undefined,
          phone: editPhone,
          clinicianId: editClinicianId,
        }),
      });
      if (res.ok) {
        addToast("Client updated", "success");
        closeEdit();
        loadClients();
      } else {
        const data = await res.json().catch(() => ({}));
        addToast(data.error || "Failed to update client", "error");
      }
    } catch {
      addToast("Network error", "error");
    }
    setEditSaving(false);
  };

  const resetImport = () => {
    setImportStep("upload");
    setParsedClients([]);
    setSkippedClients([]);
    setImportResults(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const closeImport = () => {
    setShowImport(false);
    resetImport();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      if (!text) return;

      const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
      if (lines.length < 2) {
        addToast("CSV file appears empty or has no data rows", "error");
        return;
      }

      const headerFields = parseCsvLine(lines[0]);
      const headers = headerFields.map((h) => h.toLowerCase().replace(/[^a-z]/g, ""));

      const firstNameIdx = headers.findIndex((h) => h === "firstname");
      const lastNameIdx = headers.findIndex((h) => h === "lastname");
      const nameIdx = headers.findIndex((h) => h === "name" || h === "clientname" || h === "fullname");
      const emailIdx = headers.findIndex((h) => h === "email" || h === "emailaddress");
      const phoneIdx = headers.findIndex((h) =>
        h === "phonenumber" || h === "phone" || h === "mobile" || h === "cell"
      );
      const clinicianIdx = headers.findIndex((h) =>
        h === "clinician" || h === "therapist" || h === "provider" || h === "counselor"
      );

      const hasSplitName = firstNameIdx !== -1 && lastNameIdx !== -1;
      if (!hasSplitName && nameIdx === -1) {
        addToast("CSV must have 'First Name' + 'Last Name' columns (or a single 'Name' column)", "error");
        return;
      }
      if (phoneIdx === -1) {
        addToast("CSV must have a 'Phone Number' column", "error");
        return;
      }

      const valid: CsvParsedClient[] = [];
      const skipped: CsvSkippedClient[] = [];

      for (let i = 1; i < lines.length; i++) {
        const fields = parseCsvLine(lines[i]);

        let firstName = "";
        let lastName = "";
        if (hasSplitName) {
          firstName = fields[firstNameIdx]?.trim() || "";
          lastName = fields[lastNameIdx]?.trim() || "";
        } else {
          const fullName = fields[nameIdx]?.trim() || "";
          const parts = fullName.split(/\s+/);
          firstName = parts[0] || "";
          lastName = parts.slice(1).join(" ") || "";
        }

        const rawEmail = emailIdx >= 0 ? (fields[emailIdx]?.trim() || "") : "";
        const phone = fields[phoneIdx]?.trim() || "";
        const clinicianName = clinicianIdx >= 0 ? (fields[clinicianIdx]?.trim() || "") : "";

        if (!firstName && !lastName) continue;

        const displayName = `${firstName} ${lastName}`.trim();

        if (!phone) {
          skipped.push({ name: displayName, reason: "No phone number" });
          continue;
        }

        if (!firstName) {
          skipped.push({ name: displayName, reason: "No first name" });
          continue;
        }
        if (!lastName) {
          skipped.push({ name: displayName, reason: "No last name" });
          continue;
        }

        valid.push({
          firstName,
          lastName,
          email: extractEmail(rawEmail),
          phone,
          clinicianName,
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
        setImportResults({
          imported: data.imported ?? parsedClients.length,
          skipped: data.skipped ?? 0,
          errors: data.errors ?? [],
        });
        setImportStep("results");
        loadClients();
      } else {
        const data = await res.json().catch(() => ({}));
        addToast(data.error || "Import failed", "error");
        setImportStep("preview");
      }
    } catch {
      addToast("Network error during import", "error");
      setImportStep("preview");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <p className="text-sm text-text-secondary">{filteredClients.length}{clinicianFilter ? ` of ${clients.length}` : ""} opted-in clients</p>
          <select
            value={clinicianFilter}
            onChange={(e) => setClinicianFilter(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-border bg-white text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
          >
            <option value="">All Clinicians</option>
            {clinicians.filter((c) => c.name).map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <Button onClick={purgeAllClients} size="sm" variant="danger" loading={purging} disabled={clients.length === 0}>
            <IconTrashX size={16} className="mr-1" /> Purge All
          </Button>
          <Button onClick={() => setShowImport(true)} size="sm" variant="secondary">
            <IconUpload size={16} className="mr-1" /> Import CSV
          </Button>
          <Button onClick={() => setShowAdd(true)} size="sm">
            <IconPlus size={16} className="mr-1" /> Add Client
          </Button>
        </div>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <IconSearch size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search clients by name, email, or phone..."
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-border bg-white text-text placeholder:text-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors text-sm"
          />
        </div>
        <button
          onClick={() => {
            if (visiblePhiIds.size > 0) {
              setVisiblePhiIds(new Set());
            } else {
              setVisiblePhiIds(new Set(filteredClients.map((c) => c.id)));
            }
          }}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-sm text-text-secondary hover:text-text hover:bg-bg-alt transition-colors whitespace-nowrap"
          title={visiblePhiIds.size > 0 ? "Hide all contact info" : "Show all contact info"}
        >
          {visiblePhiIds.size > 0 ? <IconEyeOff size={16} /> : <IconEye size={16} />}
          {visiblePhiIds.size > 0 ? "Hide All" : "Show All"}
        </button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-text-secondary">Loading...</div>
      ) : (
        <Table headers={["First Name", "Last Name", "Clinician", "Email", "Phone", "Opted In", ""]}>
          {filteredClients.map((c) => (
            <tr key={c.id} className="hover:bg-bg-alt">
              <td className="px-4 py-3 text-sm font-medium text-text">{c.firstName}</td>
              <td className="px-4 py-3 text-sm font-medium text-text">{c.lastName}</td>
              <td className="px-4 py-3 text-sm text-text-secondary">{clinicianMap[c.clinicianId] || "—"}</td>
              <td className="px-4 py-3 text-sm text-text-secondary">{visiblePhiIds.has(c.id) ? (c.email || "—") : (c.email ? "••••@••••" : "—")}</td>
              <td className="px-4 py-3 text-sm text-text-secondary">{visiblePhiIds.has(c.id) ? c.phone : "••••••••••"}</td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-1">
                  <Badge variant="success">{new Date(c.optedInAt).toLocaleDateString()}</Badge>
                  {c.optedOut ? (
                    <Badge variant="error">Opted out</Badge>
                  ) : c.smsConsent === "confirmed" ? (
                    <Badge variant="success">Replied YES</Badge>
                  ) : c.smsConsent === "pending" ? (
                    <Badge variant="warning">Awaiting YES</Badge>
                  ) : null}
                </div>
              </td>
              <td className="px-4 py-3 text-right">
                <div className="flex items-center justify-end gap-1">
                  <button
                    onClick={() => togglePhi(c.id)}
                    className="p-1 text-text-secondary hover:text-text transition-colors"
                    title={visiblePhiIds.has(c.id) ? "Hide contact info" : "Show contact info"}
                  >
                    {visiblePhiIds.has(c.id) ? <IconEyeOff size={18} /> : <IconEye size={18} />}
                  </button>
                  <button
                    onClick={() => openEdit(c)}
                    className="p-1 text-text-secondary hover:text-primary transition-colors"
                  >
                    <IconPencil size={18} />
                  </button>
                  <button
                    onClick={() => removeClient(c.id)}
                    className="p-1 text-text-secondary hover:text-error transition-colors"
                  >
                    <IconTrash size={18} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </Table>
      )}

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add Client">
        <AddClientForm
          onSuccess={() => {
            setShowAdd(false);
            loadClients();
            addToast("Client added to roster", "success");
          }}
        />
      </Modal>

      {/* CSV Import Modal */}
      <Modal open={showImport} onClose={closeImport} title="Import Clients from CSV">
        {importStep === "upload" && (
          <div className="space-y-4">
            <p className="text-sm text-text-secondary">
              Upload a CSV file with columns: <span className="font-medium text-text">First Name</span>,{" "}
              <span className="font-medium text-text">Last Name</span>,{" "}
              <span className="font-medium text-text">Clinician</span>,{" "}
              <span className="font-medium text-text">Email</span> (optional),{" "}
              <span className="font-medium text-text">Phone Number</span>. Other columns will be
              ignored.
            </p>
            <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
              <IconUpload size={32} className="mx-auto mb-3 text-text-secondary" />
              <p className="text-sm text-text-secondary mb-3">
                Select a .csv file to import
              </p>
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
                <span className="text-text">
                  {parsedClients.length} client{parsedClients.length !== 1 ? "s" : ""} ready to
                  import
                </span>
              </div>
              {skippedClients.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-500" />
                  <span className="text-text-secondary">
                    {skippedClients.length} will be skipped
                  </span>
                </div>
              )}
            </div>

            {skippedClients.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-xs font-medium text-amber-800 mb-1">Skipped entries:</p>
                <ul className="text-xs text-amber-700 space-y-0.5">
                  {skippedClients.map((s, i) => (
                    <li key={i}>
                      {s.name} &mdash; {s.reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {parsedClients.length > 0 && (
              <div className="max-h-48 overflow-y-auto border border-border rounded-lg">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-bg-alt border-b border-border">
                      <th className="px-3 py-2 text-left font-medium text-text-secondary">First Name</th>
                      <th className="px-3 py-2 text-left font-medium text-text-secondary">Last Name</th>
                      <th className="px-3 py-2 text-left font-medium text-text-secondary">Clinician</th>
                      <th className="px-3 py-2 text-left font-medium text-text-secondary">Email</th>
                      <th className="px-3 py-2 text-left font-medium text-text-secondary">Phone</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {parsedClients.map((c, i) => (
                      <tr key={i}>
                        <td className="px-3 py-1.5 text-text">{c.firstName}</td>
                        <td className="px-3 py-1.5 text-text">{c.lastName}</td>
                        <td className="px-3 py-1.5 text-text-secondary">{c.clinicianName || "—"}</td>
                        <td className="px-3 py-1.5 text-text-secondary">{c.email || "—"}</td>
                        <td className="px-3 py-1.5 text-text-secondary">{c.phone}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={resetImport}>
                Back
              </Button>
              <Button
                size="sm"
                onClick={handleImport}
                disabled={parsedClients.length === 0}
              >
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
              <p className="text-lg font-semibold text-green-800">
                {importResults.imported} client{importResults.imported !== 1 ? "s" : ""} imported
              </p>
              {importResults.skipped > 0 && (
                <p className="text-sm text-amber-700 mt-1">
                  {importResults.skipped} skipped
                </p>
              )}
            </div>

            {importResults.errors.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-xs font-medium text-red-800 mb-1">Errors:</p>
                <ul className="text-xs text-red-700 space-y-0.5">
                  {importResults.errors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex justify-end">
              <Button size="sm" onClick={closeImport}>
                Done
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Edit Client Modal */}
      <Modal open={!!editingClient} onClose={closeEdit} title="Edit Client">
        <form onSubmit={saveEdit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input label="First Name" value={editFirstName} onChange={(e) => setEditFirstName(e.target.value)} required />
            <Input label="Last Name" value={editLastName} onChange={(e) => setEditLastName(e.target.value)} required />
          </div>
          <Input label="Email" type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
          <Input label="Phone" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} placeholder="+14355551234" required />
          <Select
            label="Clinician"
            value={editClinicianId}
            onChange={(e) => setEditClinicianId(e.target.value)}
            options={[
              { value: "", label: "Select clinician..." },
              ...editClinicians.map((c) => ({ value: c.id, label: c.name })),
            ]}
          />
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" size="sm" onClick={closeEdit} type="button">Cancel</Button>
            <Button type="submit" size="sm" loading={editSaving}>Save Changes</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
