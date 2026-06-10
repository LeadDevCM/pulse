"use client";

import { useEffect, useState } from "react";
import Table from "@/components/ui/Table";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";

interface ResponseItem {
  token: string;
  clinicianId: string;
  submittedAt: string;
  answers: { questionId: string; value: string | number }[];
}

interface ResponseListProps {
  clinicianId?: string;
}

export default function ResponseList({ clinicianId }: ResponseListProps) {
  const [responses, setResponses] = useState<ResponseItem[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "20" });
    if (clinicianId) params.set("clinicianId", clinicianId);
    fetch(`/api/dashboard/responses?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setResponses(data.responses || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [page, clinicianId]);

  if (loading) {
    return <div className="text-center py-8 text-text-secondary">Loading responses...</div>;
  }

  if (responses.length === 0) {
    return <div className="text-center py-8 text-text-secondary">No responses found.</div>;
  }

  return (
    <div className="space-y-4">
      <Table headers={["Date", "Responses", "Ratings"]}>
        {responses.map((r) => (
          <tr key={r.token} className="hover:bg-bg-alt">
            <td className="px-4 py-3 text-sm text-text">
              {new Date(r.submittedAt).toLocaleDateString()}
            </td>
            <td className="px-4 py-3">
              <Badge>{r.answers.length} answers</Badge>
            </td>
            <td className="px-4 py-3 text-sm text-text-secondary">
              {r.answers
                .filter((a) => typeof a.value === "number")
                .map((a) => a.value)
                .join(", ") || "—"}
            </td>
          </tr>
        ))}
      </Table>
      <div className="flex justify-between">
        <Button variant="ghost" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
          Previous
        </Button>
        <span className="text-sm text-text-secondary py-2">Page {page}</span>
        <Button variant="ghost" onClick={() => setPage((p) => p + 1)} disabled={responses.length < 20}>
          Next
        </Button>
      </div>
    </div>
  );
}
