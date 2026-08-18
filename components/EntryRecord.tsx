// ==========================================
// ENTRY RECORD - Reusable share entry display
// ==========================================

"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { Entry } from "@/lib/types";
import { formatYMD } from "@/lib/date";
import { supabase } from "@/lib/supabaseClient";
import { errorMessage, reportError } from "@/lib/errors";
import { EditEntryFormContent } from "@/components/forms/EditEntryFormContent";
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
  const [deleteMessage, setDeleteMessage] = useState<string | null>(null);

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

    // The add form has always required at least one share type; this path did not, so an
    // edit could clear all four and save an entry that records nothing.
    if (
      !editingEntry.church_invite &&
      !editingEntry.spiritual_conversation &&
      !editingEntry.story_share &&
      !editingEntry.gospel_presentation
    ) {
      setEditMessage("Please select at least one way the gospel was shared.");
      return;
    }

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
    setDeleteMessage(null);
    const { error: deleteError } = await supabase
      .from("gospel_share_entries")
      .delete()
      .eq("id", entry.id);

    setDeleteLoading(false);

    if (deleteError) {
      reportError("entry: delete", deleteError);
      setDeleteMessage(errorMessage(deleteError));
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
                {formatYMD(entry.entry_date)}
              </span>
            </div>
            
            {/* Share types — only the ones actually recorded. These pills used to render
                unconditionally, so every card claimed all four regardless of the entry. The
                row variant below has always guarded them; this now matches. */}
            <div className="flex flex-wrap gap-2">
              {entry.church_invite && (
                <div className="flex items-center gap-2 px-2 py-1 bg-white rounded-md shadow-sm">
                  <Users className="h-4 w-4 text-blue-600" />
                  <span className="text-xs text-gray-600">Invite</span>
                </div>
              )}
              {entry.spiritual_conversation && (
                <div className="flex items-center gap-2 px-2 py-1 bg-white rounded-md shadow-sm">
                  <MessageSquare className="h-4 w-4 text-purple-600" />
                  <span className="text-xs text-gray-600">Conv</span>
                </div>
              )}
              {entry.story_share && (
                <div className="flex items-center gap-2 px-2 py-1 bg-white rounded-md shadow-sm">
                  <BookOpen className="h-4 w-4 text-green-600" />
                  <span className="text-xs text-gray-600">Story</span>
                </div>
              )}
              {entry.gospel_presentation && (
                <div className="flex items-center gap-2 px-2 py-1 bg-white rounded-md shadow-sm">
                  <Cross className="h-4 w-4 text-red-600" />
                  <span className="text-xs text-gray-600">Gospel</span>
                </div>
              )}
              {!entry.church_invite &&
                !entry.spiritual_conversation &&
                !entry.story_share &&
                !entry.gospel_presentation && (
                  <span className="text-xs text-gray-400">—</span>
                )}
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
                {deleteMessage && (
                  <p className="text-sm text-red-600" role="alert">{deleteMessage}</p>
                )}
                
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
          {formatYMD(entry.entry_date)}
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
              {deleteMessage && (
                <p className="text-sm text-red-600" role="alert">{deleteMessage}</p>
              )}
              
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
