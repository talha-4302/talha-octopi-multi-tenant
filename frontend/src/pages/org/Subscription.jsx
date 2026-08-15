import { useState } from 'react';
import { usePlans } from '../../api/plans.js';
import { useSubscription, useChangePlan, useCancelSubscription } from '../../api/subscriptions.js';
import { PageHeader } from '../../components/PageHeader.jsx';
import { StatusBadge } from '../../components/StatusBadge.jsx';
import { BlockedNotice } from '../../components/BlockedNotice.jsx';
import { Button } from '../../components/ui/button.jsx';
import { money, date } from '../../lib/constants.js';

export function Subscription() {
  const sub = useSubscription({ retry: false });
  const plans = usePlans();
  const change = useChangePlan();
  const cancel = useCancelSubscription();
  const [error, setError] = useState(null);

  if (sub.isLoading) return <div className="text-slate-500">Loading…</div>;
  if (sub.error) return <BlockedNotice error={sub.error} />;

  const current = sub.data;

  return (
    <>
      <PageHeader title="Subscription" />

      {error && (
        <p className="mb-4 rounded border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">{error}</p>
      )}

      <div className="rounded-lg border bg-white p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-lg font-semibold">{current.planName}</p>
            <p className="text-sm text-slate-600">{money(current.priceCents, current.currency)} per period</p>
          </div>
          <StatusBadge status={current.status} />
        </div>

        <dl className="mt-6 grid gap-4 text-sm md:grid-cols-3">
          <div>
            <dt className="text-slate-500">Renews</dt>
            <dd className="font-medium">{date(current.currentPeriodEnd) || '-'}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Members</dt>
            <dd className="font-medium">
              {current.seatsUsed} of {current.seatLimit}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Cancels at period end</dt>
            <dd className="font-medium">{current.cancelAtPeriodEnd ? 'Yes' : 'No'}</dd>
          </div>
        </dl>

        {!current.cancelAtPeriodEnd && (
          <Button
            variant="outline"
            className="mt-6"
            disabled={cancel.isPending}
            onClick={() => {
              setError(null);
              cancel.mutate(undefined, { onError: (e) => setError(e.message) });
            }}
          >
            {cancel.isPending ? 'Cancelling…' : 'Cancel subscription'}
          </Button>
        )}
      </div>

      <h2 className="mt-10 mb-3 font-semibold">Change plan</h2>
      <div className="grid gap-4 md:grid-cols-3">
        {plans.data?.map((plan) => {
          const isCurrent = plan.id === current.planId;
          return (
            <div key={plan.id} className={`rounded-lg border bg-white p-6 ${isCurrent ? 'border-slate-900' : ''}`}>
              <p className="font-semibold">{plan.name}</p>
              <p className="mt-1 text-xl font-semibold">
                {money(plan.priceCents, plan.currency)}
                <span className="text-sm font-normal text-slate-500"> / {plan.interval}</span>
              </p>
              <p className="mt-2 text-sm text-slate-500">Up to {plan.maxMembers} members</p>
              <Button
                className="mt-4 w-full"
                variant={isCurrent ? 'secondary' : 'default'}
                disabled={isCurrent || change.isPending}
                onClick={() => {
                  setError(null);
                  change.mutate(plan.id, { onError: (e) => setError(e.message) });
                }}
              >
                {isCurrent ? 'Current plan' : plan.priceCents > current.priceCents ? 'Upgrade' : 'Downgrade'}
              </Button>
            </div>
          );
        })}
      </div>
    </>
  );
}
