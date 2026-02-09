// ==========================================
// SHARE FORM - Reusable entry form
// ==========================================

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { 
  Users, 
  MessageSquare, 
  BookOpen, 
  Cross,
  Loader2
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

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
      {/* Date */}
      <div className="space-y-2">
        <Label>Date</Label>
        <Input 
          type="date" 
          value={entryDate} 
          onChange={(e) => setEntryDate(e.target.value)}
          disabled={loading}
        />
      </div>

      {/* Share Types */}
      <div className="space-y-2">
        <Label>How Was the Gospel Shared?</Label>
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <Checkbox 
              checked={churchInvite} 
              onCheckedChange={(v) => setChurchInvite(!!v)}
              disabled={loading}
            />
            <span className="flex items-center gap-1">
              <Users className="h-4 w-4" /> Church Invitation
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox 
              checked={spiritualConversation} 
              onCheckedChange={(v) => setSpiritualConversation(!!v)}
              disabled={loading}
            />
            <span className="flex items-center gap-1">
              <MessageSquare className="h-4 w-4" /> Spiritual Conversation
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox 
              checked={storyShare} 
              onCheckedChange={(v) => setStoryShare(!!v)}
              disabled={loading}
            />
            <span className="flex items-center gap-1">
              <BookOpen className="h-4 w-4" /> Story Share
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox 
              checked={gospelPresentation} 
              onCheckedChange={(v) => setGospelPresentation(!!v)}
              disabled={loading}
            />
            <span className="flex items-center gap-1">
              <Cross className="h-4 w-4" /> Gospel Presentation
            </span>
          </div>
        </div>
      </div>

      {/* Number Reached */}
      <div className="space-y-2">
        <Label>Number Reached</Label>
        <Input
          type="number"
          min={0}
          value={numberReached}
          onChange={(e) => setNumberReached(parseInt(e.target.value) || 0)}
          disabled={loading}
        />
      </div>

      {/* Gospel Response */}
      <div className="space-y-2">
        <Label>Gospel Response?</Label>
        <div className="flex items-center gap-2">
          <Checkbox 
            checked={gospelResponse} 
            onCheckedChange={(v) => setGospelResponse(!!v)}
            disabled={loading}
          />
          <span>Someone responded to the gospel</span>
        </div>
      </div>

      {gospelResponse && (
        <div className="space-y-2">
          <Label>How Many Responded?</Label>
          <Input
            type="number"
            min={1}
            value={numberResponse}
            onChange={(e) => setNumberResponse(parseInt(e.target.value) || 0)}
            disabled={loading}
          />
        </div>
      )}

      {/* Notes */}
      <div className="space-y-2">
        <Label>Notes</Label>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Tell the story of how God used you..."
          disabled={loading}
        />
      </div>

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
