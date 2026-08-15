import { useState } from 'react';
import { useOrg, useUpdateOrg } from '../../api/orgs.js';
import { PageHeader } from '../../components/PageHeader.jsx';
import { Field } from '../../components/Field.jsx';
import { BlockedNotice } from '../../components/BlockedNotice.jsx';
import { Button } from '../../components/ui/button.jsx';

export function OrgProfile() {
  const org = useOrg();
  const update = useUpdateOrg();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);
  const [fields, setFields] = useState({});

  if (org.isLoading) return <div className="text-slate-500">Loading…</div>;
  if (org.error) return <BlockedNotice error={org.error} />;

  async function onSubmit(e) {
    e.preventDefault();
    setSaved(false);
    setError(null);
    setFields({});
    const form = Object.fromEntries(new FormData(e.currentTarget));
    try {
      await update.mutateAsync({
        name: form.name,
        contactEmail: form.contactEmail || null,
        billingEmail: form.billingEmail,
      });
      setSaved(true);
    } catch (err) {
      setError(err.message);
      setFields(err.fields ?? {});
    }
  }

  return (
    <>
      <PageHeader title="Organization profile" description="Billing emails and receipts go to the billing address." />
      <form onSubmit={onSubmit} className="max-w-md space-y-4 rounded-lg border bg-white p-6">
        <Field label="Name" name="name" defaultValue={org.data.name} required error={fields.name} />
        <Field
          label="Contact email"
          name="contactEmail"
          type="email"
          defaultValue={org.data.contactEmail ?? ''}
          error={fields.contactEmail}
        />
        <Field
          label="Billing email"
          name="billingEmail"
          type="email"
          defaultValue={org.data.billingEmail}
          required
          error={fields.billingEmail}
        />
        {error && <p className="text-sm text-rose-600">{error}</p>}
        {saved && <p className="text-sm text-emerald-700">Saved.</p>}
        <Button type="submit" disabled={update.isPending}>
          {update.isPending ? 'Saving…' : 'Save changes'}
        </Button>
      </form>
    </>
  );
}
