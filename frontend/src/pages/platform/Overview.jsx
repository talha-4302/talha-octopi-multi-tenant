import { Link } from 'react-router-dom';
import { useStats } from '../../api/admin.js';
import { PageHeader } from '../../components/PageHeader.jsx';
import { StatusBadge } from '../../components/StatusBadge.jsx';
import { money, date } from '../../lib/constants.js';

export function Overview() {
  const stats = useStats();

  if (stats.isLoading) return <div className="text-slate-500">Loading…</div>;
  if (stats.error) return <p className="text-rose-600">{stats.error.message}</p>;

  const s = stats.data;

  return (
    <>
      <PageHeader title="Overview" />

      <div className="grid gap-4 md:grid-cols-4">
        <Tile label="Organizations" value={s.totalOrganizations} />
        <Tile label="Users" value={s.totalUsers} />
        <Tile label="Active subscriptions" value={s.activeSubscriptions} />
        <Tile label="Failed payments" value={s.failedPayments} />
      </div>

      <h2 className="mt-10 mb-3 font-semibold">Revenue</h2>
      {/* One row per currency. Cents are not comparable across currencies,
          so no single total is shown anywhere. */}
      {s.revenue.length === 0 ? (
        <p className="text-slate-500">No successful payments yet.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          {s.revenue.map((r) => (
            <Tile
              key={r.currency}
              label={`Revenue (${r.currency.toUpperCase()})`}
              value={money(r.totalCents, r.currency)}
              hint={`${r.payments} payments`}
            />
          ))}
        </div>
      )}

      <h2 className="mt-10 mb-3 font-semibold">Recent signups</h2>
      <ul className="divide-y rounded-lg border bg-white">
        {s.recentSignups.map((o) => (
          <li key={o.id} className="flex items-center justify-between px-4 py-3">
            <Link className="underline" to={`/platform/orgs/${o.id}`}>{o.name}</Link>
            <span className="flex items-center gap-3 text-sm text-slate-500">
              {date(o.createdAt)} <StatusBadge status={o.status} />
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}

const Tile = ({ label, value, hint }) => (
  <div className="rounded-lg border bg-white p-4">
    <p className="text-sm text-slate-500">{label}</p>
    <p className="mt-1 text-2xl font-semibold">{value}</p>
    {hint && <p className="text-xs text-slate-500">{hint}</p>}
  </div>
);
