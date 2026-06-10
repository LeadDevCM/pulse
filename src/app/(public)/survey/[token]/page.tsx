"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import type { SurveyQuestion, SurveyAnswer } from "@/types";
import SurveyForm from "@/components/survey/SurveyForm";
import SurveyComplete from "@/components/survey/SurveyComplete";
import SurveyExpired from "@/components/survey/SurveyExpired";
import LoadingSpinner from "@/components/ui/LoadingSpinner";

type PageState = "loading" | "ready" | "completed" | "expired" | "error";

export default function SurveyPage() {
  const params = useParams();
  const token = params.token as string;
  const [state, setState] = useState<PageState>("loading");
  const [questions, setQuestions] = useState<SurveyQuestion[]>([]);

  useEffect(() => {
    fetch(`/api/survey/${token}`)
      .then((r) => {
        if (r.status === 410 || r.status === 404) {
          setState("expired");
          return null;
        }
        if (!r.ok) { setState("error"); return null; }
        return r.json();
      })
      .then((data) => {
        if (data) {
          setQuestions(data.questions);
          setState("ready");
        }
      })
      .catch(() => setState("error"));
  }, [token]);

  const handleSubmit = async (answers: SurveyAnswer[]) => {
    const res = await fetch(`/api/survey/${token}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers }),
    });
    if (res.ok) {
      setState("completed");
    }
  };

  return (
    <div className="w-full max-w-xl mx-auto">
      <div className="bg-white rounded-2xl shadow-sm border border-border overflow-hidden">
        <div className="bg-primary px-6 py-5 text-center">
          <h1 className="text-xl font-bold text-white">Mending Minds</h1>
          <p className="text-primary-light text-sm mt-1">We value your feedback</p>
        </div>
        <div className="p-6">
          {state === "loading" && (
            <div className="flex justify-center py-12">
              <LoadingSpinner size={32} />
            </div>
          )}
          {state === "ready" && <SurveyForm questions={questions} onSubmit={handleSubmit} />}
          {state === "completed" && <SurveyComplete />}
          {(state === "expired" || state === "error") && <SurveyExpired />}
        </div>
      </div>
    </div>
  );
}
