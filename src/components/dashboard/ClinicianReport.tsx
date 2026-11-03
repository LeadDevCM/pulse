"use client";

import { useEffect, useState } from "react";
import Card from "@/components/ui/Card";
import Select from "@/components/ui/Select";
import Button from "@/components/ui/Button";
import { IconPrinter } from "@tabler/icons-react";

interface Clinician {
  id: string;
  name: string;
}

interface ReportData {
  clinician: { id: string; name: string };
  retention: {
    totalClients: number;
    active: number;
    inactive: number;
    terminated: number;
    retentionRate: number;
    frequencies: Record<string, number>;
    terminationReasons: Record<string, number>;
    lastUpdated: string | null;
  };
  survey: {
    totalSent: number;
    totalCompleted: number;
    responseRate: number;
    overallAverage: number;
    questionAverages: { questionId: string; text: string; average: number }[];
  };
  generatedAt: string;
}

const FREQUENCY_LABELS: Record<string, string> = {
  weekly: "Weekly",
  every_other_week: "Every Other Week",
  monthly: "Monthly",
  as_needed: "As Needed",
  never_seen: "Never Seen",
};

function ratingColor(avg: number): string {
  if (avg >= 5.5) return "text-green-600";
  if (avg >= 4) return "text-amber-600";
  return "text-red-600";
}

function ratingBgColor(avg: number): string {
  if (avg >= 5.5) return "bg-green-500";
  if (avg >= 4) return "bg-amber-500";
  return "bg-red-500";
}

function retentionColor(rate: number): string {
  if (rate >= 80) return "text-green-600";
  if (rate >= 60) return "text-amber-600";
  return "text-red-600";
}

function retentionBgColor(rate: number): string {
  if (rate >= 80) return "bg-green-500";
  if (rate >= 60) return "bg-amber-500";
  return "bg-red-500";
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function ClinicianReport() {
  const [clinicians, setClinicians] = useState<Clinician[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [days, setDays] = useState("30");
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [cliniciansLoading, setCliniciansLoading] = useState(true);
  const [includeSurvey, setIncludeSurvey] = useState(true);

  // Load clinician list
  useEffect(() => {
    fetch("/api/admin/clinicians")
      .then((r) => r.json())
      .then((data) => {
        setClinicians(data.clinicians || []);
        setCliniciansLoading(false);
      })
      .catch(() => setCliniciansLoading(false));
  }, []);

  // Fetch report when clinician or period changes
  useEffect(() => {
    if (!selectedId) {
      setReport(null);
      return;
    }
    setLoading(true);
    fetch(`/api/dashboard/reports?clinicianId=${selectedId}&days=${days}`)
      .then((r) => r.json())
      .then((data) => {
        setReport(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [selectedId, days]);

  const daysEnd = new Date();
  const daysStart = new Date();
  daysStart.setDate(daysEnd.getDate() - Number(days));

  const frequencyEntries = report
    ? Object.entries(report.retention.frequencies)
    : [];
  const totalFrequencyCount = frequencyEntries.reduce(
    (sum, [, count]) => sum + count,
    0
  );

  const terminationEntries = report
    ? Object.entries(report.retention.terminationReasons)
    : [];

  return (
    <>
      <style jsx global>{`
        @media print {
          /* Hide interactive controls */
          .print\\:hidden,
          nav,
          aside,
          .no-print {
            display: none !important;
          }

          /* Reset page for clean print */
          body {
            background: white !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          main {
            padding: 0 !important;
            margin: 0 !important;
          }

          /* Remove shadows and borders for cleaner look */
          .shadow-sm {
            box-shadow: none !important;
          }

          /* Ensure cards break cleanly */
          .print-card {
            break-inside: avoid;
            page-break-inside: avoid;
            margin-bottom: 1rem;
          }

          /* Force background colors in print */
          .print-bg {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          @page {
            margin: 0.75in;
            size: letter;
          }
        }
      `}</style>

      {/* Controls bar -- hidden when printing */}
      <div className="print:hidden flex flex-wrap items-end gap-4">
        <div className="w-64">
          <Select
            label="Clinician"
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            options={[
              { value: "", label: cliniciansLoading ? "Loading..." : "Select a clinician" },
              ...clinicians.map((c) => ({ value: c.id, label: c.name })),
            ]}
          />
        </div>
        <div className="w-44">
          <Select
            label="Period"
            value={days}
            onChange={(e) => setDays(e.target.value)}
            options={[
              { value: "30", label: "Last 30 days" },
              { value: "60", label: "Last 60 days" },
              { value: "90", label: "Last 90 days" },
            ]}
          />
        </div>
        {report && (
          <>
            <label className="flex items-center gap-2 text-sm text-text cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includeSurvey}
                onChange={(e) => setIncludeSurvey(e.target.checked)}
                className="w-4 h-4 rounded border-border text-primary focus:ring-primary/50"
              />
              Include survey results
            </label>
            <Button
              onClick={() => window.print()}
              size="sm"
              variant="secondary"
            >
              <IconPrinter size={16} className="mr-1.5" />
              Print Report
            </Button>
          </>
        )}
      </div>

      {/* Empty / loading states */}
      {!selectedId && !loading && (
        <div className="text-center py-8 text-text-secondary">
          Select a clinician above to generate a report.
        </div>
      )}
      {loading && (
        <div className="text-center py-8 text-text-secondary">
          Loading report...
        </div>
      )}

      {/* Report body */}
      {report && !loading && (
        <div className="space-y-6">
          {/* ---- Report Header (print-centered) ---- */}
          <div className="text-center print-card">
            <p className="text-sm font-medium text-text-secondary uppercase tracking-wide">
              Mending Minds Therapy
            </p>
            <h3 className="text-xl font-bold text-text mt-1">
              Clinician Performance Report
            </h3>
            <p className="text-lg font-semibold text-primary mt-2">
              {report.clinician.name}
            </p>
            <p className="text-sm text-text-secondary mt-1">
              {formatDate(daysStart.toISOString())} &ndash;{" "}
              {formatDate(daysEnd.toISOString())}
            </p>
            <p className="text-xs text-text-secondary mt-0.5">
              Generated {formatDate(report.generatedAt)}
            </p>
          </div>

          {/* ---- Retention Summary ---- */}
          <Card className="print-card">
            <h4 className="text-base font-semibold text-text mb-4">
              Retention Summary
            </h4>

            {/* Stat boxes */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              <StatBox
                label="Total Clients"
                value={report.retention.totalClients}
              />
              <StatBox
                label="Active"
                value={report.retention.active}
                color="text-green-600"
              />
              <StatBox
                label="Inactive"
                value={report.retention.inactive}
                color="text-amber-600"
              />
              <StatBox
                label="Terminated"
                value={report.retention.terminated}
                color="text-red-600"
              />
            </div>

            {/* Retention rate */}
            <div className="flex items-center gap-4">
              <div className="text-center">
                <p className="text-xs font-medium text-text-secondary uppercase tracking-wide">
                  Retention Rate
                </p>
                <p
                  className={`text-4xl font-bold mt-1 ${retentionColor(
                    report.retention.retentionRate * 100
                  )}`}
                >
                  {(report.retention.retentionRate * 100).toFixed(0)}%
                </p>
              </div>
              <div className="flex-1 h-3 bg-bg-alt rounded-full overflow-hidden print-bg">
                <div
                  className={`h-full rounded-full transition-all ${retentionBgColor(
                    report.retention.retentionRate * 100
                  )} print-bg`}
                  style={{
                    width: `${Math.min(report.retention.retentionRate * 100, 100)}%`,
                  }}
                />
              </div>
            </div>

            {report.retention.lastUpdated && (
              <p className="text-xs text-text-secondary mt-3">
                Last updated: {formatDate(report.retention.lastUpdated)}
              </p>
            )}
          </Card>

          {/* ---- Session Frequency ---- */}
          {frequencyEntries.length > 0 && (
            <Card className="print-card">
              <h4 className="text-base font-semibold text-text mb-4">
                Session Frequency
              </h4>
              <div className="space-y-3">
                {frequencyEntries.map(([key, count]) => {
                  const pct =
                    totalFrequencyCount > 0
                      ? (count / totalFrequencyCount) * 100
                      : 0;
                  return (
                    <div key={key}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-text font-medium">
                          {FREQUENCY_LABELS[key] || key}
                        </span>
                        <span className="text-text-secondary">
                          {count}{" "}
                          <span className="text-xs">
                            ({pct.toFixed(0)}%)
                          </span>
                        </span>
                      </div>
                      <div className="h-2 bg-bg-alt rounded-full overflow-hidden print-bg">
                        <div
                          className="h-full bg-primary rounded-full print-bg"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {/* ---- Termination Reasons ---- */}
          {terminationEntries.length > 0 && (
            <Card className="print-card">
              <h4 className="text-base font-semibold text-text mb-4">
                Termination Reasons
              </h4>
              <div className="space-y-2">
                {terminationEntries.map(([reason, count]) => (
                  <div
                    key={reason}
                    className="flex items-center justify-between text-sm py-1.5 border-b border-border last:border-0"
                  >
                    <span className="text-text">{reason}</span>
                    <span className="font-semibold text-text-secondary tabular-nums">
                      {count}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* ---- Survey Performance ---- */}
          {includeSurvey && <Card className="print-card">
            <h4 className="text-base font-semibold text-text mb-4">
              Survey Performance
            </h4>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <StatBox
                label="Surveys Sent"
                value={report.survey.totalSent}
              />
              <StatBox
                label="Completed"
                value={report.survey.totalCompleted}
              />
              <StatBox
                label="Response Rate"
                value={`${(report.survey.responseRate * 100).toFixed(0)}%`}
                color={
                  report.survey.responseRate * 100 >= 70
                    ? "text-green-600"
                    : report.survey.responseRate * 100 >= 50
                    ? "text-amber-600"
                    : "text-red-600"
                }
              />
            </div>

            {/* Overall average */}
            <div className="text-center py-4 mb-6 rounded-lg bg-bg-alt print-bg">
              <p className="text-xs font-medium text-text-secondary uppercase tracking-wide">
                Overall Average Rating
              </p>
              <p
                className={`text-4xl font-bold mt-1 ${ratingColor(
                  report.survey.overallAverage
                )}`}
              >
                {report.survey.overallAverage.toFixed(2)}
              </p>
              <p className="text-xs text-text-secondary mt-0.5">out of 7</p>
            </div>

            {/* Per-question breakdown */}
            {report.survey.questionAverages.length > 0 && (
              <div>
                <h5 className="text-sm font-semibold text-text mb-3">
                  Per-Question Breakdown
                </h5>
                <div className="space-y-4">
                  {report.survey.questionAverages.map((q, idx) => (
                    <div key={q.questionId}>
                      <div className="flex justify-between items-baseline mb-1">
                        <span className="text-sm text-text">
                          <span className="font-medium text-text-secondary mr-1.5">
                            Q{idx + 1}.
                          </span>
                          {q.text}
                        </span>
                        <span
                          className={`text-sm font-bold tabular-nums ml-3 whitespace-nowrap ${ratingColor(
                            q.average
                          )}`}
                        >
                          {q.average.toFixed(2)} / 7
                        </span>
                      </div>
                      <div className="h-2.5 bg-bg-alt rounded-full overflow-hidden print-bg">
                        <div
                          className={`h-full rounded-full transition-all print-bg ${ratingBgColor(
                            q.average
                          )}`}
                          style={{
                            width: `${(q.average / 7) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>}
        </div>
      )}
    </>
  );
}

/* ---- Helper components ---- */

function StatBox({
  label,
  value,
  color,
}: {
  label: string;
  value: string | number;
  color?: string;
}) {
  return (
    <div className="rounded-lg border border-border p-3 text-center bg-white">
      <p className="text-xs font-medium text-text-secondary uppercase tracking-wide">
        {label}
      </p>
      <p className={`text-2xl font-bold mt-1 ${color || "text-text"}`}>
        {value}
      </p>
    </div>
  );
}
