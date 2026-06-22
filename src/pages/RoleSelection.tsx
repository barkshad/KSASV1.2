import React, { useState, useEffect, useRef } from 'react';
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
  },
  {
    id: 'lecturer' as const,
    title: 'Lecturer',
    desc: 'Sessions, QR codes & attendance',
    icon: BookOpen,
  },
  {
    id: 'student' as const,
    title: 'Student',
    desc: 'Check-in & attendance history',
    icon: GraduationCap,
  },
] as const;

type RoleId = typeof ROLES[number]['id'];

function GoldParticles() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    const particles: { x: number; y: number; r: number; dx: number; dy: number; o: number }[] = [];

    const resize = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };
    resize();
    window.addEventListener('resize', resize);

    for (let i = 0; i < 40; i++) {
      particles.push({
        x: Math.random() * canvas.offsetWidth,
        y: Math.random() * canvas.offsetHeight,
        r: Math.random() * 1.5 + 0.5,
        dx: (Math.random() - 0.5) * 0.3,
        dy: (Math.random() - 0.5) * 0.2,
        o: Math.random() * 0.4 + 0.1,
      });
    }

    const draw = () => {
      ctx.clearRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);
      particles.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(201,168,76,${p.o})`;
        ctx.fill();
        p.x += p.dx;
        p.y += p.dy;
        if (p.x < 0 || p.x > canvas.offsetWidth) p.dx *= -1;
        if (p.y < 0 || p.y > canvas.offsetHeight) p.dy *= -1;
      });
      animId = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ opacity: 0.6 }}
    />
  );
}

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
        className="relative overflow-hidden flex-shrink-0 w-full lg:w-[520px] xl:w-[600px]"
        style={{
          background: 'linear-gradient(165deg, #0A0C10 0%, #1a0f12 35%, #2a1015 60%, #1a0a0e 100%)',
        }}
      >
        {/* Gold accent line */}
        <div
          className="absolute top-0 left-0 w-full h-[2px]"
          style={{ background: 'linear-gradient(90deg, transparent, var(--kabu-gold), transparent)' }}
        />

        {/* Radial glow */}
        <div
          className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] pointer-events-none"
          style={{
            background: 'radial-gradient(circle, rgba(201,168,76,0.06) 0%, transparent 70%)',
          }}
        />

        {/* Subtle grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage: `linear-gradient(var(--text-primary) 1px, transparent 1px), linear-gradient(90deg, var(--text-primary) 1px, transparent 1px)`,
            backgroundSize: '48px 48px',
          }}
        />

        {/* Floating particles */}
        <GoldParticles />

        <div className="relative z-10 px-10 py-10 lg:px-14 lg:py-14 flex flex-col justify-between min-h-[200px] lg:min-h-screen">
          {/* Logo */}
          <div className="flex items-center gap-3.5">
            <div
              className="w-11 h-11 flex items-center justify-center rounded-xl"
              style={{
                background: 'linear-gradient(135deg, var(--kabu-gold), var(--kabu-gold-dark))',
                boxShadow: '0 4px 20px rgba(201,168,76,0.25)',
              }}
            >
              <ShieldCheck className="w-6 h-6" style={{ color: 'var(--text-inverse)' }} />
            </div>
            <div>
              <p
                className="text-xl font-bold tracking-tight leading-none"
                style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}
              >
                KSAS
              </p>
              <p
                className="text-[10px] uppercase tracking-[0.25em] mt-0.5"
                style={{ fontFamily: 'var(--font-body)', color: 'var(--kabu-gold-dark)' }}
              >
                Smart Attendance
              </p>
            </div>
          </div>

          {/* Hero text */}
          <div className="hidden lg:block mt-auto">
            <div className="mb-6">
              <div
                className="w-12 h-[2px] mb-8"
                style={{ background: 'linear-gradient(90deg, var(--kabu-gold), transparent)' }}
              />
              <h1
                className="font-display-hero mb-6"
                style={{
                  color: 'var(--text-primary)',
                  fontFamily: 'var(--font-display)',
                  lineHeight: '1.05',
                }}
              >
                Attendance,
                <br />
                <span style={{ color: 'var(--kabu-gold)' }}>made intelligent.</span>
              </h1>
              <p
                className="font-body-lg max-w-sm mb-12"
                style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-body)' }}
              >
                QR-based check-in with real-time sync, device verification, and institutional analytics — built for Kabarak University.
              </p>
            </div>

            {/* Feature list */}
            <div className="space-y-4">
              {[
                { title: 'Rotating QR Codes', desc: 'Token refreshes every 30 seconds' },
                { title: 'Device-Bound Check-In', desc: 'Prevents proxy attendance' },
                { title: 'Real-Time Sync', desc: 'Instant updates across all devices' },
              ].map((f, i) => (
                <div key={f.title} className="flex items-start gap-4 group">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 transition-all duration-300 group-hover:scale-110"
                    style={{
                      background: 'var(--kabu-gold-subtle)',
                      border: '1px solid rgba(201,168,76,0.2)',
                    }}
                  >
                    <span
                      className="text-xs font-bold"
                      style={{ fontFamily: 'var(--font-mono)', color: 'var(--kabu-gold)' }}
                    >
                      {String(i + 1).padStart(2, '0')}
                    </span>
                  </div>
                  <div>
                    <p
                      className="text-sm font-medium"
                      style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-body)' }}
                    >
                      {f.title}
                    </p>
                    <p
                      className="text-xs mt-0.5"
                      style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-body)' }}
                    >
                      {f.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* University badge */}
          <div className="hidden lg:flex items-center gap-2 mt-8 opacity-40">
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--kabu-gold)' }} />
            <p className="text-[10px] uppercase tracking-[0.2em]" style={{ fontFamily: 'var(--font-body)', color: 'var(--text-secondary)' }}>
              Kabarak University · Since 2000
            </p>
          </div>
        </div>
      </div>

      {/* ─── Right Panel: Auth ────────────────────────────────────── */}
      <div
        className="flex-1 flex flex-col justify-center p-8 sm:p-10 lg:px-16 lg:py-12"
        style={{ background: 'var(--bg-base)' }}
      >
        <div className="w-full max-w-md mx-auto">
          {!selectedRole ? (
            /* ── Role Selection ────────────────────────────────── */
            <div className="animate-fade-in">
              <div className="mb-10">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-6 h-[1px]" style={{ background: 'var(--kabu-gold)' }} />
                  <span
                    className="text-[10px] uppercase tracking-[0.2em] font-medium"
                    style={{ fontFamily: 'var(--font-body)', color: 'var(--kabu-gold)' }}
                  >
                    Welcome
                  </span>
                </div>
                <h2
                  className="font-editorial-lg mb-3"
                  style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-editorial)' }}
                >
                  Sign in to KSAS
                </h2>
                <p
                  className="font-body-md"
                  style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-body)' }}
                >
                  Select your role to continue.
                </p>
              </div>

              <div className="space-y-3">
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
                        className="flex items-center gap-5 p-5 transition-all duration-200 cursor-pointer"
                        style={{
                          background: 'var(--bg-surface)',
                          border: '1px solid var(--bg-border)',
                          borderRadius: 'var(--radius-xl)',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = 'var(--kabu-gold-dark)';
                          e.currentTarget.style.background = 'var(--bg-elevated)';
                          e.currentTarget.style.transform = 'translateX(4px)';
                          e.currentTarget.style.boxShadow = '0 4px 24px rgba(0,0,0,0.3), inset 0 1px 0 rgba(201,168,76,0.1)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = 'var(--bg-border)';
                          e.currentTarget.style.background = 'var(--bg-surface)';
                          e.currentTarget.style.transform = 'translateX(0)';
                          e.currentTarget.style.boxShadow = 'none';
                        }}
                      >
                        <div
                          className="w-12 h-12 flex items-center justify-center shrink-0 transition-all duration-200"
                          style={{
                            background:
                              role.id === 'admin'
                                ? 'linear-gradient(135deg, var(--kabu-maroon), var(--kabu-maroon-dark))'
                                : role.id === 'lecturer'
                                ? 'linear-gradient(135deg, var(--kabu-gold), var(--kabu-gold-dark))'
                                : 'linear-gradient(135deg, var(--info), #1d4ed8)',
                            borderRadius: 'var(--radius-lg)',
                            boxShadow:
                              role.id === 'admin'
                                ? '0 4px 12px rgba(139,26,43,0.3)'
                                : role.id === 'lecturer'
                                ? '0 4px 12px rgba(201,168,76,0.3)'
                                : '0 4px 12px rgba(37,99,235,0.3)',
                          }}
                        >
                          <Icon
                            className="w-6 h-6"
                            style={{
                              color: 'var(--text-primary)',
                            }}
                          />
                        </div>
                        <div className="flex-1 text-left min-w-0">
                          <p
                            className="text-base font-bold"
                            style={{
                              fontFamily: 'var(--font-display)',
                              color: 'var(--text-primary)',
                              letterSpacing: '-0.01em',
                            }}
                          >
                            {role.title}
                          </p>
                          <p
                            className="text-xs mt-0.5"
                            style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-body)' }}
                          >
                            {role.desc}
                          </p>
                        </div>
                        <svg
                          className="w-5 h-5 shrink-0 opacity-0 group-hover:opacity-100 transition-all duration-200"
                          style={{ color: 'var(--kabu-gold)' }}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="mt-10 pt-6" style={{ borderTop: '1px solid var(--bg-border)' }}>
                <p
                  className="text-center font-body-sm"
                  style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-body)' }}
                >
                  Your account is created by your institution administrator.
                </p>
              </div>
            </div>
          ) : (
            /* ── Login Form ────────────────────────────────────── */
            <div className="animate-slide-up">
              <button
                onClick={handleBack}
                className="flex items-center gap-2 font-body-sm mb-8 transition-all duration-200 group"
                style={{
                  color: 'var(--text-secondary)',
                  fontFamily: 'var(--font-body)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'var(--kabu-gold)';
                  e.currentTarget.style.transform = 'translateX(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--text-secondary)';
                  e.currentTarget.style.transform = 'translateX(0)';
                }}
              >
                <ArrowLeft className="w-4 h-4 transition-transform duration-200 group-hover:-translate-x-0.5" />
                Change role
              </button>

              {activeRole && (
                <div
                  className="flex items-center gap-4 p-4 mb-8"
                  style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--bg-border)',
                    borderRadius: 'var(--radius-xl)',
                  }}
                >
                  <div
                    className="w-11 h-11 flex items-center justify-center shrink-0"
                    style={{
                      background:
                        activeRole.id === 'admin'
                          ? 'linear-gradient(135deg, var(--kabu-maroon), var(--kabu-maroon-dark))'
                          : activeRole.id === 'lecturer'
                          ? 'linear-gradient(135deg, var(--kabu-gold), var(--kabu-gold-dark))'
                          : 'linear-gradient(135deg, var(--info), #1d4ed8)',
                      borderRadius: 'var(--radius-lg)',
                    }}
                  >
                    <activeRole.icon
                      className="w-5 h-5"
                      style={{ color: 'var(--text-primary)' }}
                    />
                  </div>
                  <div>
                    <p
                      className="text-sm font-bold"
                      style={{
                        fontFamily: 'var(--font-display)',
                        color: 'var(--text-primary)',
                        letterSpacing: '-0.01em',
                      }}
                    >
                      {activeRole.title}
                    </p>
                    <p
                      className="text-xs mt-0.5"
                      style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-body)' }}
                    >
                      Sign in to your account
                    </p>
                  </div>
                </div>
              )}

              <div className="mb-8">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-[1px]" style={{ background: 'var(--kabu-gold)' }} />
                  <span
                    className="text-[10px] uppercase tracking-[0.2em] font-medium"
                    style={{ fontFamily: 'var(--font-body)', color: 'var(--kabu-gold)' }}
                  >
                    Credentials
                  </span>
                </div>
                <h2
                  className="font-editorial-lg"
                  style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-editorial)' }}
                >
                  Welcome back
                </h2>
                <p
                  className="font-body-md mt-1"
                  style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-body)' }}
                >
                  Enter your credentials to continue.
                </p>
              </div>

              {error && (
                <div
                  className="flex items-start gap-3 p-4 mb-6 font-body-sm animate-fade-in"
                  style={{
                    background: 'var(--danger-bg)',
                    border: '1px solid rgba(139,26,43,0.4)',
                    borderRadius: 'var(--radius-lg)',
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
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    Email
                  </label>
                  <div className="relative">
                    <Mail
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
                      style={{ color: 'var(--text-tertiary)' }}
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
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    Password
                  </label>
                  <div className="relative">
                    <Lock
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
                      style={{ color: 'var(--text-tertiary)' }}
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
                        color: 'var(--text-tertiary)',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '4px',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = 'var(--text-primary)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = 'var(--text-tertiary)';
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
                  className="w-full mt-3 transition-all duration-200"
                  style={{
                    height: '48px',
                    fontFamily: 'var(--font-body)',
                    fontWeight: 600,
                    fontSize: '14px',
                    letterSpacing: '0.03em',
                    background: loading ? 'var(--kabu-gold-dark)' : 'linear-gradient(135deg, var(--kabu-gold), #d4b65c)',
                    color: 'var(--text-inverse)',
                    borderRadius: 'var(--radius-md)',
                    border: 'none',
                    cursor: loading ? 'wait' : 'pointer',
                    boxShadow: '0 4px 16px rgba(201,168,76,0.3)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                  }}
                  onMouseEnter={(e) => {
                    if (!loading) {
                      e.currentTarget.style.boxShadow = '0 6px 24px rgba(201,168,76,0.4)';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!loading) {
                      e.currentTarget.style.boxShadow = '0 4px 16px rgba(201,168,76,0.3)';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }
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

              <div className="mt-10 pt-6" style={{ borderTop: '1px solid var(--bg-border)' }}>
                <p
                  className="text-center font-body-sm"
                  style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-body)' }}
                >
                  Account access issues? Contact your institution's IT support.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
