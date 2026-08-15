import { useState } from 'react';
import { useTransactions } from '../../api/transactions.js';
import { PageHeader } from '../../components/PageHeader.jsx';
import { DataTable } from '../../components/DataTable.jsx';
import { StatusBadge } from '../../components/StatusBadge.jsx';
import { TRANSACTION_STATUS, money, date } from '../../lib/constants.js';

export function OrgTransactions() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const txns = useTransactions({ page, status });

  const columns = [
    { key: 'createdAt', header: 'Date', render: (t) => date(t.createdAt) },
    { key: 'planName', header: 'Plan' },
    { key: 'amountCents', header: 'Amount', render: (t) => money(t.amountCents, t.currency) },
    { key: 'status', header: 'Status', render: (t) => <StatusBadge status={t.status} /> },
    {
      key: 'failureReason',
      header: 'Detail',
      render: (t) => <span className="text-slate-500">{t.failureReason ?? ''}</span>,
    },
  ];

  return (
    <>
      <PageHeader title="Transactions" description="Every payment attempt, including failures." />

      <div className="mb-3">
        <select
          className="h-9 rounded border px-2 text-sm"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All statuses</option>
          {Object.values(TRANSACTION_STATUS).map((s) => (
            <option key={s} value={s}>
              {s.replace('_', ' ').toLowerCase()}
            </option>
          ))}
        </select>
      </div>

      <DataTable
        columns={columns}
        rows={txns.data?.data}
        meta={txns.data?.meta}
        isLoading={txns.isLoading}
        error={txns.error}
        onPageChange={setPage}
        empty={{ title: 'No transactions yet' }}
      />
    </>
  );
}
