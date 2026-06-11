"use client";

import { useState } from "react";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Button from "@/components/ui/Button";
import { IconPlus, IconTrash, IconArrowUp, IconArrowDown } from "@tabler/icons-react";
import { useToast } from "@/components/ui/Toast";
import type { SurveyTemplate, SurveyQuestion } from "@/types";

interface TemplateEditorModalProps {
  open: boolean;
  onClose: () => void;
  template?: SurveyTemplate;
  onSaved: () => void;
}

const questionTypeOptions = [
  { value: "rating", label: "Rating" },
  { value: "multiple_choice", label: "Multiple Choice" },
  { value: "free_text", label: "Free Text" },
];

function createBlankQuestion(order: number): SurveyQuestion {
  return {
    id: crypto.randomUUID(),
    text: "",
    type: "rating",
    ratingScale: { min: 1, max: 5, minLabel: "Poor", maxLabel: "Excellent" },
    required: true,
    order,
  };
}

export default function TemplateEditorModal({
  open,
  onClose,
  template,
  onSaved,
}: TemplateEditorModalProps) {
  const isNew = !template;
  const { addToast } = useToast();

  const [name, setName] = useState(template?.name ?? "");
  const [questions, setQuestions] = useState<SurveyQuestion[]>(
    () => template ? [...template.questions].sort((a, b) => a.order - b.order) : [createBlankQuestion(1)]
  );
  const [saving, setSaving] = useState(false);

  const updateQuestion = (index: number, patch: Partial<SurveyQuestion>) => {
    setQuestions((prev) =>
      prev.map((q, i) => (i === index ? { ...q, ...patch } : q))
    );
  };

  const removeQuestion = (index: number) => {
    setQuestions((prev) => {
      const updated = prev.filter((_, i) => i !== index);
      return updated.map((q, i) => ({ ...q, order: i + 1 }));
    });
  };

  const addQuestion = () => {
    setQuestions((prev) => [...prev, createBlankQuestion(prev.length + 1)]);
  };

  const moveQuestion = (index: number, direction: "up" | "down") => {
    setQuestions((prev) => {
      const arr = [...prev];
      const swapIdx = direction === "up" ? index - 1 : index + 1;
      if (swapIdx < 0 || swapIdx >= arr.length) return prev;
      [arr[index], arr[swapIdx]] = [arr[swapIdx], arr[index]];
      return arr.map((q, i) => ({ ...q, order: i + 1 }));
    });
  };

  const handleTypeChange = (index: number, newType: SurveyQuestion["type"]) => {
    const patch: Partial<SurveyQuestion> = { type: newType };

    if (newType === "rating") {
      patch.ratingScale = { min: 1, max: 5, minLabel: "Poor", maxLabel: "Excellent" };
      patch.options = undefined;
    } else if (newType === "multiple_choice") {
      patch.options = ["Option 1", "Option 2"];
      patch.ratingScale = undefined;
    } else {
      patch.options = undefined;
      patch.ratingScale = undefined;
    }

    updateQuestion(index, patch);
  };

  const handleSave = async () => {
    // Validate
    if (!name.trim()) {
      addToast("Template name is required", "error");
      return;
    }

    const emptyQ = questions.find((q) => !q.text.trim());
    if (emptyQ) {
      addToast("All questions must have text", "error");
      return;
    }

    const mcNoOpts = questions.find(
      (q) => q.type === "multiple_choice" && (!q.options || q.options.length === 0)
    );
    if (mcNoOpts) {
      addToast("Multiple choice questions must have at least one option", "error");
      return;
    }

    setSaving(true);

    const payload = {
      name: name.trim(),
      questions: questions.map((q) => ({
        ...q,
        text: q.text.trim(),
      })),
    };

    try {
      const url = isNew ? "/api/admin/templates" : `/api/admin/templates/${template!.id}`;
      const method = isNew ? "POST" : "PUT";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        addToast(isNew ? "Template created" : "Template saved", "success");
        onSaved();
        onClose();
      } else {
        const data = await res.json().catch(() => ({}));
        addToast(data.error || "Failed to save template", "error");
      }
    } catch {
      addToast("Network error", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={isNew ? "New Template" : "Edit Template"}>
      <div className="space-y-5">
        <Input
          label="Template Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-text">Questions</h4>
            <Button variant="ghost" size="sm" onClick={addQuestion}>
              <IconPlus size={14} className="mr-1" /> Add Question
            </Button>
          </div>

          {questions.length === 0 && (
            <p className="text-sm text-text-secondary text-center py-4">
              No questions yet. Add one to get started.
            </p>
          )}

          {questions.map((q, index) => (
            <div
              key={q.id}
              className="border border-border rounded-lg p-4 space-y-3 bg-bg-alt/30"
            >
              {/* Question header row */}
              <div className="flex items-start gap-2">
                <span className="text-xs font-mono text-text-secondary mt-2.5 flex-shrink-0 w-5">
                  {index + 1}.
                </span>
                <div className="flex-1 space-y-3">
                  <Input
                    value={q.text}
                    onChange={(e) => updateQuestion(index, { text: e.target.value })}
                    placeholder="Question text"
                  />

                  <div className="grid grid-cols-2 gap-3">
                    <Select
                      label="Type"
                      value={q.type}
                      onChange={(e) =>
                        handleTypeChange(index, e.target.value as SurveyQuestion["type"])
                      }
                      options={questionTypeOptions}
                    />
                    <div className="space-y-1">
                      <span className="block text-sm font-medium text-text">Required</span>
                      <button
                        type="button"
                        onClick={() => updateQuestion(index, { required: !q.required })}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          q.required ? "bg-primary" : "bg-border"
                        }`}
                        role="switch"
                        aria-checked={q.required}
                      >
                        <span
                          className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                            q.required ? "translate-x-6" : "translate-x-1"
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  {/* Rating scale fields */}
                  {q.type === "rating" && (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          label="Min"
                          type="number"
                          value={String(q.ratingScale?.min ?? 1)}
                          onChange={(e) =>
                            updateQuestion(index, {
                              ratingScale: {
                                ...(q.ratingScale || { min: 1, max: 5, minLabel: "", maxLabel: "" }),
                                min: Number(e.target.value),
                              },
                            })
                          }
                        />
                        <Input
                          label="Max"
                          type="number"
                          value={String(q.ratingScale?.max ?? 5)}
                          onChange={(e) =>
                            updateQuestion(index, {
                              ratingScale: {
                                ...(q.ratingScale || { min: 1, max: 5, minLabel: "", maxLabel: "" }),
                                max: Number(e.target.value),
                              },
                            })
                          }
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          label="Min Label"
                          value={q.ratingScale?.minLabel ?? ""}
                          onChange={(e) =>
                            updateQuestion(index, {
                              ratingScale: {
                                ...(q.ratingScale || { min: 1, max: 5, minLabel: "", maxLabel: "" }),
                                minLabel: e.target.value,
                              },
                            })
                          }
                        />
                        <Input
                          label="Max Label"
                          value={q.ratingScale?.maxLabel ?? ""}
                          onChange={(e) =>
                            updateQuestion(index, {
                              ratingScale: {
                                ...(q.ratingScale || { min: 1, max: 5, minLabel: "", maxLabel: "" }),
                                maxLabel: e.target.value,
                              },
                            })
                          }
                        />
                      </div>
                    </div>
                  )}

                  {/* Multiple choice options */}
                  {q.type === "multiple_choice" && (
                    <Input
                      label="Options (comma-separated)"
                      value={q.options?.join(", ") ?? ""}
                      onChange={(e) =>
                        updateQuestion(index, {
                          options: e.target.value
                            .split(",")
                            .map((o) => o.trim())
                            .filter((o) => o !== ""),
                        })
                      }
                      placeholder="Option 1, Option 2, Option 3"
                    />
                  )}
                </div>

                {/* Action buttons */}
                <div className="flex flex-col gap-1 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => moveQuestion(index, "up")}
                    disabled={index === 0}
                    className="p-1 text-text-secondary hover:text-text disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    aria-label="Move question up"
                  >
                    <IconArrowUp size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveQuestion(index, "down")}
                    disabled={index === questions.length - 1}
                    className="p-1 text-text-secondary hover:text-text disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    aria-label="Move question down"
                  >
                    <IconArrowDown size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeQuestion(index)}
                    className="p-1 text-text-secondary hover:text-error transition-colors"
                    aria-label="Remove question"
                  >
                    <IconTrash size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-2 justify-end pt-2 border-t border-border">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave} loading={saving}>
            {isNew ? "Create Template" : "Save Template"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
