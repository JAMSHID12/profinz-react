import { useState } from 'react';
import type { FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Loader2, LogIn } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useConfig } from '../../context/ConfigContext';
import { errorMessage } from '../../api/client';
import { BrandMark } from '../../components/Layout';

export default function LoginPage() {
  const { user, login } = useAuth();
  const { config } = useConfig();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const session = await login(username.trim(), password);
      const from = (location.state as { from?: string } | null)?.from;
      navigate(session.mustChangePassword ? '/change-password' : from ?? '/', { replace: true });
    } catch (failure) {
      setError(errorMessage(failure, 'Sign-in failed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <div className="flex flex-col justify-between bg-brand-800 px-8 py-10 text-white lg:w-5/12 lg:px-12">
        <div className="flex items-center gap-3">
          <BrandMark size={44} />
          <div>
            <p className="text-lg font-semibold">{config.client.name}</p>
            {config.client.tagline && <p className="text-sm text-brand-200">{config.client.tagline}</p>}
          </div>
        </div>
        <div className="mt-10 hidden lg:block">
          <p className="text-3xl font-semibold leading-snug">
            Academics, attendance and results in one place.
          </p>
          <p className="mt-3 max-w-md text-brand-200">
            Staff, mentors, faculty and students each see exactly what they need.
          </p>
        </div>
        <p className="mt-10 hidden text-xs text-brand-300 lg:block">&copy; {new Date().getFullYear()} {config.client.name}</p>
      </div>

      <div className="flex flex-1 items-center justify-center px-6 py-10">
        <form onSubmit={submit} className="w-full max-w-sm">
          <h1 className="text-2xl font-semibold text-slate-900">Sign in</h1>
          <p className="mt-1 text-sm text-slate-500">
            {config.branding.loginMessage || `Welcome to ${config.client.name}. Use the account given to you by the centre.`}
          </p>

          {error && (
            <div className="mt-5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">
              {error}
            </div>
          )}

          <div className="mt-6 space-y-4">
            <div>
              <label className="label" htmlFor="username">
                Username or admission number
              </label>
              <input
                id="username"
                className="input"
                autoComplete="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                required
                autoFocus
              />
            </div>
            <div>
              <label className="label" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                type="password"
                className="input"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </div>
          </div>

          <button type="submit" className="btn-primary mt-6 w-full py-2.5" disabled={busy}>
            {busy ? <Loader2 className="animate-spin" size={16} /> : <LogIn size={16} />}
            Sign in
          </button>
        </form>
      </div>
    </div>
  );
}
