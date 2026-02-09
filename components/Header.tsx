"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import Link from "next/link";
import Image from "next/image";
import {
  Plus,
  LayoutDashboard,
  Users,
  BarChart,
  Settings,
  LogOut,
  Loader2,
  Menu,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabaseClient";
import { ShareForm } from "@/components/forms/ShareForm";

type HeaderProps = {
  currentPage?: "dashboard" | "admin" | "portal" | "people" | "person" | "profile";
};

export default function Header({ currentPage = "dashboard" }: HeaderProps) {
  const [loading, setLoading] = useState(true);
  const [personId, setPersonId] = useState<string>("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [addShareOpen, setAddShareOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        router.push("/login");
        return;
      }

      const user = session.user;

      // Try to find person by ID first
      let { data: person, error } = await supabase
        .from("people")
        .select("id, role")
        .eq("id", user.id)
        .single();

      // If not found by ID, try by email
      if (error && error.code === "PGRST116") {
        const { data: personByEmail } = await supabase
          .from("people")
          .select("id, role")
          .eq("email", user.email)
          .single();

        if (personByEmail) {
          person = personByEmail;
        }
      }

      // If still no person record, create one
      if (!person) {
        const fullName = user.user_metadata?.full_name || user.email?.split("@")[0] || "User";
        const { data: newPerson } = await supabase
          .from("people")
          .insert({
            id: user.id,
            email: user.email,
            full_name: fullName,
            role: "user",
          })
          .select("id, role")
          .single();
        person = newPerson;
      }

      if (person) {
        setPersonId(person.id);
        setIsAdmin(person.role === "admin");
      }

      setLoading(false);
    }

    init();
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const handleShareSuccess = () => {
    setAddShareOpen(false);
    router.refresh();
  };

  const handleMenuItemClick = () => {
    setMenuOpen(false);
  };

  if (loading) {
    return (
      <header className="bg-[#1a1a2e] text-white px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-center h-[75px]">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      </header>
    );
  }

  return (
    <header className="bg-[#1a1a2e] text-white px-4 py-3 lg:px-6 lg:py-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Logo */}
        <Link href="/dashboard" onClick={handleMenuItemClick}>
          <Image 
            src="/GST_logo_white.png"
            alt="Gospel Share Tracker"
            width={337}
            height={75}
            className="h-[50px] lg:h-[75px] w-auto"
          />
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden lg:flex items-center gap-2">
          {/* Add a Share */}
          <Dialog.Root open={addShareOpen} onOpenChange={setAddShareOpen}>
            <Dialog.Trigger asChild>
              <Button size="sm" className="bg-[#5cbe80] hover:bg-[#52a36d] flex items-center gap-2">
                <Plus className="h-4 w-4" /> Add a Share
              </Button>
            </Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
              <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg p-6 z-50 max-w-md w-[90vw] max-h-[90vh] overflow-y-auto">
                <Dialog.Title className="text-lg font-semibold mb-4">Add a Share</Dialog.Title>
                
                {personId ? (
                  <ShareForm 
                    personId={personId}
                    onSuccess={handleShareSuccess}
                    onError={(msg) => console.error(msg)}
                  />
                ) : (
                  <p className="text-center text-gray-500">Loading...</p>
                )}

                <Dialog.Close asChild>
                  <button className="absolute top-4 right-4 text-gray-400 hover:text-gray-600" aria-label="Close">
                    <X className="h-4 w-4" />
                  </button>
                </Dialog.Close>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>

          {/* My Dashboard */}
          <Link href="/dashboard">
            <Button 
              variant={currentPage === "dashboard" ? "secondary" : "ghost"} 
              size="sm" 
              className="flex items-center gap-2"
            >
              <LayoutDashboard className="h-4 w-4" /> My Dashboard
            </Button>
          </Link>

          {/* My Profile */}
          {personId && (
            <Link href={`/admin/people/${personId}`}>
              <Button 
                variant={currentPage === "person" ? "secondary" : "ghost"} 
                size="sm" 
                className="flex items-center gap-2"
              >
                <Users className="h-4 w-4" /> My Profile
              </Button>
            </Link>
          )}

          {/* Admin Links */}
          {isAdmin && (
            <>
              <Link href="/admin">
                <Button 
                  variant={currentPage === "admin" ? "secondary" : "ghost"} 
                  size="sm" 
                  className="flex items-center gap-2"
                >
                  <BarChart className="h-4 w-4" /> Admin Dashboard
                </Button>
              </Link>
              <Link href="/admin/portal">
                <Button 
                  variant={currentPage === "portal" ? "secondary" : "ghost"} 
                  size="sm" 
                  className="flex items-center gap-2"
                >
                  <Settings className="h-4 w-4" /> Admin Portal
                </Button>
              </Link>
            </>
          )}

          {/* Log Out */}
          <Button variant="ghost" size="sm" onClick={handleLogout} className="flex items-center gap-2">
            <LogOut className="h-4 w-4" /> Log Out
          </Button>
        </div>

        {/* Mobile Menu Button */}
        <Dialog.Root open={menuOpen} onOpenChange={setMenuOpen}>
          <Dialog.Trigger asChild>
            <Button variant="ghost" size="sm" className="lg:hidden p-2">
              <Menu className="h-6 w-6" />
            </Button>
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
            <Dialog.Content className="fixed top-0 right-0 h-full w-[280px] bg-[#1a1a2e] text-white z-50 p-6 flex flex-col gap-4 animate-in slide-in-from-right duration-200">
              <div className="flex justify-end">
                <Dialog.Close asChild>
                  <Button variant="ghost" size="sm" className="p-2">
                    <X className="h-6 w-6" />
                  </Button>
                </Dialog.Close>
              </div>

              <div className="flex flex-col gap-3 mt-4">
                {/* Add a Share (in menu for mobile) */}
                <Dialog.Root open={addShareOpen} onOpenChange={setAddShareOpen}>
                  <Dialog.Trigger asChild>
                    <Button size="sm" className="bg-[#5cbe80] hover:bg-[#52a36d] flex items-center gap-2 w-full justify-center">
                      <Plus className="h-4 w-4" /> Add a Share
                    </Button>
                  </Dialog.Trigger>
                  <Dialog.Portal>
                    <Dialog.Overlay className="fixed inset-0 bg-black/50 z-[60]" />
                    <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg p-6 z-[60] max-w-md w-[90vw] max-h-[90vh] overflow-y-auto">
                      <Dialog.Title className="text-lg font-semibold mb-4">Add a Share</Dialog.Title>
                      
                      {personId ? (
                        <ShareForm 
                          personId={personId}
                          onSuccess={handleShareSuccess}
                          onError={(msg) => console.error(msg)}
                        />
                      ) : (
                        <p className="text-center text-gray-500">Loading...</p>
                      )}

                      <Dialog.Close asChild>
                        <button className="absolute top-4 right-4 text-gray-400 hover:text-gray-600" aria-label="Close">
                          <X className="h-4 w-4" />
                        </button>
                      </Dialog.Close>
                    </Dialog.Content>
                  </Dialog.Portal>
                </Dialog.Root>

                {/* My Dashboard */}
                <Link href="/dashboard" onClick={handleMenuItemClick}>
                  <Button 
                    variant={currentPage === "dashboard" ? "secondary" : "ghost"} 
                    size="sm" 
                    className="w-full justify-start flex items-center gap-2"
                  >
                    <LayoutDashboard className="h-4 w-4" /> My Dashboard
                  </Button>
                </Link>

                {/* My Profile */}
                {personId && (
                  <Link href={`/admin/people/${personId}`} onClick={handleMenuItemClick}>
                    <Button 
                      variant={currentPage === "person" ? "secondary" : "ghost"} 
                      size="sm" 
                      className="w-full justify-start flex items-center gap-2"
                    >
                      <Users className="h-4 w-4" /> My Profile
                    </Button>
                  </Link>
                )}

                {/* Admin Links */}
                {isAdmin && (
                  <>
                    <Link href="/admin" onClick={handleMenuItemClick}>
                      <Button 
                        variant={currentPage === "admin" ? "secondary" : "ghost"} 
                        size="sm" 
                        className="w-full justify-start flex items-center gap-2"
                      >
                        <BarChart className="h-4 w-4" /> Admin Dashboard
                      </Button>
                    </Link>
                    <Link href="/admin/portal" onClick={handleMenuItemClick}>
                      <Button 
                        variant={currentPage === "portal" ? "secondary" : "ghost"} 
                        size="sm" 
                        className="w-full justify-start flex items-center gap-2"
                      >
                        <Settings className="h-4 w-4" /> Admin Portal
                      </Button>
                    </Link>
                  </>
                )}

                {/* Log Out */}
                <Button variant="ghost" size="sm" onClick={handleLogout} className="w-full justify-start flex items-center gap-2 mt-4">
                  <LogOut className="h-4 w-4" /> Log Out
                </Button>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </div>
    </header>
  );
}
