// ==========================================
// SORTABLE HEADER - Reusable table header
// ==========================================

"use client";

import { Button } from "@/components/ui/button";

interface SortableHeaderProps<T extends string> {
  label: string;
  column: T;
  currentColumn: T;
  direction: "asc" | "desc";
  onSort: (column: T) => void;
  align?: "left" | "right" | "center";
}

export function SortableHeader<T extends string>({
  label,
  column,
  currentColumn,
  direction,
  onSort,
  align = "left"
}: SortableHeaderProps<T>) {
  const isActive = currentColumn === column;
  const sortIndicator = isActive ? (direction === "asc" ? "↑" : "↓") : "";

  return (
    <Button
      variant="ghost"
      className={`p-0 hover:bg-transparent ${
        align === "right" ? "justify-end" : 
        align === "center" ? "justify-center" : "justify-start"
      }`}
      onClick={() => onSort(column)}
    >
      <span className="flex items-center gap-1">
        {label}
        {isActive && <span className="text-xs">{sortIndicator}</span>}
      </span>
    </Button>
  );
}
