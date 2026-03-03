"use client";

import { authedFetch } from '@/lib/auth/authedFetch'
import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { LucideIcon } from "lucide-react";
import {
  CalendarDays,
  Calculator,
  Cog,
  Home,
  Users,
  Wrench,
} from "lucide-react";

export default function CrmLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [logoError, setLogoError] = useState(false);
  const logoSrc = process.env.NEXT_PUBLIC_CRM_LOGO || "/ace-logo-clean.png";
  const iconSize = 16;
  const navItems = useMemo(
    () => [
      { href: "/crm", label: "Home", Icon: Home },
      { href: "/crm/customers", label: "Customers", Icon: Users },
      { href: "/crm/jobs", label: "Job Center", Icon: Wrench },
      { href: "/crm/estimates", label: "Estimates", Icon: Calculator },
      { href: "/crm/calendar", label: "Calendar", Icon: CalendarDays },
      { href: "/crm/settings", label: "Settings", Icon: Cog },
    ],
    []
  );

  useEffect(() => {
    let alive = true;

    (async () => {
      if (!supabaseBrowser?.auth?.getSession) {
        console.error("[CRM LAYOUT] Supabase client not initialized correctly.", {
          hasClient: Boolean(supabaseBrowser),
        });
        return;
      }

      let { data, error } = await supabaseBrowser.auth.getSession();
      if (!data?.session) {
        const refreshed = await supabaseBrowser.auth.refreshSession();
        data = refreshed.data;
        error = refreshed.error;
      }
      if (!alive) return;

      if (error || !data?.session) {
        const next = encodeURIComponent(pathname || "/crm");
        router.replace(`/login?next=${next}`);
        return;
      }

      try {
        const bootstrapRes = await authedFetch("/api/bootstrap-org", { method: "POST" });
        if (bootstrapRes.status === 401) {
          const next = encodeURIComponent(pathname || "/crm");
          router.replace(`/login?next=${next}`);
          return;
        }
        if (!bootstrapRes.ok) {
          const payload = await bootstrapRes.json().catch(() => null);
          console.error("[CRM LAYOUT] Failed to bootstrap org membership.", payload?.error ?? bootstrapRes.statusText);
        }
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
        <div
          style={{
            width: "100%",
            borderRadius: 16,
            border: "1px solid #d7dde8",
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.92) 0%, rgba(248,250,253,0.9) 100%)",
            boxShadow: "0 8px 24px rgba(17,24,39,0.06)",
            backdropFilter: "blur(8px)",
            padding: 10,
            display: "grid",
            gap: 10,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
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
                  <Image
                    src={logoSrc}
                    alt="ACE Painting"
                    onError={() => setLogoError(true)}
                    width={34}
                    height={34}
                    unoptimized
                    style={{ width: 34, height: 34, objectFit: "contain" }}
                  />
                </span>
              )}
              <span>ACE Painting CRM</span>
            </Link>
          </div>
          <nav className="crm-nav" style={{ gap: 10 }}>
          {navItems.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== "/crm" && pathname?.startsWith(item.href));
            const Icon = item.Icon as LucideIcon;
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  padding: "9px 12px",
                  borderRadius: 12,
                  textDecoration: "none",
                  fontWeight: 700,
                  fontSize: 14,
                  color: active ? "white" : "#1f2937",
                  background: active
                    ? "linear-gradient(135deg, #111827 0%, #1f2937 100%)"
                    : "rgba(255,255,255,0.9)",
                  border: active ? "1px solid #111827" : "1px solid #d1d5db",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 7,
                  boxShadow: active ? "0 4px 14px rgba(17,24,39,0.22)" : "none",
                }}
              >
                <Icon size={iconSize} aria-hidden="true" />
                <span>{item.label}</span>
              </Link>
            );
          })}
          </nav>
        </div>
      </div>

      {children}
    </div>
  );
}
