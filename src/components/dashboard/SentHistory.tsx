"use client";

import { useEffect, useState } from "react";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { IconArrowUp, IconArrowDown, IconArrowsSort } from "@tabler/icons-react";

interface SendItem {
  id: string;
  clientId: string;
  clientName?: string;
  clientFirstName?: string;
  clientLastName?: string;
  clinicianId: string;
  templateId: string;
  templateName?: string;
  sentAt: string;
  sentBy: string;
  status: string;
  completedAt?: string;
}

interface ClinicianInfo {
  id: string;
  name: string;
}

interface SentHistoryProps {
  clinicianId?: string;
}

type SortKey = "sentAt" | "client" | "clinician" | "template" | "status";
type SortDir = "asc" | "desc";

export default function SentHistory({ clinicianId }: SentHistoryProps) {
  const [sends, setSends] = useState<SendItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [clinicians, setClinicians] = useState<Record<string, string>>({});
  const [sortKey, setSortKey] = useState<SortKey>("sentAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  useEffect(() => {
    fetch("/api/admin/clinicians")
      .then((r) => r.json())
      .then((data) => {
        const map: Record<string, string> = {};
        for (const c of (data.clinicians || []) as ClinicianInfo[]) {
          map[c.id] = c.name;
        }
        setClinicians(map);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "30", days: "90" });
    if (clinicianId) params.set("clinicianId", clinicianId);
    fetch(`/api/dashboard/sends?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setSends(data.sends || []);
        setTotal(data.total || 0);
        setTotalPages(data.totalPages || 1);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [page, clinicianId]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir(key === "sentAt" ? "desc" : "asc"); }
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <IconArrowsSort size={13} className="inline ml-0.5 opacity-0 group-hover/th:opacity-40" />;
    return sortDir === "asc"
      ? <IconArrowUp size={13} className="inline ml-0.5 text-primary" />
      : <IconArrowDown size={13} className="inline ml-0.5 text-primary" />;
  };

  const sorted = [...sends].sort((a, b) => {
    const dir = sortDir === "asc" ? 1 : -1;
    switch (sortKey) {
      case "sentAt": return dir * a.sentAt.localeCompare(b.sentAt);
      case "client": return dir * (a.clientLastName || "").localeCompare(b.clientLastName || "") || dir * (a.clientFirstName || "").localeCompare(b.clientFirstName || "");
      case "clinician": return dir * (clinicians[a.clinicianId] || "").localeCompare(clinicians[b.clinicianId] || "");
      case "template": return dir * (a.templateName || "").localeCompare(b.templateName || "");
      case "status": return dir * a.status.localeCompare(b.status);
      default: return 0;
    }
  });

  const statusBadge = (status: string) => {
    switch (status) {
      case "completed": return <Badge variant="success">Completed</Badge>;
      case "sent":
      case "delivered": return <Badge variant="default">{status === "delivered" ? "Delivered" : "Sent"}</Badge>;
      case "failed": return <Badge variant="error">Failed</Badge>;
      case "expired": return <Badge variant="warning">Expired</Badge>;
      default: return <Badge>{status}</Badge>;
    }
  };

  if (loading) {
    return <div className="text-center py-8 text-text-secondary">Loading sent history...</div>;
  }

  if (sends.length === 0) {
    return <div className="text-center py-8 text-text-secondary">No surveys sent yet.</div>;
  }

  const thClass = "px-4 py-3 text-left font-medium text-text-secondary whitespace-nowrap cursor-pointer select-none group/th";

  return (
    <div className="space-y-4">
      <p className="text-xs text-text-secondary">{total} surveys sent in the last 90 days</p>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-bg-alt border-b border-border">
              <th className={thClass} onClick={() => toggleSort("sentAt")}>Date<SortIcon col="sentAt" /></th>
              <th className={thClass} onClick={() => toggleSort("client")}>Client<SortIcon col="client" /></th>
              <th className={thClass} onClick={() => toggleSort("clinician")}>Clinician<SortIcon col="clinician" /></th>
              <th className={thClass} onClick={() => toggleSort("template")}>Template<SortIcon col="template" /></th>
              <th className={thClass} onClick={() => toggleSort("status")}>Status<SortIcon col="status" /></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {sorted.map((s) => (
              <tr key={s.id} className="hover:bg-bg-alt">
                <td className="px-4 py-3 text-sm text-text whitespace-nowrap">
                  {new Date(s.sentAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </td>
                <td className="px-4 py-3 text-sm text-text">
                  {s.clientLastName ? `${s.clientLastName}, ${s.clientFirstName}` : s.clientName || "Unknown"}
                </td>
                <td className="px-4 py-3 text-sm text-text-secondary">
                  {clinicians[s.clinicianId] || "—"}
                </td>
                <td className="px-4 py-3 text-sm text-text-secondary">
                  {s.templateName || "—"}
                </td>
                <td className="px-4 py-3">
                  {statusBadge(s.status)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-between items-center">
        <Button variant="ghost" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} size="sm">
          Previous
        </Button>
        <span className="text-sm text-text-secondary">Page {page} of {totalPages}</span>
        <Button variant="ghost" onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages} size="sm">
          Next
        </Button>
      </div>
    </div>
  );
}
