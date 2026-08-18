// ==========================================
// ERROR BANNER - shared failure notice
// ==========================================
//
// Pages used to drop Supabase errors on the floor, so a failed load looked identical to
// "no data yet". Render this whenever a load fails so the difference is visible.

"use client";

import { Button } from "@/components/ui/button";

interface ErrorBannerProps {
  message: string | null;
  /** Shown above the message. Defaults to a generic load failure. */
  title?: string;
  onRetry?: () => void;
}

export function ErrorBanner({
  message,
  title = "Some data could not be loaded.",
  onRetry,
}: ErrorBannerProps) {
  if (!message) return null;

  return (
    <div
      role="alert"
      className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800"
    >
      <p className="font-medium">{title}</p>
      <p className="mt-1 break-words">{message}</p>
      {onRetry && (
        <Button variant="outline" className="mt-3" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
