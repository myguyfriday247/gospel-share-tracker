// ==========================================
// useCurrentPerson - one identity resolution for the whole app
// ==========================================
//
// Replaces five near-duplicate copies of "find my people row" that had each drifted:
//   - components/Header.tsx        id -> email -> create
//   - app/dashboard/page.tsx       id -> email -> create
//   - app/admin/layout.tsx         id -> email, no create
//   - app/dashboard/new/page.tsx   email only, no create  (couldn't self-heal)
//   - app/login/page.tsx           email, re-key or create (signup-specific; left in place)
//
// Besides the duplication, Header renders alongside every page, so each navigation resolved
// identity twice in parallel — and when a person row was missing, both copies raced to INSERT
// it. Neither checked the insert error, so the loser failed silently.
//
// The module-level cache below makes concurrent callers share a single in-flight resolution,
// which removes both the duplicate round trips and the race.

"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  errorMessage,
  isUniqueViolation,
  reportError,
} from "@/lib/errors";
import type { Person } from "@/lib/types";

const PERSON_COLUMNS = "id, email, full_name, role, created_at";

interface Resolution {
  person: Person | null;
  /** No active session — the caller should redirect to /login. */
  signedOut: boolean;
  error: string | null;
}

let cache: Resolution | null = null;
let inflight: Promise<Resolution> | null = null;

// Invalidate only when the identity itself can have changed. INITIAL_SESSION fires on every
// page load and TOKEN_REFRESHED fires periodically; clearing on those would throw away the
// cache mid-load and re-run the lookup for no reason.
if (typeof window !== "undefined") {
  supabase.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
      cache = null;
      inflight = null;
    }
  });
}

async function resolve(): Promise<Resolution> {
  const { data: sessionData, error: sessionError } =
    await supabase.auth.getSession();

  if (sessionError) {
    reportError("resolve current person: getSession", sessionError);
    return { person: null, signedOut: false, error: errorMessage(sessionError) };
  }

  const user = sessionData.session?.user;
  if (!user) return { person: null, signedOut: true, error: null };

  // 1. By auth id — the normal case once someone has signed in at least once.
  //    maybeSingle() returns null rather than raising PGRST116 when there is no match, so a
  //    genuine failure below is always a real error.
  const byId = await supabase
    .from("people")
    .select(PERSON_COLUMNS)
    .eq("id", user.id)
    .maybeSingle();

  if (byId.error) {
    reportError("resolve current person: lookup by id", byId.error);
    return { person: null, signedOut: false, error: errorMessage(byId.error) };
  }
  if (byId.data) {
    return { person: byId.data as Person, signedOut: false, error: null };
  }

  // 2. By email — people imported via CSV get a random id until login/page.tsx re-keys them.
  if (user.email) {
    const byEmail = await supabase
      .from("people")
      .select(PERSON_COLUMNS)
      .eq("email", user.email)
      .maybeSingle();

    if (byEmail.error) {
      reportError("resolve current person: lookup by email", byEmail.error);
      return {
        person: null,
        signedOut: false,
        error: errorMessage(byEmail.error),
      };
    }
    if (byEmail.data) {
      return { person: byEmail.data as Person, signedOut: false, error: null };
    }
  }

  // 3. Nothing exists yet — create it.
  const fullName =
    (user.user_metadata?.full_name as string | undefined) ||
    user.email?.split("@")[0] ||
    "User";

  const created = await supabase
    .from("people")
    .insert({ id: user.id, email: user.email, full_name: fullName, role: "user" })
    .select(PERSON_COLUMNS)
    .maybeSingle();

  if (created.error) {
    // Another tab (or the old Header/dashboard race) won. Re-read rather than fail.
    if (isUniqueViolation(created.error)) {
      const retry = await supabase
        .from("people")
        .select(PERSON_COLUMNS)
        .eq("id", user.id)
        .maybeSingle();
      if (retry.data) {
        return { person: retry.data as Person, signedOut: false, error: null };
      }
    }
    reportError("resolve current person: create", created.error);
    return { person: null, signedOut: false, error: errorMessage(created.error) };
  }

  return { person: (created.data as Person) ?? null, signedOut: false, error: null };
}

function getCurrentPerson(force = false): Promise<Resolution> {
  if (force) {
    cache = null;
    inflight = null;
  }
  if (cache) return Promise.resolve(cache);
  if (!inflight) {
    inflight = resolve()
      .then((result) => {
        cache = result;
        inflight = null;
        return result;
      })
      .catch((err) => {
        inflight = null;
        throw err;
      });
  }
  return inflight;
}

export interface UseCurrentPerson {
  person: Person | null;
  /** Admin comes from people.role only — user_metadata is user-writable and must not grant it. */
  isAdmin: boolean;
  loading: boolean;
  error: string | null;
  signedOut: boolean;
  refresh: () => void;
}

export function useCurrentPerson(): UseCurrentPerson {
  const [state, setState] = useState<Resolution>(
    () => cache ?? { person: null, signedOut: false, error: null }
  );
  const [loading, setLoading] = useState(!cache);

  // No synchronous setState here: `loading` is seeded from the cache, and refresh() flips it
  // from an event handler, so the effect below never triggers a cascading render.
  const run = useCallback((force: boolean) => {
    let active = true;
    getCurrentPerson(force)
      .then((result) => {
        if (active) {
          setState(result);
          setLoading(false);
        }
      })
      .catch((err) => {
        reportError("resolve current person", err);
        if (active) {
          setState({ person: null, signedOut: false, error: errorMessage(err) });
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => run(false), [run]);

  const refresh = useCallback(() => {
    setLoading(true);
    run(true);
  }, [run]);

  return {
    person: state.person,
    isAdmin: state.person?.role === "admin",
    loading,
    error: state.error,
    signedOut: state.signedOut,
    refresh,
  };
}
