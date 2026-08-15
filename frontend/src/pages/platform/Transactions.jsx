import { useState } from 'react';
import { Link } from 'react-router-dom';
import { usePlatformTransactions } from '../../api/transactions.js';
import { useOrgs } from '../../api/admin.js';
import { PageHeader } from '../../components/PageHeader.jsx';
import { DataTable } from '../../components/DataTable.jsx';
import { StatusBadge } from '../../components/StatusBadge.jsx';
import { Input } from '../../components/ui/input.jsx';
import { TRANSACTION_STATUS, money, date } from '../../lib/constants.js';

export function PlatformTransactions() {
  const [filters, setFilters] = useState({ page: 1, orgId: '', status: '', from: '', to: '' });
  const txns = usePlatformTransactions(filters);
  const orgs = useOrgs({ pageSize: 100 });

  const set = (patch) => setFilters((f) => ({ ...f, ...patch, page: 1 }));

  const columns = [
    { key: 'createdAt', header: 'Date', render: (t) => date(t.createdAt) },
    {
      key: 'orgName',
      header: 'Organization',
      render: (t) => <Link className="underline" to={`/platform/orgs/${t.orgId}`}>{t.orgName}</Link>,
    },
    { key: 'planName', header: 'Plan' },
    { key: 'amountCents', header: 'Amount', render: (t) => money(t.amountCents, t.currency) },
    { key: 'status', header: 'Status', render: (t) => <StatusBadge status={t.status} /> },
  ];

  return (
    <>
      <PageHeader title="Transactions" description="Every payment across every organization." />

      <div className="mb-3 flex flex-wrap gap-2">
        <select className="h-9 rounded border px-2 text-sm" value={filters.orgId} onChange={(e) => set({ orgId: e.target.value })}>
          <option value="">All organizations</option>
          {orgs.data?.data.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
        <select className="h-9 rounded border px-2 text-sm" value={filters.status} onChange={(e) => set({ status: e.target.value })}>
          <option value="">All statuses</option>
          {Object.values(TRANSACTION_STATUS).map((s) => (
            <option key={s} value={s}>
              {s.replace('_', ' ').toLowerCase()}
            </option>
          ))}
        </select>
        <Input type="date" className="w-40" value={filters.from} onChange={(e) => set({ from: e.target.value })} />
        <Input type="date" className="w-40" value={filters.to} onChange={(e) => set({ to: e.target.value })} />
      </div>

      <DataTable
        columns={columns}
        rows={txns.data?.data}
        meta={txns.data?.meta}
        isLoading={txns.isLoading}
        error={txns.error}
        onPageChange={(page) => setFilters((f) => ({ ...f, page }))}
        empty={{ title: 'No transactions match these filters' }}
      />
    </>
  );
}
