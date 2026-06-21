import React, { useState, useRef, useEffect } from 'react';
import { Bell, LogOut, User, ShieldCheck, Menu, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { cn } from '../../lib/utils';

interface TopAppBarProps {
  role: 'student' | 'lecturer' | 'admin';
  user: { name?: string; };
}

function getInitials(name?: string) {
  if (!name) return 'U';
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

export function TopAppBar({ role, user }: TopAppBarProps) {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [hasNotifs, setHasNotifs] = useState(true);
  const menuRef = useRef<HTMLDivElement>(null);

  const profilePath = `/${role}/profile`;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const ROLE_LABELS = { student: 'Student', lecturer: 'Lecturer', admin: 'Administrator' };

  return (
    <header className="top-bar px-4 md:px-6">
      {/* Mobile brand */}
      <div className="flex items-center gap-2 md:hidden">
        <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
          <ShieldCheck className="w-4.5 h-4.5 text-white" style={{ width: 18, height: 18 }} />
        </div>
        <span className="font-bold text-primary text-base" style={{ fontFamily: 'Space Grotesk, Inter, sans-serif' }}>KSAS</span>
      </div>

      {/* Desktop: empty left (sidebar has branding) */}
      <div className="hidden md:block" />

      {/* Right actions */}
      <div className="flex items-center gap-1">
        {/* Notifications */}
        <button
          className="relative btn-icon"
          aria-label="Notifications"
          onClick={() => setHasNotifs(false)}
        >
          <Bell className="w-5 h-5" />
          {hasNotifs && (
            <span className="absolute top-2 right-2 w-2 h-2 bg-error rounded-full ring-2 ring-surface" />
          )}
        </button>

        {/* Profile dropdown */}
        <div className="relative ml-1" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(v => !v)}
            className={cn(
              'flex items-center gap-2 rounded-full transition-all h-10 px-2',
              menuOpen ? 'bg-surface-container' : 'hover:bg-surface-container'
            )}
            aria-expanded={menuOpen}
            aria-label="Account menu"
          >
            <div className="w-8 h-8 rounded-full bg-primary text-on-primary font-bold text-xs flex items-center justify-center border-2 border-primary-container">
              {getInitials(user?.name)}
            </div>
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-12 w-56 bg-surface rounded-2xl shadow-xl border border-outline-variant/20 overflow-hidden z-50 animate-scale-in">
              <div className="px-4 py-3.5 border-b border-outline-variant/15 bg-surface-container-low">
                <p className="font-bold text-on-surface text-sm truncate">{user?.name || 'User'}</p>
                <p className="text-xs text-on-surface-variant capitalize mt-0.5">{ROLE_LABELS[role]}</p>
              </div>
              <div className="py-1">
                <button
                  onClick={() => { navigate(profilePath); setMenuOpen(false); }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-on-surface hover:bg-surface-container transition-colors"
                >
                  <User className="w-4 h-4 text-on-surface-variant" />
                  Profile & Settings
                </button>
                <div className="mx-3 my-1 h-px bg-outline-variant/20" />
                <button
                  onClick={() => { logout(); setMenuOpen(false); }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-error hover:bg-error-container/15 transition-colors font-semibold"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
