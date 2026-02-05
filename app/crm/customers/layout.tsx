"use client";

import Link from "next/link";
import { CustomersOrgProvider, useOrg } from "./customers-orgproviders";

function CustomersShell({ children }: { children: React.ReactNode }) {
  const { loading, error, orgId, refresh } = useOrg();

  const showChildren = !!orgId; // ✅ only render pages when orgId is real

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <div>
          <div style={{ fontSize: 18, fontWeight: 800 }}>Customers</div>
          <div style={{ fontSize: 12, color: "#6b7280" }}>
            {loading ? "Loading org…" : orgId ? `Org: ${orgId}` : "Org: —"}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <Link
            href="/crm/customers"
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              background: "white",
              border: "1px solid #e5e7eb",
              textDecoration: "none",
              color: "#111",
              fontWeight: 700,
              fontSize: 14,
            }}
          >
            List
          </Link>

          <Link
            href="/crm/customers/new"
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              background: "#111",
              color: "white",
              textDecoration: "none",
              fontWeight: 700,
              fontSize: 14,
            }}
          >
            + Add
          </Link>
        </div>
      </div>

      {error && (
        <div
          style={{
            background: "#fff",
            border: "1px solid #fecaca",
            borderRadius: 12,
            padding: 12,
            color: "#991b1b",
            marginBottom: 12,
            fontSize: 14,
          }}
        >
          <div style={{ fontWeight: 800, marginBottom: 6 }}>
            Customers section error
          </div>
          <div style={{ marginBottom: 10 }}>{error}</div>
          <button
            onClick={() => void refresh()}
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              background: "#111",
              color: "white",
              border: "none",
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            Retry
          </button>
        </div>
      )}

      {!showChildren ? (
        <div
          style={{
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: 12,
            padding: 14,
            color: "#6b7280",
          }}
        >
          {loading ? "Loading…" : "Org not ready. Hit Retry above."}
        </div>
      ) : (
        children
      )}
    </div>
  );
}

export default function CustomersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <CustomersOrgProvider>
      <CustomersShell>{children}</CustomersShell>
    </CustomersOrgProvider>
  );
}
