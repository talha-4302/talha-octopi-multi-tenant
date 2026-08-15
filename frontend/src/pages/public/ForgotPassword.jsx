import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForgotPassword } from '../../api/auth.js';
import { Field } from '../../components/Field.jsx';
import { Button } from '../../components/ui/button.jsx';

export function ForgotPassword() {
  const forgot = useForgotPassword();
  const [sent, setSent] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    const { email } = Object.fromEntries(new FormData(e.currentTarget));
    await forgot.mutateAsync(email).catch(() => {});
    // Always the same outcome. The API answers identically whether or not the
    // address exists, and this screen must not undo that.
    setSent(true);
  }

  if (sent) {
    return (
      <div className="mx-auto max-w-sm px-4 py-16 text-center">
        <h1 className="text-xl font-semibold">Check your email</h1>
        <p className="mt-2 text-slate-600">
          If that address has an account, a reset link is on its way. It expires in one hour.
        </p>
        <Link className="mt-6 inline-block underline" to="/login">Back to sign in</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <h1 className="text-2xl font-semibold">Reset your password</h1>
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <Field label="Email" name="email" type="email" required />
        <Button type="submit" className="w-full" disabled={forgot.isPending}>
          {forgot.isPending ? 'Sending…' : 'Send reset link'}
        </Button>
      </form>
    </div>
  );
}
