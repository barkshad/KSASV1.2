import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { db, collection, query, where, getDocs } from '../lib/firebase';
import { hashPassword } from '../lib/auth';
import {
  ChevronRight,
  ArrowLeft,
  Lock,
  Mail,
  Loader2,
  AlertCircle,
  Eye,
  EyeOff,
  Radio,
  Wifi,
  Database,
  Clock,
} from 'lucide-react';

const ROLES = [
  { id: 'admin' as const, label: '01', title: 'ADMINISTRATOR', desc: 'System management & analytics' },
  { id: 'lecturer' as const, label: '02', title: 'LECTURER', desc: 'Sessions, QR codes & attendance' },
  { id: 'student' as const, label: '03', title: 'STUDENT', desc: 'Check-in & attendance history' },
] as const;

type RoleId = typeof ROLES[number]['id'];

const StatusLine = ({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) => (
  <div className="flex items-center gap-2">
    <Icon className="w-3 h-3 text-primary" />
    <span className="font-mono text-[10px] text-on-surface-variant uppercase tracking-wider">{label}:</span>
    <span className="font-mono text-[10px] text-on-surface font-medium">{value}</span>
  </div>
);

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
      const roleObj = ROLES.find((r) => r.id === selectedRole)!;
      navigate(`/${roleObj.id}`, { replace: true });
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
    <div className="min-h-screen bg-surface-container flex flex-col lg:flex-row">
      {/* ─── LEFT: Selection Grid ──────────────────────────────────── */}
      <div className="lg:w-[420px] border-r border-outline-variant bg-surface flex flex-col">
        {/* Header */}
        <div className="border-b border-outline-variant p-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary flex items-center justify-center">
              <span className="font-mono text-xs font-bold text-white">K</span>
            </div>
            <div>
              <p className="font-display text-sm font-bold text-on-surface tracking-tight leading-none">KSAS</p>
              <p className="font-mono text-[9px] text-on-surface-variant uppercase tracking-[0.2em] mt-0.5">Smart Attendance</p>
            </div>
          </div>
        </div>

        {/* Status bar */}
        <div className="border-b border-outline-variant px-6 py-3 flex items-center gap-4">
          <StatusLine icon={Radio} label="SYS" value="ACTIVE" />
          <StatusLine icon={Wifi} label="NODE" value="KAB-01" />
          <StatusLine icon={Clock} label="UTC" value="+3" />
        </div>

        {/* Role Selection */}
        <div className="flex-1 flex flex-col">
          <div className="px-6 pt-6 pb-3">
            <p className="font-mono text-[10px] text-on-surface-variant uppercase tracking-[0.15em] mb-1">SELECT ROLE</p>
            <p className="text-xs text-on-surface-variant">Choose your access level to continue.</p>
          </div>

          <div className="flex-1 px-6 pb-6">
            {!selectedRole ? (
              <div className="space-y-0">
                {ROLES.map((role, i) => (
                  <button
                    key={role.id}
                    onClick={() => setSelectedRole(role.id)}
                    className="w-full group focus-visible:outline-2 focus-visible:outline-primary"
                  >
                    <div className="flex items-stretch border border-outline-variant hover:border-primary transition-colors duration-150">
                      {/* Number */}
                      <div className="w-12 bg-surface-container-low border-r border-outline-variant flex items-center justify-center shrink-0">
                        <span className="font-mono text-xs font-bold text-on-surface-variant group-hover:text-primary transition-colors">
                          {role.label}
                        </span>
                      </div>
                      {/* Content */}
                      <div className="flex-1 p-4 flex items-center justify-between">
                        <div>
                          <p className="font-display text-sm font-bold text-on-surface group-hover:text-primary transition-colors tracking-tight">
                            {role.title}
                          </p>
                          <p className="text-[11px] text-on-surface-variant mt-0.5">{role.desc}</p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-outline-variant group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="animate-slide-up">
                <button
                  onClick={handleBack}
                  className="flex items-center gap-1.5 text-[11px] font-mono text-on-surface-variant uppercase tracking-wider mb-5 hover:text-primary transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Back to roles
                </button>

                {activeRole && (
                  <div className="border border-primary bg-primary-container/30 p-4 mb-6">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs font-bold text-primary bg-primary/10 px-2 py-1">{activeRole.label}</span>
                      <div>
                        <p className="font-display text-sm font-bold text-on-surface tracking-tight">{activeRole.title}</p>
                        <p className="text-[11px] text-on-surface-variant">{activeRole.desc}</p>
                      </div>
                    </div>
                  </div>
                )}

                {error && (
                  <div className="flex items-start gap-2.5 p-4 border border-error bg-error-container text-on-error-container mb-5 text-xs font-medium animate-fade-in">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}

                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="font-mono text-[10px] text-on-surface-variant uppercase tracking-[0.12em] font-medium" htmlFor="email">
                      Email
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant/40 pointer-events-none" />
                      <input
                        id="email"
                        type="email"
                        required
                        autoComplete="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@kabarak.ac.ke"
                        style={{ backgroundColor: '#ffffff' }}
                        className="w-full h-11 pl-10 pr-4 border border-outline-variant text-on-surface text-sm font-mono placeholder:text-outline outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-mono text-[10px] text-on-surface-variant uppercase tracking-[0.12em] font-medium" htmlFor="password">
                      Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant/40 pointer-events-none" />
                      <input
                        id="password"
                        type={showPw ? 'text' : 'password'}
                        required
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter password"
                        style={{ backgroundColor: '#ffffff' }}
                        className="w-full h-11 pl-10 pr-11 border border-outline-variant text-on-surface text-sm font-mono placeholder:text-outline outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPw((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant/40 hover:text-on-surface transition-colors"
                        aria-label={showPw ? 'Hide password' : 'Show password'}
                      >
                        {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full h-11 bg-primary text-white font-display text-sm font-bold uppercase tracking-wider hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
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
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── RIGHT: Info Panel ────────────────────────────────────── */}
      <div className="hidden lg:flex flex-col flex-1 bg-surface">
        {/* Top bar */}
        <div className="border-b border-outline-variant px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="w-3.5 h-3.5 text-on-surface-variant" />
            <span className="font-mono text-[10px] text-on-surface-variant uppercase tracking-wider">Firebase Connected</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-success rounded-full animate-pulse" />
            <span className="font-mono text-[10px] text-on-surface-variant uppercase tracking-wider">Secure</span>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col justify-center px-16 py-12">
          <div className="max-w-lg">
            <p className="font-mono text-[10px] text-primary uppercase tracking-[0.2em] font-bold mb-4">KABARAK UNIVERSITY</p>
            <h1 className="font-display text-4xl font-bold text-on-surface leading-[1.1] tracking-tight mb-4">
              Attendance,<br />
              <span className="text-primary">made intelligent.</span>
            </h1>
            <p className="text-sm text-on-surface-variant leading-relaxed mb-10 max-w-sm">
              QR-based check-in with real-time sync, device verification, and institutional analytics.
            </p>

            {/* Feature list */}
            <div className="border-l border-outline-variant pl-6 space-y-5">
              {[
                { num: '01', title: 'Rotating QR Codes', desc: 'Token refreshes every 30 seconds' },
                { num: '02', title: 'Device-Bound Check-In', desc: 'Prevents proxy attendance' },
                { num: '03', title: 'Real-Time Sync', desc: 'Instant updates across all devices' },
              ].map((f) => (
                <div key={f.num} className="flex items-start gap-4">
                  <span className="font-mono text-[10px] text-outline font-bold mt-0.5">{f.num}</span>
                  <div>
                    <p className="text-sm font-bold text-on-surface">{f.title}</p>
                    <p className="text-xs text-on-surface-variant mt-0.5">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-outline-variant px-8 py-4 flex items-center justify-between">
          <span className="font-mono text-[10px] text-on-surface-variant uppercase tracking-wider">KSAS v1.0</span>
          <span className="font-mono text-[10px] text-on-surface-variant uppercase tracking-wider">&copy; 2026 Kabarak University</span>
        </div>
      </div>
    </div>
  );
}
