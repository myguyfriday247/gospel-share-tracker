// ==========================================
// DATE RANGE SELECTOR - Reusable date filter
// ==========================================

"use client";

import { useMemo } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RangeKey } from "@/lib/types";
import { getDateRange } from "@/lib/date";

interface DateRangeSelectorProps {
  value: RangeKey;
  onChange: (value: RangeKey) => void;
}

export function DateRangeSelector({ value, onChange }: DateRangeSelectorProps) {
  const range = useMemo(() => getDateRange(value), [value]);

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-gray-600">Viewing:</span>
      <Select value={value} onValueChange={(v: RangeKey) => onChange(v)}>
        <SelectTrigger className="w-48">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Time</SelectItem>
          <SelectItem value="this_week">This Week</SelectItem>
          <SelectItem value="last_week">Last Week</SelectItem>
          <SelectItem value="this_month">This Month</SelectItem>
          <SelectItem value="last_month">Last Month</SelectItem>
          <SelectItem value="this_year">This Year</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
