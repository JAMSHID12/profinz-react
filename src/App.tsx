import type { ReactNode } from 'react';
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Loader2, ShieldOff } from 'lucide-react';
import { useAuth } from './context/AuthContext';
import { useConfig } from './context/ConfigContext';
import { canAccess } from './access';
import type { AppRoute } from './access';
import Layout from './components/Layout';
import LoginPage from './pages/auth/LoginPage';
import ChangePasswordPage from './pages/auth/ChangePasswordPage';
import { NAV_SECTION_ICONS, ROUTES } from './routes';

function FullPageSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center text-slate-400">
      <Loader2 className="animate-spin" size={28} />
    </div>
  );
}

function Forbidden() {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-20 text-center">
      <ShieldOff className="text-slate-400" size={32} />
      <p className="text-base font-semibold text-slate-800">This page is not available to you</p>
      <p className="max-w-md text-sm text-slate-500">
        Your role does not include it, or the feature is switched off for this centre.
      </p>
      <Link to="/" className="btn-secondary mt-2">Go to the dashboard</Link>
    </div>
  );
}

/** Signed-in users only; a forced password change comes before anything else. */
function RequireSession({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <FullPageSpinner />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (user.mustChangePassword) return <Navigate to="/change-password" replace />;
  return <>{children}</>;
}

/** Same rule as the menu: permissions, roles, module switch, feature switch and portal. */
function Guarded({ route }: { route: AppRoute }) {
  const { user } = useAuth();
  const { config } = useConfig();
  if (!user || !canAccess(route, user, config)) return <Forbidden />;
  return <>{route.element}</>;
}

function PasswordRoute() {
  const { user, loading } = useAuth();
  if (loading) return <FullPageSpinner />;
  if (!user) return <Navigate to="/login" replace />;
  // Forced changes get a full screen; voluntary ones stay inside the normal layout.
  return user.mustChangePassword ? <ChangePasswordPage /> : <Layout routes={ROUTES} sectionIcons={NAV_SECTION_ICONS} />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/change-password" element={<PasswordRoute />}>
        <Route index element={<ChangePasswordPage />} />
      </Route>
      <Route element={<RequireSession><Layout routes={ROUTES} sectionIcons={NAV_SECTION_ICONS} /></RequireSession>}>
        {ROUTES.map((route) => (
          <Route key={route.path} path={route.path} element={<Guarded route={route} />} />
        ))}
        <Route path="*" element={<Forbidden />} />
      </Route>
    </Routes>
  );
}
