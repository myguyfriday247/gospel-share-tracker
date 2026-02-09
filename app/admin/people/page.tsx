"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import Header from "@/components/Header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Eye,
  Edit2,
  ArrowUpDown,
  Search,
  Loader2,
} from "lucide-react";
import { Person } from "@/lib/types";
import { Pagination } from "@/components/ui/Pagination";
import { SortableHeader } from "@/components/ui/SortableHeader";

export default function AdminPeoplePage() {
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [sortColumn, setSortColumn] = useState("created_at");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const router = useRouter();

  const totalPages = Math.ceil(totalCount / pageSize);

  useEffect(() => {
    async function fetchPeople() {
      setLoading(true);
      
      // Get total count
      let countQuery = supabase.from("people").select("*", { count: "exact", head: true });
      if (search) {
        countQuery = countQuery.ilike("full_name", `%${search}%`);
      }
      const { count } = await countQuery;
      setTotalCount(count || 0);

      // Get paginated data
      let query = supabase
        .from("people")
        .select("*")
        .order(sortColumn, { ascending: sortDirection === "asc" })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (search) {
        query = query.ilike("full_name", `%${search}%`);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error fetching people:", error);
      } else {
        setPeople(data || []);
      }

      setLoading(false);
    }

    fetchPeople();
  }, [page, pageSize, search, sortColumn, sortDirection]);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setPage(0);
  };

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const handleToggleRole = async (personId: string, currentRole: string) => {
    const newRole = currentRole === "admin" ? "user" : "admin";
    const { error } = await supabase
      .from("people")
      .update({ role: newRole })
      .eq("id", personId);

    if (!error) {
      setPeople(people.map(p => 
        p.id === personId ? { ...p, role: newRole } : p
      ));
    }
  };

  const formatName = (name: string) => {
    return name
      .split(" ")
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");
  };

  return (
    <>
      <Header currentPage="people" />
      
      <div className="container mx-auto py-6 px-4">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-semibold">People on Mission</h2>
          <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search people..."
              value={search}
              onChange={handleSearch}
              className="pl-9 max-w-xs"
            />
          </div>
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
      </div>
      </div>

      <div className="bg-white rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[200px]">
                <SortableHeader
                  label="Name"
                  column="full_name"
                  currentColumn={sortColumn}
                  direction={sortDirection}
                  onSort={handleSort}
                />
              </TableHead>
              <TableHead>Email</TableHead>
              <TableHead className="w-[150px]">
                <SortableHeader
                  label="Created"
                  column="created_at"
                  currentColumn={sortColumn}
                  direction={sortDirection}
                  onSort={handleSort}
                />
              </TableHead>
              <TableHead className="w-[100px]">Role</TableHead>
              <TableHead className="w-[120px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8">
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading...
                  </div>
                </TableCell>
              </TableRow>
            ) : people.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8">
                  No people found
                </TableCell>
              </TableRow>
            ) : (
              people.map((person) => (
                <TableRow key={person.id}>
                  <TableCell className="font-medium">
                    {formatName(person.full_name)}
                  </TableCell>
                  <TableCell>{person.email}</TableCell>
                  <TableCell>
                    {new Date(person.created_at).toLocaleDateString()}
                  </TableCell>
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
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => router.push(`/admin/people/${person.id}`)}
                        title="View"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => handleToggleRole(person.id, person.role || "user")}
                        title={person.role === "admin" ? "Demote to User" : "Promote to Admin"}
                      >
                        <ArrowUpDown className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => router.push(`/admin/people/${person.id}`)}
                        title="Edit"
                      >
                        <Edit2 className="h-4 w-4" />
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
          Showing {people.length} of {totalCount} people
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(0)}
            disabled={page === 0}
          >
            First
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
          >
            Previous
          </Button>
          <span className="text-sm px-2">
            Page {totalPages > 0 ? page + 1 : 0} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1 || people.length < pageSize}
          >
            Next
          </Button>
        </div>
      </div>

      {/* Pagination */}
      <div className="flex justify-between items-center mt-4">
        <span className="text-sm text-gray-600">
          Showing {people.length} of {totalCount} people
        </span>
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          onPageChange={setPage}
        />
      </div>
    </>
  );
}
