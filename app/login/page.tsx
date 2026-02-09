"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "signup">("login");

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const normalizeName = (name: string) => name.trim().replace(/\s+/g, " ");

  const handleAuth = async () => {
    setMessage(null);

    const e = email.trim();
    const p = password;

    if (!e) {
      setMessage("Please enter your email.");
      return;
    }

    if (p.length < 8) {
      setMessage("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);

    // ---------------- SIGN UP ----------------
    if (mode === "signup") {
      const name = normalizeName(fullName);

      if (!name) {
        setLoading(false);
        setMessage("Please enter your full name.");
        return;
      }

      // ✅ Enforce First + Last required
      if (name.split(" ").length < 2) {
        setLoading(false);
        setMessage("Please enter both your first and last name.");
        return;
      }

      // ✅ Pre-check name availability (works before login)
      const { data: available, error: availErr } = await supabase.rpc(
        "display_name_available",
        { p_name: name }
      );

      if (availErr) {
        setLoading(false);
        setMessage("Could not validate your name. Please try again.");
        return;
      }

      if (available === false) {
        setLoading(false);
        setMessage("That full name is already in use. Please add a middle initial.");
        return;
      }

      // ✅ Create auth user + store name in metadata
      const { error } = await supabase.auth.signUp({
        email: e,
        password: p,
        options: {
          data: {
            full_name: name,
          },
        },
      });

      setLoading(false);

      if (error) {
        // Supabase hides trigger/constraint issues behind this generic error
        if (error.message === "Database error saving new user") {
          setMessage(
            "Signup failed. Make sure your full name is unique and includes both first and last name (add a middle initial if needed)."
          );
        } else {
          setMessage(error.message);
        }
        return;
      }

      // ✅ Auto-create or update person record in people table
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Check if person already exists by email
        const { data: existingPerson } = await supabase
          .from("people")
          .select("id")
          .eq("email", e)
          .single();

        if (existingPerson && existingPerson.id !== user.id) {
          // Update existing person's ID to match auth ID (cascade to entries)
          await supabase
            .from("gospel_share_entries")
            .update({ person_id: user.id })
            .eq("person_id", existingPerson.id);
          
          await supabase
            .from("people")
            .update({ id: user.id })
            .eq("id", existingPerson.id);
        } else if (!existingPerson) {
          // Create new person record
          await supabase.from("people").insert({
            id: user.id,
            email: e,
            full_name: name,
            role: "user",
          });
        }
      }

      setMessage(
        "Account created! Please check your email to confirm your account, then log in."
      );
      setMode("login");
      setPassword("");
      return;
    }

    // ---------------- LOGIN ----------------
    const { error } = await supabase.auth.signInWithPassword({
      email: e,
      password: p,
    });

    setLoading(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    window.location.href = "/dashboard";
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-zinc-50 dark:bg-black">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{mode === "login" ? "Log in" : "Create account"}</CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          {mode === "signup" && (
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="First Last"
                autoComplete="name"
              />
              <p className="text-xs text-muted-foreground">
                Please enter both your first and last name.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label>Email</Label>
            <Input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              autoComplete="email"
            />
          </div>

          <div className="space-y-2">
            <Label>Password</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              placeholder="At least 8 characters"
            />
          </div>

          <Button className="w-full" onClick={handleAuth} disabled={loading}>
            {loading ? "Please wait…" : mode === "login" ? "Log in" : "Create account"}
          </Button>

          <button
            className="text-sm underline text-muted-foreground"
            onClick={() => {
              setMessage(null);
              setMode(mode === "login" ? "signup" : "login");
            }}
          >
            {mode === "login"
              ? "Need an account? Sign up"
              : "Already have an account? Log in"}
          </button>

          {message && <p className="text-sm">{message}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
