"use client";

import { useEffect, useMemo, useState } from 'react'
import Link from "next/link";
import { ArrowRight, Mail, MapPin, Phone, Plus } from "lucide-react";
import { CrmButton } from '@/app/crm/_components/CrmButton'
import { CrmChip } from '@/app/crm/_components/CrmChip'
import { CrmEmptyState } from '@/app/crm/_components/CrmEmptyState'
import { CrmNotice } from '@/app/crm/_components/CrmNotice'
import { CrmPageHeader } from '@/app/crm/_components/CrmPageHeader'
import { CrmPageShell } from '@/app/crm/_components/CrmPageShell'
import { CrmSearchBar } from '@/app/crm/_components/CrmSearchBar'
import { CrmSectionCard } from '@/app/crm/_components/CrmSectionCard'
import { useCustomerList } from '@/app/crm/customers/_hooks/useCustomerList'
import { useOrg } from '@/app/crm/customers/customers-orgproviders'

export default function CustomersPage() {
  const { orgId, loading: orgLoading, error: orgError } = useOrg();
  const { customers, total, page, pageSize, search, setSearch, setPage, loading, error } = useCustomerList({
    enabled: !orgLoading && !orgError && Boolean(orgId),
  });
  const [searchInput, setSearchInput] = useState(search);

  useEffect(() => {
    setSearchInput(search);
  }, [search]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      if (searchInput !== search) {
        setSearch(searchInput);
      }
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [search, searchInput, setSearch]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pageLabel = useMemo(() => `Page ${page} of ${totalPages}`, [page, totalPages]);
  const customersLoading = orgLoading || loading;

  return (
    <CrmPageShell>
      <CrmPageHeader
        eyebrow="Relationship hub"
        emoji="👥"
        title="Customers"
        description="Search and manage customer profiles across the CRM with one consistent list, detail, and create flow."
        badge={<CrmChip tone="accent">Org: {orgId || "Loading..."}</CrmChip>}
        actions={
          <CrmButton href="/crm/customers/new" tone="primary">
            <Plus size={16} aria-hidden="true" />
            <span>New customer</span>
          </CrmButton>
        }
      />

      <CrmSearchBar
        value={searchInput}
        onChange={setSearchInput}
        placeholder="Search customers by name, email, or phone..."
        actions={
          <div className="flex items-center gap-2">
            <CrmButton type="button" onClick={() => setPage(page - 1)} disabled={page <= 1 || customersLoading}>
              Prev
            </CrmButton>
            <div className="text-sm font-semibold text-[color:var(--crm-ui-muted)]">{pageLabel}</div>
            <CrmButton
              type="button"
              onClick={() => setPage(page + 1)}
              disabled={page >= totalPages || customersLoading}
            >
              Next
            </CrmButton>
          </div>
        }
      />

      {error ? <CrmNotice tone="error" emoji="⚠️">{error}</CrmNotice> : null}

      {customersLoading ? (
        <CrmSectionCard title="Loading customers" emoji="⏳">
          <p className="text-sm text-[color:var(--crm-ui-muted)]">Pulling the latest customer profiles.</p>
        </CrmSectionCard>
      ) : null}

      {!customersLoading && !error && !orgError && total === 0 && !search.trim() ? (
        <CrmEmptyState
          emoji="🪴"
          title="No customers yet"
          description="Create the first customer profile to start tracking jobs, messages, and estimates in one place."
          action={<CrmButton href="/crm/customers/new" tone="primary">Create customer</CrmButton>}
        />
      ) : null}

      {!customersLoading && !error && !orgError && (total === 0 ? Boolean(search.trim()) : customers.length === 0) ? (
        <CrmEmptyState
          emoji="🔎"
          title="No matching customers"
          description="Try a broader search by name, email, or phone."
        />
      ) : null}

      <div className="grid gap-3">
        {customers.map((customer) => (
          <Link
            key={customer.id}
            href={`/crm/customers/${customer.id}`}
            className="ace-crm-surface block p-4 transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_24px_56px_rgba(17,24,39,0.12)] focus:outline-none focus:ring-2 focus:ring-[color:var(--crm-ui-accent-border)]"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-base font-black text-[color:var(--crm-ui-text)]">
                    {customer.name}
                  </div>
                  <CrmChip tone="default" emoji="🧾">Profile</CrmChip>
                </div>
                <div className="mt-2 flex flex-wrap gap-3 text-sm text-[color:var(--crm-ui-muted)]">
                  {customer.phone ? (
                    <span className="inline-flex items-center gap-1.5">
                      <Phone size={13} aria-hidden="true" />
                      <span>{customer.phone}</span>
                    </span>
                  ) : null}
                  {customer.email ? (
                    <span className="inline-flex items-center gap-1.5">
                      <Mail size={13} aria-hidden="true" />
                      <span>{customer.email}</span>
                    </span>
                  ) : null}
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin size={13} aria-hidden="true" />
                    <span>{customer.address || "No address"}</span>
                  </span>
                </div>
              </div>
              <div className="shrink-0 text-sm font-semibold text-[color:var(--crm-ui-accent)] sm:pt-0.5">
                <span className="inline-flex items-center gap-1 whitespace-nowrap">
                  <span>Open profile</span>
                  <ArrowRight size={12} aria-hidden="true" />
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </CrmPageShell>
  );
}
