import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { changeRecoveredPassword } from '../lib/authRecovery';
import AuthLayout from './auth/AuthLayout';
import PasswordField from './auth/PasswordField';
import SubmitButton from './auth/SubmitButton';
import Notice from './auth/Notice';

export default function PasswordRecovery({ session, restoring, onClose }) {
  const [password, setPassword] = useState(''), [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [done, setDone] = useState(false);
  const inFlight = useRef(false), heading = useRef(null);
  useEffect(() => { heading.current?.focus(); }, [restoring, done]);
  const url = new URL(window.location.href), hash = new URLSearchParams(url.hash.slice(1));
  const expired = url.searchParams.has('error') || hash.has('error') || !session;
  const save = async event => {
    event.preventDefault();
    if (inFlight.current || restoring || expired) return;
    inFlight.current = true; setBusy(true); setError('');
    try {
      const result = await changeRecoveredPassword(supabase, session.user.id, password, confirmation);
      if (!result.ok) { setError(result.error); return; }
      setDone(true); setPassword(''); setConfirmation('');
    } finally { inFlight.current = false; setBusy(false); }
  };
  return <AuthLayout variant="recovery"><div className="space-y-5">
    <p className="page-eyebrow">INTERNSHIP PORTAL</p>
    <h1 ref={heading} tabIndex={-1} className="text-3xl font-bold">{done ? 'Password updated' : 'Set a new password'}</h1>
    {restoring ? <p role="status">Checking your recovery session…</p> : done ?
      <Notice tone="info">Your password has been updated. Account roles and approval status are unchanged. Return to sign in with your new password.</Notice> : expired ?
        <Notice tone="error" title="Recovery link unavailable">This link may have expired or was not completed. Return to sign in and request a new recovery email.</Notice> :
        <form onSubmit={save} noValidate className="space-y-5" aria-busy={busy}>
          <PasswordField id="recovery-password" label="New password" autoComplete="new-password" value={password} onChange={setPassword} disabled={busy} helper="Use at least 8 characters." required />
          <PasswordField id="recovery-confirm" label="Confirm new password" autoComplete="new-password" value={confirmation} onChange={setConfirmation} disabled={busy} required />
          {error && <Notice tone="error" title="Unable to update password">{error}</Notice>}
          <SubmitButton loading={busy} loadingLabel="Updating password…">Update password</SubmitButton>
        </form>}
    <button type="button" disabled={busy || restoring} onClick={onClose} className="action-secondary">Return to sign in</button>
  </div></AuthLayout>;
}
