"use client";

import type { SurveyQuestion } from "@/types";

interface FTQProps {
  question: SurveyQuestion;
  value: string;
  onChange: (value: string) => void;
}

export default function FreeTextQuestion({ question, value, onChange }: FTQProps) {
  return (
    <div className="space-y-3">
      <p className="text-base font-medium text-text">
        {question.text}
        {!question.required && (
          <span className="text-text-secondary text-sm font-normal ml-2">(optional)</span>
        )}
      </p>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={4}
        placeholder="Share your thoughts..."
        className="w-full px-3 py-2 rounded-lg border border-border bg-white text-text placeholder:text-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors resize-none"
      />
    </div>
  );
}
