"use client";

import Input from "@/components/ui/Input";

interface DateRangeFilterProps {
  startDate: string;
  endDate: string;
  onStartChange: (date: string) => void;
  onEndChange: (date: string) => void;
}

export default function DateRangeFilter({ startDate, endDate, onStartChange, onEndChange }: DateRangeFilterProps) {
  return (
    <div className="flex gap-3">
      <Input
        label="From"
        type="date"
        value={startDate}
        onChange={(e) => onStartChange(e.target.value)}
      />
      <Input
        label="To"
        type="date"
        value={endDate}
        onChange={(e) => onEndChange(e.target.value)}
      />
    </div>
  );
}
