import { Link } from 'react-router-dom';
import { Button } from '../../components/ui/button.jsx';
import { usePlans } from '../../api/plans.js';
import { money } from '../../lib/constants.js';

export function Landing() {
  const { data: plans, isLoading } = usePlans();

  return (
    <div className="mx-auto max-w-5xl px-4 py-16">
      <h1 className="text-3xl font-semibold">Run your organization on one subscription</h1>
      <p className="mt-2 text-slate-600">Pick a plan, pay, and invite your team.</p>

      <div className="mt-10 grid gap-4 md:grid-cols-3">
        {isLoading && <p className="text-slate-500">Loading plans…</p>}
        {plans?.map((plan) => (
          <div key={plan.id} className="rounded-lg border bg-white p-6">
            <h2 className="font-semibold">{plan.name}</h2>
            <p className="mt-1 text-2xl font-semibold">
              {money(plan.priceCents, plan.currency)}
              <span className="text-sm font-normal text-slate-500"> / {plan.interval}</span>
            </p>
            <ul className="mt-4 space-y-1 text-sm text-slate-600">
              {plan.features.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
            <p className="mt-4 text-sm text-slate-500">Up to {plan.maxMembers} members</p>
            <Button asChild className="mt-6 w-full">
              <Link to={`/signup?plan=${plan.id}`}>Choose {plan.name}</Link>
            </Button>
          </div>
        ))}
      </div>

      <p className="mt-10 text-sm">
        Already have an account? <Link className="underline" to="/login">Sign in</Link>
      </p>
    </div>
  );
}
