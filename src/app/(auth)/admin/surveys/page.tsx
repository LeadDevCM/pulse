"use client";

import { useEffect, useState, useCallback } from "react";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import TemplateEditorModal from "@/components/admin/TemplateEditorModal";
import { IconPencil, IconPlus, IconTrash } from "@tabler/icons-react";
import { useToast } from "@/components/ui/Toast";
import type { SurveyTemplate } from "@/types";

export default function SurveysPage() {
  const [templates, setTemplates] = useState<SurveyTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTemplate, setEditingTemplate] = useState<SurveyTemplate | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const { addToast } = useToast();

  const loadTemplates = useCallback(() => {
    setLoading(true);
    fetch("/api/admin/templates")
      .then((r) => r.json())
      .then((data) => {
        setTemplates(data.templates || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  const deleteTemplate = async (id: string) => {
    if (!confirm("Delete this survey template? This cannot be undone.")) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/admin/templates/${id}`, { method: "DELETE" });
      if (res.ok) {
        addToast("Template deleted", "success");
        loadTemplates();
      } else {
        const data = await res.json().catch(() => ({}));
        addToast(data.error || "Failed to delete template", "error");
      }
    } catch {
      addToast("Network error", "error");
    }
    setDeleting(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-text">Survey Templates</h2>
          <p className="text-text-secondary mt-1">
            Manage survey question templates
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)} size="sm">
          <IconPlus size={16} className="mr-1" /> New Template
        </Button>
      </div>

      {loading ? (
        <p className="text-text-secondary">Loading...</p>
      ) : templates.length === 0 ? (
        <Card>
          <p className="text-text-secondary text-center py-4">
            No templates yet. Seed the database to create the default template.
          </p>
        </Card>
      ) : (
        templates.map((t) => (
          <Card key={t.id}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-text">{t.name}</h3>
                <p className="text-sm text-text-secondary">
                  {t.questions.length} questions
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditingTemplate(t)}
                >
                  <IconPencil size={16} className="mr-1" /> Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => deleteTemplate(t.id)}
                  disabled={deleting === t.id}
                  className="text-error hover:text-error"
                >
                  <IconTrash size={16} className="mr-1" /> Delete
                </Button>
                <Badge variant={t.active ? "success" : "default"}>
                  {t.active ? "Active" : "Inactive"}
                </Badge>
              </div>
            </div>
            <div className="space-y-3">
              {t.questions
                .sort((a, b) => a.order - b.order)
                .map((q, i) => (
                  <div key={q.id} className="flex items-start gap-3 text-sm">
                    <span className="text-text-secondary font-mono w-6 flex-shrink-0">
                      {i + 1}.
                    </span>
                    <div>
                      <p className="text-text">{q.text}</p>
                      <p className="text-text-secondary text-xs mt-0.5">
                        {q.type === "rating" && q.ratingScale
                          ? `Rating ${q.ratingScale.min}-${q.ratingScale.max} (${q.ratingScale.minLabel} → ${q.ratingScale.maxLabel})`
                          : q.type === "multiple_choice"
                            ? `Multiple choice: ${q.options?.join(", ")}`
                            : "Free text"}
                        {q.required ? "" : " · Optional"}
                      </p>
                    </div>
                  </div>
                ))}
            </div>
          </Card>
        ))
      )}

      {editingTemplate && (
        <TemplateEditorModal
          open={true}
          onClose={() => setEditingTemplate(null)}
          template={editingTemplate}
          onSaved={loadTemplates}
        />
      )}

      {showCreate && (
        <TemplateEditorModal
          open={true}
          onClose={() => setShowCreate(false)}
          onSaved={loadTemplates}
        />
      )}
    </div>
  );
}
