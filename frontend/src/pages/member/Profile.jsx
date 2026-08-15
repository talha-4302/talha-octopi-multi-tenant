import { useState } from 'react';
import { useAuth } from '../../auth/AuthProvider.jsx';
import { useMe, useChangePassword } from '../../api/auth.js';
import { PageHeader } from '../../components/PageHeader.jsx';
import { Field } from '../../components/Field.jsx';
import { Button } from '../../components/ui/button.jsx';

export function MemberProfile() {
  const { user, setUser } = useAuth();
  const updateMe = useMe();
  const changePassword = useChangePassword();
  const [msg, setMsg] = useState(null);
  const [error, setError] = useState(null);
  const [fields, setFields] = useState({});

  async function saveName(e) {
    e.preventDefault();
    setMsg(null);
    setError(null);
    const { name } = Object.fromEntries(new FormData(e.currentTarget));
    try {
      const updated = await updateMe.mutateAsync({ name });
      setUser(updated);
      setMsg('Profile saved.');
    } catch (err) {
      setError(err.message);
    }
  }

  async function savePassword(e) {
    e.preventDefault();
    setMsg(null);
    setError(null);
    setFields({});
    const form = Object.fromEntries(new FormData(e.currentTarget));
    try {
      await changePassword.mutateAsync(form);
      e.target.reset();
      setMsg('Password changed. Your other sessions were signed out.');
    } catch (err) {
      setError(err.message);
      setFields(err.fields ?? {});
    }
  }

  return (
    <>
      <PageHeader title="Your account" />
      {msg && <p className="mb-4 text-sm text-emerald-700">{msg}</p>}
      {error && <p className="mb-4 text-sm text-rose-600">{error}</p>}

      <div className="grid gap-6 md:grid-cols-2">
        <form onSubmit={saveName} className="space-y-4 rounded-lg border bg-white p-6">
          <h2 className="font-semibold">Details</h2>
          <Field label="Name" name="name" defaultValue={user?.name} required />
          {/* Email is the login identity. Changing it would need re-verification,
              which the brief never asks for, so it is shown read only. */}
          <Field label="Email" name="email" defaultValue={user?.email} disabled />
          <Button type="submit" disabled={updateMe.isPending}>Save</Button>
        </form>

        <form onSubmit={savePassword} className="space-y-4 rounded-lg border bg-white p-6">
          <h2 className="font-semibold">Change password</h2>
          <Field
            label="Current password"
            name="currentPassword"
            type="password"
            required
            autoComplete="current-password"
          />
          <Field
            label="New password"
            name="newPassword"
            type="password"
            required
            minLength={8}
            error={fields.newPassword}
            autoComplete="new-password"
          />
          <Button type="submit" disabled={changePassword.isPending}>Change password</Button>
        </form>
      </div>
    </>
  );
}
