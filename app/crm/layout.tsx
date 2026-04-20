"use client";

import { authedFetch } from '@/lib/auth/authedFetch'
import { getBrandLogoUrl } from '@/lib/brand/logo'
import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { LucideIcon } from "lucide-react";
import {
  Camera,
  CalendarDays,
  Calculator,
  Cog,
  FileText,
  Home,
  Shapes,
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
  const logoSrc = getBrandLogoUrl()
  const iconSize = 16;
  const isEstimatorV2Path =
    pathname === "/crm/estimates/v2" ||
    Boolean(pathname?.startsWith("/crm/estimates/v2/")) ||
    Boolean(pathname && /^\/crm\/estimates\/[^/]+\/v2(?:\/|$)/.test(pathname));
  const navItems = useMemo(
    () => [
      { href: "/crm", label: "Home", Icon: Home },
      { href: "/crm/customers", label: "Customers", Icon: Users },
      { href: "/crm/jobs", label: "Job Center", Icon: Wrench },
      { href: "/crm/estimates", label: "Estimates", Icon: Calculator },
      { href: "/crm/estimates/v2", label: "V2", Icon: Shapes },
      { href: "/crm/notes", label: "Notes", Icon: FileText },
      { href: "/crm/calendar", label: "Calendar", Icon: CalendarDays },
      { href: "/field/jobs", label: "Field Cam", Icon: Camera },
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
      style={{
        minHeight: "100vh",
        display: "flex",
        background: "var(--crm-bg)",
        color: "var(--crm-text)",
      }}
    >
      {/* ── Desktop sidebar ── */}
      <aside
        className="hidden lg:flex"
        style={{
          width: 220,
          flexShrink: 0,
          flexDirection: "column",
          background: "var(--crm-card)",
          borderRight: "1px solid var(--crm-border)",
          position: "sticky",
          top: 0,
          height: "100vh",
          overflowY: "auto",
        }}
      >
        {/* Brand */}
        <div
          style={{
            padding: "18px 16px 14px",
            borderBottom: "1px solid var(--crm-border)",
          }}
        >
          <Link
            href="/crm"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              textDecoration: "none",
            }}
          >
            {!logoError && (
              <span
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: "var(--crm-bg)",
                  border: "1px solid var(--crm-border)",
                  display: "grid",
                  placeItems: "center",
                  overflow: "hidden",
                  flexShrink: 0,
                }}
              >
                <Image
                  src={logoSrc}
                  alt="ACE Painting"
                  onError={() => setLogoError(true)}
                  width={28}
                  height={28}
                  unoptimized
                  style={{ width: 28, height: 28, objectFit: "contain" }}
                />
              </span>
            )}
            <div>
              <div style={{ fontWeight: 800, fontSize: 13, color: "var(--crm-text)", lineHeight: 1.2 }}>
                ACE Painting
              </div>
              <div style={{ fontSize: 11, color: "var(--crm-muted)", fontWeight: 600, marginTop: 1 }}>
                CRM
              </div>
            </div>
          </Link>
        </div>

        {/* Nav items */}
        <nav
          style={{
            flex: 1,
            padding: "10px 10px",
            display: "flex",
            flexDirection: "column",
            gap: 2,
          }}
        >
          {navItems.map((item) => {
            const active =
              item.href === "/crm"
                ? pathname === item.href
                : item.href === "/crm/estimates"
                  ? Boolean(pathname?.startsWith("/crm/estimates")) && !isEstimatorV2Path
                  : item.href === "/crm/estimates/v2"
                    ? isEstimatorV2Path
                    : pathname === item.href || Boolean(pathname?.startsWith(item.href));
            const Icon = item.Icon as LucideIcon;
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "9px 12px",
                  borderRadius: 10,
                  textDecoration: "none",
                  fontWeight: active ? 700 : 500,
                  fontSize: 14,
                  color: active ? "var(--crm-accent-text)" : "var(--crm-text-soft)",
                  background: active
                    ? "linear-gradient(135deg, var(--crm-accent) 0%, var(--crm-accent-strong) 100%)"
                    : "transparent",
                  borderLeft: active
                    ? "none"
                    : "3px solid transparent",
                  transition: "background 120ms, color 120ms",
                }}
              >
                <Icon size={iconSize} aria-hidden="true" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Theme at bottom */}
        <div
          style={{
            padding: "14px 16px",
            borderTop: "1px solid var(--crm-border)",
          }}
        >
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 12,
              fontWeight: 700,
              color: "var(--crm-muted)",
            }}
          >
            Theme
            <select
              value={theme}
              onChange={(event) => updateTheme(event.target.value as ThemeMode)}
              style={{
                flex: 1,
                height: 32,
                borderRadius: 8,
                border: "1px solid var(--crm-border)",
                background: "var(--crm-input)",
                color: "var(--crm-text)",
                fontSize: 12,
                fontWeight: 700,
                padding: "0 6px",
              }}
            >
              <option value="system">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </label>
        </div>
      </aside>

      {/* ── Main content column ── */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>

        {/* Mobile top bar */}
        <div
          className="lg:hidden"
          style={{
            position: "sticky",
            top: 0,
            zIndex: 30,
            borderBottom: "1px solid var(--crm-border)",
            background: "var(--crm-nav-bg)",
            backdropFilter: "blur(8px)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 14px",
              justifyContent: "space-between",
            }}
          >
            <Link
              href="/crm"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                fontWeight: 800,
                fontSize: 15,
                color: "var(--crm-text)",
                textDecoration: "none",
                flexShrink: 0,
              }}
            >
              {!logoError && (
                <span
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 8,
                    background: "var(--crm-card)",
                    border: "1px solid var(--crm-border)",
                    display: "grid",
                    placeItems: "center",
                    overflow: "hidden",
                  }}
                >
                  <Image
                    src={logoSrc}
                    alt="ACE Painting"
                    onError={() => setLogoError(true)}
                    width={22}
                    height={22}
                    unoptimized
                    style={{ width: 22, height: 22, objectFit: "contain" }}
                  />
                </span>
              )}
              ACE CRM
            </Link>
            <select
              value={theme}
              onChange={(event) => updateTheme(event.target.value as ThemeMode)}
              style={{
                height: 30,
                borderRadius: 8,
                border: "1px solid var(--crm-border)",
                background: "var(--crm-input)",
                color: "var(--crm-text)",
                fontSize: 12,
                fontWeight: 700,
                padding: "0 6px",
              }}
            >
              <option value="system">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </div>
          <div
            style={{
              overflowX: "auto",
              display: "flex",
              gap: 6,
              padding: "0 14px 10px",
              scrollbarWidth: "none",
            }}
          >
            {navItems.map((item) => {
              const active =
                item.href === "/crm"
                  ? pathname === item.href
                  : item.href === "/crm/estimates"
                    ? Boolean(pathname?.startsWith("/crm/estimates")) && !isEstimatorV2Path
                    : item.href === "/crm/estimates/v2"
                      ? isEstimatorV2Path
                      : pathname === item.href || Boolean(pathname?.startsWith(item.href));
              const Icon = item.Icon as LucideIcon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  style={{
                    padding: "7px 12px",
                    borderRadius: 10,
                    textDecoration: "none",
                    fontWeight: 700,
                    fontSize: 13,
                    color: active ? "var(--crm-accent-text)" : "var(--crm-text-soft)",
                    background: active
                      ? "linear-gradient(135deg, var(--crm-accent) 0%, var(--crm-accent-strong) 100%)"
                      : "var(--crm-nav-link)",
                    border: active ? "1px solid var(--crm-accent)" : "1px solid var(--crm-border)",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    flexShrink: 0,
                  }}
                >
                  <Icon size={14} aria-hidden="true" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Page content */}
        <div style={{ flex: 1 }}>
          {children}
        </div>
      </div>
    </div>
  );
}
