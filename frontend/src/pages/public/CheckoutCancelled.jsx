import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useCreateCheckout } from '../../api/subscriptions.js';
import { Button } from '../../components/ui/button.jsx';

export function CheckoutCancelled() {
  const checkout = useCreateCheckout();
  const [error, setError] = useState(null);

  async function retry() {
    setError(null);
    try {
      const { checkoutUrl } = await checkout.mutateAsync({});
      window.location.assign(checkoutUrl);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-20 text-center">
      <h1 className="text-xl font-semibold">Payment was not completed</h1>
      <p className="mt-2 text-slate-600">
        Your organization is registered but not yet active. You can pay now to finish.
      </p>
      {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
      <Button className="mt-6" onClick={retry} disabled={checkout.isPending}>
        {checkout.isPending ? 'Opening checkout…' : 'Pay and activate'}
      </Button>
      <p className="mt-6 text-sm">
        <Link className="underline" to="/login">Sign in instead</Link>
      </p>
    </div>
  );
}
