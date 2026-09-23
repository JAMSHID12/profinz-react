import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { KeyRound, Loader2 } from 'lucide-react';
import { authApi } from '../../api/endpoints';
import { errorMessage } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Card, Notice } from '../../components/ui';

/** Used voluntarily from the header, and forced after an administrator-issued password. */
export default function ChangePasswordPage() {
  const { user, refreshSession, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const forced = Boolean(user?.mustChangePassword);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (next !== confirm) {
      setError('The new passwords do not match');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await authApi.changePassword(current, next);
      await refreshSession();
      toast.success('Password changed');
      navigate('/', { replace: true });
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={forced ? 'flex min-h-screen items-center justify-center bg-slate-100 px-4' : ''}>
      <Card className={`w-full max-w-md p-6 ${forced ? '' : 'mx-auto mt-4'}`}>
        <div className="mb-4 flex items-center gap-3">
          <div className="rounded-lg bg-brand-50 p-2 text-brand-600">
            <KeyRound size={20} />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Change password</h1>
            <p className="text-sm text-slate-500">{user?.fullName}</p>
          </div>
        </div>

        {forced && (
          <div className="mb-4">
            <Notice tone="warning">Please choose your own password before continuing.</Notice>
          </div>
        )}
        {error && (
          <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">
            {error}
          </div>
        )}

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label" htmlFor="current">
              Current password
            </label>
            <input id="current" type="password" className="input" autoComplete="current-password" value={current}
              onChange={(event) => setCurrent(event.target.value)} required />
          </div>
          <div>
            <label className="label" htmlFor="next">
              New password
            </label>
            <input id="next" type="password" className="input" autoComplete="new-password" minLength={8} value={next}
              onChange={(event) => setNext(event.target.value)} required />
            <p className="mt-1 text-xs text-slate-400">At least 8 characters.</p>
          </div>
          <div>
            <label className="label" htmlFor="confirm">
              Confirm new password
            </label>
            <input id="confirm" type="password" className="input" autoComplete="new-password" value={confirm}
              onChange={(event) => setConfirm(event.target.value)} required />
          </div>
          <div className="flex gap-2 pt-2">
            <button type="submit" className="btn-primary flex-1" disabled={busy}>
              {busy && <Loader2 className="animate-spin" size={16} />}
              Save password
            </button>
            {forced ? (
              <button type="button" className="btn-secondary" onClick={logout}>
                Sign out
              </button>
            ) : (
              <button type="button" className="btn-secondary" onClick={() => navigate(-1)}>
                Cancel
              </button>
            )}
          </div>
        </form>
      </Card>
    </div>
  );
}
