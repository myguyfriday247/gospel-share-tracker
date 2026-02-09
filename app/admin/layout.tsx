"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";
import { Loader2 } from "lucide-react";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userId, setUserId] = useState<string>("");
  const router = useRouter();
  const pathname = usePathname();

  // Check if this is the user's own profile page
  const isOwnProfilePath = pathname?.startsWith("/admin/people/") && 
    pathname !== "/admin/people" &&
    pathname !== "/admin/people/";

  useEffect(() => {
    async function checkAdmin() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      // Try to find person by ID first
      let { data: person, error } = await supabase
        .from("people")
        .select("id, email, role")
        .eq("id", user.id)
        .single();

      // If not found by ID, try by email
      if (error && error.code === "PGRST116") {
        const { data: personByEmail } = await supabase
          .from("people")
          .select("id, email, role")
          .eq("email", user.email)
          .single();

        if (personByEmail) {
          person = personByEmail;
        }
      }

      // Also check user metadata for backward compatibility
      const metadataAdmin = user.user_metadata?.role === "admin";
      const tableAdmin = person?.role === "admin";

      setIsAdmin(metadataAdmin || tableAdmin);
      // Store the person's ID (may differ from auth ID if record was imported)
      setUserId(person?.id || "");
      setLoading(false);
    }

    checkAdmin();
  }, [router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  // Allow access if:
  // 1. User is admin, OR
  // 2. User is viewing their own profile page (profileId matches stored userId)
  const profileId = pathname?.split("/").pop();
  const canAccess = isAdmin || (isOwnProfilePath && profileId === userId);

  if (!canAccess) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Access Denied</h1>
          <p className="text-gray-600 mt-2">You don't have permission to view this page.</p>
          <p className="text-gray-400 text-sm mt-1">userId: {userId}</p>
          <p className="text-gray-400 text-sm mt-1">profileId: {profileId}</p>
          <p className="text-gray-400 text-sm mt-1">isAdmin: {isAdmin ? "true" : "false"}</p>
          <p className="text-gray-400 text-sm mt-1">isOwnProfile: {isOwnProfilePath ? "true" : "false"}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {children}
    </>
  );
}
