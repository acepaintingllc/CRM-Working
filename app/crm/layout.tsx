"use client";

import { authedFetch } from '@/lib/auth/authedFetch'
import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import * as Supa from "@/lib/supabase/client";

export default function CrmLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [logoError, setLogoError] = useState(false);
  const logoSrc = process.env.NEXT_PUBLIC_CRM_LOGO || "/ace-logo-clean.png";
  const navItems = useMemo(
    () => [
      { href: "/crm", label: "Home" },
      { href: "/crm/customers", label: "Customers" },
      { href: "/crm/jobs", label: "Jobs" },
      { href: "/crm/calendar", label: "Calendar" },
      { href: "/crm/email-templates", label: "Email templates" },
    ],
    []
  );

  useEffect(() => {
    let alive = true;

    (async () => {
      // Supports both patterns:
      // - export const supabaseBrowser = createClient(...)
      // - export const supabaseBrowser = () => createClient(...)
      const candidate =
        (Supa as any).supabaseBrowser ??
        (Supa as any).default;

      const sb: any = typeof candidate === "function" ? candidate() : candidate;

      if (!sb?.auth?.getSession) {
        console.error("[CRM LAYOUT] Supabase client not initialized correctly.", {
          exports: Object.keys(Supa),
          sb,
        });
        return;
      }

      const { data, error } = await sb.auth.getSession();
      if (!alive) return;

      if (error || !data?.session) {
        const next = encodeURIComponent(pathname || "/crm");
        router.replace(`/login?next=${next}`);
        return;
      }

      try {
        await authedFetch("/api/bootstrap-org", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: data.session.user.id }),
        });
      } catch (e) {
        console.error("[CRM LAYOUT] Failed to bootstrap org membership.", e);
      }

      setReady(true);
    })();

    return () => {
      alive = false;
    };
  }, [router, pathname]);

  if (!ready) return null;

  return (
    <div
      className="crm-shell"
      style={{
        minHeight: "100vh",
        color: "#111",
        background:
          "radial-gradient(1200px circle at top left, #ffffff 0%, #f6f7fb 35%, #eef1f6 100%)",
      }}
    >
      <div className="crm-topbar" style={{ marginBottom: 16 }}>
        <Link
          href="/crm"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
            fontWeight: 900,
            fontSize: 18,
            color: "#111",
            textDecoration: "none",
          }}
        >
          {!logoError && (
            <span
              style={{
                width: 42,
                height: 42,
                borderRadius: 12,
                background: "#fff",
                border: "1px solid #d1d5db",
                display: "grid",
                placeItems: "center",
                overflow: "hidden",
                boxShadow: "0 1px 0 rgba(0,0,0,0.04)",
              }}
            >
              <img
                src={logoSrc}
                alt="ACE Painting"
                onError={() => setLogoError(true)}
                style={{ width: 34, height: 34, objectFit: "contain" }}
              />
            </span>
          )}
          <span>ACE Painting</span>
        </Link>
        <nav className="crm-nav">
          {navItems.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== "/crm" && pathname?.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  padding: "8px 12px",
                  borderRadius: 10,
                  textDecoration: "none",
                  fontWeight: 700,
                  fontSize: 14,
                  color: active ? "white" : "#111",
                  background: active ? "#111" : "#f3f4f6",
                  border: active ? "1px solid #111" : "1px solid #d1d5db",
                }}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {children}
    </div>
  );
}
