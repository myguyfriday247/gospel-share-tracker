// ==========================================
// ENTRY RECORD - Reusable share entry display
// ==========================================

"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, X } from "lucide-react";
import { Entry } from "@/lib/types";
import { supabase } from "@/lib/supabaseClient";
import {
  Users,
  MessageSquare,
  BookOpen,
  Cross,
  Calendar,
} from "lucide-react";

interface EntryRecordProps {
  entry: Entry;
  onUpdate?: () => void;
  showActions?: boolean;
  variant?: "card" | "row";
}

export function EntryRecord({ entry, onUpdate, showActions = true, variant = "card" }: EntryRecordProps) {
  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<Entry | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editMessage, setEditMessage] = useState<string | null>(null);

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingEntry(entry);
    setEditDialogOpen(true);
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteDialogOpen(true);
  };

  const handleEditSubmit = async () => {
    if (!editingEntry) return;
    setEditMessage(null);
    setEditSaving(true);

    const { error } = await supabase
      .from("gospel_share_entries")
      .update({
        entry_date: editingEntry.entry_date,
        number_reached: editingEntry.number_reached,
        church_invite: editingEntry.church_invite,
        spiritual_conversation: editingEntry.spiritual_conversation,
        story_share: editingEntry.story_share,
        gospel_presentation: editingEntry.gospel_presentation,
        gospel_response: editingEntry.gospel_response,
        number_response: editingEntry.gospel_response ? editingEntry.number_response : 0,
        notes: editingEntry.notes?.trim() || null,
      })
      .eq("id", editingEntry.id);

    setEditSaving(false);

    if (error) {
      setEditMessage("Error: " + error.message);
      return;
    }

    setEditDialogOpen(false);
    onUpdate?.();
  };

  const handleDeleteConfirm = async () => {
    setDeleteLoading(true);
    const { error } = await supabase
      .from("gospel_share_entries")
      .delete()
      .eq("id", entry.id);

    setDeleteLoading(false);

    if (error) {
      alert("Error deleting: " + error.message);
      return;
    }

    setDeleteDialogOpen(false);
    onUpdate?.();
  };

  const refreshEntries = async () => {
    onUpdate?.();
  };

  // Card variant (dashboard)
  if (variant === "card") {
    return (
      <>
        <div className="flex flex-col p-4 bg-gray-50 rounded-lg gap-3">
          {/* Top row: Date + Share types + Stats */}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            {/* Date */}
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-gray-400" />
              <span className="text-sm font-medium">
                {new Date(entry.entry_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </span>
            </div>
            
            {/* Share types */}
            <div className="flex flex-wrap gap-2">
              <div className="flex items-center gap-2 px-2 py-1 bg-white rounded-md shadow-sm">
                <Users className="h-4 w-4 text-blue-600" />
                <span className="text-xs text-gray-600">Invite</span>
              </div>
              <div className="flex items-center gap-2 px-2 py-1 bg-white rounded-md shadow-sm">
                <MessageSquare className="h-4 w-4 text-purple-600" />
                <span className="text-xs text-gray-600">Conv</span>
              </div>
              <div className="flex items-center gap-2 px-2 py-1 bg-white rounded-md shadow-sm">
                <BookOpen className="h-4 w-4 text-green-600" />
                <span className="text-xs text-gray-600">Story</span>
              </div>
              <div className="flex items-center gap-2 px-2 py-1 bg-white rounded-md shadow-sm">
                <Cross className="h-4 w-4 text-red-600" />
                <span className="text-xs text-gray-600">Gospel</span>
              </div>
            </div>
            
            {/* Stats */}
            <div className="flex gap-4 text-sm">
              <div className="flex items-center gap-1">
                <span className="text-gray-500">Reached:</span>
                <span className="font-medium">{entry.number_reached}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-gray-500">Response:</span>
                <span className="font-medium">{entry.gospel_response ? entry.number_response : 0}</span>
              </div>
            </div>
          </div>
          
          {/* Notes */}
          <div className="text-sm text-gray-600 italic">
            <p>{entry.notes || <span className="text-gray-400">—</span>}</p>
          </div>
          
          {/* Actions */}
          {showActions && (
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" title="Edit" onClick={handleEditClick}>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </Button>
              <Button variant="ghost" size="icon" title="Delete" onClick={handleDeleteClick}>
                <svg className="h-4 w-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </Button>
            </div>
          )}
        </div>

        {/* Edit Dialog */}
        <Dialog.Root open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
            <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg p-6 z-50 max-w-md w-[90vw] max-h-[90vh] overflow-y-auto">
              <Dialog.Title className="text-lg font-semibold mb-4">Edit Share</Dialog.Title>
              
              {editingEntry && (
                <EditEntryFormContent
                  entry={editingEntry}
                  entryDate={editingEntry.entry_date}
                  numberReached={editingEntry.number_reached}
                  churchInvite={editingEntry.church_invite}
                  spiritualConversation={editingEntry.spiritual_conversation}
                  storyShare={editingEntry.story_share}
                  gospelPresentation={editingEntry.gospel_presentation}
                  gospelResponse={editingEntry.gospel_response}
                  numberResponse={editingEntry.number_response}
                  notes={editingEntry.notes || ""}
                  message={editMessage}
                  saving={editSaving}
                  setEntryDate={(v) => setEditingEntry({ ...editingEntry, entry_date: v })}
                  setNumberReached={(v) => setEditingEntry({ ...editingEntry, number_reached: v })}
                  setChurchInvite={(v) => setEditingEntry({ ...editingEntry, church_invite: v })}
                  setSpiritualConversation={(v) => setEditingEntry({ ...editingEntry, spiritual_conversation: v })}
                  setStoryShare={(v) => setEditingEntry({ ...editingEntry, story_share: v })}
                  setGospelPresentation={(v) => setEditingEntry({ ...editingEntry, gospel_presentation: v })}
                  setGospelResponse={(v) => setEditingEntry({ ...editingEntry, gospel_response: v })}
                  setNumberResponse={(v) => setEditingEntry({ ...editingEntry, number_response: v })}
                  setNotes={(v) => setEditingEntry({ ...editingEntry, notes: v })}
                  setMessage={setEditMessage}
                  onSubmit={handleEditSubmit}
                  onCancel={() => setEditDialogOpen(false)}
                />
              )}

              <Dialog.Close asChild>
                <button className="absolute top-4 right-4 text-gray-400 hover:text-gray-600" aria-label="Close">
                  <X className="h-4 w-4" />
                </button>
              </Dialog.Close>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>

        {/* Delete Dialog */}
        <Dialog.Root open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
            <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg p-6 z-50 max-w-md w-[90vw]">
              <Dialog.Title className="text-lg font-semibold mb-4">Delete Share</Dialog.Title>
              
              <div className="space-y-4">
                <p>Are you sure you want to delete this share record?</p>
                
                <div className="flex gap-2">
                  <Button 
                    onClick={handleDeleteConfirm} 
                    disabled={deleteLoading} 
                    className="flex-1 bg-red-600 hover:bg-red-700"
                  >
                    {deleteLoading ? "Deleting..." : "Delete"}
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => setDeleteDialogOpen(false)} 
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                </div>
              </div>

              <Dialog.Close asChild>
                <button className="absolute top-4 right-4 text-gray-400 hover:text-gray-600" aria-label="Close">
                  <X className="h-4 w-4" />
                </button>
              </Dialog.Close>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </>
    );
  }

  // Row variant (table)
  return (
    <>
      <div className="flex items-start gap-4 p-3 bg-gray-50 rounded">
        {/* Date */}
        <div className="min-w-[80px] text-sm">
          {new Date(entry.entry_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
        </div>
        
        {/* Share types */}
        <div className="flex gap-1 min-w-[180px]">
          {entry.church_invite && <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">Invite</span>}
          {entry.spiritual_conversation && <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">Conv</span>}
          {entry.story_share && <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">Story</span>}
          {entry.gospel_presentation && <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded">Gospel</span>}
        </div>
        
        {/* Reached */}
        <div className="w-[60px] text-sm text-right">{entry.number_reached}</div>
        
        {/* Response */}
        <div className="w-[80px] text-sm text-right">
          {entry.gospel_response ? entry.number_response : "—"}
        </div>
        
        {/* Notes */}
        <div className="flex-1 text-sm text-gray-600 truncate max-w-[200px]">
          {entry.notes || <span className="text-gray-400">—</span>}
        </div>
        
        {/* Actions */}
        {showActions && (
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" title="Edit" onClick={handleEditClick}>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </Button>
            <Button variant="ghost" size="icon" title="Delete" onClick={handleDeleteClick}>
              <svg className="h-4 w-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </Button>
          </div>
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog.Root open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg p-6 z-50 max-w-md w-[90vw] max-h-[90vh] overflow-y-auto">
            <Dialog.Title className="text-lg font-semibold mb-4">Edit Share</Dialog.Title>
            
            {editingEntry && (
              <EditEntryFormContent
                entry={editingEntry}
                entryDate={editingEntry.entry_date}
                numberReached={editingEntry.number_reached}
                churchInvite={editingEntry.church_invite}
                spiritualConversation={editingEntry.spiritual_conversation}
                storyShare={editingEntry.story_share}
                gospelPresentation={editingEntry.gospel_presentation}
                gospelResponse={editingEntry.gospel_response}
                numberResponse={editingEntry.number_response}
                notes={editingEntry.notes || ""}
                message={editMessage}
                saving={editSaving}
                setEntryDate={(v) => setEditingEntry({ ...editingEntry, entry_date: v })}
                setNumberReached={(v) => setEditingEntry({ ...editingEntry, number_reached: v })}
                setChurchInvite={(v) => setEditingEntry({ ...editingEntry, church_invite: v })}
                setSpiritualConversation={(v) => setEditingEntry({ ...editingEntry, spiritual_conversation: v })}
                setStoryShare={(v) => setEditingEntry({ ...editingEntry, story_share: v })}
                setGospelPresentation={(v) => setEditingEntry({ ...editingEntry, gospel_presentation: v })}
                setGospelResponse={(v) => setEditingEntry({ ...editingEntry, gospel_response: v })}
                setNumberResponse={(v) => setEditingEntry({ ...editingEntry, number_response: v })}
                setNotes={(v) => setEditingEntry({ ...editingEntry, notes: v })}
                setMessage={setEditMessage}
                onSubmit={handleEditSubmit}
                onCancel={() => setEditDialogOpen(false)}
              />
            )}

            <Dialog.Close asChild>
              <button className="absolute top-4 right-4 text-gray-400 hover:text-gray-600" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Delete Dialog */}
      <Dialog.Root open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg p-6 z-50 max-w-md w-[90vw]">
            <Dialog.Title className="text-lg font-semibold mb-4">Delete Share</Dialog.Title>
            
            <div className="space-y-4">
              <p>Are you sure you want to delete this share record?</p>
              
              <div className="flex gap-2">
                <Button 
                  onClick={handleDeleteConfirm} 
                  disabled={deleteLoading} 
                  className="flex-1 bg-red-600 hover:bg-red-700"
                >
                  {deleteLoading ? "Deleting..." : "Delete"}
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => setDeleteDialogOpen(false)} 
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </div>

            <Dialog.Close asChild>
              <button className="absolute top-4 right-4 text-gray-400 hover:text-gray-600" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}

// Edit form content (shared between variants)
function EditEntryFormContent({
  entry,
  entryDate,
  numberReached,
  churchInvite,
  spiritualConversation,
  storyShare,
  gospelPresentation,
  gospelResponse,
  numberResponse,
  notes,
  message,
  saving,
  setEntryDate,
  setNumberReached,
  setChurchInvite,
  setSpiritualConversation,
  setStoryShare,
  setGospelPresentation,
  setGospelResponse,
  setNumberResponse,
  setNotes,
  setMessage,
  onSubmit,
  onCancel,
}: {
  entry: Entry;
  entryDate: string;
  numberReached: number;
  churchInvite: boolean;
  spiritualConversation: boolean;
  storyShare: boolean;
  gospelPresentation: boolean;
  gospelResponse: boolean;
  numberResponse: number;
  notes: string;
  message: string | null;
  saving: boolean;
  setEntryDate: (v: string) => void;
  setNumberReached: (v: number) => void;
  setChurchInvite: (v: boolean) => void;
  setSpiritualConversation: (v: boolean) => void;
  setStoryShare: (v: boolean) => void;
  setGospelPresentation: (v: boolean) => void;
  setGospelResponse: (v: boolean) => void;
  setNumberResponse: (v: number) => void;
  setNotes: (v: string) => void;
  setMessage: (v: string | null) => void;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="space-y-4">
      {/* Date */}
      <div className="space-y-2">
        <Label>Date</Label>
        <Input
          type="date"
          value={entryDate}
          onChange={(e) => setEntryDate(e.target.value)}
          disabled={saving}
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
              disabled={saving}
            />
            <span className="text-sm">Invite</span>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              checked={spiritualConversation}
              onCheckedChange={(v) => setSpiritualConversation(!!v)}
              disabled={saving}
            />
            <span className="text-sm">Conversation</span>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              checked={storyShare}
              onCheckedChange={(v) => setStoryShare(!!v)}
              disabled={saving}
            />
            <span className="text-sm">Story</span>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              checked={gospelPresentation}
              onCheckedChange={(v) => setGospelPresentation(!!v)}
              disabled={saving}
            />
            <span className="text-sm">Gospel</span>
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
          disabled={saving}
        />
      </div>

      {/* Gospel Response */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Checkbox
            checked={gospelResponse}
            onCheckedChange={(v) => setGospelResponse(!!v)}
            disabled={saving}
          />
          <Label>Gospel Response?</Label>
        </div>
        {gospelResponse && (
          <Input
            type="number"
            min={1}
            placeholder="How many responded?"
            value={numberResponse}
            onChange={(e) => setNumberResponse(parseInt(e.target.value) || 0)}
            disabled={saving}
          />
        )}
      </div>

      {/* Notes */}
      <div className="space-y-2">
        <Label>Notes</Label>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Tell the story..."
          disabled={saving}
        />
      </div>

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
