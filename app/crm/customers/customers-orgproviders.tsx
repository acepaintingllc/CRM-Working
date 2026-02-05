"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

type OrgContextValue = {
  orgId: string | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

const OrgContext = createContext<OrgContextValue | null>(null);

export function useOrg() {
  const ctx = useContext(OrgContext);
  if (!ctx) throw new Error("useOrg must be used inside CustomersOrgProvider");
  return ctx;
}

export function CustomersOrgProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [orgId, setOrgId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);

    const { data: sessionData, error: sessionErr } = await supabaseBrowser.auth.getSession();

    if (sessionErr) {
      setError(sessionErr.message);
      setLoading(false);
      return;
    }

    const user = sessionData.session?.user;
    if (!user) {
      router.replace("/login");
      return;
    }

    const { data, error: memErr } = await supabaseBrowser
      .from("org_members")
      .select("org_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (memErr) {
      setError(memErr.message);
      setLoading(false);
      return;
    }

    const id = data?.org_id ?? null;

    if (!id) {
      setError("No org membership found. Visit /crm once, then come back.");
      setOrgId(null);
      setLoading(false);
      return;
    }

    setOrgId(id);
    setLoading(false);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <OrgContext.Provider value={{ orgId, loading, error, refresh: load }}>
      {children}
    </OrgContext.Provider>
  );
}
