"use client";

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
import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, Mail, MapPin, Phone, Plus } from "lucide-react";

export default function CustomersPage() {
  const { orgId } = useOrg();
  const { listCustomers, listLoading, listError } = useCustomerList();
  const [query, setQuery] = useState("");

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return listCustomers;
    return listCustomers.filter((customer) => {
      const hay = `${customer.name ?? ""} ${customer.email ?? ""} ${customer.phone ?? ""} ${customer.address ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [listCustomers, query]);

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
        value={query}
        onChange={setQuery}
        placeholder="Search customers by name, email, phone, or address..."
      />

      {listError ? <CrmNotice tone="error" emoji="⚠️">{listError}</CrmNotice> : null}

      {listLoading ? (
        <CrmSectionCard title="Loading customers" emoji="⏳">
          <p className="text-sm text-[color:var(--crm-ui-muted)]">Pulling the latest customer profiles.</p>
        </CrmSectionCard>
      ) : null}

      {!listLoading && !listError && listCustomers.length === 0 ? (
        <CrmEmptyState
          emoji="🪴"
          title="No customers yet"
          description="Create the first customer profile to start tracking jobs, messages, and estimates in one place."
          action={<CrmButton href="/crm/customers/new" tone="primary">Create customer</CrmButton>}
        />
      ) : null}

      {!listLoading && !listError && listCustomers.length > 0 && filteredRows.length === 0 ? (
        <CrmEmptyState
          emoji="🔎"
          title="No matching customers"
          description="Try a broader search by name, email, phone, or address."
        />
      ) : null}

      <div className="grid gap-3">
        {filteredRows.map((customer) => (
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
