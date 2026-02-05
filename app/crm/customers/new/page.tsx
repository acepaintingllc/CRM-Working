"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { getActiveOrgId } from "@/lib/org/getActiveOrgId";

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
      const orgId = await getActiveOrgId();

      const { error } = await supabaseBrowser.from("customers").insert({
        org_id: orgId,
        name: name.trim(),
        phone: phone.trim() || null,
        email: email.trim() || null,
        address_line1: address1.trim() || null,
        address_line2: address2.trim() || null,
        city: city.trim() || null,
        state: state.trim() || null,
        postal_code: postal.trim() || null,
      });

      if (error) throw error;

      router.push("/crm/customers");
      router.refresh();
    } catch (e: any) {
      setErr(e?.message ?? "Failed to create customer.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6 max-w-xl space-y-4">
      <h1 className="text-xl font-semibold">New customer</h1>

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
          className="rounded-md bg-black text-white px-3 py-2 text-sm disabled:opacity-50"
        >
          {saving ? "Saving…" : "Create customer"}
        </button>
      </form>
    </div>
  );
}
