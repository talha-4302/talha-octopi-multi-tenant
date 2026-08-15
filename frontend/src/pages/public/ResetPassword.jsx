import { useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useResetPassword } from '../../api/auth.js';
import { Field } from '../../components/Field.jsx';
import { Button } from '../../components/ui/button.jsx';

export function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const reset = useResetPassword();
  const navigate = useNavigate();
  const [error, setError] = useState(null);
  const [fields, setFields] = useState({});

  if (!token) {
    return (
      <div className="mx-auto max-w-sm px-4 py-16 text-center">
        <p className="text-slate-600">That link is not valid.</p>
        <Link className="mt-4 inline-block underline" to="/forgot-password">Request a new one</Link>
      </div>
    );
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    setFields({});
    const { password } = Object.fromEntries(new FormData(e.currentTarget));
    try {
      await reset.mutateAsync({ token, password });
      navigate('/login', { replace: true });
    } catch (err) {
      setError(err.message);
      setFields(err.fields ?? {});
    }
  }

  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <h1 className="text-2xl font-semibold">Choose a new password</h1>
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <Field
          label="New password"
          name="password"
          type="password"
          required
          minLength={8}
          error={fields.password}
          autoComplete="new-password"
        />
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <Button type="submit" className="w-full" disabled={reset.isPending}>
          Save password
        </Button>
      </form>
    </div>
  );
}
