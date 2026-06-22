'use client';

import { ReactNode, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from './sidebar';
import { Menu } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { useVmiAutoSync } from '@/hooks/use-vmi-auto-sync';
import { useCachedSession, clearCachedSession } from '@/hooks/use-cached-session';
import { CompactLanguageSwitcher } from '@/components/shared/language-switcher';
import { NotificationBell } from '@/components/equipment-notifications/NotificationBell';

interface MainLayoutProps {
  children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const router = useRouter();
  // Session is served from an in-memory cache so navigating between modules
  // (which remounts MainLayout, because each module has its own layout.tsx)
  // no longer re-fetches the session or flashes the loading spinner — the
  // "feels like a reload" symptom the sidebar had.
  const { user, isLoading, unauthenticated } = useCachedSession();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Redirect to login only once the session has resolved to "no user".
  useEffect(() => {
    if (unauthenticated) router.push('/login');
  }, [unauthenticated, router]);

  // Close sidebar when clicking outside on mobile/tablet
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setSidebarOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // VMI Auto Sync - runs every 15 minutes only for roles with VMI sync permission
  const vmiRoles = ['admin', 'manager', 'sales'];
  useVmiAutoSync({ enabled: !!user && vmiRoles.includes(user.role) });

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      clearCachedSession();
      router.push('/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="text-center">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-emerald-200 rounded-full animate-spin border-t-emerald-600 mx-auto motion-reduce:animate-none"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-8 h-8 bg-emerald-500 rounded-full animate-pulse motion-reduce:animate-none"></div>
            </div>
          </div>
          <p className="mt-6 text-slate-600 font-medium">กำลังโหลด...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Skip to main content link for accessibility */}
      <a
        href="#main-content"
        className={cn(
          'sr-only focus:not-sr-only',
          'focus:absolute focus:top-4 focus:left-4 focus:z-[100]',
          'focus:px-4 focus:py-2 focus:rounded-lg',
          'focus:bg-emerald-600 focus:text-white focus:shadow-lg',
          'focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2'
        )}
      >
        Skip to main content
      </a>

      {/* Mobile/Tablet Overlay */}
      <div
        className={cn(
          'fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden no-print',
          'transition-opacity duration-300 ease-out',
          'motion-reduce:transition-none',
          sidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
        onClick={() => setSidebarOpen(false)}
        aria-hidden="true"
      />

      {/* Sidebar - Desktop */}
      <div className="hidden lg:block lg:fixed lg:inset-y-0 lg:z-50 no-print">
        <Sidebar user={user} onLogout={handleLogout} />
      </div>

      {/* Sidebar - Mobile/Tablet */}
      <div
        className={cn(
          'fixed inset-y-0 left-0 z-50 lg:hidden no-print',
          'transform transition-transform duration-300 ease-out',
          'motion-reduce:transition-none',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <Sidebar user={user} onLogout={handleLogout} onNavigate={() => setSidebarOpen(false)} />
      </div>

      {/* Main Content */}
      <div className="flex-1 lg:pl-64 flex flex-col min-h-screen max-w-full overflow-x-hidden">
        {/* Mobile/Tablet Header */}
        <header
          className={cn(
            'lg:hidden sticky top-0 z-30 no-print',
            'bg-white/80 backdrop-blur-lg',
            'border-b border-slate-200/50 shadow-sm',
            'transition-shadow duration-200',
            'motion-reduce:transition-none'
          )}
        >
          <div className="flex items-center justify-between px-4 py-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className={cn(
                'p-2 rounded-xl',
                'bg-slate-100 hover:bg-slate-200',
                'text-slate-600',
                'transition-colors duration-150',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2',
                'motion-reduce:transition-none'
              )}
              aria-label="Open navigation menu"
            >
              <Menu className="h-6 w-6" />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center">
                <span className="text-white text-sm font-bold">H</span>
              </div>
              <span className="font-semibold text-slate-800">Herbal ERP</span>
            </div>
            <div className="flex items-center gap-2">
              <NotificationBell />
              <CompactLanguageSwitcher />
              <div
                className={cn(
                  'w-10 h-10 rounded-xl',
                  'bg-gradient-to-br from-emerald-400 to-teal-500',
                  'flex items-center justify-center',
                  'shadow-lg shadow-emerald-500/20'
                )}
              >
                <span className="text-white text-sm font-bold">
                  {user.name.charAt(0).toUpperCase()}
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main
          id="main-content"
          tabIndex={-1}
          className={cn(
            'flex-1 flex flex-col',
            'p-4 md:p-4 lg:p-6',
            'min-w-0 max-w-full',
            // On tablet, fit content to viewport height (minus header)
            'md:h-[calc(100vh-56px)] md:overflow-hidden',
            // On desktop, constrain to viewport height — pages handle their own scrolling
            'lg:h-[calc(100vh)] lg:overflow-hidden',
            'animate-fade-in motion-reduce:animate-none',
            'focus:outline-none'
          )}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
