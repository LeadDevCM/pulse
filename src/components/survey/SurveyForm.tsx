"use client";

import { useState } from "react";
import type { SurveyQuestion, SurveyAnswer } from "@/types";
import RatingQuestion from "./RatingQuestion";
import MultipleChoiceQuestion from "./MultipleChoiceQuestion";
import FreeTextQuestion from "./FreeTextQuestion";
import Button from "@/components/ui/Button";

interface SurveyFormProps {
  questions: SurveyQuestion[];
  onSubmit: (answers: SurveyAnswer[]) => Promise<void>;
}

export default function SurveyForm({ questions, onSubmit }: SurveyFormProps) {
  const [answers, setAnswers] = useState<Record<string, string | number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const showStepper = questions.length > 3;

  const updateAnswer = (questionId: string, value: string | number) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const currentQ = showStepper ? questions[currentStep] : null;
  const canProceed = currentQ
    ? !currentQ.required || answers[currentQ.id] !== undefined
    : true;

  const handleSubmit = async () => {
    const required = questions.filter((q) => q.required);
    const missing = required.find((q) => answers[q.id] === undefined);
    if (missing) return;

    setSubmitting(true);
    const formattedAnswers: SurveyAnswer[] = Object.entries(answers).map(
      ([questionId, value]) => ({ questionId, value })
    );
    await onSubmit(formattedAnswers);
  };

  const renderQuestion = (q: SurveyQuestion) => {
    switch (q.type) {
      case "rating":
        return (
          <RatingQuestion
            key={q.id}
            question={q}
            value={answers[q.id] as number}
            onChange={(v) => updateAnswer(q.id, v)}
          />
        );
      case "multiple_choice":
        return (
          <MultipleChoiceQuestion
            key={q.id}
            question={q}
            value={answers[q.id] as string}
            onChange={(v) => updateAnswer(q.id, v)}
          />
        );
      case "free_text":
        return (
          <FreeTextQuestion
            key={q.id}
            question={q}
            value={(answers[q.id] as string) || ""}
            onChange={(v) => updateAnswer(q.id, v)}
          />
        );
    }
  };

  if (showStepper) {
    return (
      <div className="space-y-6">
        <div className="flex gap-1.5">
          {questions.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                i <= currentStep ? "bg-primary" : "bg-border"
              }`}
            />
          ))}
        </div>

        <div className="text-sm text-text-secondary">
          Question {currentStep + 1} of {questions.length}
        </div>

        {renderQuestion(questions[currentStep])}

        <div className="flex gap-3 pt-4">
          {currentStep > 0 && (
            <Button variant="ghost" onClick={() => setCurrentStep((s) => s - 1)}>
              Back
            </Button>
          )}
          {currentStep < questions.length - 1 ? (
            <Button
              onClick={() => setCurrentStep((s) => s + 1)}
              disabled={!canProceed}
              className="ml-auto"
            >
              Next
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              loading={submitting}
              disabled={!canProceed}
              className="ml-auto"
            >
              Submit Feedback
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {questions.map(renderQuestion)}
      <Button onClick={handleSubmit} loading={submitting} size="lg" className="w-full">
        Submit Feedback
      </Button>
    </div>
  );
}
