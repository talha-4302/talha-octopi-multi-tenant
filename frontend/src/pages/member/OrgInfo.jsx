import { useOrg } from '../../api/orgs.js';
import { PageHeader } from '../../components/PageHeader.jsx';
import { StatusBadge } from '../../components/StatusBadge.jsx';

export function MemberOrgInfo() {
  const org = useOrg();

  if (org.isLoading) return <div className="text-slate-500">Loading…</div>;
  if (org.error) return <p className="text-slate-600">{org.error.message}</p>;

  // The API sends a member exactly three fields. There is no billing detail to
  // hide here, because none was ever loaded.
  return (
    <>
      <PageHeader title="Your organization" />
      <dl className="max-w-md space-y-4 rounded-lg border bg-white p-6">
        <div>
          <dt className="text-sm text-slate-500">Name</dt>
          <dd className="font-medium">{org.data.name}</dd>
        </div>
        <div>
          <dt className="text-sm text-slate-500">Plan</dt>
          <dd className="font-medium">{org.data.planName ?? 'No plan'}</dd>
        </div>
        <div>
          <dt className="text-sm text-slate-500">Status</dt>
          <dd>
            <StatusBadge status={org.data.status} />
          </dd>
        </div>
      </dl>
    </>
  );
}
