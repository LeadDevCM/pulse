"use client";

import { useEffect, useState, useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import Card from "@/components/ui/Card";
import Select from "@/components/ui/Select";
import Badge from "@/components/ui/Badge";
import { IconArrowUp, IconArrowDown, IconSelector } from "@tabler/icons-react";

interface ClinicianData {
  clinicianId: string;
  clinicianName: string;
  totalResponses: number;
  overallAverage: number;
  questionAverages: Record<string, number>;
}

interface QuestionInfo {
  id: string;
  text: string;
}

type SortKey = "name" | "responses" | "overall" | string;
type SortDir = "asc" | "desc";

const COLORS = [
  "#008080", "#D97706", "#16A34A", "#DC2626", "#6366f1",
  "#EC4899", "#14B8A6", "#F59E0B", "#8B5CF6", "#EF4444",
  "#06B6D4",
];

function shortenName(name: string) {
  const parts = name.split(" ");
  if (parts.length <= 1) return name;
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

function ratingColor(avg: number): string {
  if (avg >= 4) return "text-green-600";
  if (avg >= 3) return "text-amber-600";
  return "text-red-600";
}

export default function ClinicianCompare() {
  const [data, setData] = useState<ClinicianData[]>([]);
  const [questions, setQuestions] = useState<QuestionInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState("30");
  const [sortKey, setSortKey] = useState<SortKey>("overall");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  useEffect(() => {
    setLoading(true);
    fetch(`/api/dashboard/compare?days=${days}`)
      .then((r) => r.json())
      .then((res) => {
        setData(res.clinicians || []);
        setQuestions(res.questions || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [days]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "name" ? "asc" : "desc");
    }
  };

  const sorted = useMemo(() => {
    return [...data].sort((a, b) => {
      let av: number | string, bv: number | string;
      if (sortKey === "name") {
        av = a.clinicianName.toLowerCase();
        bv = b.clinicianName.toLowerCase();
      } else if (sortKey === "responses") {
        av = a.totalResponses;
        bv = b.totalResponses;
      } else if (sortKey === "overall") {
        av = a.overallAverage;
        bv = b.overallAverage;
      } else {
        av = a.questionAverages[sortKey] || 0;
        bv = b.questionAverages[sortKey] || 0;
      }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [data, sortKey, sortDir]);

  if (loading) return <div className="text-center py-8 text-text-secondary">Loading comparison data...</div>;
  if (data.length === 0) return <div className="text-center py-8 text-text-secondary">No comparison data available.</div>;

  const shortQuestionLabel = (_text: string, idx: number) => `Q${idx + 1}`;

  const overallChartData = sorted.map((c) => ({
    name: shortenName(c.clinicianName),
    average: c.overallAverage,
    responses: c.totalResponses,
  }));

  const questionChartData = questions.map((q, qi) => {
    const row: Record<string, string | number> = { question: shortQuestionLabel(q.text, qi) };
    for (const c of data) {
      row[shortenName(c.clinicianName)] = c.questionAverages[q.id] || 0;
    }
    return row;
  });

  const clinicianNames = data.map((c) => shortenName(c.clinicianName));

  const SortIcon = ({ columnKey }: { columnKey: SortKey }) => {
    if (sortKey !== columnKey) return <IconSelector size={14} className="inline ml-0.5 opacity-40" />;
    return sortDir === "asc"
      ? <IconArrowUp size={14} className="inline ml-0.5" />
      : <IconArrowDown size={14} className="inline ml-0.5" />;
  };

  const thClass = "px-3 py-2 font-medium text-text-secondary cursor-pointer hover:text-text select-none transition-colors";

  return (
    <div className="space-y-6">
      <div className="flex items-end gap-4">
        <div className="w-40">
          <Select
            label="Period"
            value={days}
            onChange={(e) => setDays(e.target.value)}
            options={[
              { value: "7", label: "Last 7 days" },
              { value: "30", label: "Last 30 days" },
              { value: "90", label: "Last 90 days" },
            ]}
          />
        </div>
        <p className="text-sm text-text-secondary pb-2">{data.length} clinicians with responses</p>
      </div>

      {/* Ranking table */}
      <Card>
        <h3 className="text-lg font-semibold text-text mb-4">Overall Rankings</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-3 py-2 font-medium text-text-secondary w-8">#</th>
                <th className={`text-left ${thClass}`} onClick={() => toggleSort("name")}>
                  Clinician <SortIcon columnKey="name" />
                </th>
                <th className={`text-center ${thClass}`} onClick={() => toggleSort("responses")}>
                  Responses <SortIcon columnKey="responses" />
                </th>
                <th className={`text-center ${thClass}`} onClick={() => toggleSort("overall")}>
                  Overall Avg <SortIcon columnKey="overall" />
                </th>
                {questions.map((q, qi) => (
                  <th
                    key={q.id}
                    className={`text-center ${thClass}`}
                    title={q.text}
                    onClick={() => toggleSort(q.id)}
                  >
                    Q{qi + 1} <SortIcon columnKey={q.id} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sorted.map((c, i) => (
                <tr key={c.clinicianId} className="hover:bg-bg-alt">
                  <td className="px-3 py-2.5 text-text-secondary font-mono">{i + 1}</td>
                  <td className="px-3 py-2.5 font-medium text-text">{c.clinicianName}</td>
                  <td className="px-3 py-2.5 text-center">
                    <Badge>{c.totalResponses}</Badge>
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <span className={`font-semibold ${ratingColor(c.overallAverage)}`}>
                      {c.overallAverage.toFixed(2)}
                    </span>
                  </td>
                  {questions.map((q) => (
                    <td key={q.id} className="px-3 py-2.5 text-center">
                      <span className={ratingColor(c.questionAverages[q.id] || 0)}>
                        {c.questionAverages[q.id]?.toFixed(2) || "—"}
                      </span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-secondary">
          {questions.map((q, qi) => (
            <span key={q.id}><span className="font-medium">Q{qi + 1}:</span> {q.text}</span>
          ))}
        </div>
      </Card>

      {/* Overall average bar chart */}
      <Card>
        <h3 className="text-lg font-semibold text-text mb-4">Overall Average Rating</h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={overallChartData} layout="vertical" margin={{ left: 10, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis type="number" domain={[0, 5]} tick={{ fontSize: 12 }} stroke="#666" />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} stroke="#666" width={90} />
              <Tooltip
                formatter={(value) => [Number(value).toFixed(2), "Average"]}
                contentStyle={{ fontSize: 13, borderRadius: 8 }}
              />
              <Bar
                dataKey="average"
                fill="#008080"
                radius={[0, 4, 4, 0]}
                barSize={20}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Per-question comparison */}
      <Card>
        <h3 className="text-lg font-semibold text-text mb-4">Per-Question Comparison</h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={questionChartData} margin={{ left: 10, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="question" tick={{ fontSize: 12 }} stroke="#666" />
              <YAxis domain={[0, 5]} tick={{ fontSize: 12 }} stroke="#666" />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {clinicianNames.map((name, i) => (
                <Bar
                  key={name}
                  dataKey={name}
                  fill={COLORS[i % COLORS.length]}
                  radius={[2, 2, 0, 0]}
                  barSize={12}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-secondary">
          {questions.map((q, qi) => (
            <span key={q.id}><span className="font-medium">Q{qi + 1}:</span> {q.text}</span>
          ))}
        </div>
      </Card>
    </div>
  );
}
