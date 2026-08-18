"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCurrentPerson } from "@/hooks/useCurrentPerson";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShareForm } from "@/components/forms/ShareForm";

export default function NewEntryPage() {
  const router = useRouter();
  const { person, loading, error, signedOut } = useCurrentPerson();
  const personId = person?.id ?? null;

  useEffect(() => {
    if (signedOut) router.push("/login");
  }, [signedOut, router]);

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
            <p className="text-gray-600">
              {error ? `Could not load your profile: ${error}` : "Could not find your profile."}
            </p>
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
