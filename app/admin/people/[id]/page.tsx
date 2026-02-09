"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import * as Dialog from "@radix-ui/react-dialog";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Pagination } from "@/components/ui/Pagination";
import {
  Plus,
  Calendar,
  Users,
  MessageSquare,
  BookOpen,
  Cross,
  Settings,
  Edit2,
  Trash2,
  Eye,
  Loader2,
} from "lucide-react";
import { ShareForm } from "@/components/forms/ShareForm";
import { PersonEditForm } from "@/components/forms/PersonEditForm";
import { EntryRecord } from "@/components/EntryRecord";
import { Person, Entry } from "@/lib/types";

export default function PersonDetailPage() {
  const params = useParams();
  const router = useRouter();
  const personId = params.id as string;

  const [person, setPerson] = useState<Person | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  
  // Pagination state
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  // Pagination calculations
  const totalPages = Math.ceil(entries.length / pageSize);
  const paginatedEntries = entries.slice(page * pageSize, (page + 1) * pageSize);

  // Reset page when entries change
  useEffect(() => {
    if (page >= totalPages && totalPages > 0) {
      setPage(totalPages - 1);
    }
  }, [entries.length, page, totalPages]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string>("");

  // Form state
  const [message, setMessage] = useState<string | null>(null);

  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<Entry | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editNumberReached, setEditNumberReached] = useState(0);
  const [editChurchInvite, setEditChurchInvite] = useState(false);
  const [editSpiritualConversation, setEditSpiritualConversation] = useState(false);
  const [editStoryShare, setEditStoryShare] = useState(false);
  const [editGospelPresentation, setEditGospelPresentation] = useState(false);
  const [editGospelResponse, setEditGospelResponse] = useState(false);
  const [editNumberResponse, setEditNumberResponse] = useState(0);
  const [editNotes, setEditNotes] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [editMessage, setEditMessage] = useState<string | null>(null);

  // Person edit dialog state
  const [personEditOpen, setPersonEditOpen] = useState(false);

  // View dialog state
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewingEntry, setViewingEntry] = useState<Entry | null>(null);

  const openViewDialog = (entry: Entry) => {
    setViewingEntry(entry);
    setViewDialogOpen(true);
  };

  useEffect(() => {
    async function fetchData() {
      // Get current user
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        // Try by ID first
        const { data: currentPerson } = await supabase
          .from("people")
          .select("id")
          .eq("id", session.user.id)
          .single();

        if (currentPerson) {
          setCurrentUserId(currentPerson.id);
        } else {
          // Try by email
          const { data: currentPersonByEmail } = await supabase
            .from("people")
            .select("id")
            .eq("email", session.user.email)
            .single();
          if (currentPersonByEmail) {
            setCurrentUserId(currentPersonByEmail.id);
          }
        }
      }

      // Fetch person by ID first
      let { data: personData } = await supabase
        .from("people")
        .select("*")
        .eq("id", personId)
        .single();

      // If not found by ID, try by email
      if (!personData && session?.user) {
        const { data: personByEmail } = await supabase
          .from("people")
          .select("*")
          .eq("email", session.user.email)
          .single();
        personData = personByEmail;
      }

      if (personData) {
        setPerson(personData);
      }

      // Fetch entries for this person
      const { data: entriesData } = await supabase
        .from("gospel_share_entries")
        .select("*")
        .eq("person_id", personData?.id || personId)
        .order("entry_date", { ascending: false });

      if (entriesData) {
        setEntries(entriesData);
      }

      setLoading(false);
    }

    fetchData();
  }, [personId]);

  const formatName = (name: string) => {
    return name
      .split(" ")
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");
  };

  const truncateNotes = (text: string | null) => {
    if (!text) return "-";
    return text.length > 20 ? text.slice(0, 20) + "..." : text;
  };

  const openEditDialog = (entry: Entry) => {
    setEditingEntry(entry);
    setEditDate(entry.entry_date);
    setEditNumberReached(entry.number_reached);
    setEditChurchInvite(entry.church_invite);
    setEditSpiritualConversation(entry.spiritual_conversation);
    setEditStoryShare(entry.story_share);
    setEditGospelPresentation(entry.gospel_presentation);
    setEditGospelResponse(entry.gospel_response);
    setEditNumberResponse(entry.number_response);
    setEditNotes(entry.notes || "");
    setEditDialogOpen(true);
  };

  const handleEditSubmit = async () => {
    if (!editingEntry) return;
    
    setEditMessage(null);

    const { error } = await supabase
      .from("gospel_share_entries")
      .update({
        entry_date: editDate,
        number_reached: editNumberReached,
        church_invite: editChurchInvite,
        spiritual_conversation: editSpiritualConversation,
        story_share: editStoryShare,
        gospel_presentation: editGospelPresentation,
        gospel_response: editGospelResponse,
        number_response: editGospelResponse ? editNumberResponse : 0,
        notes: editNotes.trim() || null,
      })
      .eq("id", editingEntry.id);

    if (error) {
      setEditMessage(error.message);
      return;
    }

    // Refresh entries
    const { data: entriesData } = await supabase
      .from("gospel_share_entries")
      .select("*")
      .eq("person_id", personId)
      .order("entry_date", { ascending: false });

    if (entriesData) {
      setEntries(entriesData);
    }

    setEditDialogOpen(false);
    setMessage("Entry updated!");
  };

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingEntry, setDeletingEntry] = useState<Entry | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const openDeleteDialog = (entry: Entry) => {
    setDeletingEntry(entry);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingEntry) return;
    setDeleteLoading(true);

    const { error } = await supabase
      .from("gospel_share_entries")
      .delete()
      .eq("id", deletingEntry.id);

    setDeleteLoading(false);

    if (error) {
      alert("Error deleting: " + error.message);
      return;
    }

    setDeleteDialogOpen(false);
    setEntries(entries.filter(e => e.id !== deletingEntry.id));
    setMessage("Entry deleted!");
  };

  if (loading) {
    return (
      <>
        <Header currentPage="person" />
        <div className="p-6 text-center">Loading...</div>
      </>
    );
  }

  if (!person) {
    return (
      <>
        <Header currentPage="person" />
        <div className="p-6">
          <div className="mt-4">Person not found</div>
        </div>
      </>
    );
  }

  return (
    <>
      <Header currentPage="person" />
      
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        {/* Person Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-2xl font-semibold">{formatName(person.full_name)}</h1>
              <p className="text-gray-500">{person.email}</p>
            </div>
          </div>
          {/* Buttons */}
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setPersonEditOpen(true)}>
              <Edit2 className="mr-2 h-4 w-4" /> Edit
            </Button>
            {currentUserId !== personId && (
              <Button variant="outline" onClick={() => router.push(`/dashboard?person=${personId}`)}>
                <Calendar className="mr-2 h-4 w-4" /> View Their Dashboard
              </Button>
            )}
          </div>
        </div>


      {/* Create Entry Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" /> Add a Share
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ShareForm 
            personId={personId}
            onSuccess={async () => {
              // Refresh entries
              const { data: entriesData } = await supabase
                .from("gospel_share_entries")
                .select("*")
                .eq("person_id", personId)
                .order("entry_date", { ascending: false });

              if (entriesData) {
                setEntries(entriesData);
              }
            }}
            onError={(msg) => setMessage(msg)}
            submitLabel="Add Share"
          />
        </CardContent>
      </Card>

      {/* Entry History */}
      <Card>
        <CardHeader>
          <CardTitle>Share History</CardTitle>
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <p className="text-gray-500">No entries yet</p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Shared</TableHead>
                    <TableHead>Reached</TableHead>
                    <TableHead>Response</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedEntries.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell>{new Date(entry.entry_date).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {entry.church_invite && <span className="text-xs bg-blue-100 px-1 rounded">Invite</span>}
                          {entry.spiritual_conversation && <span className="text-xs bg-purple-100 px-1 rounded">Conv</span>}
                          {entry.story_share && <span className="text-xs bg-green-100 px-1 rounded">Story</span>}
                          {entry.gospel_presentation && <span className="text-xs bg-red-100 px-1 rounded">Gospel</span>}
                        </div>
                      </TableCell>
                      <TableCell>{entry.number_reached}</TableCell>
                      <TableCell>
                        {entry.gospel_response ? `${entry.number_response} responded` : "-"}
                      </TableCell>
                      <TableCell>{truncateNotes(entry.notes)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button variant="ghost" size="icon" title="View" onClick={() => openViewDialog(entry)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" title="Edit" onClick={() => openEditDialog(entry)}>
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" title="Delete" onClick={() => openDeleteDialog(entry)}>
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              <div className="flex justify-between items-center mt-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">Rows:</span>
                  <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(0); }}>
                    <SelectTrigger className="w-20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="25">25</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setPage(0)} disabled={page === 0}>
                    First
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>
                    Previous
                  </Button>
                  <span className="text-sm">
                    {entries.length > 0 ? page + 1 : 0} of {totalPages || 1}
                  </span>
                  <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}>
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Person Edit Dialog */}
      <Dialog.Root open={personEditOpen} onOpenChange={setPersonEditOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg p-6 z-50 max-w-md w-[90vw]">
            <Dialog.Title className="text-lg font-semibold mb-4">Edit Person</Dialog.Title>
            
            {person && (
              <PersonEditForm
                person={person}
                onSuccess={() => {
                  setPersonEditOpen(false);
                }}
                onCancel={() => setPersonEditOpen(false)}
              />
            )}

            <Dialog.Close asChild>
              <button className="absolute top-4 right-4 text-gray-400 hover:text-gray-600" aria-label="Close">
                ✕
              </button>
            </Dialog.Close>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Edit Dialog */}
      <Dialog.Root open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg p-6 z-50 max-w-md max-h-[90vh] overflow-y-auto w-[90vw]">
            <Dialog.Title className="text-lg font-semibold mb-4">Edit Share</Dialog.Title>
            
            <div className="space-y-4">
              {/* Date */}
              <div className="space-y-2">
                <Label>Date</Label>
                <Input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} />
              </div>

              {/* Share Types */}
              <div className="space-y-2">
                <Label>How Was the Gospel Shared?</Label>
                <div className="flex flex-wrap gap-4">
                  <div className="flex items-center gap-2">
                    <Checkbox checked={editChurchInvite} onCheckedChange={(v) => setEditChurchInvite(!!v)} />
                    <span className="text-sm">Invite</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox checked={editSpiritualConversation} onCheckedChange={(v) => setEditSpiritualConversation(!!v)} />
                    <span className="text-sm">Conversation</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox checked={editStoryShare} onCheckedChange={(v) => setEditStoryShare(!!v)} />
                    <span className="text-sm">Story</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox checked={editGospelPresentation} onCheckedChange={(v) => setEditGospelPresentation(!!v)} />
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
                  value={editNumberReached}
                  onChange={(e) => setEditNumberReached(parseInt(e.target.value) || 0)}
                />
              </div>

              {/* Gospel Response */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Checkbox checked={editGospelResponse} onCheckedChange={(v) => setEditGospelResponse(!!v)} />
                  <Label>Gospel Response?</Label>
                </div>
                {editGospelResponse && (
                  <Input
                    type="number"
                    min={1}
                    placeholder="How many responded?"
                    value={editNumberResponse}
                    onChange={(e) => setEditNumberResponse(parseInt(e.target.value) || 0)}
                  />
                )}
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Tell the story..."
                />
              </div>

              {editMessage && <p className="text-sm text-center text-red-500">{editMessage}</p>}

              <Button onClick={handleEditSubmit} disabled={editSaving} className="w-full">
                {editSaving ? "Saving..." : "Save Changes"}
              </Button>
            </div>

            <Dialog.Close asChild>
              <button className="absolute top-4 right-4 text-gray-400 hover:text-gray-600" aria-label="Close">
                ✕
              </button>
            </Dialog.Close>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Delete Confirmation Dialog */}
      <Dialog.Root open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg p-6 z-50 max-w-md w-[90vw]">
            <Dialog.Title className="text-lg font-semibold mb-4">Delete Share</Dialog.Title>
            
            <div className="space-y-4">
              <p>Are you sure you want to delete this share record?</p>
              
              <div className="flex gap-2">
                <Button onClick={handleDeleteConfirm} disabled={deleteLoading} className="flex-1 bg-red-600 hover:bg-red-700">
                  {deleteLoading ? "Deleting..." : "Delete"}
                </Button>
                <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} className="flex-1">
                  Cancel
                </Button>
              </div>
            </div>

            <Dialog.Close asChild>
              <button className="absolute top-4 right-4 text-gray-400 hover:text-gray-600" aria-label="Close">
                ✕
              </button>
            </Dialog.Close>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* View Dialog */}
      <Dialog.Root open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg p-6 z-50 w-[80vw] max-w-4xl max-h-[90vh] overflow-y-auto">
            <Dialog.Title className="text-lg font-semibold mb-4">Share Details</Dialog.Title>
            
            {viewingEntry && (
              <EntryRecord
                entry={viewingEntry}
                onUpdate={() => {
                  // Refresh entries when edited/deleted
                  const refresh = async () => {
                    const { data } = await supabase
                      .from("gospel_share_entries")
                      .select("*")
                      .eq("person_id", personId)
                      .order("entry_date", { ascending: false });
                    if (data) setEntries(data as Entry[]);
                  };
                  refresh();
                }}
              />
            )}

            <Dialog.Close asChild>
              <button className="absolute top-4 right-4 text-gray-400 hover:text-gray-600" aria-label="Close">
                ✕
              </button>
            </Dialog.Close>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      </div>
    </>
  );
}
