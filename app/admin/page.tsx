"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabaseClient";
import { errorMessage, reportError } from "@/lib/errors";
import Header from "@/components/Header";
import { ErrorBanner } from "@/components/ErrorBanner";
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
import { RangeKey, UserAgg, OverallAgg, ChartDataPoint, formatDisplayName } from "@/lib/types";

// Shapes returned by the migration 007 aggregate functions. Postgres bigint arrives over
// PostgREST as a string or number depending on size, so every numeric field is passed through
// Number() at the call site.
interface TotalsRow {
  unique_people: number | string;
  entry_count: number | string;
  total_reached: number | string;
  total_responses: number | string;
  invites: number | string;
  conversations: number | string;
  stories: number | string;
  gospel: number | string;
}

interface ByDateRow {
  entry_day: string;
  reached: number | string;
  responses: number | string;
}

interface ByPersonRow {
  person_key: string | null;
  display_name: string;
  entry_count: number | string;
  total_reached: number | string;
  total_responses: number | string;
  invites: number | string;
  conversations: number | string;
  stories: number | string;
  gospel: number | string;
}

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
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

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

  // Changing the range resets to page 1. Done here rather than in an effect keyed on `range`,
  // which caused a second render pass on every range change.
  const handleRangeChange = (next: RangeKey) => {
    setRange(next);
    setPage(1);
  };

  const rangeInfo = useMemo(() => getDateRange(range), [range]);

  // Aggregation happens in Postgres (migration 007) rather than by downloading every matching
  // row and reducing it here. Three small result sets replace one transfer that grew with the
  // data. The functions run SECURITY INVOKER, so migration 006's RLS still applies.
  useEffect(() => {
    let active = true;

    async function load() {
      const { start, end } = rangeInfo;
      const args = { p_start: start ?? null, p_end: end ?? null };

      const [totalsRes, byDateRes, byPersonRes] = await Promise.all([
        supabase.rpc("gst_entry_totals", args),
        supabase.rpc("gst_entries_by_date", args),
        supabase.rpc("gst_entries_by_person", args),
      ]);

      if (!active) return;
      setLoading(false);

      const failed = totalsRes.error || byDateRes.error || byPersonRes.error;
      if (failed) {
        reportError("admin dashboard: aggregate", failed);
        setError(errorMessage(failed));
        return;
      }

      setError(null);

      const t = (totalsRes.data as TotalsRow[] | null)?.[0];
      setOverall({
        unique_users: Number(t?.unique_people ?? 0),
        entries: Number(t?.entry_count ?? 0),
        total_reached: Number(t?.total_reached ?? 0),
        total_responses: Number(t?.total_responses ?? 0),
        invites_reached: Number(t?.invites ?? 0),
        conversations_reached: Number(t?.conversations ?? 0),
        story_share_reached: Number(t?.stories ?? 0),
        gospel_share_reached: Number(t?.gospel ?? 0),
      });

      setChartData(
        ((byDateRes.data as ByDateRow[] | null) ?? []).map((r) => ({
          date: r.entry_day,
          reached: Number(r.reached),
          responses: Number(r.responses),
        }))
      );

      setByUser(
        ((byPersonRes.data as ByPersonRow[] | null) ?? []).map((r) => ({
          user_id: r.person_key ?? "anonymous",
          display_name: formatDisplayName(
            r.person_key ?? "anonymous",
            r.person_key ? { [r.person_key]: r.display_name } : {}
          ),
          entries: Number(r.entry_count),
          total_reached: Number(r.total_reached),
          total_responses: Number(r.total_responses),
          invites_reached: Number(r.invites),
          conversations_reached: Number(r.conversations),
          story_share_reached: Number(r.stories),
          gospel_share_reached: Number(r.gospel),
        }))
      );
    }

    load();
    return () => {
      active = false;
    };
  }, [rangeInfo, reloadToken]);

  return (
    <>
      <Header currentPage="admin" />
      
      <div className="p-6 space-y-6 max-w-6xl mx-auto">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold">Admin Dashboard</h1>
        </div>

      {/* A failed load must not render as community-wide zeros */}
      <ErrorBanner message={error} onRetry={() => setReloadToken((t) => t + 1)} />

      {/* Date Range Selector */}
      <DateRangeSelector value={range} onChange={handleRangeChange} />

      {/* First Row: Unique Users, Total Reached, Total Responses */}
      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total People</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{loading ? "…" : overall.unique_users.toLocaleString()}</div>
            <p className="text-xs text-gray-500">Unique users who logged shares</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Reached</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{loading ? "…" : overall.total_reached.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Responses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{loading ? "…" : overall.total_responses.toLocaleString()}</div>
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
            <div className="text-2xl font-bold">{loading ? "…" : overall.invites_reached.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-purple-600" /> Conversation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? "…" : overall.conversations_reached.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-green-600" /> Story
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? "…" : overall.story_share_reached.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <Cross className="h-4 w-4 text-red-600" /> Gospel
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? "…" : overall.gospel_share_reached.toLocaleString()}</div>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg font-medium">Reached + Responses Over Time</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : chartData.length === 0 ? (
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
