"use client";

import { useCustomerList } from '@/app/crm/customers/_hooks/useCustomerList'
import { useOrg } from '@/app/crm/customers/customers-orgproviders'
import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, Mail, MapPin, Phone, Plus, Search, Users } from "lucide-react";

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
    <div className="min-h-full bg-gradient-to-br from-gray-50 to-gray-200 py-4 md:py-6">
      <div className="mx-auto max-w-6xl space-y-4 px-4 md:space-y-5 md:px-6">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h1 className="inline-flex items-center gap-2 text-2xl font-extrabold text-gray-900">
                <Users size={20} aria-hidden="true" />
                <span>Customers</span>
              </h1>
              <p className="mt-1 text-sm text-gray-600">Search and manage customer profiles.</p>
              <div className="mt-2 inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs text-gray-500">
                Org: {orgId || "Loading..."}
              </div>
            </div>
            <Link
              href="/crm/customers/new"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-black px-3 py-2 text-sm font-semibold text-white transition-transform hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-black/80"
            >
              <Plus size={16} aria-hidden="true" />
              <span>New customer</span>
            </Link>
          </div>
        </div>

        <div className="relative rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
          <Search
            size={16}
            aria-hidden="true"
            className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search customers by name, email, phone, or address..."
            className="h-11 w-full rounded-xl border border-gray-300 bg-white pl-10 pr-3 text-sm text-gray-900 outline-none ring-black/70 transition placeholder:text-gray-400 focus:ring-2"
          />
        </div>

        {listLoading && <div className="text-sm text-gray-600">Loading...</div>}
        {listError && <div className="text-sm text-red-600">{listError}</div>}

        {!listLoading && !listError && listCustomers.length === 0 && (
          <div className="rounded-2xl border border-gray-200 bg-white p-4 text-sm text-gray-600 shadow-sm">
            No customers yet.
          </div>
        )}

        <div className="space-y-3">
          {!listLoading && !listError && listCustomers.length > 0 && filteredRows.length === 0 && (
            <div className="rounded-2xl border border-gray-200 bg-white p-4 text-sm text-gray-600 shadow-sm">
              No matching customers.
            </div>
          )}
          {filteredRows.map((customer) => (
            <Link
              key={customer.id}
              href={`/crm/customers/${customer.id}`}
              className="block rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-black/70"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="inline-flex items-center gap-2 text-base font-bold text-gray-900">
                    <Users size={16} aria-hidden="true" />
                    <span className="truncate">{customer.name}</span>
                  </div>
                  <div className="mt-1 text-sm text-gray-700">
                    {customer.phone ? (
                      <span className="inline-flex items-center gap-1">
                        <Phone size={13} aria-hidden="true" />
                        <span>{customer.phone}</span>
                      </span>
                    ) : null}
                    {customer.phone && customer.email ? <span> | </span> : null}
                    {customer.email ? (
                      <span className="inline-flex items-center gap-1">
                        <Mail size={13} aria-hidden="true" />
                        <span>{customer.email}</span>
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-1 text-sm text-gray-700 inline-flex items-center gap-1">
                    {customer.address ? (
                      <>
                        <MapPin size={13} aria-hidden="true" />
                        <span>{customer.address}</span>
                      </>
                    ) : (
                      <span className="text-gray-500">No address</span>
                    )}
                  </div>
                </div>
                <div className="shrink-0 text-sm font-medium text-gray-500 sm:pt-0.5">
                  <span className="inline-flex items-center gap-1 whitespace-nowrap">
                    <span>Open profile</span>
                    <ArrowRight size={12} aria-hidden="true" />
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
