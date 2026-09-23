import { useEffect, useMemo, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { ChevronDown, KeyRound, LayoutGrid, LogOut, Menu, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useConfig } from '../context/ConfigContext';
import { canAccess } from '../access';
import type { AppRoute } from '../access';
import { ROLE_LABELS } from '../utils/format';

/** The menu entry for the current page: the longest path that matches (so /students/7 is Students). */
function activeNavPath(routes: AppRoute[], pathname: string): string | null {
  let best: string | null = null;
  for (const route of routes) {
    const matches = route.path === '/' ? pathname === '/' : pathname === route.path || pathname.startsWith(`${route.path}/`);
    if (matches && (!best || route.path.length > best.length)) best = route.path;
  }
  return best;
}

function MenuLink({ route, active, nested = false }: { route: AppRoute; active: boolean; nested?: boolean }) {
  const Icon = route.nav!.icon;
  return (
    <Link to={route.path} aria-current={active ? 'page' : undefined}
      className={`flex items-center gap-3 rounded-lg px-3 text-sm font-medium transition ${nested ? 'py-1.5' : 'py-2'} ${
        active ? 'bg-brand-600 text-white' : 'text-brand-100 hover:bg-brand-800 hover:text-white'
      }`}>
      <Icon size={nested ? 16 : 17} className="shrink-0" />
      <span className="truncate">{route.nav!.label}</span>
    </Link>
  );
}

/**
 * The sidebar menu as an accordion: one section open at a time - the one holding the current
 * page, until another is opened - so the menu fits the screen instead of scrolling.
 */
function SidebarMenu({ sections, sectionIcons }: {
  sections: [string, AppRoute[]][];
  sectionIcons: Record<string, LucideIcon>;
}) {
  const location = useLocation();
  const activePath = activeNavPath(sections.flatMap(([, items]) => items), location.pathname);
  const activeSection = sections.find(([, items]) => items.some((route) => route.path === activePath))?.[0] ?? null;
  const [openSection, setOpenSection] = useState<string | null>(activeSection);
  useEffect(() => setOpenSection(activeSection), [activeSection]);

  return (
    <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-6 pt-2" aria-label="Main menu">
      {sections.map(([section, items]) => {
        // A section with a single screen needs no accordion: link to it directly.
        if (items.length === 1) {
          return <MenuLink key={section} route={items[0]} active={items[0].path === activePath} />;
        }
        const open = openSection === section;
        const current = section === activeSection;
        const Icon = sectionIcons[section] ?? LayoutGrid;
        const panelId = `menu-${section.toLowerCase().replace(/[^a-z]+/g, '-')}`;
        return (
          <div key={section}>
            <button type="button" aria-expanded={open} aria-controls={panelId}
              onClick={() => setOpenSection(open ? null : section)}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition hover:bg-brand-800 hover:text-white ${
                current || open ? 'text-white' : 'text-brand-100'
              } ${open ? 'bg-brand-800/60' : ''}`}>
              <Icon size={17} className="shrink-0" />
              <span className="flex-1 truncate text-left">{section}</span>
              {current && !open && <span className="h-1.5 w-1.5 rounded-full bg-brand-300" aria-label="Current page is here" />}
              <ChevronDown size={16} className={`shrink-0 text-brand-300 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
            </button>
            <div id={panelId} className={`grid transition-[grid-template-rows] duration-200 ease-out ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
              <div className={`overflow-hidden ${open ? '' : 'invisible'}`}>
                <div className="ml-5 mt-0.5 space-y-0.5 border-l border-brand-700 pb-1 pl-2">
                  {items.map((route) => <MenuLink key={route.path} route={route} active={route.path === activePath} nested />)}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </nav>
  );
}

/** The client's full logo at its own proportions - or its name, when there is no logo or it cannot be loaded. */
export function BrandLogo({ className = 'h-12' }: { className?: string }) {
  const { config } = useConfig();
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [config.client.logo]);
  if (config.client.logo && !failed) {
    return (
      <img src={config.client.logo} alt={config.client.name} onError={() => setFailed(true)}
        className={`w-auto max-w-full object-contain ${className}`} />
    );
  }
  return <span className="truncate text-lg font-bold tracking-tight text-brand-800">{config.client.name}</span>;
}

export function BrandMark({ size = 36 }: { size?: number }) {
  const { config } = useConfig();
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [config.client.logo]);
  if (config.client.logo && !failed) {
    // As tall as the mark and as wide as the logo's own proportions (a wide wordmark stays readable).
    return (
      <img
        src={config.client.logo}
        alt={`${config.client.name} logo`}
        onError={() => setFailed(true)}
        className="w-auto shrink-0 rounded-lg bg-white object-contain"
        style={{ height: size, maxWidth: size * 4 }}
      />
    );
  }
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-lg bg-white font-bold text-brand-700"
      style={{ width: size, height: size }}
    >
      {config.client.name.charAt(0)}
    </span>
  );
}

export default function Layout({ routes, sectionIcons = {} }: { routes: AppRoute[]; sectionIcons?: Record<string, LucideIcon> }) {
  const { user, logout } = useAuth();
  const { config } = useConfig();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  // The sidebar is a drawer on phones; close it after every navigation.
  useEffect(() => setMenuOpen(false), [location.pathname]);

  const sections = useMemo(() => {
    if (!user) return [];
    const grouped = new Map<string, AppRoute[]>();
    for (const route of routes) {
      if (!route.nav || !canAccess(route, user, config)) continue;
      const list = grouped.get(route.nav.section) ?? [];
      list.push(route);
      grouped.set(route.nav.section, list);
    }
    return Array.from(grouped.entries());
  }, [routes, user, config]);

  const roleLabel = user?.roles.map((role) => ROLE_LABELS[role] ?? role).join(', ');

  return (
    <div className="min-h-screen lg:flex">
      {menuOpen && (
        <div className="fixed inset-0 z-30 bg-slate-900/40 lg:hidden" onClick={() => setMenuOpen(false)} aria-hidden="true" />
      )}

      <aside
        className={`no-print fixed inset-y-0 left-0 z-40 flex w-64 transform flex-col bg-brand-900 text-brand-50 transition-transform duration-200 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${
          menuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* The logo on white, level with the page's top bar, so its colours show as designed. */}
        <div className="flex h-16 shrink-0 items-center justify-between gap-2 border-b border-slate-200 bg-white px-5">
          <Link to="/" className="flex min-w-0 items-center" aria-label={`${config.client.name} - dashboard`}>
            <BrandLogo />
          </Link>
          <button type="button" className="rounded-md p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 lg:hidden"
            onClick={() => setMenuOpen(false)} aria-label="Close menu">
            <X size={20} />
          </button>
        </div>

        <SidebarMenu sections={sections} sectionIcons={sectionIcons} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 sm:px-6">
          <button
            type="button"
            className="rounded-md p-2 text-slate-600 transition hover:bg-slate-100 lg:hidden"
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>

          <div className="ml-auto flex items-center gap-2">
            <div className="text-right">
              <p className="text-sm font-semibold text-slate-800">{user?.fullName}</p>
              <p className="text-xs text-slate-500">{roleLabel}</p>
            </div>
            <Link
              to="/change-password"
              className="rounded-md p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
              aria-label="Change password"
              title="Change password"
            >
              <KeyRound size={18} />
            </Link>
            <button
              type="button"
              onClick={logout}
              className="rounded-md p-2 text-slate-500 transition hover:bg-slate-100 hover:text-rose-600"
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut size={18} />
            </button>
          </div>
        </header>

        <main className="flex-1 px-4 py-5 sm:px-6 sm:py-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
