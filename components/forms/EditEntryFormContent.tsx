// ==========================================
// EDIT ENTRY FORM CONTENT - Edit dialog body for EntryRecord
// ==========================================

"use client";

import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { ShareFormFields } from "./ShareFormFields";

interface EditEntryFormContentProps {
  entryDate: string;
  setEntryDate: (v: string) => void;
  numberReached: number;
  setNumberReached: (v: number) => void;
  churchInvite: boolean;
  setChurchInvite: (v: boolean) => void;
  spiritualConversation: boolean;
  setSpiritualConversation: (v: boolean) => void;
  storyShare: boolean;
  setStoryShare: (v: boolean) => void;
  gospelPresentation: boolean;
  setGospelPresentation: (v: boolean) => void;
  gospelResponse: boolean;
  setGospelResponse: (v: boolean) => void;
  numberResponse: number;
  setNumberResponse: (v: number) => void;
  notes: string;
  setNotes: (v: string) => void;
  message: string | null;
  saving: boolean;
  onSubmit: () => void;
  onCancel: () => void;
}

export function EditEntryFormContent({
  message,
  saving,
  onSubmit,
  onCancel,
  ...fields
}: EditEntryFormContentProps) {
  return (
    <div className="space-y-4">
      <ShareFormFields {...fields} disabled={saving} />

      {message && <p className="text-sm text-center text-red-500">{message}</p>}

      <div className="flex gap-2">
        <Button onClick={onSubmit} disabled={saving} className="flex-1">
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            "Save Changes"
          )}
        </Button>
        <Button variant="outline" onClick={onCancel} disabled={saving} className="flex-1">
          Cancel
        </Button>
      </div>
    </div>
  );
}
