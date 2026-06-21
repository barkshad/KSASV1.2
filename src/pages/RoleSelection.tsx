import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { db, collection, query, where, getDocs } from '../lib/firebase';
import { hashPassword } from '../lib/auth';
import {
  ArrowLeft,
  Lock,
  Mail,
  Loader2,
  AlertCircle,
  Eye,
  EyeOff,
  Shield,
  BookOpen,
  GraduationCap,
  ShieldCheck,
} from 'lucide-react';

const ROLES = [
  {
    id: 'admin' as const,
    title: 'Administrator',
    desc: 'System management & analytics',
    icon: Shield,
    iconBg: 'bg-crimson',
  },
  {
    id: 'lecturer' as const,
    title: 'Lecturer',
    desc: 'Sessions, QR codes & attendance',
    icon: BookOpen,
    iconBg: 'bg-gold-muted',
  },
  {
    id: 'student' as const,
    title: 'Student',
    desc: 'Check-in & attendance history',
    icon: GraduationCap,
    iconBg: 'bg-info',
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

  useEffect(() => {
    try {
      const cached = localStorage.getItem('ksas_current_user');
      if (cached) {
        const u = JSON.parse(cached);
        if (u?.role === 'admin') navigate('/admin', { replace: true });
        else if (u?.role === 'lecturer') navigate('/lecturer', { replace: true });
        else if (u?.role === 'student') navigate('/student', { replace: true });
      }
    } catch {
      localStorage.removeItem('ksas_current_user');
    }
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRole) return;

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
        setLoginAttempts((a) => a + 1);
        throw new Error('No account found with that email for this role.');
      }

      const userDoc = snapshot.docs[0];
      const userData = userDoc.data();

      if (userData.password !== hashPassword(password)) {
        setLoginAttempts((a) => a + 1);
        throw new Error('Incorrect password. Please try again.');
      }

      if (userData.status === 'inactive') {
        throw new Error('This account has been deactivated. Contact your administrator.');
      }

      setLoginAttempts(0);
      login({ uid: userDoc.id, ...userData });
      navigate(`/${selectedRole}`, { replace: true });
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

  const activeRole = ROLES.find((r) => r.id === selectedRole);

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* ─── Left Panel: Hero ─────────────────────────────────────── */}
      <div
        className="relative overflow-hidden flex-shrink-0 lg:w-[42%]"
        style={{ minWidth: '420px', background: 'var(--color-crimson)' }}
      >
        {/* Subtle grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(var(--color-text-primary) 1px, transparent 1px), linear-gradient(90deg, var(--color-text-primary) 1px, transparent 1px)`,
            backgroundSize: '40px 40px',
          }}
        />

        <div className="relative z-10 p-12 lg:p-14 flex flex-col justify-between min-h-[200px] lg:min-h-screen">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 flex items-center justify-center">
              <ShieldCheck className="w-8 h-8" style={{ color: 'var(--color-gold-primary)' }} />
            </div>
            <div>
              <p
                className="text-lg font-bold tracking-tight leading-none"
                style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)' }}
              >
                KSAS
              </p>
              <p
                className="text-[10px] uppercase tracking-[0.2em] mt-0.5"
                style={{ fontFamily: 'var(--font-body)', color: 'rgba(240,237,232,0.5)' }}
              >
                Smart Attendance
              </p>
            </div>
          </div>

          {/* Hero text */}
          <div className="hidden lg:block mt-auto">
            <h1
              className="font-display-hero mb-6"
              style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-display)' }}
            >
              Attendance,<br />made intelligent.
            </h1>
            <p
              className="font-body-lg max-w-sm mb-12"
              style={{ color: 'rgba(240,237,232,0.6)', fontFamily: 'var(--font-body)' }}
            >
              QR-based check-in with real-time sync, device verification, and institutional analytics — built for Kabarak University.
            </p>

            {/* Feature list */}
            <div className="space-y-4">
              {[
                { title: 'Rotating QR Codes', desc: 'Token refreshes every 30 seconds' },
                { title: 'Device-Bound Check-In', desc: 'Prevents proxy attendance' },
                { title: 'Real-Time Sync', desc: 'Instant updates across all devices' },
              ].map((f) => (
                <div key={f.title} className="flex items-start gap-3">
                  <div
                    className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0"
                    style={{ background: 'var(--color-gold-primary)' }}
                  />
                  <div>
                    <p
                      className="text-sm font-medium"
                      style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-body)' }}
                    >
                      {f.title}
                    </p>
                    <p
                      className="text-xs mt-0.5"
                      style={{ color: 'rgba(240,237,232,0.5)', fontFamily: 'var(--font-body)' }}
                    >
                      {f.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ─── Right Panel: Auth ────────────────────────────────────── */}
      <div className="flex-1 flex flex-col justify-center p-10 lg:p-14">
        <div className="w-full max-w-md mx-auto">
          {!selectedRole ? (
            /* ── Role Selection ────────────────────────────────── */
            <div className="animate-fade-in">
              <div className="mb-8">
                <h2
                  className="font-editorial-lg mb-2"
                  style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-editorial)' }}
                >
                  Sign in to KSAS
                </h2>
                <p
                  className="font-body-md"
                  style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)' }}
                >
                  Select your role to continue.
                </p>
              </div>

              <div className="space-y-4">
                {ROLES.map((role) => {
                  const Icon = role.icon;
                  return (
                    <button
                      key={role.id}
                      onClick={() => setSelectedRole(role.id)}
                      className="w-full group focus-visible:outline-2 focus-visible:outline-gold-primary"
                      style={{ padding: 0 }}
                    >
                      <div
                        className="flex items-center gap-5 p-5 transition-all duration-150"
                        style={{
                          background: 'var(--color-bg-surface)',
                          border: '0.5px solid var(--color-bg-border)',
                          borderRadius: 'var(--radius-xl)',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = 'var(--color-gold-muted)';
                          e.currentTarget.style.background = 'var(--color-bg-elevated)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = 'var(--color-bg-border)';
                          e.currentTarget.style.background = 'var(--color-bg-surface)';
                        }}
                      >
                        <div
                          className="w-12 h-12 flex items-center justify-center shrink-0"
                          style={{
                            background:
                              role.id === 'admin'
                                ? 'var(--color-crimson)'
                                : role.id === 'lecturer'
                                ? 'var(--color-gold-subtle)'
                                : 'var(--color-info-bg)',
                            borderRadius: 'var(--radius-lg)',
                          }}
                        >
                          <Icon
                            className="w-6 h-6"
                            style={{
                              color:
                                role.id === 'admin'
                                  ? '#F4A0A8'
                                  : role.id === 'lecturer'
                                  ? 'var(--color-gold-primary)'
                                  : 'var(--color-info)',
                            }}
                          />
                        </div>
                        <div className="flex-1 text-left min-w-0">
                          <p
                            className="text-base font-bold"
                            style={{
                              fontFamily: 'var(--font-display)',
                              color: 'var(--color-text-primary)',
                              letterSpacing: '-0.02em',
                            }}
                          >
                            {role.title}
                          </p>
                          <p
                            className="text-xs mt-0.5"
                            style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)' }}
                          >
                            {role.desc}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              <p
                className="text-center font-body-sm mt-8"
                style={{ color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-body)' }}
              >
                Your account is created by your institution administrator.
              </p>
            </div>
          ) : (
            /* ── Login Form ────────────────────────────────────── */
            <div className="animate-slide-up">
              <button
                onClick={handleBack}
                className="flex items-center gap-1.5 font-body-sm mb-8 transition-colors"
                style={{
                  color: 'var(--color-text-secondary)',
                  fontFamily: 'var(--font-body)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'var(--color-gold-primary)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--color-text-secondary)';
                }}
              >
                <ArrowLeft className="w-4 h-4" /> Change role
              </button>

              {activeRole && (
                <div
                  className="flex items-center gap-4 p-5 mb-8"
                  style={{
                    background: 'var(--color-bg-surface)',
                    border: '0.5px solid var(--color-bg-border)',
                    borderRadius: 'var(--radius-xl)',
                  }}
                >
                  <div
                    className="w-12 h-12 flex items-center justify-center shrink-0"
                    style={{
                      background:
                        activeRole.id === 'admin'
                          ? 'var(--color-crimson)'
                          : activeRole.id === 'lecturer'
                          ? 'var(--color-gold-subtle)'
                          : 'var(--color-info-bg)',
                      borderRadius: 'var(--radius-lg)',
                    }}
                  >
                    <activeRole.icon
                      className="w-6 h-6"
                      style={{
                        color:
                          activeRole.id === 'admin'
                            ? '#F4A0A8'
                            : activeRole.id === 'lecturer'
                            ? 'var(--color-gold-primary)'
                            : 'var(--color-info)',
                      }}
                    />
                  </div>
                  <div>
                    <p
                      className="text-base font-bold"
                      style={{
                        fontFamily: 'var(--font-display)',
                        color: 'var(--color-text-primary)',
                        letterSpacing: '-0.02em',
                      }}
                    >
                      {activeRole.title}
                    </p>
                    <p
                      className="text-xs mt-0.5"
                      style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)' }}
                    >
                      Sign in to your account
                    </p>
                  </div>
                </div>
              )}

              <div className="mb-8">
                <h2
                  className="font-editorial-lg"
                  style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-editorial)' }}
                >
                  Welcome back
                </h2>
                <p
                  className="font-body-md mt-1"
                  style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)' }}
                >
                  Enter your credentials to continue.
                </p>
              </div>

              {error && (
                <div
                  className="flex items-start gap-3 p-4 mb-6 font-body-sm animate-fade-in"
                  style={{
                    background: 'var(--color-danger-bg)',
                    border: '0.5px solid var(--color-danger)',
                    borderRadius: 'var(--radius-md)',
                    color: '#F4A0A8',
                  }}
                >
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleLogin} className="space-y-5">
                <div className="space-y-2">
                  <label
                    className="form-label"
                    htmlFor="email"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    Email
                  </label>
                  <div className="relative">
                    <Mail
                      className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
                      style={{ color: 'var(--color-text-tertiary)' }}
                    />
                    <input
                      id="email"
                      type="email"
                      required
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@kabarak.ac.ke"
                      className="input-with-icon-l"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label
                    className="form-label"
                    htmlFor="password"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    Password
                  </label>
                  <div className="relative">
                    <Lock
                      className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
                      style={{ color: 'var(--color-text-tertiary)' }}
                    />
                    <input
                      id="password"
                      type={showPw ? 'text' : 'password'}
                      required
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter password"
                      className="input-with-icon-l"
                      style={{ paddingRight: '44px' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                      style={{
                        color: 'var(--color-text-tertiary)',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '4px',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = 'var(--color-text-primary)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = 'var(--color-text-tertiary)';
                      }}
                      aria-label={showPw ? 'Hide password' : 'Show password'}
                    >
                      {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary w-full mt-2"
                  style={{
                    height: '48px',
                    fontFamily: 'var(--font-body)',
                    fontWeight: 500,
                    fontSize: '14px',
                    letterSpacing: '0.02em',
                  }}
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Authenticating...
                    </>
                  ) : (
                    'Sign In'
                  )}
                </button>
              </form>

              <p
                className="text-center font-body-sm mt-8"
                style={{ color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-body)' }}
              >
                Account access issues? Contact your institution's IT support.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
