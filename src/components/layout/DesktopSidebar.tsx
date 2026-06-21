import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { cn } from '../../lib/utils';
import {
  LayoutDashboard, School, BarChart, Calendar, Settings,
  BookOpen, Clock, Users, FileText, LogOut, ShieldCheck,
  QrCode, AlertTriangle, UserCircle
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

interface DesktopSidebarProps {
  role: 'student' | 'lecturer' | 'admin';
  user: { name: string; id?: string; uid?: string; department?: string; role?: string; };
}

export function AvatarCircle({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  const initials = name ? name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() : '?';
  const sizeClass = { lg: 'w-14 h-14 text-lg', md: 'w-11 h-11 text-sm', sm: 'w-8 h-8 text-xs' }[size];
  return (
    <div className={`${sizeClass} rounded-full bg-primary text-on-primary font-bold flex items-center justify-center shrink-0 border-2 border-primary-container shadow-sm`}>
      {initials}
    </div>
  );
}

export function DesktopSidebar({ role, user }: DesktopSidebarProps) {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const profilePath = `/${role}/profile`;
  const displayId = user.uid || user.id || '';

  const ROLE_LABELS = { student: 'Student', lecturer: 'Lecturer', admin: 'Administrator' };

  const navLinks = {
    student: [
      { to: '/student', icon: LayoutDashboard, label: 'Dashboard', end: true },
      { to: '/student/courses', icon: School, label: 'My Courses' },
      { to: '/student/checkin', icon: QrCode, label: 'Check-In' },
      { to: '/student/analytics', icon: BarChart, label: 'Attendance Reports' },
      { to: '/student/calendar', icon: Calendar, label: 'Academic Calendar' },
      { to: '/student/profile', icon: Settings, label: 'Settings & Profile' },
    ],
    lecturer: [
      { to: '/lecturer', icon: LayoutDashboard, label: 'Dashboard', end: true },
      { to: '/lecturer/courses', icon: BookOpen, label: 'My Courses' },
      { to: '/lecturer/live', icon: QrCode, label: 'Live Session' },
      { to: '/lecturer/risk', icon: AlertTriangle, label: 'Risk Monitor' },
      { to: '/lecturer/reports', icon: BarChart, label: 'Reports' },
      { to: '/lecturer/profile', icon: Settings, label: 'Settings & Profile' },
    ],
    admin: [
      { to: '/admin', icon: LayoutDashboard, label: 'Dashboard', end: true },
      { to: '/admin/users', icon: Users, label: 'User Management' },
      { to: '/admin/academics', icon: School, label: 'Academics' },
      { to: '/admin/courses', icon: BookOpen, label: 'Courses' },
      { to: '/admin/reports', icon: FileText, label: 'Reports' },
      { to: '/admin/settings', icon: Settings, label: 'Settings & Profile' },
    ],
  };

  const links = navLinks[role];

  return (
    <aside className="sidebar shadow-xl">
      {/* Brand Header */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-outline-variant/15 shrink-0">
        <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center shrink-0 shadow-sm">
          <ShieldCheck className="w-5 h-5 text-white" />
        </div>
        <div>
          <span className="font-bold text-lg text-primary tracking-tight" style={{ fontFamily: 'Space Grotesk, Inter, sans-serif' }}>KSAS</span>
          <p className="text-[9px] uppercase tracking-[0.14em] text-on-surface-variant font-semibold leading-none mt-0.5">
            Kabarak Smart Attendance
          </p>
        </div>
      </div>

      {/* User Profile Card */}
      <button
        onClick={() => navigate(profilePath)}
        className="flex items-center gap-3 p-4 mx-3 mt-3 rounded-2xl hover:bg-primary-container/10 transition-colors group text-left border border-transparent hover:border-primary-container/30"
      >
        <AvatarCircle name={user.name} />
        <div className="min-w-0 flex-1">
          <p className="font-bold text-on-surface text-sm truncate leading-tight">{user.name}</p>
          <p className="text-xs text-on-surface-variant truncate mt-0.5">{displayId}</p>
          <span className="badge badge-primary mt-1">{ROLE_LABELS[role]}</span>
        </div>
      </button>

      <div className="mx-5 mt-3 mb-2 h-px bg-outline-variant/20" />

      {/* Navigation */}
      <nav className="flex-1 px-3 py-1 space-y-0.5 overflow-y-auto custom-scrollbar">
        {links.map(({ to, icon: Icon, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => cn(
              'nav-link',
              isActive && 'active'
            )}
          >
            <Icon className="w-4.5 h-4.5 shrink-0" style={{ width: 18, height: 18 }} />
            <span className="text-sm">{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Logout */}
      <div className="px-3 pb-5 pt-2 border-t border-outline-variant/15 shrink-0">
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-error hover:bg-error-container/15 transition-colors font-semibold text-sm group"
        >
          <LogOut className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
