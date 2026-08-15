import { Link } from 'react-router-dom';
import { useOrg } from '../../api/orgs.js';
import { useSubscription } from '../../api/subscriptions.js';
import { PageHeader } from '../../components/PageHeader.jsx';
import { StatusBadge } from '../../components/StatusBadge.jsx';
import { BlockedNotice } from '../../components/BlockedNotice.jsx';
import { date } from '../../lib/constants.js';

export function OrgDashboard() {
  const org = useOrg();
  const sub = useSubscription({ retry: false });

  if (org.isLoading) return <div className="text-slate-500">Loading…</div>;
  if (org.error) return <BlockedNotice error={org.error} />;

  return (
    <>
      <PageHeader title={org.data.name} description="Everything about your organization in one place." />

      {sub.error && <BlockedNotice error={sub.error} orgStatus={org.data.status} />}

      <div className="grid gap-4 md:grid-cols-3">
        <Card label="Status">
          <StatusBadge status={org.data.status} />
        </Card>
        <Card label="Plan">{org.data.planName ?? 'No plan'}</Card>
        <Card label="Renews">{sub.data?.currentPeriodEnd ? date(sub.data.currentPeriodEnd) : '-'}</Card>
        <Card label="Members">{sub.data ? `${sub.data.seatsUsed} of ${sub.data.seatLimit}` : '-'}</Card>
      </div>

      <div className="mt-6 flex gap-3 text-sm">
        <Link className="underline" to="/app/members">Manage members</Link>
        <Link className="underline" to="/app/subscription">Change plan</Link>
        <Link className="underline" to="/app/billing">Billing</Link>
      </div>
    </>
  );
}

const Card = ({ label, children }) => (
  <div className="rounded-lg border bg-white p-4">
    <p className="text-sm text-slate-500">{label}</p>
    <div className="mt-1 font-medium">{children}</div>
  </div>
);
