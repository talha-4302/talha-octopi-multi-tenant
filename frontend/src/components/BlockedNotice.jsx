import { useState } from 'react';
import { useCreateCheckout } from '../api/subscriptions.js';
import { ERROR_CODE, ORG_STATUS } from '../lib/constants.js';
import { Button } from './ui/button.jsx';

export function BlockedNotice({ error, orgStatus }) {
  const checkout = useCreateCheckout();
  const [busy, setBusy] = useState(false);

  if (error?.code !== ERROR_CODE.ORG_NOT_ACTIVE) return null;

  const canPay = orgStatus !== ORG_STATUS.SUSPENDED;

  async function pay() {
    setBusy(true);
    try {
      const { checkoutUrl } = await checkout.mutateAsync({});
      window.location.assign(checkoutUrl);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-6">
      <h2 className="font-semibold text-amber-900">{error.message}</h2>
      <p className="mt-1 text-sm text-amber-800">
        {canPay
          ? 'Complete payment to activate your organization.'
          : 'Contact the platform administrator to restore access.'}
      </p>
      {canPay && (
        <Button className="mt-4" onClick={pay} disabled={busy}>
          {busy ? 'Opening checkout…' : 'Pay and activate'}
        </Button>
      )}
    </div>
  );
}
