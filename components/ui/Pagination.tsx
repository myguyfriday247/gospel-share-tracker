// ==========================================
// PAGINATION - Reusable pagination controls
// ==========================================

"use client";

import { Button } from "@/components/ui/button";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
}

export function Pagination({ 
  currentPage, 
  totalPages, 
  onPageChange,
  disabled = false
}: PaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(0)}
        disabled={disabled || currentPage === 0}
      >
        First
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={disabled || currentPage === 0}
      >
        Previous
      </Button>
      <span className="text-sm px-2">
        Page {currentPage + 1} of {totalPages}
      </span>
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={disabled || currentPage >= totalPages - 1}
      >
        Next
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(totalPages - 1)}
        disabled={disabled || currentPage >= totalPages - 1}
      >
        Last
      </Button>
    </div>
  );
}
