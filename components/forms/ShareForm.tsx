// ==========================================
// SHARE FORM - Reusable entry form
// ==========================================

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { ShareFormFields } from "./ShareFormFields";

interface ShareFormProps {
  personId: string;
  onSuccess?: () => void;
  onError?: (message: string) => void;
  submitLabel?: string;
}

export function ShareForm({ 
  personId, 
  onSuccess, 
  onError,
  submitLabel = "Add Share"
}: ShareFormProps) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Form state
  const [entryDate, setEntryDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [numberReached, setNumberReached] = useState(0);
  const [churchInvite, setChurchInvite] = useState(false);
  const [spiritualConversation, setSpiritualConversation] = useState(false);
  const [storyShare, setStoryShare] = useState(false);
  const [gospelPresentation, setGospelPresentation] = useState(false);
  const [gospelResponse, setGospelResponse] = useState(false);
  const [numberResponse, setNumberResponse] = useState(0);
  const [notes, setNotes] = useState("");

  const handleSubmit = async () => {
    setMessage(null);

    const anyShareType = churchInvite || spiritualConversation || storyShare || gospelPresentation;
    if (!anyShareType) {
      const msg = "Please select at least one way the gospel was shared.";
      setMessage(msg);
      onError?.(msg);
      return;
    }

    if (numberReached < 0 || Number.isNaN(numberReached)) {
      const msg = "Number Reached must be 0 or greater.";
      setMessage(msg);
      onError?.(msg);
      return;
    }

    if (gospelResponse && (numberResponse <= 0 || numberResponse > numberReached)) {
      const msg = "If someone responded, enter 1+ and it cannot exceed Number Reached.";
      setMessage(msg);
      onError?.(msg);
      return;
    }

    setLoading(true);

    const { error } = await supabase.from("gospel_share_entries").insert({
      person_id: personId,
      entry_date: entryDate,
      number_reached: numberReached,
      church_invite: churchInvite,
      spiritual_conversation: spiritualConversation,
      story_share: storyShare,
      gospel_presentation: gospelPresentation,
      gospel_response: gospelResponse,
      number_response: gospelResponse ? numberResponse : 0,
      notes: notes.trim() || null,
    });

    setLoading(false);

    if (error) {
      const msg = error.message;
      setMessage(msg);
      onError?.(msg);
      return;
    }

    // Reset form
    setEntryDate(new Date().toISOString().slice(0, 10));
    setNumberReached(0);
    setChurchInvite(false);
    setSpiritualConversation(false);
    setStoryShare(false);
    setGospelPresentation(false);
    setGospelResponse(false);
    setNumberResponse(0);
    setNotes("");
    setMessage("Entry saved!");
    onSuccess?.();
  };

  return (
    <div className="space-y-4">
      <ShareFormFields
        entryDate={entryDate}
        setEntryDate={setEntryDate}
        numberReached={numberReached}
        setNumberReached={setNumberReached}
        churchInvite={churchInvite}
        setChurchInvite={setChurchInvite}
        spiritualConversation={spiritualConversation}
        setSpiritualConversation={setSpiritualConversation}
        storyShare={storyShare}
        setStoryShare={setStoryShare}
        gospelPresentation={gospelPresentation}
        setGospelPresentation={setGospelPresentation}
        gospelResponse={gospelResponse}
        setGospelResponse={setGospelResponse}
        numberResponse={numberResponse}
        setNumberResponse={setNumberResponse}
        notes={notes}
        setNotes={setNotes}
        disabled={loading}
      />

      {/* Submit */}
      <div className="flex items-center gap-4">
        <Button 
          onClick={handleSubmit} 
          disabled={loading}
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            submitLabel
          )}
        </Button>
        {message && (
          <span className="text-sm">{message}</span>
        )}
      </div>
    </div>
  );
}
