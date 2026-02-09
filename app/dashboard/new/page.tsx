"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShareForm } from "@/components/forms/ShareForm";

export default function NewEntryPage() {
  const [personId, setPersonId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function getPersonId() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        router.push("/login");
        return;
      }

      // Look up person_id from people table
      const { data: person } = await supabase
        .from("people")
        .select("id")
        .eq("email", session.user.email)
        .single();

      if (person) {
        setPersonId(person.id);
      }
      setLoading(false);
    }

    getPersonId();
  }, [router]);

  if (loading) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            Loading...
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!personId) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-600">Could not find your profile.</p>
            <Button 
              variant="outline" 
              onClick={() => router.push("/dashboard")}
              className="mt-4"
            >
              Back to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">New Entry</h1>
        <Button
          variant="outline"
          onClick={() => router.push("/dashboard")}
        >
          Back
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Gospel Share Form</CardTitle>
        </CardHeader>
        <CardContent>
          <ShareForm
            personId={personId}
            onSuccess={() => router.push("/dashboard")}
            submitLabel="Save Entry"
          />
        </CardContent>
      </Card>
    </div>
  );
}
