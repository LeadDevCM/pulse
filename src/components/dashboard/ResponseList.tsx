"use client";

import { useEffect, useState } from "react";
import Table from "@/components/ui/Table";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { IconChevronRight, IconTrash, IconPencil, IconCheck, IconX } from "@tabler/icons-react";
import { useToast } from "@/components/ui/Toast";
import { useViewAs } from "@/lib/view-context";
import type { SurveyQuestion } from "@/types";

interface ResponseItem {
  token?: string;
  id?: string;
  clinicianId: string;
  templateId: string;
  submittedAt: string;
  clientName?: string | null;
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
  const [deleting, setDeleting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editAnswers, setEditAnswers] = useState<{ questionId: string; value: string | number }[]>([]);
  const [saving, setSaving] = useState(false);
  const { addToast } = useToast();
  const { viewingAs } = useViewAs();

  const canEdit = viewingAs === "partner" || viewingAs === "office_manager";

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

  const deleteResponse = async (token: string) => {
    if (!confirm("Permanently delete this response? This cannot be undone.")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/dashboard/responses/${token}`, { method: "DELETE" });
      if (res.ok) {
        setResponses((prev) => prev.filter((r) => r.token !== token));
        setSelected(null);
        addToast("Response deleted", "success");
      } else {
        addToast("Failed to delete response", "error");
      }
    } catch {
      addToast("Network error", "error");
    }
    setDeleting(false);
  };

  const startEditing = () => {
    if (!selected) return;
    setEditAnswers(selected.answers.map((a) => ({ ...a })));
    setEditing(true);
  };

  const cancelEditing = () => {
    setEditing(false);
    setEditAnswers([]);
  };

  const updateEditAnswer = (questionId: string, value: string | number) => {
    setEditAnswers((prev) =>
      prev.map((a) => (a.questionId === questionId ? { ...a, value } : a))
    );
  };

  const saveEdits = async () => {
    if (!selected?.token) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/dashboard/responses/${selected.token}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: editAnswers }),
      });
      if (res.ok) {
        const updated = { ...selected, answers: editAnswers };
        setSelected(updated);
        setResponses((prev) =>
          prev.map((r) => (r.token === selected.token ? updated : r))
        );
        setEditing(false);
        addToast("Response updated", "success");
      } else {
        addToast("Failed to save changes", "error");
      }
    } catch {
      addToast("Network error", "error");
    }
    setSaving(false);
  };

  const getQuestion = (templateId: string, questionId: string): SurveyQuestion | undefined => {
    return questions[templateId]?.find((q) => q.id === questionId);
  };

  if (loading) {
    return <div className="text-center py-8 text-text-secondary">Loading responses...</div>;
  }

  if (responses.length === 0) {
    return <div className="text-center py-8 text-text-secondary">No responses found.</div>;
  }

  const showClientColumn = responses.some((r) => "clientName" in r);

  const headers = showClientColumn
    ? ["Date", "Client", "Clinician", "Answers", "Avg Rating", ""]
    : ["Date", "Clinician", "Answers", "Avg Rating", ""];

  return (
    <div className="space-y-4">
      <Table headers={headers}>
        {responses.map((r, i) => {
          const avg = getAvgRating(r);
          return (
            <tr
              key={r.token || r.id || String(i)}
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
              {showClientColumn && (
                <td className="px-4 py-3 text-sm text-text">
                  {r.clientName || <span className="text-text-secondary italic">Anonymous</span>}
                </td>
              )}
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
        onClose={() => { setSelected(null); cancelEditing(); }}
        title={editing ? "Edit Response" : "Survey Response"}
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
              <div className="flex items-center gap-2">
                {selected.clientName && (
                  <Badge variant="default">{selected.clientName}</Badge>
                )}
                <Badge>{clinicians[selected.clinicianId] || "Unknown"}</Badge>
              </div>
            </div>

            <div className="divide-y divide-border">
              {(editing ? editAnswers : selected.answers).map((a, i) => {
                const type = getQuestionType(selected.templateId, a.questionId);
                const q = getQuestion(selected.templateId, a.questionId);
                const isRating = typeof a.value === "number" && type === "rating";

                return (
                  <div key={a.questionId} className="py-4 first:pt-0">
                    <p className="text-sm font-medium text-text mb-2">
                      {i + 1}. {getQuestionText(selected.templateId, a.questionId)}
                    </p>

                    {editing ? (
                      isRating && q?.ratingScale ? (
                        <div className="flex gap-1.5 flex-wrap">
                          {Array.from(
                            { length: q.ratingScale.max - q.ratingScale.min + 1 },
                            (_, idx) => q.ratingScale!.min + idx
                          ).map((v) => (
                            <button
                              key={v}
                              type="button"
                              onClick={() => updateEditAnswer(a.questionId, v)}
                              className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors ${
                                a.value === v
                                  ? "bg-primary text-white"
                                  : "bg-bg-alt text-text-secondary hover:bg-border"
                              }`}
                            >
                              {v}
                            </button>
                          ))}
                          <span className="ml-2 text-xs text-text-secondary self-center">
                            {q.ratingScale.minLabel} — {q.ratingScale.maxLabel}
                          </span>
                        </div>
                      ) : type === "multiple_choice" && q?.options ? (
                        <div className="flex gap-1.5 flex-wrap">
                          {q.options.map((opt) => (
                            <button
                              key={opt}
                              type="button"
                              onClick={() => updateEditAnswer(a.questionId, opt)}
                              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                                String(a.value) === opt
                                  ? "bg-primary text-white"
                                  : "bg-bg-alt text-text-secondary hover:bg-border"
                              }`}
                            >
                              {opt}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <textarea
                          value={String(a.value)}
                          onChange={(e) => updateEditAnswer(a.questionId, e.target.value)}
                          rows={2}
                          className="w-full border border-border rounded-lg px-3 py-2 text-sm text-text bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
                        />
                      )
                    ) : isRating ? (
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

            {selected.token && (
              <div className="border-t border-border pt-4 flex justify-between">
                {editing ? (
                  <>
                    <button
                      onClick={cancelEditing}
                      className="flex items-center gap-1 text-xs text-text-secondary hover:text-text transition-colors"
                    >
                      <IconX size={14} /> Cancel
                    </button>
                    <button
                      onClick={saveEdits}
                      disabled={saving}
                      className="flex items-center gap-1 text-xs text-primary hover:text-primary-dark transition-colors font-medium disabled:opacity-50"
                    >
                      <IconCheck size={14} /> {saving ? "Saving..." : "Save Changes"}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => deleteResponse(selected.token!)}
                      disabled={deleting}
                      className="flex items-center gap-1 text-xs text-error hover:text-red-700 transition-colors disabled:opacity-50"
                    >
                      <IconTrash size={14} /> {deleting ? "Deleting..." : "Delete Response"}
                    </button>
                    {canEdit && (
                      <button
                        onClick={startEditing}
                        className="flex items-center gap-1 text-xs text-primary hover:text-primary-dark transition-colors font-medium"
                      >
                        <IconPencil size={14} /> Edit Response
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
