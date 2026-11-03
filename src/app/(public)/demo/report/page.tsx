"use client";

import { useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Select from "@/components/ui/Select";
import { IconPrinter } from "@tabler/icons-react";

const MOCK_CLINICIANS = [
  { id: "c1", name: "Kendra Jones" },
  { id: "c2", name: "Chelsee Jackson" },
  { id: "c3", name: "Ashley Barton" },
  { id: "c4", name: "Dennie Asbury" },
];

const MOCK_REPORTS: Record<string, ReportData> = {
  c1: {
    clinician: { id: "c1", name: "Kendra Jones" },
    retention: {
      totalClients: 22,
      active: 18,
      inactive: 2,
      terminated: 2,
      retentionRate: 0.9,
      frequencies: { weekly: 10, every_other_week: 5, monthly: 3, as_needed: 2 },
      terminationReasons: { "Client achieved goals": 1, "Client-no communication": 1 },
      lastUpdated: "2026-10-25",
    },
    survey: {
      totalSent: 48,
      totalCompleted: 39,
      responseRate: 0.8125,
      overallAverage: 6.42,
      questionAverages: [
        { questionId: "q1", text: "How heard, respected, and supported did you feel by your therapist?", average: 6.58 },
        { questionId: "q2", text: "How satisfied were you with your overall experience at Mending Minds Therapy?", average: 6.26 },
      ],
    },
    generatedAt: new Date().toISOString(),
  },
  c2: {
    clinician: { id: "c2", name: "Chelsee Jackson" },
    retention: {
      totalClients: 19,
      active: 14,
      inactive: 3,
      terminated: 2,
      retentionRate: 0.875,
      frequencies: { weekly: 8, every_other_week: 4, monthly: 2 },
      terminationReasons: { "Client requested": 1, "Referred out": 1 },
      lastUpdated: "2026-10-22",
    },
    survey: {
      totalSent: 41,
      totalCompleted: 32,
      responseRate: 0.7805,
      overallAverage: 6.15,
      questionAverages: [
        { questionId: "q1", text: "How heard, respected, and supported did you feel by your therapist?", average: 6.31 },
        { questionId: "q2", text: "How satisfied were you with your overall experience at Mending Minds Therapy?", average: 5.98 },
      ],
    },
    generatedAt: new Date().toISOString(),
  },
  c3: {
    clinician: { id: "c3", name: "Ashley Barton" },
    retention: {
      totalClients: 15,
      active: 9,
      inactive: 3,
      terminated: 3,
      retentionRate: 0.75,
      frequencies: { weekly: 5, every_other_week: 3, monthly: 1, never_seen: 2, as_needed: 1 },
      terminationReasons: { "Client achieved goals": 1, "Insurance/financial": 1, "Client-no communication": 1 },
      lastUpdated: "2026-10-20",
    },
    survey: {
      totalSent: 30,
      totalCompleted: 21,
      responseRate: 0.7,
      overallAverage: 5.73,
      questionAverages: [
        { questionId: "q1", text: "How heard, respected, and supported did you feel by your therapist?", average: 5.88 },
        { questionId: "q2", text: "How satisfied were you with your overall experience at Mending Minds Therapy?", average: 5.57 },
      ],
    },
    generatedAt: new Date().toISOString(),
  },
  c4: {
    clinician: { id: "c4", name: "Dennie Asbury" },
    retention: {
      totalClients: 11,
      active: 10,
      inactive: 1,
      terminated: 0,
      retentionRate: 1.0,
      frequencies: { weekly: 6, every_other_week: 3, monthly: 1 },
      terminationReasons: {},
      lastUpdated: "2026-10-27",
    },
    survey: {
      totalSent: 25,
      totalCompleted: 22,
      responseRate: 0.88,
      overallAverage: 6.71,
      questionAverages: [
        { questionId: "q1", text: "How heard, respected, and supported did you feel by your therapist?", average: 6.82 },
        { questionId: "q2", text: "How satisfied were you with your overall experience at Mending Minds Therapy?", average: 6.59 },
      ],
    },
    generatedAt: new Date().toISOString(),
  },
};

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

function StatBox({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="rounded-lg border border-border p-3 text-center bg-white">
      <p className="text-xs font-medium text-text-secondary uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${color || "text-text"}`}>{value}</p>
    </div>
  );
}

export default function DemoReportPage() {
  const [selectedId, setSelectedId] = useState("c1");
  const [days, setDays] = useState("30");

  const report = MOCK_REPORTS[selectedId] || null;

  const daysEnd = new Date();
  const daysStart = new Date();
  daysStart.setDate(daysEnd.getDate() - Number(days));

  const frequencyEntries = report ? Object.entries(report.retention.frequencies) : [];
  const totalFrequencyCount = frequencyEntries.reduce((sum, [, count]) => sum + count, 0);
  const terminationEntries = report ? Object.entries(report.retention.terminationReasons) : [];

  return (
    <div className="min-h-screen bg-bg-alt">
      <style jsx global>{`
        @media print {
          .print\\:hidden, nav, aside, .no-print { display: none !important; }
          body { background: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          main { padding: 0 !important; margin: 0 !important; }
          .shadow-sm { box-shadow: none !important; }
          .print-card { break-inside: avoid; page-break-inside: avoid; margin-bottom: 1rem; }
          .print-bg { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          @page { margin: 0.75in; size: letter; }
        }
      `}</style>

      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Demo banner */}
        <div className="print:hidden bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-6 text-center">
          <p className="text-sm text-amber-800 font-medium">Preview Mode — Sample Data</p>
          <p className="text-xs text-amber-600 mt-0.5">This is a preview of the Clinician Report feature with mock data.</p>
        </div>

        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-text">Clinician Reports</h2>
            <p className="text-text-secondary mt-1">Per-clinician survey performance and retention summary</p>
          </div>

          {/* Controls */}
          <div className="print:hidden flex flex-wrap items-end gap-4">
            <div className="w-64">
              <Select
                label="Clinician"
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                options={MOCK_CLINICIANS.map((c) => ({ value: c.id, label: c.name }))}
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
            <Button onClick={() => window.print()} size="sm" variant="secondary">
              <IconPrinter size={16} className="mr-1.5" />
              Print Report
            </Button>
          </div>

          {/* Report body */}
          {report && (
            <div className="space-y-6">
              {/* Header */}
              <div className="text-center print-card">
                <p className="text-sm font-medium text-text-secondary uppercase tracking-wide">Mending Minds Therapy</p>
                <h3 className="text-xl font-bold text-text mt-1">Clinician Performance Report</h3>
                <p className="text-lg font-semibold text-primary mt-2">{report.clinician.name}</p>
                <p className="text-sm text-text-secondary mt-1">
                  {formatDate(daysStart.toISOString())} &ndash; {formatDate(daysEnd.toISOString())}
                </p>
                <p className="text-xs text-text-secondary mt-0.5">Generated {formatDate(report.generatedAt)}</p>
              </div>

              {/* Retention Summary */}
              <Card className="print-card">
                <h4 className="text-base font-semibold text-text mb-4">Retention Summary</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                  <StatBox label="Total Clients" value={report.retention.totalClients} />
                  <StatBox label="Active" value={report.retention.active} color="text-green-600" />
                  <StatBox label="Inactive" value={report.retention.inactive} color="text-amber-600" />
                  <StatBox label="Terminated" value={report.retention.terminated} color="text-red-600" />
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-center">
                    <p className="text-xs font-medium text-text-secondary uppercase tracking-wide">Retention Rate</p>
                    <p className={`text-4xl font-bold mt-1 ${retentionColor(report.retention.retentionRate * 100)}`}>
                      {(report.retention.retentionRate * 100).toFixed(0)}%
                    </p>
                  </div>
                  <div className="flex-1 h-3 bg-bg-alt rounded-full overflow-hidden print-bg">
                    <div
                      className={`h-full rounded-full transition-all ${retentionBgColor(report.retention.retentionRate * 100)} print-bg`}
                      style={{ width: `${Math.min(report.retention.retentionRate * 100, 100)}%` }}
                    />
                  </div>
                </div>
                {report.retention.lastUpdated && (
                  <p className="text-xs text-text-secondary mt-3">Last updated: {formatDate(report.retention.lastUpdated)}</p>
                )}
              </Card>

              {/* Session Frequency */}
              {frequencyEntries.length > 0 && (
                <Card className="print-card">
                  <h4 className="text-base font-semibold text-text mb-4">Session Frequency</h4>
                  <div className="space-y-3">
                    {frequencyEntries.map(([key, count]) => {
                      const pct = totalFrequencyCount > 0 ? (count / totalFrequencyCount) * 100 : 0;
                      return (
                        <div key={key}>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-text font-medium">{FREQUENCY_LABELS[key] || key}</span>
                            <span className="text-text-secondary">{count} <span className="text-xs">({pct.toFixed(0)}%)</span></span>
                          </div>
                          <div className="h-2 bg-bg-alt rounded-full overflow-hidden print-bg">
                            <div className="h-full bg-primary rounded-full print-bg" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              )}

              {/* Termination Reasons */}
              {terminationEntries.length > 0 && (
                <Card className="print-card">
                  <h4 className="text-base font-semibold text-text mb-4">Termination Reasons</h4>
                  <div className="space-y-2">
                    {terminationEntries.map(([reason, count]) => (
                      <div key={reason} className="flex items-center justify-between text-sm py-1.5 border-b border-border last:border-0">
                        <span className="text-text">{reason}</span>
                        <span className="font-semibold text-text-secondary tabular-nums">{count}</span>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* Survey Performance */}
              <Card className="print-card">
                <h4 className="text-base font-semibold text-text mb-4">Survey Performance</h4>
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <StatBox label="Surveys Sent" value={report.survey.totalSent} />
                  <StatBox label="Completed" value={report.survey.totalCompleted} />
                  <StatBox
                    label="Response Rate"
                    value={`${(report.survey.responseRate * 100).toFixed(0)}%`}
                    color={report.survey.responseRate * 100 >= 70 ? "text-green-600" : report.survey.responseRate * 100 >= 50 ? "text-amber-600" : "text-red-600"}
                  />
                </div>
                <div className="text-center py-4 mb-6 rounded-lg bg-bg-alt print-bg">
                  <p className="text-xs font-medium text-text-secondary uppercase tracking-wide">Overall Average Rating</p>
                  <p className={`text-4xl font-bold mt-1 ${ratingColor(report.survey.overallAverage)}`}>
                    {report.survey.overallAverage.toFixed(2)}
                  </p>
                  <p className="text-xs text-text-secondary mt-0.5">out of 7</p>
                </div>
                {report.survey.questionAverages.length > 0 && (
                  <div>
                    <h5 className="text-sm font-semibold text-text mb-3">Per-Question Breakdown</h5>
                    <div className="space-y-4">
                      {report.survey.questionAverages.map((q, idx) => (
                        <div key={q.questionId}>
                          <div className="flex justify-between items-baseline mb-1">
                            <span className="text-sm text-text">
                              <span className="font-medium text-text-secondary mr-1.5">Q{idx + 1}.</span>
                              {q.text}
                            </span>
                            <span className={`text-sm font-bold tabular-nums ml-3 whitespace-nowrap ${ratingColor(q.average)}`}>
                              {q.average.toFixed(2)} / 7
                            </span>
                          </div>
                          <div className="h-2.5 bg-bg-alt rounded-full overflow-hidden print-bg">
                            <div
                              className={`h-full rounded-full transition-all print-bg ${ratingBgColor(q.average)}`}
                              style={{ width: `${(q.average / 7) * 100}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
