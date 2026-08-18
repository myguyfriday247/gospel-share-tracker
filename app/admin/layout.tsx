"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useCurrentPerson } from "@/hooks/useCurrentPerson";
import { Loader2 } from "lucide-react";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();

  // Admin comes from people.role only. It previously also accepted
  // user.user_metadata.role, which users can set on themselves via auth.updateUser() —
  // a privilege-escalation path, not a compatibility shim worth keeping.
  const { person, isAdmin, loading, signedOut } = useCurrentPerson();
  const userId = person?.id ?? "";

  useEffect(() => {
    if (signedOut) router.push("/login");
  }, [signedOut, router]);

  // Check if this is the user's own profile page
  const isOwnProfilePath = pathname?.startsWith("/admin/people/") &&
    pathname !== "/admin/people" &&
    pathname !== "/admin/people/";

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
          <p className="text-gray-600 mt-2">You don&apos;t have permission to view this page.</p>
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
