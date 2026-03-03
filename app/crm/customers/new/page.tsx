"use client";

import { authedFetch } from '@/lib/auth/authedFetch'
import { useState } from "react";
import { useRouter } from "next/navigation";
import { getActiveOrgId } from "@/lib/org/getActiveOrgId";
import { ArrowLeft, Plus, UserPlus } from "lucide-react";
import Link from "next/link";

export default function NewCustomerPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address1, setAddress1] = useState("");
  const [address2, setAddress2] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [postal, setPostal] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);

    if (!name.trim()) {
      setErr("Name is required.");
      return;
    }

    try {
      setSaving(true);
      await getActiveOrgId();

      const street = [address1.trim(), address2.trim()].filter(Boolean).join(" ");

      const res = await authedFetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim() || null,
          email: email.trim() || null,
          street: street || null,
          city: city.trim() || null,
          state: state.trim() || null,
          zip: postal.trim() || null,
        }),
      });

      const payload = await res.json().catch(() => null);
      if (!res.ok) throw new Error(payload?.error ?? "Failed to create customer.");

      router.push("/crm/customers");
      router.refresh();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed to create customer.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6 max-w-xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold inline-flex items-center gap-2">
          <UserPlus size={20} aria-hidden="true" />
          <span>New customer</span>
        </h1>
        <Link
          href="/crm/customers"
          className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm inline-flex items-center gap-2"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          <span>Back</span>
        </Link>
      </div>

      {err && <div className="text-red-600">{err}</div>}

      <form onSubmit={onSubmit} className="space-y-3">
        <div>
          <label className="text-sm">Name *</label>
          <input className="border rounded-md w-full p-2" value={name} onChange={(e) => setName(e.target.value)} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-sm">Phone</label>
            <input className="border rounded-md w-full p-2" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div>
            <label className="text-sm">Email</label>
            <input className="border rounded-md w-full p-2" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
        </div>

        <div>
          <label className="text-sm">Address line 1</label>
          <input className="border rounded-md w-full p-2" value={address1} onChange={(e) => setAddress1(e.target.value)} />
        </div>

        <div>
          <label className="text-sm">Address line 2</label>
          <input className="border rounded-md w-full p-2" value={address2} onChange={(e) => setAddress2(e.target.value)} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="text-sm">City</label>
            <input className="border rounded-md w-full p-2" value={city} onChange={(e) => setCity(e.target.value)} />
          </div>
          <div>
            <label className="text-sm">State</label>
            <input className="border rounded-md w-full p-2" value={state} onChange={(e) => setState(e.target.value)} />
          </div>
          <div>
            <label className="text-sm">ZIP</label>
            <input className="border rounded-md w-full p-2" value={postal} onChange={(e) => setPostal(e.target.value)} />
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-black text-white px-3 py-2 text-sm disabled:opacity-50 inline-flex items-center gap-2"
        >
          <Plus size={16} aria-hidden="true" />
          <span>{saving ? "Saving..." : "Create customer"}</span>
        </button>
      </form>
    </div>
  );
}
