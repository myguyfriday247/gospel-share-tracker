"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { errorMessage, reportError } from "@/lib/errors";
import { useCurrentPerson } from "@/hooks/useCurrentPerson";
import { ErrorBanner } from "@/components/ErrorBanner";
import { toCSV, downloadCSV, parseCSVToObjects } from "@/lib/csv";
import { toYMD } from "@/lib/date";
import Header from "@/components/Header";
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
import * as Dialog from "@radix-ui/react-dialog";
import {
  Users,
  FileSpreadsheet,
  Download,
  Upload,
  Search,
  Eye,
  Edit2,
  Trash2,
  ArrowUpDown,
  X,
} from "lucide-react";

type Person = {
  id: string;
  email: string;
  full_name: string;
  created_at: string;
  role?: string;
};

type ActiveSection = "people" | "export" | "import";

export default function AdminPortalPage() {
  const [activeSection, setActiveSection] = useState<ActiveSection>("people");
  const { person: currentPerson } = useCurrentPerson();
  const currentUserId = currentPerson?.id ?? "";
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  // Export state
  const [exportLoading, setExportLoading] = useState(false);
  const [exportType, setExportType] = useState<"people" | "entries" | "all">("all");
  const [exportDateFrom, setExportDateFrom] = useState("");
  const [exportDateTo, setExportDateTo] = useState("");

  // Import state
  const [importLoading, setImportLoading] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<Record<string, string>[]>([]);
  const [importType, setImportType] = useState<"people" | "entries">("entries");

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
  }, [peoplePage, peoplePageSize, peopleSearch, sortColumn, sortDirection, reloadToken]);

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

  // ==================== EXPORT FUNCTIONS ====================
  const handleExport = async () => {
    setExportLoading(true);
    setError(null);
    setNotice(null);
    try {
      let data: Record<string, unknown>[] = [];

      if (exportType === "people" || exportType === "all") {
        const { data: peopleData, error: peopleError } = await supabase
          .from("people").select("*").order("created_at", { ascending: false });
        if (peopleError) throw peopleError;
        if (peopleData) {
          data = exportType === "all"
            ? [...data, ...peopleData.map(p => ({ ...p, _table: "people" }))]
            : peopleData;
        }
      }

      if (exportType === "entries" || exportType === "all") {
        let query = supabase.from("gospel_share_entries").select("*").order("entry_date", { ascending: false });
        if (exportDateFrom) query = query.gte("entry_date", exportDateFrom);
        if (exportDateTo) query = query.lte("entry_date", exportDateTo);
        const { data: entriesData, error: entriesError } = await query;
        if (entriesError) throw entriesError;
        if (entriesData) {
          data = exportType === "all"
            ? [...data, ...entriesData.map(e => ({ ...e, _table: "entries" }))]
            : entriesData;
        }
      }

      if (data.length === 0) {
        setNotice("No data to export for this selection.");
        setExportLoading(false);
        return;
      }

      // Union across all rows: an "all" export mixes people and entries, which have
      // different columns. Reading headers off data[0] alone dropped the other table's fields.
      const headers = [...new Set(data.flatMap((r) => Object.keys(r)))].filter(k => k !== "_table");
      downloadCSV(
        `gospel-share-${exportType}-${toYMD(new Date())}.csv`,
        toCSV(data, headers)
      );
      setNotice(`Exported ${data.length} rows.`);
    } catch (err) {
      reportError("portal: export", err);
      setError(errorMessage(err));
    }
    setExportLoading(false);
  };

  // ==================== IMPORT FUNCTIONS ====================
  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFile(file);
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const rows = parseCSVToObjects(event.target?.result as string);
      if (rows.length === 0) {
        setError("That file has no readable rows. Expected a CSV with a header row.");
        setImportPreview([]);
        return;
      }
      setError(null);
      setImportPreview(rows.slice(0, 5));
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!importFile) {
      setError("Choose a file first.");
      return;
    }

    setImportLoading(true);
    setError(null);
    setNotice(null);
    try {
      const data = parseCSVToObjects(await importFile.text());
      
      // Every row's result is checked. This previously ignored each row's error and then
      // reported `Successfully imported ${data.length} records` unconditionally — so an
      // import where every row failed still claimed success.
      let imported = 0;
      const failures: string[] = [];

      if (importType === "people") {
        for (const [i, row] of data.entries()) {
          if (!row.email) {
            failures.push(`Row ${i + 2}: missing email`);
            continue;
          }
          const { error: upsertError } = await supabase.from("people").upsert({
            email: row.email.toLowerCase(),
            full_name: row.full_name || row.name || "",
          }, { onConflict: "email" });

          if (upsertError) {
            reportError("portal: import person", upsertError);
            failures.push(`Row ${i + 2} (${row.email}): ${upsertError.message}`);
          } else {
            imported++;
          }
        }
      } else if (importType === "entries") {
        for (const [i, row] of data.entries()) {
          if (!row.email) {
            failures.push(`Row ${i + 2}: missing email`);
            continue;
          }
          const { data: person, error: lookupError } = await supabase
            .from("people")
            .select("id")
            .eq("email", row.email.toLowerCase())
            .maybeSingle();

          if (lookupError) {
            reportError("portal: import entry lookup", lookupError);
            failures.push(`Row ${i + 2} (${row.email}): ${lookupError.message}`);
            continue;
          }
          if (!person) {
            failures.push(`Row ${i + 2}: no person with email ${row.email}`);
            continue;
          }

          const { error: insertError } = await supabase.from("gospel_share_entries").insert({
            person_id: person.id,
            entry_date: row.entry_date,
            number_reached: parseInt(row.number_reached) || 0,
            church_invite: row.church_invite === "true",
            spiritual_conversation: row.spiritual_conversation === "true",
            story_share: row.story_share === "true",
            gospel_presentation: row.gospel_presentation === "true",
            gospel_response: row.gospel_response === "true",
            number_response: parseInt(row.number_response) || 0,
            notes: row.notes || null,
          });

          if (insertError) {
            reportError("portal: import entry", insertError);
            failures.push(`Row ${i + 2} (${row.email}): ${insertError.message}`);
          } else {
            imported++;
          }
        }
      }

      setNotice(`Imported ${imported} of ${data.length} rows.`);
      if (failures.length > 0) {
        setError(
          `${failures.length} row(s) failed:\n` +
          failures.slice(0, 10).join("\n") +
          (failures.length > 10 ? `\n…and ${failures.length - 10} more.` : "")
        );
      }
      setImportFile(null);
      setImportPreview([]);
      setReloadToken((t) => t + 1);
    } catch (err) {
      reportError("portal: import", err);
      setError(errorMessage(err));
    }
    setImportLoading(false);
  };

  return (
    <>
      <Header currentPage="portal" />
      
      <div className="container mx-auto py-6 px-4">
        {/* Failures and outcomes, replacing the alert() dialogs this page used to use */}
        {notice && (
          <div
            role="status"
            className="mb-4 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800"
          >
            {notice}
          </div>
        )}
        <div className="mb-4">
          <ErrorBanner
            message={error}
            title="Something didn't complete."
            onRetry={() => {
              setError(null);
              setReloadToken((t) => t + 1);
            }}
          />
        </div>

        {/* Admin Tools Cards */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-8">
          {/* Manage People & Users */}
          <Card
            className={`cursor-pointer transition-colors h-full ${
              activeSection === "people" ? "ring-2 ring-blue-500 bg-blue-50" : "hover:bg-gray-50"
            }`}
            onClick={() => setActiveSection("people")}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <Users className="h-6 w-6 text-blue-600" /> People on Mission
              </CardTitle>
            </CardHeader>
            <CardContent className="text-gray-600">
              <p>View and manage all people records and user accounts. Link users to people, promote to admin, and manage access.</p>
            </CardContent>
          </Card>

          {/* Export Data */}
          <Card
            className={`cursor-pointer transition-colors h-full ${
              activeSection === "export" ? "ring-2 ring-green-500 bg-green-50" : "hover:bg-gray-50"
            }`}
            onClick={() => setActiveSection("export")}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <FileSpreadsheet className="h-6 w-6 text-green-600" /> Export Data
              </CardTitle>
            </CardHeader>
            <CardContent className="text-gray-600">
              <p>Export people and entries to CSV for analysis. Download all data or filter by date range.</p>
            </CardContent>
          </Card>

          {/* Import Data */}
          <Card
            className={`cursor-pointer transition-colors h-full ${
              activeSection === "import" ? "ring-2 ring-purple-500 bg-purple-50" : "hover:bg-gray-50"
            }`}
            onClick={() => setActiveSection("import")}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <Upload className="h-6 w-6 text-purple-600" /> Import Data
              </CardTitle>
            </CardHeader>
            <CardContent className="text-gray-600">
              <p>Import people and entries from CSV files. Preview data before importing and handle errors gracefully.</p>
            </CardContent>
          </Card>
        </div>

        {/* People Table */}
        {activeSection === "people" && (
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
        )}

        {/* Export Section */}
        {activeSection === "export" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="h-5 w-5" /> Export Data
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Export Type</Label>
                  <Select value={exportType} onValueChange={(v: "people" | "entries" | "all") => setExportType(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Data</SelectItem>
                      <SelectItem value="people">People Only</SelectItem>
                      <SelectItem value="entries">Entries Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label>Date From</Label>
                  <Input type="date" value={exportDateFrom} onChange={(e) => setExportDateFrom(e.target.value)} />
                </div>
                
                <div className="space-y-2">
                  <Label>Date To</Label>
                  <Input type="date" value={exportDateTo} onChange={(e) => setExportDateTo(e.target.value)} />
                </div>
              </div>
              
              <Button onClick={handleExport} disabled={exportLoading} className="flex items-center gap-2">
                {exportLoading ? "Exporting..." : <><Download className="h-4 w-4" /> Export to CSV</>}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Import Section */}
        {activeSection === "import" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" /> Import Data
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Import Type</Label>
                <Select value={importType} onValueChange={(v: "people" | "entries") => setImportType(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="entries">Entries (CSV with email column)</SelectItem>
                    <SelectItem value="people">People (CSV with email and full_name)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Select CSV File</Label>
                <Input type="file" accept=".csv" onChange={handleImportFile} />
              </div>
              
              {importPreview.length > 0 && (
                <div className="space-y-2">
                  <Label>Preview (first 5 rows)</Label>
                  <div className="overflow-x-auto border rounded-md">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          {Object.keys(importPreview[0]).map(h => (
                            <th key={h} className="px-3 py-2 font-medium text-gray-600">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {importPreview.map((row, i) => (
                          <tr key={i} className="border-t">
                            {Object.values(row).map((v, j) => (
                              <td key={j} className="px-3 py-2">{v}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              
              <Button onClick={handleImport} disabled={importLoading || !importFile} className="flex items-center gap-2">
                {importLoading ? "Importing..." : <><Upload className="h-4 w-4" /> Import Data</>}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Edit Person Dialog */}
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
    </>
  );
}
