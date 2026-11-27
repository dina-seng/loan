import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { usePartner } from '../partners.jsx';
import { labels } from '../i18n/labels.js';
import { formatDate, todayISO } from '../utils/money.js';
import { LogOutIcon } from './Icons.jsx';
import { ClockIcon, HomeIcon, UserIcon } from './NavIcons.jsx';
import PartnerSwitcher from './PartnerSwitcher.jsx';

const nav = [
  { to: '/', label: labels.dashboard, Icon: HomeIcon, end: true },
  { to: '/history', label: labels.history, Icon: ClockIcon },
];

const linkClass = ({ isActive }) => `flex min-h-[44px] items-center gap-3 rounded-xl px-3 text-sm font-bold transition-colors ${isActive ? 'bg-brand-50 text-brand-800' : 'text-slate-600 hover:bg-slate-100'}`;

export default function Layout() {
  const { user, logout } = useAuth();
  const { partner } = usePartner();

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[236px_1fr]">
      <aside className="sticky top-0 hidden h-screen flex-col border-r border-slate-200 bg-white px-4 py-5 lg:flex">
        <div className="mb-8 px-2">
          <p className="text-lg font-extrabold text-brand-800">{labels.appName}</p>
          <div className="mt-1"><PartnerSwitcher /></div>
          <p className="mt-1 text-xs text-slate-500">{partner?.name || labels.selectPartner}</p>
        </div>
        <nav className="flex flex-col gap-1">
          {nav.map(({ to, label, Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={linkClass}>
              <Icon className="h-5 w-5 shrink-0" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <button type="button" onClick={logout} className="mt-auto flex min-h-[44px] items-center gap-3 rounded-xl px-3 text-sm font-bold text-slate-500 hover:bg-slate-100">
          <LogOutIcon className="h-5 w-5" />
          {labels.logout}
        </button>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-30 border-b border-brand-800/20 bg-brand-800 text-white shadow-sm">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-3 py-2.5 sm:px-5">
            <div className="min-w-0">
              <h1 className="truncate text-base font-extrabold leading-tight sm:text-lg">{labels.appName}</h1>
              <p className="truncate text-[11px] text-brand-100 sm:text-xs">{formatDate(todayISO())}</p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
              <PartnerSwitcher compact />
              <span className="hidden items-center gap-1.5 rounded-full bg-brand-700 px-3 py-1.5 text-xs font-bold sm:inline-flex">
                <UserIcon className="h-4 w-4" />{user?.displayName || labels.partner}
              </span>
              <button type="button" onClick={logout} className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-700 hover:bg-brand-600" aria-label={labels.logout} title={labels.logout}>
                <LogOutIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-3 py-4 pb-28 sm:px-5 lg:pb-10">
          <Outlet />
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        <div className="mx-auto grid max-w-lg grid-cols-2">
          {nav.map(({ to, label, Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => `flex min-h-[60px] flex-col items-center justify-center gap-0.5 px-0.5 text-[10px] font-bold leading-tight ${isActive ? 'text-brand-700' : 'text-slate-500'}`}>
              <Icon className="h-[22px] w-[22px]" />
              <span className="truncate">{label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
