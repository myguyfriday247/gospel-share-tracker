"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabaseClient";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  Users,
  MessageSquare,
  BookOpen,
  Cross,
} from "lucide-react";
import { DateRangeSelector } from "@/components/ui/DateRangeSelector";
import { Pagination } from "@/components/ui/Pagination";
import { SortableHeader } from "@/components/ui/SortableHeader";
import { getDateRange } from "@/lib/date";
import { RangeKey, UserAgg, OverallAgg, formatDisplayName } from "@/lib/types";

export default function AdminDashboard() {
  const [range, setRange] = useState<RangeKey>("this_week");
  const [overall, setOverall] = useState<OverallAgg>({
    unique_users: 0,
    entries: 0,
    total_reached: 0,
    total_responses: 0,
    invites_reached: 0,
    conversations_reached: 0,
    story_share_reached: 0,
    gospel_share_reached: 0,
  });
  const [byUser, setByUser] = useState<UserAgg[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [nameMap, setNameMap] = useState<Record<string, string>>({});

  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortColumn, setSortColumn] = useState<keyof UserAgg>("total_reached");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  // Pagination calculations
  const totalPages = Math.ceil(byUser.length / pageSize);
  const startIdx = (page - 1) * pageSize;

  // Sorting
  const handleSort = (column: keyof UserAgg) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("desc");
    }
  };

  // Sort and paginate data
  const sortedAndPaginatedByUser = useMemo(() => {
    return [...byUser]
      .sort((a, b) => {
        const aVal = a[sortColumn] ?? 0;
        const bVal = b[sortColumn] ?? 0;
        if (typeof aVal === "string" && typeof bVal === "string") {
          return sortDirection === "asc" 
            ? aVal.localeCompare(bVal) 
            : bVal.localeCompare(aVal);
        }
        return sortDirection === "asc" 
          ? (aVal as number) - (bVal as number) 
          : (bVal as number) - (aVal as number);
      })
      .slice(startIdx, startIdx + pageSize);
  }, [byUser, sortColumn, sortDirection, pageSize, startIdx]);

  // Reset page when range changes
  useEffect(() => {
    setPage(1);
  }, [range]);

  const rangeInfo = useMemo(() => getDateRange(range), [range]);

  // Fetch person names map (person_id -> person_name)
  useEffect(() => {
    async function fetchNames() {
      const { data: people } = await supabase.from("people").select("id, full_name");
      
      if (people) {
        const personMap: Record<string, string> = {};
        people.forEach((p) => {
          personMap[p.id] = p.full_name;
        });
        setNameMap(personMap);
      }
    }
    fetchNames();
  }, []);

  useEffect(() => {
    async function load() {
      const { start, end } = rangeInfo;

      // Get entries with person_id (join via profiles if needed)
      let entryQ = supabase
        .from("gospel_share_entries")
        .select("entry_date,number_reached,number_response,church_invite,spiritual_conversation,story_share,gospel_presentation,user_id,person_id");

      if (start) entryQ = entryQ.gte("entry_date", start);
      if (end) entryQ = entryQ.lte("entry_date", end);

      const { data: raw } = await entryQ;

      // Calculate unique users from entries (from user_id OR person_id)
      const uniqueUserIds = new Set((raw || []).map(e => e.user_id || e.person_id).filter(Boolean));
      const uniqueUsers = uniqueUserIds.size;

      // Calculate aggregates
      let reach = 0, resp = 0, invites = 0, conversations = 0, stories = 0, gospel = 0;
      const byDate: Record<string, { reached: number; responses: number }> = {};
      const byUserMap: Record<string, UserAgg> = {};

      for (const e of raw || []) {
        // Date aggregation
        const d = e.entry_date;
        if (!byDate[d]) byDate[d] = { reached: 0, responses: 0 };
        byDate[d].reached += Number(e.number_reached) || 0;
        byDate[d].responses += Number(e.number_response) || 0;

        // Overall metrics
        reach += Number(e.number_reached) || 0;
        resp += Number(e.number_response) || 0;
        if (e.church_invite) invites += Number(e.number_reached) || 0;
        if (e.spiritual_conversation) conversations += Number(e.number_reached) || 0;
        if (e.story_share) stories += Number(e.number_reached) || 0;
        if (e.gospel_presentation) gospel += Number(e.number_reached) || 0;

        // Use person_id if available, otherwise use user_id (as auth users are also people), otherwise anonymous
        const personKey = e.person_id || e.user_id || "anonymous";
        
        if (!byUserMap[personKey]) {
          byUserMap[personKey] = {
            user_id: personKey,
            display_name: formatDisplayName(personKey, nameMap),
            entries: 0,
            total_reached: 0,
            total_responses: 0,
            invites_reached: 0,
            conversations_reached: 0,
            story_share_reached: 0,
            gospel_share_reached: 0,
          };
        }
        byUserMap[personKey].entries++;
        byUserMap[personKey].total_reached += Number(e.number_reached) || 0;
        byUserMap[personKey].total_responses += Number(e.number_response) || 0;
        if (e.church_invite) byUserMap[personKey].invites_reached += Number(e.number_reached) || 0;
        if (e.spiritual_conversation) byUserMap[personKey].conversations_reached += Number(e.number_reached) || 0;
        if (e.story_share) byUserMap[personKey].story_share_reached += Number(e.number_reached) || 0;
        if (e.gospel_presentation) byUserMap[personKey].gospel_share_reached += Number(e.number_reached) || 0;
      }

      setOverall({
        unique_users: uniqueUsers || 0,
        entries: raw?.length || 0,
        total_reached: reach,
        total_responses: resp,
        invites_reached: invites,
        conversations_reached: conversations,
        story_share_reached: stories,
        gospel_share_reached: gospel,
      });

      setChartData(
        Object.entries(byDate)
          .map(([k, v]) => ({ date: k, ...v }))
          .sort((a, b) => a.date.localeCompare(b.date))
      );

      setByUser(Object.values(byUserMap).sort((a, b) => b.total_reached - a.total_reached));
    }
    load();
  }, [range, rangeInfo, nameMap]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  return (
    <>
      <Header currentPage="admin" />
      
      <div className="p-6 space-y-6 max-w-6xl mx-auto">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold">Admin Dashboard</h1>
        </div>

      {/* Date Range Selector */}
      <DateRangeSelector value={range} onChange={setRange} />

      {/* First Row: Unique Users, Total Reached, Total Responses */}
      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total People</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{overall.unique_users.toLocaleString()}</div>
            <p className="text-xs text-gray-500">Unique users who logged shares</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Reached</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{overall.total_reached.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Responses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{overall.total_responses.toLocaleString()}</div>
          </CardContent>
        </Card>
      </div>

      {/* Second Row: Share Types */}
      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-600" /> Invite
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overall.invites_reached.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-purple-600" /> Conversation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overall.conversations_reached.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-green-600" /> Story
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overall.story_share_reached.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <Cross className="h-4 w-4 text-red-600" /> Gospel
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overall.gospel_share_reached.toLocaleString()}</div>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg font-medium">Reached + Responses Over Time</CardTitle>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <p className="text-sm text-muted-foreground">No chart data for this range yet.</p>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="reached" name="Reached" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="responses" name="Responses" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* By Person Table */}
      <Card>
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <CardTitle className="text-lg font-medium">People on Mission</CardTitle>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Rows:</span>
              <Select value={String(pageSize)} onValueChange={(v) => setPageSize(parseInt(v, 10))}>
                <SelectTrigger className="w-[80px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="text-sm text-gray-600">
              Page <span className="font-medium">{page}</span> of{" "}
              <span className="font-medium">{totalPages || 1}</span> ·{" "}
              <span className="font-medium">{byUser.length}</span> total
            </div>

            <Pagination 
              currentPage={page - 1} 
              totalPages={totalPages || 1}
              onPageChange={(p) => setPage(p + 1)}
            />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[200px]">
                  <SortableHeader
                    label="Name"
                    column="display_name"
                    currentColumn={sortColumn}
                    direction={sortDirection}
                    onSort={handleSort}
                  />
                </TableHead>
                <TableHead className="text-right">
                  <SortableHeader
                    label="Entries"
                    column="entries"
                    currentColumn={sortColumn}
                    direction={sortDirection}
                    onSort={handleSort}
                    align="right"
                  />
                </TableHead>
                <TableHead className="text-right">
                  <SortableHeader
                    label="Reached"
                    column="total_reached"
                    currentColumn={sortColumn}
                    direction={sortDirection}
                    onSort={handleSort}
                    align="right"
                  />
                </TableHead>
                <TableHead className="text-right">
                  <SortableHeader
                    label="Responses"
                    column="total_responses"
                    currentColumn={sortColumn}
                    direction={sortDirection}
                    onSort={handleSort}
                    align="right"
                  />
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedAndPaginatedByUser.map((u) => (
                <TableRow key={u.user_id}>
                  <TableCell className="font-medium">{u.display_name}</TableCell>
                  <TableCell className="text-right">{u.entries}</TableCell>
                  <TableCell className="text-right">{u.total_reached}</TableCell>
                  <TableCell className="text-right">{u.total_responses}</TableCell>
                </TableRow>
              ))}
              {sortedAndPaginatedByUser.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-gray-500">No data for this range.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      </div>
    </>
  );
}
