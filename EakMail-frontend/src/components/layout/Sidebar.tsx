import { Mail } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/cn';
import { strings } from '@/lib/strings';
import { navGroups } from './nav-items';

export interface SidebarProps {
  collapsed: boolean;
}

/**
 * Grouped primary navigation (DESIGN_SYSTEM.md §2.1, §13.3).
 * 240px expanded / 64px collapsed; active item gets a brand left indicator +
 * tinted background. Labels are Bahasa Indonesia via the strings module.
 */
export function Sidebar({ collapsed }: SidebarProps) {
  return (
    <aside
      className={cn(
        'flex h-full flex-col border-r border-border bg-surface transition-[width] duration-200',
        collapsed ? 'w-16' : 'w-60',
      )}
      aria-label={strings.brand.name}
    >
      <div className="flex h-14 items-center gap-2 border-b border-border px-4">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm bg-brand text-white">
          <Mail className="h-4 w-4" aria-hidden />
        </span>
        {!collapsed && (
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-semibold text-text">{strings.brand.name}</span>
            <span className="text-[11px] text-text-muted">{strings.brand.tagline}</span>
          </div>
        )}
      </div>

      <nav className="scroll-thin flex-1 overflow-y-auto px-2 py-3">
        {navGroups.map((group) => (
          <div key={group.label} className="mb-4">
            {!collapsed && (
              <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                {group.label}
              </p>
            )}
            <ul className="flex flex-col gap-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.end}
                      title={collapsed ? item.label : undefined}
                      className={({ isActive }) =>
                        cn(
                          'focus-ring group relative flex items-center gap-3 rounded-sm px-2 py-2 text-sm transition active:scale-[0.98]',
                          collapsed && 'justify-center',
                          isActive
                            ? 'bg-brand/10 font-medium text-text'
                            : 'text-text-muted hover:bg-surface-2 hover:text-text',
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          {isActive && (
                            <span
                              className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r bg-brand"
                              aria-hidden
                            />
                          )}
                          <Icon className="h-4 w-4 shrink-0" aria-hidden />
                          <span
                            className={cn(
                              'truncate transition-opacity duration-200',
                              collapsed && 'pointer-events-none hidden opacity-0',
                            )}
                          >
                            {item.label}
                          </span>
                        </>
                      )}
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}
