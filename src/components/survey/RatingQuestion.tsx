"use client";

import type { SurveyQuestion } from "@/types";

interface RatingQuestionProps {
  question: SurveyQuestion;
  value?: number;
  onChange: (value: number) => void;
}

export default function RatingQuestion({ question, value, onChange }: RatingQuestionProps) {
  const scale = question.ratingScale!;
  const range = Array.from(
    { length: scale.max - scale.min + 1 },
    (_, i) => scale.min + i
  );

  return (
    <div className="space-y-3">
      <p className="text-base font-medium text-text">
        {question.text}
        {question.required && <span className="text-error ml-1">*</span>}
      </p>
      <div className="flex gap-2 flex-wrap">
        {range.map((n) => (
          <button
            key={n}
            onClick={() => onChange(n)}
            className={`min-w-[44px] h-11 rounded-lg text-sm font-medium transition-all border ${
              value === n
                ? "bg-primary text-white border-primary shadow-sm"
                : "bg-white text-text-secondary border-border hover:border-primary/50"
            }`}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="flex justify-between text-xs text-text-secondary">
        <span>{scale.minLabel}</span>
        <span>{scale.maxLabel}</span>
      </div>
    </div>
  );
}
