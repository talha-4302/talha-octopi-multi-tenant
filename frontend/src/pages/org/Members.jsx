import { useState } from 'react';
import { useMembers, useInviteMember, useChangeRole, useRemoveMember } from '../../api/members.js';
import { PageHeader } from '../../components/PageHeader.jsx';
import { DataTable } from '../../components/DataTable.jsx';
import { StatusBadge } from '../../components/StatusBadge.jsx';
import { Field } from '../../components/Field.jsx';
import { BlockedNotice } from '../../components/BlockedNotice.jsx';
import { Button } from '../../components/ui/button.jsx';
import { ROLES, ERROR_CODE, date } from '../../lib/constants.js';

export function Members() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [open, setOpen] = useState(false);
  const [error, setError] = useState(null);
  const [fields, setFields] = useState({});

  const members = useMembers({ page, status });
  const invite = useInviteMember();
  const changeRole = useChangeRole();
  const remove = useRemoveMember();

  if (members.error?.code === ERROR_CODE.ORG_NOT_ACTIVE) return <BlockedNotice error={members.error} />;

  async function onInvite(e) {
    e.preventDefault();
    setError(null);
    setFields({});
    const form = Object.fromEntries(new FormData(e.currentTarget));
    try {
      await invite.mutateAsync(form);
      setOpen(false);
      e.target.reset();
    } catch (err) {
      setError(err.message);
      setFields(err.fields ?? {});
    }
  }

  const columns = [
    { key: 'name', header: 'Name' },
    { key: 'email', header: 'Email' },
    {
      key: 'role',
      header: 'Role',
      render: (m) => (
        <select
          className="rounded border px-2 py-1 text-sm"
          value={m.role}
          onChange={(e) =>
            changeRole.mutate({ id: m.id, role: e.target.value }, { onError: (err) => setError(err.message) })
          }
        >
          <option value={ROLES.ORG_ADMIN}>Admin</option>
          <option value={ROLES.ORG_MEMBER}>Member</option>
        </select>
      ),
    },
    { key: 'status', header: 'Status', render: (m) => <StatusBadge status={m.status} /> },
    { key: 'createdAt', header: 'Added', render: (m) => date(m.createdAt) },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (m) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => remove.mutate(m.id, { onError: (err) => setError(err.message) })}
        >
          Remove
        </Button>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Members"
        description="Invite people and set what they can do."
        action={<Button onClick={() => setOpen((v) => !v)}>{open ? 'Cancel' : 'Invite member'}</Button>}
      />

      {error && (
        <p className="mb-4 rounded border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">{error}</p>
      )}

      {open && (
        <form onSubmit={onInvite} className="mb-6 grid gap-4 rounded-lg border bg-white p-6 md:grid-cols-3">
          <Field label="Email" name="email" type="email" required error={fields.email} />
          <Field label="Name" name="name" required error={fields.name} />
          <div className="space-y-1.5">
            <span className="text-sm font-medium">Role</span>
            <select name="role" defaultValue={ROLES.ORG_MEMBER} className="h-9 w-full rounded border px-2 text-sm">
              <option value={ROLES.ORG_MEMBER}>Member</option>
              <option value={ROLES.ORG_ADMIN}>Admin</option>
            </select>
          </div>
          <Button type="submit" disabled={invite.isPending} className="justify-self-start md:col-span-3">
            {invite.isPending ? 'Sending invitation…' : 'Send invitation'}
          </Button>
        </form>
      )}

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
          <option value="ACTIVE">Active</option>
          <option value="INVITED">Invited</option>
          <option value="REMOVED">Removed</option>
        </select>
      </div>

      <DataTable
        columns={columns}
        rows={members.data?.data}
        meta={members.data?.meta}
        isLoading={members.isLoading}
        error={members.error}
        onPageChange={setPage}
        empty={{ title: 'No members yet', hint: 'Invite your first teammate above.' }}
      />
    </>
  );
}
