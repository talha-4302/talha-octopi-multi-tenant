import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../../lib/api.js';
import { useAcceptInvite } from '../../api/auth.js';
import { Field } from '../../components/Field.jsx';
import { Button } from '../../components/ui/button.jsx';

export function AcceptInvite() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const accept = useAcceptInvite();
  const navigate = useNavigate();

  const [invite, setInvite] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [error, setError] = useState(null);
  const [fields, setFields] = useState({});

  useEffect(() => {
    if (!token) return;
    api.get(`/auth/invite/${token}`).then(setInvite).catch((e) => setLoadError(e.message));
  }, [token]);

  if (!token || loadError) {
    return (
      <div className="mx-auto max-w-sm px-4 py-16 text-center">
        <p className="text-slate-600">{loadError ?? 'That invitation link is not valid.'}</p>
        <Link className="mt-4 inline-block underline" to="/login">Go to sign in</Link>
      </div>
    );
  }

  if (!invite) return <div className="p-8 text-slate-500">Loading…</div>;

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    setFields({});
    const { password } = Object.fromEntries(new FormData(e.currentTarget));
    try {
      await accept.mutateAsync({ token, password });
      navigate('/login', { replace: true });
    } catch (err) {
      setError(err.message);
      setFields(err.fields ?? {});
    }
  }

  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <h1 className="text-2xl font-semibold">Join {invite.orgName}</h1>
      <p className="mt-2 text-sm text-slate-600">
        Hello {invite.name}. Choose a password for {invite.email}.
      </p>
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <Field
          label="Password"
          name="password"
          type="password"
          required
          minLength={8}
          error={fields.password}
          autoComplete="new-password"
        />
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <Button type="submit" className="w-full" disabled={accept.isPending}>
          Accept invitation
        </Button>
      </form>
    </div>
  );
}
