import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useOrgs } from '../../api/admin.js';
import { PageHeader } from '../../components/PageHeader.jsx';
import { DataTable } from '../../components/DataTable.jsx';
import { StatusBadge } from '../../components/StatusBadge.jsx';
import { Input } from '../../components/ui/input.jsx';
import { ORG_STATUS, date } from '../../lib/constants.js';

export function Orgs() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const orgs = useOrgs({ page, search, status });

  const columns = [
    {
      key: 'name',
      header: 'Organization',
      render: (o) => (
        <Link className="font-medium underline" to={`/platform/orgs/${o.id}`}>{o.name}</Link>
      ),
    },
    { key: 'planName', header: 'Plan', render: (o) => o.planName ?? '-' },
    { key: 'status', header: 'Status', render: (o) => <StatusBadge status={o.status} /> },
    { key: 'memberCount', header: 'Members' },
    { key: 'createdAt', header: 'Signed up', render: (o) => date(o.createdAt) },
  ];

  return (
    <>
      <PageHeader title="Organizations" />

      <div className="mb-3 flex flex-wrap gap-2">
        <Input
          className="max-w-xs"
          placeholder="Search by name"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <select
          className="h-9 rounded border px-2 text-sm"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All statuses</option>
          {Object.values(ORG_STATUS).map((s) => (
            <option key={s} value={s}>
              {s.toLowerCase()}
            </option>
          ))}
        </select>
      </div>

      <DataTable
        columns={columns}
        rows={orgs.data?.data}
        meta={orgs.data?.meta}
        isLoading={orgs.isLoading}
        error={orgs.error}
        onPageChange={setPage}
        empty={{ title: 'No organizations match', hint: 'Try a different search or filter.' }}
      />
    </>
  );
}
