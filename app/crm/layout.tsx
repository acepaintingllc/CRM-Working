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
  FileText,
  Home,
  Users,
  Wrench,
} from "lucide-react";

type ThemeMode = "system" | "light" | "dark";

const themeStorageKey = "acecrm.theme";

function isThemeMode(value: string | null): value is ThemeMode {
  return value === "system" || value === "light" || value === "dark";
}

function resolveTheme(mode: ThemeMode) {
  if (mode !== "system") return mode;
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(mode: ThemeMode) {
  document.documentElement.dataset.theme = resolveTheme(mode);
}

export default function CrmLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [logoError, setLogoError] = useState(false);
  const [theme, setTheme] = useState<ThemeMode>("system");
  const logoSrc = process.env.NEXT_PUBLIC_CRM_LOGO || "/ace-logo-clean.png";
  const iconSize = 16;
  const navItems = useMemo(
    () => [
      { href: "/crm", label: "Home", Icon: Home },
      { href: "/crm/customers", label: "Customers", Icon: Users },
      { href: "/crm/jobs", label: "Job Center", Icon: Wrench },
      { href: "/crm/estimates", label: "Estimates", Icon: Calculator },
      { href: "/crm/notes", label: "Notes", Icon: FileText },
      { href: "/crm/calendar", label: "Calendar", Icon: CalendarDays },
      { href: "/crm/settings", label: "Settings", Icon: Cog },
    ],
    []
  );

  useEffect(() => {
    const stored = localStorage.getItem(themeStorageKey);
    const initialTheme = isThemeMode(stored) ? stored : "system";
    setTheme(initialTheme);
    applyTheme(initialTheme);

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      const current = localStorage.getItem(themeStorageKey);
      if (!current || current === "system") applyTheme("system");
    };
    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, []);

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

  const updateTheme = (nextTheme: ThemeMode) => {
    setTheme(nextTheme);
    localStorage.setItem(themeStorageKey, nextTheme);
    applyTheme(nextTheme);
  };

  if (!ready) return null;

  return (
    <div
      className="crm-shell"
      style={{
        minHeight: "100vh",
        color: "var(--crm-text)",
        background: "var(--crm-bg)",
      }}
    >
      <div className="crm-topbar" style={{ marginBottom: 16 }}>
        <div
          style={{
            width: "100%",
            borderRadius: 16,
            border: "1px solid var(--crm-border)",
            background: "var(--crm-nav-bg)",
            boxShadow: "var(--crm-shadow)",
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
                color: "var(--crm-text)",
                textDecoration: "none",
              }}
            >
              {!logoError && (
                <span
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 12,
                    background: "var(--crm-card)",
                    border: "1px solid var(--crm-border)",
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
            <label
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                fontSize: 12,
                fontWeight: 800,
                color: "var(--crm-muted)",
              }}
            >
              Theme
              <select
                value={theme}
                onChange={(event) => updateTheme(event.target.value as ThemeMode)}
                style={{
                  height: 34,
                  borderRadius: 10,
                  border: "1px solid var(--crm-border)",
                  background: "var(--crm-input)",
                  color: "var(--crm-text)",
                  fontSize: 13,
                  fontWeight: 700,
                  padding: "0 8px",
                }}
              >
                <option value="system">System</option>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </label>
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
                  color: active ? "var(--crm-accent-text)" : "var(--crm-text-soft)",
                  background: active
                    ? "linear-gradient(135deg, var(--crm-accent) 0%, var(--crm-accent-strong) 100%)"
                    : "var(--crm-nav-link)",
                  border: active ? "1px solid var(--crm-accent)" : "1px solid var(--crm-border)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 7,
                  boxShadow: active ? "var(--crm-shadow-active)" : "none",
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
