"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function Home() {
  useEffect(() => {
    const go = async () => {
      const { data } = await supabase.auth.getSession();
      window.location.href = data.session ? "/dashboard" : "/login";
    };
    go();
  }, []);

  return <p className="p-6">Loading…</p>;
}
