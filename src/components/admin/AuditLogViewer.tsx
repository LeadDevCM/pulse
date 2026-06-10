"use client";

import { useEffect, useState } from "react";
import Table from "@/components/ui/Table";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import type { AuditEntry } from "@/types";

export default function AuditLogViewer() {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
  );
  const [endDate, setEndDate] = useState(new Date().toISOString().split("T")[0]);

  const loadLogs = () => {
    setLoading(true);
    const params = new URLSearchParams({ startDate, endDate, page: String(page), limit: "50" });
    fetch(`/api/admin/audit?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setLogs(data.logs || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => { loadLogs(); }, [page, startDate, endDate]);

  const actionColor = (action: string): "success" | "warning" | "error" | "default" => {
    if (action.includes("failed")) return "error";
    if (action.includes("purged") || action.includes("removed")) return "warning";
    if (action.includes("success") || action.includes("submitted")) return "success";
    return "default";
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-3 items-end">
        <Input label="From" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        <Input label="To" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        <Button variant="secondary" onClick={loadLogs} size="sm">Filter</Button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-text-secondary">Loading audit logs...</div>
      ) : (
        <Table headers={["Timestamp", "Action", "User", "Resource", "Details"]}>
          {logs.map((log) => (
            <tr key={log.id} className="hover:bg-bg-alt">
              <td className="px-4 py-3 text-xs text-text-secondary whitespace-nowrap">
                {new Date(log.timestamp).toLocaleString()}
              </td>
              <td className="px-4 py-3">
                <Badge variant={actionColor(log.action)}>{log.action}</Badge>
              </td>
              <td className="px-4 py-3 text-sm text-text">{log.userId === "system" ? "System" : log.userId.slice(0, 8)}</td>
              <td className="px-4 py-3 text-sm text-text-secondary">{log.resourceType}</td>
              <td className="px-4 py-3 text-xs text-text-secondary">
                {log.metadata ? Object.entries(log.metadata).map(([k, v]) => `${k}=${v}`).join(", ") : "—"}
              </td>
            </tr>
          ))}
        </Table>
      )}

      <div className="flex justify-between">
        <Button variant="ghost" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>Previous</Button>
        <span className="text-sm text-text-secondary py-2">Page {page}</span>
        <Button variant="ghost" onClick={() => setPage((p) => p + 1)} disabled={logs.length < 50}>Next</Button>
      </div>
    </div>
  );
}
