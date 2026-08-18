// ==========================================
// SHARE FORM FIELDS - Shared fields for add + edit
// ==========================================

"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Users, MessageSquare, BookOpen, Cross } from "lucide-react";

interface ShareFormFieldsProps {
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
  disabled?: boolean;
}

export function ShareFormFields({
  entryDate,
  setEntryDate,
  numberReached,
  setNumberReached,
  churchInvite,
  setChurchInvite,
  spiritualConversation,
  setSpiritualConversation,
  storyShare,
  setStoryShare,
  gospelPresentation,
  setGospelPresentation,
  gospelResponse,
  setGospelResponse,
  numberResponse,
  setNumberResponse,
  notes,
  setNotes,
  disabled = false,
}: ShareFormFieldsProps) {
  return (
    <>
      {/* Date */}
      <div className="space-y-2">
        <Label>Date</Label>
        <Input
          type="date"
          value={entryDate}
          onChange={(e) => setEntryDate(e.target.value)}
          disabled={disabled}
        />
      </div>

      {/* Share Types — at least one is required; enforced on add, edit, import and by a
          CHECK constraint on the table. */}
      <div className="space-y-2">
        <Label>
          How Was the Gospel Shared?{" "}
          <span className="text-red-600" aria-hidden="true">
            *
          </span>
          <span className="sr-only">(required)</span>
        </Label>
        <p className="text-xs text-gray-500">Choose at least one.</p>
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <Checkbox
              checked={churchInvite}
              onCheckedChange={(v) => setChurchInvite(!!v)}
              disabled={disabled}
            />
            <span className="flex items-center gap-1">
              <Users className="h-4 w-4" /> Church Invitation
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              checked={spiritualConversation}
              onCheckedChange={(v) => setSpiritualConversation(!!v)}
              disabled={disabled}
            />
            <span className="flex items-center gap-1">
              <MessageSquare className="h-4 w-4" /> Spiritual Conversation
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              checked={storyShare}
              onCheckedChange={(v) => setStoryShare(!!v)}
              disabled={disabled}
            />
            <span className="flex items-center gap-1">
              <BookOpen className="h-4 w-4" /> Story Share
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              checked={gospelPresentation}
              onCheckedChange={(v) => setGospelPresentation(!!v)}
              disabled={disabled}
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
          disabled={disabled}
        />
      </div>

      {/* Gospel Response */}
      <div className="space-y-2">
        <Label>Gospel Response?</Label>
        <div className="flex items-center gap-2">
          <Checkbox
            checked={gospelResponse}
            onCheckedChange={(v) => setGospelResponse(!!v)}
            disabled={disabled}
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
            disabled={disabled}
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
          disabled={disabled}
        />
      </div>
    </>
  );
}
