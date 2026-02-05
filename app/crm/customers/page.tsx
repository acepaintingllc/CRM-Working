"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { getActiveOrgId } from "@/lib/org/getActiveOrgId";

type Customer = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address_line1: string | null;
  city: string | null;
  state: string | null;
};

export default function CustomersPage() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [rows, setRows] = useState<Customer[]>([]);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        setErr(null);

        const orgId = await getActiveOrgId();

        const { data, error } = await supabaseBrowser
          .from("customers")
          .select("id,name,phone,email,address_line1,city,state")
          .eq("org_id", orgId)
          .order("created_at", { ascending: false });

        if (error) throw error;
        if (!alive) return;

        setRows((data ?? []) as Customer[]);
      } catch (e: any) {
        if (!alive) return;
        setErr(e?.message ?? "Failed to load customers.");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Customers</h1>
        <Link
          href="/crm/customers/new"
          className="rounded-md bg-black text-white px-3 py-2 text-sm"
        >
          + New customer
        </Link>
      </div>

      {loading && <div>Loading…</div>}
      {err && <div className="text-red-600">{err}</div>}

      {!loading && !err && rows.length === 0 && (
        <div className="text-sm text-gray-600">No customers yet.</div>
      )}

      <div className="space-y-2">
        {rows.map((c) => (
          <div key={c.id} className="rounded-md border p-3">
            <div className="font-medium">{c.name}</div>
            <div className="text-sm text-gray-700">
              {c.phone ? <span>{c.phone}</span> : null}
              {c.phone && c.email ? <span> • </span> : null}
              {c.email ? <span>{c.email}</span> : null}
            </div>
            <div className="text-sm text-gray-700">
              {c.address_line1 ? (
                <span>
                  {c.address_line1}
                  {c.city || c.state ? `, ${c.city ?? ""}${c.city && c.state ? ", " : ""}${c.state ?? ""}` : ""}
                </span>
              ) : (
                <span className="text-gray-500">No address</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
