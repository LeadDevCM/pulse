"use client";

import { useEffect, useState } from "react";
import Table from "@/components/ui/Table";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";

interface SendItem {
  id: string;
  clientId: string;
  clientName?: string;
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

export default function SentHistory({ clinicianId }: SentHistoryProps) {
  const [sends, setSends] = useState<SendItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [clinicians, setClinicians] = useState<Record<string, string>>({});

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

  return (
    <div className="space-y-4">
      <p className="text-xs text-text-secondary">{total} surveys sent in the last 90 days</p>

      <Table headers={["Date", "Client", "Clinician", "Template", "Status"]}>
        {sends.map((s) => (
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
              {s.clientName || "Unknown"}
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
      </Table>

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
