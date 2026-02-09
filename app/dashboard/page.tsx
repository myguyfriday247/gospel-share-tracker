"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { 
  Users,
  MessageSquare,
  BookOpen,
  Cross,
  ArrowRight,
} from "lucide-react";
import { getDateRange } from "@/lib/date";
import { RangeKey, Entry, Totals } from "@/lib/types";
import { Loader2 } from "lucide-react";
import { DateRangeSelector } from "@/components/ui/DateRangeSelector";
import { EntryRecord } from "@/components/EntryRecord";

function DashboardContent() {
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [personName, setPersonName] = useState("");
  const [personId, setPersonId] = useState("");

  const [rangeKey, setRangeKey] = useState<RangeKey>("this_week");
  const range = useMemo(() => getDateRange(rangeKey), [rangeKey]);
  const searchParams = useSearchParams();

  const [entries, setEntries] = useState<Entry[]>([]);
  const [allEntries, setAllEntries] = useState<Entry[]>([]);
  const [currentPersonId, setCurrentPersonId] = useState<string>("");
  const [loggedInPersonId, setLoggedInPersonId] = useState<string>("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);

      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;

      if (!user) {
        window.location.href = "/login";
        return;
      }

      // Always find the logged-in user's person first
      let loggedInPersonId = "";
      let loggedInPersonName = "";

      // Try by ID first
      const { data: loggedInPerson, error: errorById } = await supabase
        .from("people")
        .select("id, full_name")
        .eq("id", user.id)
        .single();

      if (loggedInPerson) {
        loggedInPersonId = loggedInPerson.id;
        loggedInPersonName = formatName(loggedInPerson.full_name);
      } else {
        // Try by email - use this record since it has the shares
        const { data: personByEmail } = await supabase
          .from("people")
          .select("id, full_name")
          .eq("email", user.email)
          .single();

        if (personByEmail) {
          loggedInPersonId = personByEmail.id;
          loggedInPersonName = formatName(personByEmail.full_name);
        } else {
          // Create new person record
          const fullName = user.user_metadata?.full_name || user.email?.split("@")[0] || "User";
          const { data: newPerson } = await supabase
            .from("people")
            .insert({
              id: user.id,
              email: user.email,
              full_name: fullName,
              role: "user",
            })
            .select("id, full_name")
            .single();
          
          if (newPerson) {
            loggedInPersonId = newPerson.id;
            loggedInPersonName = formatName(newPerson.full_name);
          }
        }
      }

      setLoggedInPersonId(loggedInPersonId);

      // Check if viewing someone else's dashboard
      const urlPersonId = searchParams.get("person");
      let pid = urlPersonId || loggedInPersonId;
      let pName = "";

      if (urlPersonId) {
        // Viewing someone else's dashboard
        const { data: personData } = await supabase
          .from("people")
          .select("full_name")
          .eq("id", pid)
          .single();
        if (personData) {
          pName = formatName(personData.full_name);
        }
      } else {
        // Viewing own dashboard
        pName = loggedInPersonName;
      }

      setPersonId(pid);
      setPersonName(pName);
      setCurrentPersonId(pid);

      if (!pid) {
        setLoading(false);
        return;
      }

      let qAll = supabase
        .from("gospel_share_entries")
        .select("*")
        .eq("person_id", pid)
        .order("entry_date", { ascending: true })
        .limit(5000);

      if (range.start) qAll = qAll.gte("entry_date", range.start);
      if (range.end) qAll = qAll.lte("entry_date", range.end);

      const allRes = await qAll;

      if (!allRes.error) {
        setAllEntries((allRes.data as Entry[]) ?? []);
      }

      let qRecent = supabase
        .from("gospel_share_entries")
        .select("*")
        .eq("person_id", pid)
        .order("entry_date", { ascending: false })
        .limit(3);

      const recentRes = await qRecent;

      if (!recentRes.error) {
        setEntries((recentRes.data as Entry[]) ?? []);
      }

      // Check admin status from people.role first
      const { data: adminPerson } = await supabase
        .from("people")
        .select("role")
        .eq("id", user.id)
        .single();
      
      const isAdminUser = adminPerson?.role === "admin" || user.user_metadata?.role === "admin";
      setIsAdmin(isAdminUser);

      setLoading(false);
    };

    load();
  }, [range.start, range.end]);

  const totals: Totals = useMemo(() => {
    const totalReached = allEntries.reduce((sum, e) => sum + (e.number_reached || 0), 0);
    const gospelResponses = allEntries.reduce(
      (sum, e) => sum + (e.gospel_response ? e.number_response || 0 : 0),
      0
    );
    const invitesReached = allEntries.filter((e) => e.church_invite).reduce((sum, e) => sum + e.number_reached, 0);
    const conversationsReached = allEntries.filter((e) => e.spiritual_conversation).reduce((sum, e) => sum + e.number_reached, 0);
    const storyShareReached = allEntries.filter((e) => e.story_share).reduce((sum, e) => sum + e.number_reached, 0);
    const gospelShareReached = allEntries.filter((e) => e.gospel_presentation).reduce((sum, e) => sum + e.number_reached, 0);

    return {
      totalReached,
      gospelResponses,
      invitesReached,
      conversationsReached,
      storyShareReached,
      gospelShareReached,
    };
  }, [allEntries]);

  const chartData = useMemo(() => {
    const map = new Map<string, { reached: number; responses: number }>();

    for (const e of allEntries) {
      const day = e.entry_date;
      const cur = map.get(day) ?? { reached: 0, responses: 0 };
      cur.reached += e.number_reached || 0;
      cur.responses += e.gospel_response ? e.number_response || 0 : 0;
      map.set(day, cur);
    }

    return Array.from(map.entries())
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .map(([date, v]) => ({ date, reached: v.reached, responses: v.responses }));
  }, [allEntries]);

  const formatName = (name: string) => {
    return name
      .split(" ")
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");
  };

  const refreshEntries = async () => {
    if (!personId) return;
    const { data: recentRes } = await supabase
      .from("gospel_share_entries")
      .select("*")
      .eq("person_id", personId)
      .order("entry_date", { ascending: false })
      .limit(3);
    setEntries((recentRes as Entry[]) || []);
  };

  return (
    <>
      <Header currentPage="dashboard" />
      
      <div className="p-6 space-y-6 max-w-6xl mx-auto">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Dashboard</h1>
            <p className="text-gray-500">{personName ? `${personName}'s Dashboard` : "Welcome!"}</p>
          </div>
          {searchParams.get("person") && (
            <Button variant="outline" onClick={() => window.history.back()}>
              ← Back
            </Button>
          )}
        </div>

        {/* Date Range Selector */}
        <DateRangeSelector value={rangeKey} onChange={setRangeKey} />

        {/* Summary Cards */}
        <div className="grid md:grid-cols-2 gap-4">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-blue-700">Total Reached</CardTitle>
            </CardHeader>
            <CardContent className="text-4xl font-bold text-blue-800">
              {loading ? "…" : totals.totalReached}
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-green-700">Gospel Responses</CardTitle>
            </CardHeader>
            <CardContent className="text-4xl font-bold text-green-800">
              {loading ? "…" : totals.gospelResponses}
            </CardContent>
          </Card>
        </div>

        <div className="grid md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                <Users className="h-4 w-4 text-blue-600" /> Invite
              </CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-bold">
              {loading ? "…" : totals.invitesReached}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-purple-600" /> Conversation
              </CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-bold">
              {loading ? "…" : totals.conversationsReached}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-green-600" /> Story
              </CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-bold">
              {loading ? "…" : totals.storyShareReached}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                <Cross className="h-4 w-4 text-red-600" /> Gospel
              </CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-bold">
              {loading ? "…" : totals.gospelShareReached}
            </CardContent>
          </Card>
        </div>

        {/* Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-medium">Reached + Responses Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p>Loading…</p>
            ) : chartData.length === 0 ? (
              <p className="text-sm text-muted-foreground">No chart data for this range yet.</p>
            ) : (
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 10, right: 20, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tickMargin={8} />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="reached" name="Reached" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="responses" name="Responses" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Shares Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-medium">Recent Shares</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p>Loading…</p>
            ) : entries.length === 0 ? (
              <p className="text-gray-500">No entries yet. Add your first share!</p>
            ) : (
              <div className="space-y-4">
                {entries.map((entry) => (
                  <EntryRecord
                    key={entry.id}
                    entry={entry}
                    onUpdate={refreshEntries}
                    variant="card"
                  />
                ))}
                
                {/* See All Shares Link */}
                <Link href={personId ? `/admin/people/${personId}` : "/admin/people"}>
                  <div className="flex items-center justify-center gap-2 p-4 mt-2 bg-[#5cbe80] text-white rounded-lg hover:bg-[#52a36d] transition-all cursor-pointer">
                    <span className="font-medium">See All Shares</span>
                    <ArrowRight className="h-4 w-4" />
                  </div>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <>
        <Header currentPage="dashboard" />
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      </>
    }>
      <DashboardContent />
    </Suspense>
  );
}
