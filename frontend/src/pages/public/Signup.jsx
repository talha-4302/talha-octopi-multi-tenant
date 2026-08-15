import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthProvider.jsx';
import { usePlans } from '../../api/plans.js';
import { Field } from '../../components/Field.jsx';
import { Button } from '../../components/ui/button.jsx';
import { money } from '../../lib/constants.js';

export function Signup() {
  const [params] = useSearchParams();
  const { register } = useAuth();
  const { data: plans } = usePlans();

  const [planId, setPlanId] = useState(params.get('plan') ?? '');
  const [fields, setFields] = useState({});
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const selected = plans?.find((p) => p.id === planId);

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setFields({});
    const form = Object.fromEntries(new FormData(e.currentTarget));
    try {
      const { checkoutUrl } = await register({ ...form, planId });
      // Straight to Stripe. No card field ever renders in this application.
      window.location.assign(checkoutUrl);
    } catch (err) {
      setError(err.message);
      setFields(err.fields ?? {});
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-2xl font-semibold">Create your organization</h1>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <Field label="Organization name" name="organizationName" required error={fields.organizationName} />
        <Field label="Your name" name="name" required error={fields.name} />
        <Field label="Email" name="email" type="email" required error={fields.email} />
        <Field
          label="Password"
          name="password"
          type="password"
          required
          minLength={8}
          error={fields.password}
        />

        <div className="space-y-1.5">
          <span className="text-sm font-medium">Plan</span>
          <div className="grid gap-2">
            {plans?.map((plan) => (
              <label
                key={plan.id}
                className={`flex cursor-pointer items-center justify-between rounded border px-3 py-2 ${
                  planId === plan.id ? 'border-slate-900 bg-slate-50' : ''
                }`}
              >
                <span className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="plan"
                    value={plan.id}
                    checked={planId === plan.id}
                    onChange={() => setPlanId(plan.id)}
                  />
                  {plan.name}
                </span>
                <span className="text-sm text-slate-600">
                  {money(plan.priceCents, plan.currency)} / {plan.interval}
                </span>
              </label>
            ))}
          </div>
        </div>

        {error && <p className="text-sm text-rose-600">{error}</p>}

        <Button type="submit" className="w-full" disabled={busy || !planId}>
          {busy
            ? 'Redirecting to checkout…'
            : `Continue to payment${selected ? ` (${money(selected.priceCents, selected.currency)})` : ''}`}
        </Button>
      </form>

      <p className="mt-6 text-sm">
        Already registered? <Link className="underline" to="/login">Sign in</Link>
      </p>
    </div>
  );
}
