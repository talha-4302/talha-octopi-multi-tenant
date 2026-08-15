import { useState } from 'react';
import { useAllPlans, useCreatePlan, useUpdatePlan } from '../../api/plans.js';
import { PageHeader } from '../../components/PageHeader.jsx';
import { DataTable } from '../../components/DataTable.jsx';
import { Field } from '../../components/Field.jsx';
import { Button } from '../../components/ui/button.jsx';
import { money } from '../../lib/constants.js';

export function Plans() {
  const plans = useAllPlans();
  const create = useCreatePlan();
  const update = useUpdatePlan();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState(null);
  const [fields, setFields] = useState({});

  async function onCreate(e) {
    e.preventDefault();
    setError(null);
    setFields({});
    const f = Object.fromEntries(new FormData(e.currentTarget));
    try {
      await create.mutateAsync({
        name: f.name,
        priceCents: Number(f.priceCents),
        currency: f.currency || 'usd',
        interval: f.interval,
        maxMembers: Number(f.maxMembers),
        features: f.features.split('\n').map((s) => s.trim()).filter(Boolean),
      });
      setOpen(false);
      e.target.reset();
    } catch (err) {
      setError(err.message);
      setFields(err.fields ?? {});
    }
  }

  const columns = [
    { key: 'name', header: 'Plan' },
    { key: 'priceCents', header: 'Price', render: (p) => `${money(p.priceCents, p.currency)} / ${p.interval}` },
    { key: 'maxMembers', header: 'Seats' },
    { key: 'features', header: 'Features', render: (p) => p.features.join(', ') },
    {
      key: 'isActive',
      header: 'Active',
      className: 'text-right',
      render: (p) => (
        <Button
          variant="outline"
          size="sm"
          disabled={update.isPending}
          onClick={() => {
            setError(null);
            update.mutate({ id: p.id, isActive: !p.isActive }, { onError: (e) => setError(e.message) });
          }}
        >
          {p.isActive ? 'Disable' : 'Enable'}
        </Button>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Plans"
        description="Disabling hides a plan from signup. Existing subscribers are unaffected."
        action={<Button onClick={() => setOpen((v) => !v)}>{open ? 'Cancel' : 'New plan'}</Button>}
      />

      {error && <p className="mb-4 text-sm text-rose-600">{error}</p>}

      {open && (
        <form onSubmit={onCreate} className="mb-6 grid gap-4 rounded-lg border bg-white p-6 md:grid-cols-2">
          <Field label="Name" name="name" required error={fields.name} />
          <Field label="Price in cents" name="priceCents" type="number" min={0} required error={fields.priceCents} />
          <Field label="Currency" name="currency" defaultValue="usd" maxLength={3} />
          <div className="space-y-1.5">
            <span className="text-sm font-medium">Interval</span>
            <select name="interval" className="h-9 w-full rounded border px-2 text-sm">
              <option value="month">Monthly</option>
              <option value="year">Yearly</option>
            </select>
          </div>
          <Field label="Max members" name="maxMembers" type="number" min={1} required error={fields.maxMembers} />
          <div className="space-y-1.5 md:col-span-2">
            <span className="text-sm font-medium">Features, one per line</span>
            <textarea name="features" rows={4} className="w-full rounded border p-2 text-sm" />
          </div>
          <Button type="submit" disabled={create.isPending} className="justify-self-start">
            {create.isPending ? 'Creating in Stripe…' : 'Create plan'}
          </Button>
        </form>
      )}

      <DataTable columns={columns} rows={plans.data} isLoading={plans.isLoading} error={plans.error} empty={{ title: 'No plans yet' }} />
    </>
  );
}
