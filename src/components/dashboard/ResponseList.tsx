"use client";

import { useEffect, useState } from "react";
import Table from "@/components/ui/Table";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { IconChevronRight } from "@tabler/icons-react";
import type { SurveyQuestion } from "@/types";

interface ResponseItem {
  token: string;
  clinicianId: string;
  templateId: string;
  submittedAt: string;
  answers: { questionId: string; value: string | number }[];
}

interface ClinicianInfo {
  id: string;
  name: string;
}

interface ResponseListProps {
  clinicianId?: string;
}

export default function ResponseList({ clinicianId }: ResponseListProps) {
  const [responses, setResponses] = useState<ResponseItem[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ResponseItem | null>(null);
  const [questions, setQuestions] = useState<Record<string, SurveyQuestion[]>>({});
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

    fetch("/api/admin/templates")
      .then((r) => r.json())
      .then((data) => {
        const map: Record<string, SurveyQuestion[]> = {};
        for (const t of data.templates || []) {
          map[t.id] = t.questions;
        }
        setQuestions(map);
      })
      .catch(() => {});
  }, []);

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

  const getQuestionText = (templateId: string, questionId: string) => {
    const qs = questions[templateId];
    if (!qs) return questionId;
    const q = qs.find((q) => q.id === questionId);
    return q?.text || questionId;
  };

  const getQuestionType = (templateId: string, questionId: string) => {
    const qs = questions[templateId];
    if (!qs) return "unknown";
    const q = qs.find((q) => q.id === questionId);
    return q?.type || "unknown";
  };

  const getRatingLabel = (templateId: string, questionId: string, value: number) => {
    const qs = questions[templateId];
    if (!qs) return String(value);
    const q = qs.find((q) => q.id === questionId);
    if (!q?.ratingScale) return String(value);
    const { min, max, minLabel, maxLabel } = q.ratingScale;
    if (value === min) return `${value} — ${minLabel}`;
    if (value === max) return `${value} — ${maxLabel}`;
    return String(value);
  };

  const getAvgRating = (r: ResponseItem) => {
    const ratings = r.answers.filter((a) => typeof a.value === "number");
    if (ratings.length === 0) return null;
    const avg = ratings.reduce((s, a) => s + (a.value as number), 0) / ratings.length;
    return Math.round(avg * 10) / 10;
  };

  if (loading) {
    return <div className="text-center py-8 text-text-secondary">Loading responses...</div>;
  }

  if (responses.length === 0) {
    return <div className="text-center py-8 text-text-secondary">No responses found.</div>;
  }

  return (
    <div className="space-y-4">
      <Table headers={["Date", "Clinician", "Answers", "Avg Rating", ""]}>
        {responses.map((r) => {
          const avg = getAvgRating(r);
          return (
            <tr
              key={r.token}
              onClick={() => setSelected(r)}
              className="hover:bg-bg-alt cursor-pointer"
            >
              <td className="px-4 py-3 text-sm text-text">
                {new Date(r.submittedAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </td>
              <td className="px-4 py-3 text-sm text-text-secondary">
                {clinicians[r.clinicianId] || "—"}
              </td>
              <td className="px-4 py-3">
                <Badge>{r.answers.length} answers</Badge>
              </td>
              <td className="px-4 py-3 text-sm">
                {avg !== null ? (
                  <span className={avg >= 4 ? "text-green-600 font-medium" : avg >= 3 ? "text-amber-600 font-medium" : "text-red-600 font-medium"}>
                    {avg}
                  </span>
                ) : "—"}
              </td>
              <td className="px-4 py-3 text-right text-text-secondary">
                <IconChevronRight size={16} />
              </td>
            </tr>
          );
        })}
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

      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title="Survey Response"
      >
        {selected && (
          <div className="space-y-5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-text-secondary">
                {new Date(selected.submittedAt).toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </span>
              <Badge>{clinicians[selected.clinicianId] || "Unknown"}</Badge>
            </div>

            <div className="divide-y divide-border">
              {selected.answers.map((a, i) => {
                const type = getQuestionType(selected.templateId, a.questionId);
                const isRating = typeof a.value === "number" && type === "rating";

                return (
                  <div key={a.questionId} className="py-4 first:pt-0">
                    <p className="text-sm font-medium text-text mb-2">
                      {i + 1}. {getQuestionText(selected.templateId, a.questionId)}
                    </p>

                    {isRating ? (
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-3">
                          <div className="flex-1 h-2 bg-border rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                (a.value as number) >= 4
                                  ? "bg-green-500"
                                  : (a.value as number) >= 3
                                    ? "bg-amber-500"
                                    : "bg-red-500"
                              }`}
                              style={{
                                width: `${(() => {
                                  const qs = questions[selected.templateId];
                                  const q = qs?.find((q) => q.id === a.questionId);
                                  const min = q?.ratingScale?.min ?? 0;
                                  const max = q?.ratingScale?.max ?? 5;
                                  return ((a.value as number) - min) / (max - min) * 100;
                                })()}%`,
                              }}
                            />
                          </div>
                          <span className="text-sm font-semibold text-text w-8 text-right">
                            {a.value}
                          </span>
                        </div>
                        <p className="text-xs text-text-secondary">
                          {getRatingLabel(selected.templateId, a.questionId, a.value as number)}
                        </p>
                      </div>
                    ) : type === "multiple_choice" ? (
                      <Badge variant="default">{String(a.value)}</Badge>
                    ) : (
                      <div className="bg-bg-alt rounded-lg px-3 py-2 text-sm text-text italic">
                        &ldquo;{String(a.value)}&rdquo;
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
