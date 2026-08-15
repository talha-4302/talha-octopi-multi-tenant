import { useState } from 'react';
import { useTransactions } from '../../api/transactions.js';
import { useBillingPortal } from '../../api/subscriptions.js';
import { PageHeader } from '../../components/PageHeader.jsx';
import { DataTable } from '../../components/DataTable.jsx';
import { StatusBadge } from '../../components/StatusBadge.jsx';
import { Button } from '../../components/ui/button.jsx';
import { money, date } from '../../lib/constants.js';

export function Billing() {
  const [page, setPage] = useState(1);
  const payments = useTransactions({ page, status: 'SUCCESS' });
  const portal = useBillingPortal();
  const [error, setError] = useState(null);

  async function openPortal() {
    setError(null);
    try {
      const { portalUrl } = await portal.mutateAsync();
      window.location.assign(portalUrl);
    } catch (err) {
      setError(err.message);
    }
  }

  const columns = [
    { key: 'createdAt', header: 'Date', render: (t) => date(t.createdAt) },
    { key: 'planName', header: 'Plan' },
    { key: 'amountCents', header: 'Amount', render: (t) => money(t.amountCents, t.currency) },
    { key: 'status', header: 'Status', render: (t) => <StatusBadge status={t.status} /> },
    {
      key: 'invoiceUrl',
      header: 'Invoice',
      className: 'text-right',
      render: (t) =>
        t.invoiceUrl ? (
          <a className="underline" href={t.invoiceUrl} target="_blank" rel="noreferrer">
            Download
          </a>
        ) : (
          <span className="text-slate-400">-</span>
        ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Billing and payments"
        description="Card details are managed by Stripe. We never store them."
        action={
          <Button variant="outline" onClick={openPortal} disabled={portal.isPending}>
            {portal.isPending ? 'Opening…' : 'Manage payment method'}
          </Button>
        }
      />

      {error && <p className="mb-4 text-sm text-rose-600">{error}</p>}

      <DataTable
        columns={columns}
        rows={payments.data?.data}
        meta={payments.data?.meta}
        isLoading={payments.isLoading}
        error={payments.error}
        onPageChange={setPage}
        empty={{ title: 'No payments yet' }}
      />
    </>
  );
}
