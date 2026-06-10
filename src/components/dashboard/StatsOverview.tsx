"use client";

import { useEffect, useState } from "react";
import Card from "@/components/ui/Card";
import { IconSend, IconChecks, IconPercentage, IconTrendingUp } from "@tabler/icons-react";

interface Stats {
  totalSendsMonth: number;
  totalCompletedMonth: number;
  completionRate: number;
}

export default function StatsOverview() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    fetch("/api/dashboard/stats")
      .then((r) => r.json())
      .then(setStats)
      .catch(() => {});
  }, []);

  const cards = [
    { label: "Surveys Sent", value: stats?.totalSendsMonth ?? "—", icon: <IconSend size={20} className="text-primary" /> },
    { label: "Completed", value: stats?.totalCompletedMonth ?? "—", icon: <IconChecks size={20} className="text-success" /> },
    { label: "Completion Rate", value: stats ? `${stats.completionRate}%` : "—", icon: <IconPercentage size={20} className="text-warning" /> },
    { label: "This Month", value: stats?.totalSendsMonth ?? "—", icon: <IconTrendingUp size={20} className="text-primary" /> },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <Card key={card.label}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-text-secondary">{card.label}</p>
              <p className="text-2xl font-bold text-text mt-1">{card.value}</p>
            </div>
            <div className="p-2 rounded-lg bg-bg-alt">{card.icon}</div>
          </div>
        </Card>
      ))}
    </div>
  );
}
