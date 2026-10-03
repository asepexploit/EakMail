import { RouterProvider } from 'react-router-dom';
import { ThemeProvider } from './providers/theme-provider';
import { QueryProvider } from './providers/query-provider';
import { ToastProvider } from '@/components/ui';
import { router } from './router';

/**
 * Root application: composes global providers around the router
 * (frontend-guide.md §1). Order: theme (tokens) → query (server state) →
 * toast (notifications) → routes.
 */
export function App() {
  return (
    <ThemeProvider>
      <QueryProvider>
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </QueryProvider>
    </ThemeProvider>
  );
}
