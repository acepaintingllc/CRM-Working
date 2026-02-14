"use client";

import { authedFetch } from '@/lib/auth/authedFetch'
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getActiveOrgId } from "@/lib/org/getActiveOrgId";

type Customer = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
};

export default function CustomersPage() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [rows, setRows] = useState<Customer[]>([]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        setErr(null);

        await getActiveOrgId();

        const res = await authedFetch("/api/customers", { cache: "no-store" });
        const payload = await res.json().catch(() => null);
        if (!res.ok) throw new Error(payload?.error ?? "Failed to load customers.");
        if (!alive) return;

        setRows((payload?.customers ?? []) as Customer[]);
      } catch (e: unknown) {
        if (!alive) return;
        setErr(e instanceof Error ? e.message : "Failed to load customers.");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((c) => {
      const hay = `${c.name ?? ""} ${c.email ?? ""} ${c.phone ?? ""} ${c.address ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [rows, query]);

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

      <div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search customers by name, email, phone, or address..."
          className="w-full rounded-md border px-3 py-2 text-sm"
        />
      </div>

      {loading && <div>Loading…</div>}
      {err && <div className="text-red-600">{err}</div>}

      {!loading && !err && rows.length === 0 && (
        <div className="text-sm text-gray-600">No customers yet.</div>
      )}

      <div className="space-y-2">
        {!loading && !err && rows.length > 0 && filteredRows.length === 0 && (
          <div className="text-sm text-gray-600">No matching customers.</div>
        )}
        {filteredRows.map((c) => (
          <Link
            key={c.id}
            href={`/crm/customers/${c.id}`}
            className="rounded-md border p-3 block hover:border-black transition-colors"
          >
            <div className="font-medium">{c.name}</div>
            <div className="text-sm text-gray-700">
              {c.phone ? <span>{c.phone}</span> : null}
              {c.phone && c.email ? <span> • </span> : null}
              {c.email ? <span>{c.email}</span> : null}
            </div>
            <div className="text-sm text-gray-700">
              {c.address ? (
                <span>{c.address}</span>
              ) : (
                <span className="text-gray-500">No address</span>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
