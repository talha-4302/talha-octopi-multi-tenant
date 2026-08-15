import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useOrgDetail, useSuspendOrg, useReactivateOrg } from '../../api/admin.js';
import { useOrgTransactions } from '../../api/transactions.js';
import { PageHeader } from '../../components/PageHeader.jsx';
import { DataTable } from '../../components/DataTable.jsx';
import { StatusBadge } from '../../components/StatusBadge.jsx';
import { Button } from '../../components/ui/button.jsx';
import { Input } from '../../components/ui/input.jsx';
import { ORG_STATUS, money, date } from '../../lib/constants.js';

export function OrgDetail() {
  const { orgId } = useParams();
  const detail = useOrgDetail(orgId);
  const suspend = useSuspendOrg();
  const reactivate = useReactivateOrg();
  const [page, setPage] = useState(1);
  const txns = useOrgTransactions(orgId, { page });
  const [reason, setReason] = useState('');
  const [error, setError] = useState(null);

  if (detail.isLoading) return <div className="text-slate-500">Loading…</div>;
  if (detail.error) return <p className="text-rose-600">{detail.error.message}</p>;

  const { organization: org, members, subscriptions } = detail.data;
  const isSuspended = org.status === ORG_STATUS.SUSPENDED;

  return (
    <>
      <PageHeader
        title={org.name}
        description={`Billing ${org.billingEmail} · signed up ${date(org.createdAt)}`}
        action={<StatusBadge status={org.status} />}
      />

      {error && <p className="mb-4 text-sm text-rose-600">{error}</p>}

      <section className="mb-8 rounded-lg border bg-white p-6">
        <h2 className="font-semibold">Access</h2>
        {isSuspended ? (
          <>
            <p className="mt-1 text-sm text-slate-600">
              Suspended{org.suspendedReason ? `: ${org.suspendedReason}` : ''}.
            </p>
            <Button
              className="mt-4"
              disabled={reactivate.isPending}
              onClick={() => {
                setError(null);
                reactivate.mutate(orgId, { onError: (e) => setError(e.message) });
              }}
            >
              Reactivate
            </Button>
          </>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            <Input
              className="max-w-sm"
              placeholder="Reason for suspension"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <Button
              variant="destructive"
              disabled={!reason.trim() || suspend.isPending}
              onClick={() => {
                setError(null);
                suspend.mutate(
                  { orgId, reason },
                  { onError: (e) => setError(e.message), onSuccess: () => setReason('') },
                );
              }}
            >
              Suspend
            </Button>
          </div>
        )}
        {/* Suspending revokes every refresh token in the organization, so
            existing sessions die within the access token's fifteen minutes. */}
      </section>

      <section className="mb-8">
        <h2 className="mb-3 font-semibold">Members ({members.length})</h2>
        <DataTable
          rows={members}
          columns={[
            { key: 'name', header: 'Name' },
            { key: 'email', header: 'Email' },
            { key: 'role', header: 'Role' },
            { key: 'status', header: 'Status', render: (m) => <StatusBadge status={m.status} /> },
            { key: 'createdAt', header: 'Added', render: (m) => date(m.createdAt) },
          ]}
          empty={{ title: 'No members' }}
        />
      </section>

      <section className="mb-8">
        <h2 className="mb-3 font-semibold">Subscription history</h2>
        <DataTable
          rows={subscriptions}
          columns={[
            { key: 'planName', header: 'Plan' },
            { key: 'priceCents', header: 'Price', render: (s) => money(s.priceCents, s.currency) },
            { key: 'status', header: 'Status', render: (s) => <StatusBadge status={s.status} /> },
            { key: 'currentPeriodEnd', header: 'Period end', render: (s) => date(s.currentPeriodEnd) },
            { key: 'createdAt', header: 'Started', render: (s) => date(s.createdAt) },
          ]}
          empty={{ title: 'No subscriptions' }}
        />
      </section>

      <section>
        <h2 className="mb-3 font-semibold">Transactions</h2>
        <DataTable
          columns={[
            { key: 'createdAt', header: 'Date', render: (t) => date(t.createdAt) },
            { key: 'planName', header: 'Plan' },
            { key: 'amountCents', header: 'Amount', render: (t) => money(t.amountCents, t.currency) },
            { key: 'status', header: 'Status', render: (t) => <StatusBadge status={t.status} /> },
            { key: 'failureReason', header: 'Detail' },
          ]}
          rows={txns.data?.data}
          meta={txns.data?.meta}
          isLoading={txns.isLoading}
          error={txns.error}
          onPageChange={setPage}
          empty={{ title: 'No transactions' }}
        />
      </section>
    </>
  );
}
