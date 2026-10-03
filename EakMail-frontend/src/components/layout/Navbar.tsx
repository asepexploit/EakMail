import { Bell, LogOut, Menu, Moon, Search, Sun } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/cn';
import { strings } from '@/lib/strings';
import { useTheme } from '@/app/providers/useTheme';
import { useLogout } from '@/features/auth/useAuth';
import { routes } from '@/app/routes';
import { HealthDot, type HealthLevel } from './HealthDot';

export interface NavbarProps {
  onToggleSidebar: () => void;
  /** Host:port the dashboard is bound to (DESIGN_SYSTEM.md §13.4). */
  bindAddress?: string;
  health?: HealthLevel;
  hasUnreadNotifications?: boolean;
}

/**
 * Top bar (DESIGN_SYSTEM.md §2.1, §13.4): sidebar toggle, global search,
 * environment badge (127.0.0.1:PORT), health dot, theme toggle, notifications.
 * Copy is Bahasa Indonesia via the strings module.
 */
export function Navbar({
  onToggleSidebar,
  bindAddress = '127.0.0.1:5173',
  health = 'unknown',
  hasUnreadNotifications = false,
}: NavbarProps) {
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const logout = useLogout();

  async function onLogout() {
    await logout.mutateAsync().catch(() => undefined);
    navigate(routes.login, { replace: true });
  }

  return (
    <header className="elevation-1 flex h-14 items-center gap-3 border-b border-border bg-surface px-4">
      <button
        type="button"
        onClick={onToggleSidebar}
        aria-label={strings.navbar.toggleSidebar}
        className="focus-ring flex h-9 w-9 items-center justify-center rounded-sm text-text-muted transition hover:bg-surface-2 hover:text-text active:scale-95"
      >
        <Menu className="h-4 w-4" />
      </button>

      <div className="relative hidden max-w-md flex-1 items-center sm:flex">
        <Search className="pointer-events-none absolute left-3 h-4 w-4 text-text-muted" aria-hidden />
        <input
          type="search"
          placeholder={strings.navbar.searchPlaceholder}
          aria-label={strings.actions.search}
          className="focus-ring h-9 w-full rounded-sm border border-border bg-surface-2 pl-9 pr-3 text-sm text-text placeholder:text-text-muted/70"
        />
      </div>

      <div className="ml-auto flex items-center gap-2">
        <span
          className="hidden items-center gap-1.5 rounded-sm border border-border bg-surface-2 px-2 py-1 font-mono text-[11px] text-text-muted md:inline-flex"
          title={strings.navbar.health}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-brand-accent" aria-hidden />
          {bindAddress}
        </span>

        <HealthDot level={health} label={strings.navbar.health} pulse={health === 'healthy'} />

        <button
          type="button"
          onClick={toggleTheme}
          aria-label={strings.navbar.toggleTheme}
          className="focus-ring flex h-9 w-9 items-center justify-center rounded-sm text-text-muted transition hover:bg-surface-2 hover:text-text active:scale-95"
        >
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>

        <button
          type="button"
          disabled
          aria-label={strings.navbar.notifications}
          title={strings.navbar.notifications}
          className="focus-ring relative flex h-9 w-9 cursor-not-allowed items-center justify-center rounded-sm text-text-muted/60 transition"
        >
          <Bell className="h-4 w-4" />
          {hasUnreadNotifications && (
            <span
              className={cn('absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-danger')}
              aria-hidden
            />
          )}
        </button>

        <button
          type="button"
          onClick={onLogout}
          disabled={logout.isPending}
          aria-label={strings.auth.logout}
          title={strings.auth.logout}
          className="focus-ring flex h-9 w-9 items-center justify-center rounded-sm text-text-muted transition hover:bg-surface-2 hover:text-text active:scale-95 disabled:opacity-60"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
