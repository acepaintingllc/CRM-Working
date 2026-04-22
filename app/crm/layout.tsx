"use client";

import { authedFetch } from '@/lib/auth/authedFetch'
import { getBrandLogoUrl } from '@/lib/brand/logo'
import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { SWRConfig } from 'swr'
import type { LucideIcon } from "lucide-react";
import {
  Camera,
  CalendarDays,
  Calculator,
  Cog,
  FileText,
  Home,
  Users,
  Wrench,
} from "lucide-react";

const themeStorageKey = "acecrm.theme";

function resolveStoredTheme() {
  const stored = localStorage.getItem(themeStorageKey);
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export default function CrmLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [logoError, setLogoError] = useState(false);
  const logoSrc = getBrandLogoUrl()
  const iconSize = 16;
  const isQuotePath =
    pathname === "/crm/quotes" ||
    Boolean(pathname?.startsWith("/crm/quotes/")) ||
    pathname === "/crm/estimates/v2" ||
    Boolean(pathname?.startsWith("/crm/estimates/v2/")) ||
    Boolean(pathname && /^\/crm\/estimates\/[^/]+\/v2(?:\/|$)/.test(pathname));
  const navItems = useMemo(
    () => [
      { href: "/crm", label: "Home", Icon: Home },
      { href: "/crm/customers", label: "Customers", Icon: Users },
      { href: "/crm/jobs", label: "Job Center", Icon: Wrench },
      { href: "/crm/quotes", label: "Quotes", Icon: Calculator },
      { href: "/crm/notes", label: "Notes", Icon: FileText },
      { href: "/crm/calendar", label: "Calendar", Icon: CalendarDays },
      { href: "/field/jobs", label: "Field Cam", Icon: Camera },
      { href: "/crm/settings", label: "Settings", Icon: Cog },
    ],
    []
  );

  useEffect(() => {
    const previousTheme = document.documentElement.dataset.theme;
    document.documentElement.dataset.theme = "dark";

    return () => {
      document.documentElement.dataset.theme = previousTheme || resolveStoredTheme();
    };
  }, []);

  useEffect(() => {
    let alive = true;

    (async () => {
      if (!alive) return;

      try {
        const bootstrapRes = await authedFetch("/api/bootstrap-org", { method: "POST" });
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
  }, [pathname]);

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
                : item.href === "/crm/quotes"
                  ? isQuotePath
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
            <span>Theme</span>
            <span
              style={{
                flex: 1,
                height: 32,
                borderRadius: 8,
                border: "1px solid var(--crm-border)",
                background: "var(--crm-input)",
                color: "var(--crm-text)",
                fontSize: 12,
                fontWeight: 700,
                padding: "0 10px",
                display: "inline-flex",
                alignItems: "center",
              }}
            >
              Dark
            </span>
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
            <div
              style={{
                height: 30,
                borderRadius: 8,
                border: "1px solid var(--crm-border)",
                background: "var(--crm-input)",
                color: "var(--crm-text)",
                fontSize: 12,
                fontWeight: 700,
                padding: "0 10px",
                display: "inline-flex",
                alignItems: "center",
              }}
            >
              Dark
            </div>
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
                  : item.href === "/crm/quotes"
                    ? isQuotePath
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
          <SWRConfig
            value={{
              fetcher: (url: string) => authedFetch(url).then((response) => response.json()),
              revalidateOnFocus: false,
              dedupingInterval: 5000,
            }}
          >
            {children}
          </SWRConfig>
        </div>
      </div>
    </div>
  );
}
