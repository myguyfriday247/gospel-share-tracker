"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, ArrowLeft, Mail } from "lucide-react";

type AuthMode = "login" | "signup" | "forgot" | "reset";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [mode, setMode] = useState<AuthMode>("login");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const normalizeName = (name: string) => name.trim().replace(/\s+/g, " ");

  // Check for recovery token in URL (password reset flow)
  useEffect(() => {
    if (searchParams?.get("type") === "recovery") {
      setMode("reset");
    }
  }, [searchParams]);

  const handleAuth = async () => {
    setMessage(null);

    const e = email.trim();
    const p = password;

    if (!e) {
      setMessage("Please enter your email.");
      return;
    }

    // ---------------- SIGN UP ----------------
    if (mode === "signup") {
      if (p.length < 8) {
        setMessage("Password must be at least 8 characters.");
        return;
      }
      if (p !== confirmPassword) {
        setMessage("Passwords do not match.");
        return;
      }

      const name = normalizeName(fullName);

      if (!name) {
        setMessage("Please enter your full name.");
        return;
      }
      if (name.split(" ").length < 2) {
        setMessage("Please enter both your first and last name.");
        return;
      }

      // Pre-check name availability
      const { data: available, error: availErr } = await supabase.rpc(
        "display_name_available",
        { p_name: name }
      );

      if (availErr) {
        setMessage("Could not validate your name. Please try again.");
        return;
      }
      if (available === false) {
        setMessage("That full name is already in use. Please add a middle initial.");
        return;
      }

      setLoading(true);

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
        if (error.message === "Database error saving new user") {
          setMessage("Signup failed. Make sure your full name is unique and includes both first and last name (add a middle initial if needed).");
        } else {
          setMessage(error.message);
        }
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: existingPerson } = await supabase
          .from("people")
          .select("id")
          .eq("email", e)
          .single();

        if (existingPerson && existingPerson.id !== user.id) {
          await supabase.from("gospel_share_entries").update({ person_id: user.id }).eq("person_id", existingPerson.id);
          await supabase.from("people").update({ id: user.id }).eq("id", existingPerson.id);
        } else if (!existingPerson) {
          await supabase.from("people").insert({
            id: user.id,
            email: e,
            full_name: name,
            role: "user",
          });
        }
      }

      setMessage("Account created! Please check your email to confirm your account, then log in.");
      setMode("login");
      setPassword("");
      setConfirmPassword("");
      return;
    }

    // ---------------- FORGOT PASSWORD ----------------
    if (mode === "forgot") {
      setLoading(true);
      const { error } = await supabase.auth.resetPasswordForEmail(e, {
        redirectTo: `${window.location.origin}/login?type=recovery`,
      });
      setLoading(false);

      if (error) {
        setMessage(error.message);
        return;
      }

      setMessage("Check your email for a password reset link.");
      return;
    }

    // ---------------- RESET PASSWORD ----------------
    if (mode === "reset") {
      if (p.length < 8) {
        setMessage("Password must be at least 8 characters.");
        return;
      }
      if (p !== confirmPassword) {
        setMessage("Passwords do not match.");
        return;
      }

      setLoading(true);
      const { error } = await supabase.auth.updateUser({ password: p });
      setLoading(false);

      if (error) {
        setMessage(error.message);
        return;
      }

      setMessage("Password updated successfully! Redirecting to dashboard...");
      setTimeout(() => {
        router.push("/dashboard");
      }, 2000);
      return;
    }

    // ---------------- LOGIN ----------------
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: e,
      password: p,
    });
    setLoading(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    router.push("/dashboard");
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-zinc-50 dark:bg-black">
      <Image
        src="/GST_Logo.png"
        alt="Gospel Share Tracker"
        width={337}
        height={75}
        className="w-full max-w-md mb-6 h-auto"
        priority
      />
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>
            {mode === "login" && "Log in"}
            {mode === "signup" && "Create account"}
            {mode === "forgot" && "Reset password"}
            {mode === "reset" && "New password"}
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Back to login (shown on forgot/reset) */}
          {(mode === "forgot" || mode === "reset") && (
            <button
              className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-2"
              onClick={() => {
                setMode("login");
                setMessage(null);
              }}
            >
              <ArrowLeft className="h-4 w-4" /> Back to login
            </button>
          )}

          {/* Name field (signup only) */}
          {mode === "signup" && (
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="First Last"
                autoComplete="name"
              />
              <p className="text-xs text-muted-foreground">Please enter both your first and last name.</p>
            </div>
          )}

          {/* Email field */}
          {mode !== "reset" && (
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
              />
            </div>
          )}

          {/* Password field */}
          {(mode === "login" || mode === "signup" || mode === "reset") && (
            <div className="space-y-2">
              <Label>{mode === "reset" ? "New Password" : "Password"}</Label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={mode === "signup" || mode === "reset" ? "new-password" : "current-password"}
                  placeholder="At least 8 characters"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          )}

          {/* Confirm password (signup and reset) */}
          {(mode === "signup" || mode === "reset") && (
            <div className="space-y-2">
              <Label>Confirm Password</Label>
              <div className="relative">
                <Input
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  placeholder="Confirm your password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          )}

          {/* Forgot password link (login only) */}
          {mode === "login" && (
            <button
              className="text-sm text-muted-foreground hover:text-foreground block w-full text-right"
              onClick={() => {
                setMode("forgot");
                setMessage(null);
              }}
            >
              Forgot your password?
            </button>
          )}

          {/* Submit button */}
          <Button className="w-full" onClick={handleAuth} disabled={loading}>
            {loading
              ? "Please wait…"
              : mode === "login"
              ? "Log in"
              : mode === "signup"
              ? "Create account"
              : mode === "forgot"
              ? "Send reset link"
              : "Update password"}
          </Button>

          {/* Toggle login/signup */}
          {mode !== "forgot" && mode !== "reset" && (
            <button
              className="text-sm underline text-muted-foreground block w-full text-center"
              onClick={() => {
                setMode(mode === "login" ? "signup" : "login");
                setMessage(null);
              }}
            >
              {mode === "login" ? "Need an account? Sign up" : "Already have an account? Log in"}
            </button>
          )}

          {/* Message */}
          {message && (
            <p className={`text-sm text-center ${message.includes("Check your email") ? "text-green-600" : ""}`}>
              {message}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

