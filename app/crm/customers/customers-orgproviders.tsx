"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getActiveOrgId } from "@/lib/org/getActiveOrgId";

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

    try {
      const id = await getActiveOrgId();
      setOrgId(id);
      setLoading(false);
    } catch (e: any) {
      const message = e?.message ?? "Failed to load org membership.";
      if (message === "Not signed in.") {
        router.replace("/login");
        return;
      }
      setError(message);
      setOrgId(null);
      setLoading(false);
    }
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
