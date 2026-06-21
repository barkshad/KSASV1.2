/**
 * src/pages/RoleSelection.tsx
 * KSAS Login — modern, mobile-first, brand-consistent.
 * Zero default-password hints anywhere in UI.
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, BookOpen, GraduationCap, ArrowRight, ArrowLeft, Lock, Mail, Loader2, AlertCircle, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { db, collection, query, where, getDocs } from '../lib/firebase';
import { hashPassword } from '../lib/auth';

const ROLES = [
  {
    id: 'admin' as const,
    title: 'Administrator',
    subtitle: 'System management & analytics',
    icon: Shield,
    path: '/admin',
    accent: 'from-primary to-primary-hover',
    iconBg: 'bg-primary',
  },
  {
    id: 'lecturer' as const,
    title: 'Lecturer',
    subtitle: 'Sessions, QR codes & attendance',
    icon: BookOpen,
    path: '/lecturer',
    accent: 'from-secondary to-amber-700',
    iconBg: 'bg-secondary',
  },
  {
    id: 'student' as const,
    title: 'Student',
    subtitle: 'Check-in & attendance history',
    icon: GraduationCap,
    path: '/student',
    accent: 'from-success to-green-800',
    iconBg: 'bg-success',
  },
] as const;

type RoleId = typeof ROLES[number]['id'];

export default function RoleSelection() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [selectedRole, setSelectedRole] = useState<RoleId | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [loginAttempts, setLoginAttempts] = useState(0);

  // Redirect if already logged in
  useEffect(() => {
    try {
      const cached = localStorage.getItem('ksas_current_user');
      if (cached) {
        const u = JSON.parse(cached);
        if (u?.role === 'admin') navigate('/admin', { replace: true });
        else if (u?.role === 'lecturer') navigate('/lecturer', { replace: true });
        else if (u?.role === 'student') navigate('/student', { replace: true });
      }
    } catch { localStorage.removeItem('ksas_current_user'); }
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRole) return;
    
    // Rate limiting: after 5 failed attempts, add delay
    if (loginAttempts >= 5) {
      setError('Too many attempts. Please wait a moment before trying again.');
      setTimeout(() => setLoginAttempts(0), 30000);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const usersRef = collection(db, 'users');
      const q = query(
        usersRef,
        where('email', '==', email.toLowerCase().trim()),
        where('role', '==', selectedRole)
      );
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        setLoginAttempts(a => a + 1);
        throw new Error('No account found with that email for this role.');
      }

      const userDoc = snapshot.docs[0];
      const userData = userDoc.data();

      if (userData.password !== hashPassword(password)) {
        setLoginAttempts(a => a + 1);
        throw new Error('Incorrect password. Please try again.');
      }

      if (userData.status === 'inactive') {
        throw new Error('This account has been deactivated. Contact your administrator.');
      }

      setLoginAttempts(0);
      login({ uid: userDoc.id, ...userData });
      const roleObj = ROLES.find(r => r.id === selectedRole)!;
      navigate(roleObj.path, { replace: true });
    } catch (err: any) {
      setError(err.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    setSelectedRole(null);
    setError('');
    setEmail('');
    setPassword('');
    setShowPw(false);
    setLoginAttempts(0);
  };

  const activeRole = ROLES.find(r => r.id === selectedRole);

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      {/* Mobile: full screen */}
      <div className="flex-1 flex flex-col lg:flex-row">

        {/* ── Brand panel ────────────────────────────────────────── */}
        <div className="relative lg:w-5/12 bg-primary overflow-hidden flex-shrink-0">
          <div className="dot-grid absolute inset-0" />
          {/* Gradient blobs */}
          <div className="absolute -top-20 -right-20 w-64 h-64 bg-white/5 rounded-full blur-3xl" />
          <div className="absolute -bottom-10 -left-10 w-48 h-48 bg-white/5 rounded-full blur-2xl" />

          <div className="relative z-10 p-8 lg:p-12 flex flex-col justify-between min-h-[200px] lg:min-h-screen">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 bg-white/15 rounded-2xl flex items-center justify-center border border-white/20">
                <ShieldCheck className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="font-bold text-white text-xl tracking-tight" style={{ fontFamily: 'Space Grotesk, Inter, sans-serif' }}>KSAS</p>
                <p className="text-white/60 text-[10px] uppercase tracking-[0.18em] font-semibold">Smart Attendance</p>
              </div>
            </div>

            {/* Hero text (desktop only) */}
            <div className="hidden lg:block mt-auto">
              <h1 className="text-white font-bold text-4xl leading-tight mb-4" style={{ fontFamily: 'Space Grotesk, Inter, sans-serif' }}>
                Attendance,<br />made intelligent.
              </h1>
              <p className="text-white/65 text-sm leading-relaxed max-w-xs mb-10">
                QR-based check-in with real-time sync, device verification, and institutional analytics — built for Kabarak University.
              </p>
              <div className="space-y-3">
                {[
                  { label: 'Rotating QR Codes', detail: 'Token refreshes every 30 seconds' },
                  { label: 'Device-Bound Check-In', detail: 'Prevents proxy attendance' },
                  { label: 'Real-Time Sync', detail: 'Instant updates across all devices' },
                ].map(f => (
                  <div key={f.label} className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-white/15 flex items-center justify-center shrink-0">
                      <div className="w-2 h-2 bg-white rounded-full" />
                    </div>
                    <div>
                      <p className="text-white font-semibold text-sm">{f.label}</p>
                      <p className="text-white/50 text-xs">{f.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Right panel ────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col justify-center p-6 sm:p-10 lg:p-14">
          <div className="w-full max-w-md mx-auto">

            {!selectedRole ? (
              /* ── Role selection ────────────────────────────────── */
              <div className="animate-fade-in">
                <div className="mb-8">
                  <h2 className="text-2xl font-bold text-on-surface mb-2" style={{ fontFamily: 'Space Grotesk, Inter, sans-serif' }}>
                    Sign in to KSAS
                  </h2>
                  <p className="text-on-surface-variant text-sm">
                    Select your role to continue.
                  </p>
                </div>

                <div className="space-y-3">
                  {ROLES.map((role, i) => (
                    <button
                      key={role.id}
                      onClick={() => setSelectedRole(role.id)}
                      className="w-full flex items-center gap-4 p-5 rounded-2xl border border-outline-variant/30 hover:border-primary/30 hover:bg-primary-container/5 transition-all duration-200 text-left group focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 animate-slide-up"
                      style={{ animationDelay: `${i * 0.08}s` }}
                    >
                      <div className={`w-12 h-12 ${role.iconBg} text-white rounded-2xl flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform duration-200 shadow-sm`}>
                        <role.icon className="w-6 h-6" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-on-surface text-base group-hover:text-primary transition-colors">
                          {role.title}
                        </p>
                        <p className="text-xs text-on-surface-variant mt-0.5">{role.subtitle}</p>
                      </div>
                      <ArrowRight className="w-4 h-4 text-outline opacity-0 group-hover:opacity-100 -translate-x-1 group-hover:translate-x-0 transition-all duration-200" />
                    </button>
                  ))}
                </div>

                <p className="text-center text-xs text-on-surface-variant mt-8">
                  Your account is created by your institution administrator.
                </p>
              </div>
            ) : (
              /* ── Login form ────────────────────────────────────── */
              <div className="animate-slide-up">
                <button
                  onClick={handleBack}
                  className="flex items-center gap-1.5 text-sm text-primary font-semibold mb-8 hover:opacity-70 transition-opacity"
                >
                  <ArrowLeft className="w-4 h-4" /> Change role
                </button>

                {/* Role pill */}
                {activeRole && (
                  <div className="flex items-center gap-3 mb-6 p-4 rounded-2xl bg-primary-container/20 border border-primary-container/40">
                    <div className={`w-10 h-10 ${activeRole.iconBg} text-white rounded-xl flex items-center justify-center shrink-0`}>
                      <activeRole.icon className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-bold text-on-surface text-sm">{activeRole.title}</p>
                      <p className="text-xs text-on-surface-variant">Sign in to your account</p>
                    </div>
                  </div>
                )}

                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-on-surface" style={{ fontFamily: 'Space Grotesk, Inter, sans-serif' }}>
                    Welcome back
                  </h2>
                  <p className="text-on-surface-variant text-sm mt-1">Enter your credentials to continue.</p>
                </div>

                {/* Error banner */}
                {error && (
                  <div className="flex items-start gap-2.5 p-4 bg-error-container text-on-error-container rounded-2xl mb-5 text-sm font-medium animate-fade-in">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}

                <form onSubmit={handleLogin} className="space-y-4">
                  {/* Email */}
                  <div className="form-group">
                    <label className="form-label" htmlFor="email">Institutional email</label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant/50 pointer-events-none" />
                      <input
                        id="email"
                        type="email"
                        required
                        autoComplete="email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder="you@kabarak.ac.ke"
                        className="input-with-icon-l"
                      />
                    </div>
                  </div>

                  {/* Password */}
                  <div className="form-group">
                    <label className="form-label" htmlFor="password">Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant/50 pointer-events-none" />
                      <input
                        id="password"
                        type={showPw ? 'text' : 'password'}
                        required
                        autoComplete="current-password"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder="Enter your password"
                        className="input-with-icon-l pr-12"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPw(v => !v)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant/50 hover:text-on-surface transition-colors"
                        aria-label={showPw ? 'Hide password' : 'Show password'}
                      >
                        {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="btn-primary w-full h-12 mt-2 text-base disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <><Loader2 className="w-5 h-5 animate-spin" /> Signing in…</>
                    ) : 'Sign In'}
                  </button>
                </form>

                <p className="text-center text-xs text-on-surface-variant mt-6">
                  Account access issues? Contact your institution's IT support.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
