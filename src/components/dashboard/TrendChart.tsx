"use client";

import { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface TrendData {
  period: string;
  responseCount: number;
  averages: Record<string, number>;
}

interface TrendChartProps {
  clinicianId?: string;
  days?: number;
  groupBy?: "day" | "week" | "month";
}

export default function TrendChart({ clinicianId, days = 30, groupBy = "day" }: TrendChartProps) {
  const [data, setData] = useState<TrendData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams({ days: String(days), groupBy });
    if (clinicianId) params.set("clinicianId", clinicianId);
    fetch(`/api/dashboard/trends?${params}`)
      .then((r) => r.json())
      .then((res) => {
        setData(res.trends || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [clinicianId, days, groupBy]);

  if (loading) return <div className="text-center py-8 text-text-secondary">Loading trends...</div>;
  if (data.length === 0) return <div className="text-center py-8 text-text-secondary">No trend data available yet.</div>;

  const questionIds = data.length > 0 ? Object.keys(data[0].averages) : [];
  const colors = ["#008080", "#D97706", "#16A34A", "#DC2626", "#6366f1"];

  const chartData = data.map((d) => ({
    period: d.period,
    responses: d.responseCount,
    ...d.averages,
  }));

  return (
    <div className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
          <XAxis dataKey="period" tick={{ fontSize: 12 }} stroke="#666666" />
          <YAxis tick={{ fontSize: 12 }} stroke="#666666" />
          <Tooltip />
          <Legend />
          {questionIds.map((qId, i) => (
            <Line
              key={qId}
              type="monotone"
              dataKey={qId}
              stroke={colors[i % colors.length]}
              strokeWidth={2}
              dot={{ r: 3 }}
              name={`Q${i + 1}`}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
