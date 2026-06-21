import React, { useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { DesktopSidebar } from './DesktopSidebar';
import { MobileNav } from './MobileNav';
import { TopAppBar } from './TopAppBar';
import { useAuth } from '../../hooks/useAuth';
import { Toaster } from 'react-hot-toast';

interface AppLayoutProps {
  role: 'student' | 'lecturer' | 'admin';
}

export function AppLayout({ role }: AppLayoutProps) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate('/', { replace: true });
    else if (!loading && user && user.role !== role && user.role !== 'admin') navigate('/', { replace: true });
  }, [user, loading, navigate, role]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center animate-pulse">
            <svg className="w-7 h-7 text-on-primary" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
          </div>
          <p className="text-sm text-on-surface-variant font-medium">Loading KSAS…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-container-low flex">
      <Toaster
        position="top-right"
        toastOptions={{
          className: 'toast-custom',
          duration: 3500,
        }}
      />

      {/* Desktop Sidebar */}
      <DesktopSidebar role={role} user={user} />

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0 with-sidebar">
        <TopAppBar role={role} user={user} />

        <div className="flex-1 overflow-y-auto custom-scrollbar pb-20 md:pb-0">
          <Outlet />
        </div>
      </main>

      {/* Mobile bottom nav */}
      <MobileNav role={role} />
    </div>
  );
}
