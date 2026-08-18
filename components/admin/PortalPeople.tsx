// ==========================================
// PORTAL / PEOPLE - list, edit, role, delete
// ==========================================
//
// Split out of app/admin/portal/page.tsx. Owns its own loading, error and dialog state.

"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { errorMessage, reportError } from "@/lib/errors";
import * as Dialog from "@radix-ui/react-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, Eye, Edit2, Trash2, ArrowUpDown } from "lucide-react";
import { ErrorBanner } from "@/components/ErrorBanner";
import type { Person } from "@/lib/types";

interface PortalPeopleProps {
  /** Bumped by the parent (e.g. after an import) to force a reload. */
  reloadSignal?: number;
}

export function PortalPeople({ reloadSignal = 0 }: PortalPeopleProps) {
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  // People table state
  const [people, setPeople] = useState<Person[]>([]);
  const [peopleLoading, setPeopleLoading] = useState(true);
  const [peoplePage, setPeoplePage] = useState(0);
  const [peoplePageSize, setPeoplePageSize] = useState(10);
  const [peopleTotal, setPeopleTotal] = useState(0);
  const [peopleSearch, setPeopleSearch] = useState("");
  const [sortColumn, setSortColumn] = useState("created_at");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [editMessage, setEditMessage] = useState<string | null>(null);

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingPerson, setDeletingPerson] = useState<Person | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    let active = true;

    async function fetchPeople() {
      let query = supabase
        .from("people")
        .select("*", { count: "exact" })
        .order(sortColumn, { ascending: sortDirection === "asc" });

      if (peopleSearch) {
        query = query.ilike("full_name", `%${peopleSearch}%`);
      }

      const from = peoplePage * peoplePageSize;
      const to = from + peoplePageSize - 1;
      query = query.range(from, to);

      const { data, error: fetchError, count } = await query;

      if (!active) return;
      setPeopleLoading(false);

      if (fetchError) {
        reportError("portal: load people", fetchError);
        setError(errorMessage(fetchError));
        return;
      }

      // Roles come straight from people.role. This previously called
      // supabase.auth.admin.getUserById() once per row to read user_metadata.role — an
      // endpoint that needs the service role key, so with the browser's anon key every one
      // of those returned 401 (measured: 10 failed requests per page load). The result was
      // discarded and it fell back to person.role anyway. user_metadata is also
      // user-writable, so it must not decide a role in the first place.
      setError(null);
      setPeople(data || []);
      setPeopleTotal(count || 0);
    }

    fetchPeople();
    return () => {
      active = false;
    };
  }, [peoplePage, peoplePageSize, peopleSearch, sortColumn, sortDirection, reloadToken, reloadSignal]);

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const formatName = (name: string) => {
    return name
      .split(" ")
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");
  };

  // Edit functions
  const openEditDialog = (person: Person) => {
    setEditingPerson(person);
    setEditName(person.full_name);
    setEditEmail(person.email);
    setEditMessage(null);
    setEditDialogOpen(true);
  };

  const handleEditSubmit = async () => {
    if (!editingPerson) return;
    setEditSaving(true);
    setEditMessage(null);

    const { error } = await supabase
      .from("people")
      .update({ 
        full_name: editName,
        email: editEmail.toLowerCase()
      })
      .eq("id", editingPerson.id);

    setEditSaving(false);

    if (error) {
      setEditMessage("Error: " + error.message);
      return;
    }

    setEditDialogOpen(false);
    setReloadToken((t) => t + 1);
  };

  const handleToggleRole = async (person: Person) => {
    const newRole = person.role === "admin" ? "user" : "admin";
    const { error: roleError } = await supabase
      .from("people")
      .update({ role: newRole })
      .eq("id", person.id);

    if (roleError) {
      reportError("portal: toggle role", roleError);
      setError(errorMessage(roleError));
      return;
    }

    setError(null);
    setPeople(people.map(p =>
      p.id === person.id ? { ...p, role: newRole } : p
    ));
  };

  const openDeleteDialog = (person: Person) => {
    setDeletingPerson(person);
    setDeleteDialogOpen(true);
  };

  const handleDeletePerson = async () => {
    if (!deletingPerson) return;
    setDeleteLoading(true);

    const { error: deleteError } = await supabase
      .from("people")
      .delete()
      .eq("id", deletingPerson.id);

    setDeleteLoading(false);
    setDeleteDialogOpen(false);

    if (deleteError) {
      reportError("portal: delete person", deleteError);
      setError(errorMessage(deleteError));
      return;
    }

    setError(null);
    setPeople(people.filter(p => p.id !== deletingPerson.id));
  };

  const totalPages = Math.ceil(peopleTotal / peoplePageSize);

  return (
    <div className="space-y-4">
      <ErrorBanner
        message={error}
        title="Something didn&apos;t complete."
        onRetry={() => {
          setError(null);
          setReloadToken((t) => t + 1);
        }}
      />
        <Card>
          <CardHeader>
            <CardTitle>People on Mission</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex justify-end mb-4">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search people..."
                    value={peopleSearch}
                    onChange={(e) => { setPeopleSearch(e.target.value); setPeoplePage(0); }}
                    className="pl-9 max-w-xs"
                  />
                </div>
                <Select value={String(peoplePageSize)} onValueChange={(v) => { setPeoplePageSize(Number(v)); setPeoplePage(0); }}>
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
            </div>
            
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead 
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() => handleSort("full_name")}
                    >
                      Name {sortColumn === "full_name" && (sortDirection === "asc" ? "↑" : "↓")}
                    </TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() => handleSort("created_at")}
                    >
                      Created {sortColumn === "created_at" && (sortDirection === "asc" ? "↑" : "↓")}
                    </TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {peopleLoading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8">Loading...</TableCell>
                    </TableRow>
                  ) : people.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8">No people found</TableCell>
                    </TableRow>
                  ) : (
                    people.map((person) => (
                      <TableRow key={person.id}>
                        <TableCell className="font-medium">{formatName(person.full_name)}</TableCell>
                        <TableCell>{person.email}</TableCell>
                        <TableCell>{new Date(person.created_at).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            person.role === "admin" 
                              ? "bg-purple-100 text-purple-700" 
                              : "bg-gray-100 text-gray-700"
                          }`}>
                            {person.role || "user"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => window.location.href = `/admin/people/${person.id}`}
                              title="View People Page"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => openEditDialog(person)}
                              title="Edit"
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => handleToggleRole(person)}
                              title={person.role === "admin" ? "Demote to User" : "Promote to Admin"}
                            >
                              <ArrowUpDown className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => openDeleteDialog(person)}
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            <div className="flex justify-between items-center mt-4">
              <span className="text-sm text-gray-600">
                Showing {people.length} of {peopleTotal} people
              </span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setPeoplePage(0)} disabled={peoplePage === 0}>First</Button>
                <Button variant="outline" size="sm" onClick={() => setPeoplePage((p) => Math.max(0, p - 1))} disabled={peoplePage === 0}>Previous</Button>
                <span className="text-sm px-2">Page {totalPages > 0 ? peoplePage + 1 : 0} of {totalPages}</span>
                <Button variant="outline" size="sm" onClick={() => setPeoplePage((p) => Math.min(totalPages - 1, p + 1))} disabled={peoplePage >= totalPages - 1 || people.length < peoplePageSize}>Next</Button>
                <Button variant="outline" size="sm" onClick={() => setPeoplePage(totalPages - 1)} disabled={peoplePage >= totalPages - 1 || people.length < peoplePageSize}>Last</Button>
              </div>
            </div>
          </CardContent>
        </Card>

      <Dialog.Root open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg p-6 z-50 max-w-md w-[90vw]">
            <Dialog.Title className="text-lg font-semibold mb-4">Edit Person</Dialog.Title>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Full Name</Label>
                <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
              </div>
              
              {editMessage && <p className="text-sm text-center text-red-500">{editMessage}</p>}

              <Button onClick={handleEditSubmit} disabled={editSaving} className="w-full">
                {editSaving ? "Saving..." : "Submit"}
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
            <Dialog.Title className="text-lg font-semibold mb-4">Delete Person</Dialog.Title>
            
            <div className="space-y-4">
              <p>Are you sure you want to delete <strong>{deletingPerson ? formatName(deletingPerson.full_name) : ""}</strong> from records?</p>
              
              <div className="flex gap-2">
                <Button onClick={handleDeletePerson} disabled={deleteLoading} className="flex-1 bg-red-600 hover:bg-red-700">
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
    </div>
  );
}
