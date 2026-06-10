"use client";

import type { SurveyQuestion } from "@/types";

interface MCQProps {
  question: SurveyQuestion;
  value?: string;
  onChange: (value: string) => void;
}

export default function MultipleChoiceQuestion({ question, value, onChange }: MCQProps) {
  return (
    <div className="space-y-3">
      <p className="text-base font-medium text-text">
        {question.text}
        {question.required && <span className="text-error ml-1">*</span>}
      </p>
      <div className="space-y-2">
        {question.options?.map((opt) => (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            className={`w-full text-left px-4 py-3 rounded-lg border transition-all ${
              value === opt
                ? "bg-primary-light border-primary text-primary"
                : "bg-white border-border text-text hover:border-primary/50"
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}
