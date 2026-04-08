"use client";

import { CustomersOrgProvider, useOrg } from "./customers-orgproviders";
import { RefreshCw, Users } from "lucide-react";

function CustomersShell({ children }: { children: React.ReactNode }) {
  const { loading, error, orgId, refresh } = useOrg();

  const showChildren = !!orgId;

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
          <div
            style={{
              fontSize: 18,
              fontWeight: 800,
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Users size={18} aria-hidden="true" />
            <span>Customers</span>
          </div>
          <div style={{ fontSize: 12, color: "var(--crm-muted)" }}>
            {loading ? "Loading org..." : orgId ? `Org: ${orgId}` : "Org: -"}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8 }} />
      </div>

      {error && (
        <div
          style={{
            background: "var(--crm-card)",
            border: "1px solid #fecaca",
            borderRadius: 12,
            padding: 12,
            color: "#991b1b",
            marginBottom: 12,
            fontSize: 14,
          }}
        >
          <div style={{ fontWeight: 800, marginBottom: 6 }}>Customers section error</div>
          <div style={{ marginBottom: 10 }}>{error}</div>
          <button
            onClick={() => void refresh()}
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              background: "var(--crm-accent)",
              color: "var(--crm-accent-text)",
              border: "none",
              cursor: "pointer",
              fontWeight: 700,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <RefreshCw size={16} aria-hidden="true" />
            <span>Retry</span>
          </button>
        </div>
      )}

      {!showChildren ? (
        <div
          style={{
            background: "var(--crm-card)",
            border: "1px solid var(--crm-border-soft)",
            borderRadius: 12,
            padding: 14,
            color: "var(--crm-muted)",
          }}
        >
          {loading ? "Loading..." : "Org not ready. Hit Retry above."}
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
