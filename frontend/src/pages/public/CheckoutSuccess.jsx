import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api.js';
import { SUBSCRIPTION_STATUS } from '../../lib/constants.js';

const POLL_MS = 2000;
const GIVE_UP_MS = 20000;

/**
 * This page NEVER writes. Activation is driven by the webhook; the redirect
 * carries no authority. All this does is wait for the webhook to land.
 */
export function CheckoutSuccess() {
  const [state, setState] = useState('waiting'); // waiting | active | slow
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    let cancelled = false;
    const startedAt = Date.now();

    async function poll() {
      if (cancelled) return;
      try {
        const sub = await api.get('/subscription');
        if (sub.status === SUBSCRIPTION_STATUS.ACTIVE) {
          queryClient.invalidateQueries();
          setState('active');
          setTimeout(() => navigate('/app', { replace: true }), 800);
          return;
        }
      } catch {
        /* still pending, keep waiting */
      }

      if (Date.now() - startedAt > GIVE_UP_MS) {
        setState('slow');
        return;
      }
      setTimeout(poll, POLL_MS);
    }

    poll();
    return () => {
      cancelled = true;
    };
  }, [navigate, queryClient]);

  return (
    <div className="mx-auto max-w-md px-4 py-20 text-center">
      {state === 'waiting' && (
        <>
          <h1 className="text-xl font-semibold">Confirming your payment</h1>
          <p className="mt-2 text-slate-600">
            This takes a moment. We are waiting for confirmation from Stripe.
          </p>
        </>
      )}
      {state === 'active' && (
        <>
          <h1 className="text-xl font-semibold">You are all set</h1>
          <p className="mt-2 text-slate-600">Taking you to your dashboard…</p>
        </>
      )}
      {state === 'slow' && (
        <>
          <h1 className="text-xl font-semibold">Payment received</h1>
          {/* Deliberately not an error. A slow webhook is normal, and the
              organization activates whether or not this tab is still open. */}
          <p className="mt-2 text-slate-600">
            Activation is still in progress. You can close this page; we will email you when it is
            done.
          </p>
        </>
      )}
    </div>
  );
}
