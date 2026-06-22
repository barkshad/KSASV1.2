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
  ShieldAlert,
} from 'lucide-react';

const ROLES = [
  {
    id: 'admin' as const,
    title: 'Admin',
    desc: 'System configuration & academic management',
  },
  {
    id: 'lecturer' as const,
    title: 'Lecturer',
    desc: 'Manage courses & view attendance analytics',
  },
  {
    id: 'student' as const,
    title: 'Student',
    desc: 'Check-in to classes & view history',
  },
] as const;

type RoleId = typeof ROLES[number]['id'];

function RoleIcon({ role, highlighted }: { role: RoleId; highlighted?: boolean }) {
  const color = highlighted ? '#fff' : '#7B1A2B';
  const wrapBg = highlighted ? 'rgba(255,255,255,0.18)' : 'rgba(123,26,43,0.08)';

  if (role === 'admin') {
    return (
      <div className="role-icon-wrap" style={{ background: wrapBg }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2L4 6v6c0 5.5 3.5 10.7 8 12 4.5-1.3 8-6.5 8-12V6L12 2z"/>
        </svg>
      </div>
    );
  }
  if (role === 'lecturer') {
    return (
      <div className="role-icon-wrap" style={{ background: wrapBg }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
          <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
        </svg>
      </div>
    );
  }
  return (
    <div className="role-icon-wrap" style={{ background: wrapBg }}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
        <path d="M6 12v5c3 3 9 3 12 0v-5"/>
      </svg>
    </div>
  );
}

function ShieldLogoSvg() {
  return (
    <svg width="64" height="64" viewBox="0 0 64 72" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M32 2L6 12V34C6 50 18 63 32 70C46 63 58 50 58 34V12L32 2Z"
            fill="#F9E8EA" stroke="#7B1A2B" strokeWidth="2.5" strokeLinejoin="round"/>
      <path d="M32 8L12 16V34C12 47 21 58 32 64C43 58 52 47 52 34V16L32 8Z"
            fill="white" stroke="#E8A8B2" strokeWidth="1" strokeLinejoin="round"/>
      <path d="M20 34L28 43L44 26"
            stroke="#7B1A2B" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="32" cy="22" r="2.5" fill="#C9A84C"/>
    </svg>
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

  const isHighlighted = (id: RoleId) => selectedRole === id;

  return (
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      animation: 'fadeUp 300ms ease-out',
      fontFamily: "'Outfit', sans-serif",
    }}>
      {/* ═══════════════ LEFT PANEL ═══════════════ */}
      <div style={{
        width: '380px',
        minWidth: '380px',
        background: '#F9E8EA',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '48px 36px 40px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Radial bloom */}
        <div style={{
          position: 'absolute',
          top: '-60px', left: '50%',
          transform: 'translateX(-50%)',
          width: '400px', height: '400px',
          background: 'radial-gradient(circle, rgba(255,255,255,0.55) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        {/* Logo circle */}
        <div style={{
          width: '140px', height: '140px',
          background: '#fff',
          borderRadius: '9999px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 24px rgba(123,26,43,0.12)',
          marginBottom: '28px',
          position: 'relative',
          zIndex: 1,
        }}>
          <ShieldLogoSvg />
          <span style={{
            fontFamily: "'Big Shoulders Display', sans-serif",
            fontSize: '18px',
            fontWeight: 800,
            letterSpacing: '0.04em',
            color: '#7B1A2B',
          }}>KSAS</span>
        </div>

        {/* Brand name */}
        <div style={{
          fontFamily: "'Big Shoulders Display', sans-serif",
          fontSize: '52px',
          fontWeight: 900,
          letterSpacing: '-0.01em',
          color: '#7B1A2B',
          lineHeight: 1,
          marginBottom: '4px',
        }}>KSAS</div>
        <div style={{
          fontFamily: "'Outfit', sans-serif",
          fontSize: '10px',
          fontWeight: 500,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: '#6B4A50',
          marginBottom: '36px',
        }}>Kabarak Smart Attendance</div>

        {/* Feature list */}
        <div style={{
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          marginTop: 'auto',
        }}>
          {/* Secure Verification */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <div style={{ width: '28px', height: '28px', minWidth: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: '2px' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7B1A2B" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L4 6v6c0 5.5 3.5 10.7 8 12 4.5-1.3 8-6.5 8-12V6L12 2z"/>
                <path d="M9 12l2 2 4-4"/>
              </svg>
            </div>
            <div>
              <strong style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#7B1A2B', marginBottom: '2px' }}>Secure Verification</strong>
              <span style={{ fontSize: '12px', fontWeight: 300, color: '#6B4A50', lineHeight: 1.5 }}>Device-bound authentication prevents proxy attendance.</span>
            </div>
          </div>

          {/* Live Synchronisation */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <div style={{ width: '28px', height: '28px', minWidth: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: '2px' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7B1A2B" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </div>
            <div>
              <strong style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#7B1A2B', marginBottom: '2px' }}>Live Synchronisation</strong>
              <span style={{ fontSize: '12px', fontWeight: 300, color: '#6B4A50', lineHeight: 1.5 }}>Real-time attendance tracking for every active session.</span>
            </div>
          </div>

          {/* Institutional Analytics */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <div style={{ width: '28px', height: '28px', minWidth: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: '2px' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7B1A2B" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2"/>
                <path d="M3 9h18M9 21V9"/>
              </svg>
            </div>
            <div>
              <strong style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#7B1A2B', marginBottom: '2px' }}>Institutional Analytics</strong>
              <span style={{ fontSize: '12px', fontWeight: 300, color: '#6B4A50', lineHeight: 1.5 }}>Full visibility into attendance trends across every course.</span>
            </div>
          </div>

          {/* Anti-Fraud Shield */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <div style={{ width: '28px', height: '28px', minWidth: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: '2px' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7B1A2B" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L4 6v6c0 5.5 3.5 10.7 8 12 4.5-1.3 8-6.5 8-12V6L12 2z"/>
                <path d="M9 12l2 2 4-4"/>
                <circle cx="12" cy="12" r="10" strokeDasharray="4 2"/>
              </svg>
            </div>
            <div>
              <strong style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#7B1A2B', marginBottom: '2px' }}>Anti-Fraud Shield</strong>
              <span style={{ fontSize: '12px', fontWeight: 300, color: '#6B4A50', lineHeight: 1.5 }}>Device binding, GPS & one-time QR tokens block proxy attendance.</span>
            </div>
          </div>
        </div>

        {/* Biblical tagline */}
        <div style={{
          marginTop: '32px',
          paddingTop: '20px',
          borderTop: '0.5px solid #E8A8B2',
          fontSize: '10px',
          fontWeight: 300,
          fontStyle: 'italic',
          color: '#9A7A82',
          textAlign: 'center',
          lineHeight: 1.6,
          width: '100%',
        }}>
          "Education in Biblical Perspective"<br />
          We purpose at all times and in all places to set apart<br />
          in one's heart, Jesus as Lord. — 1 Peter 3:15
        </div>
      </div>

      {/* ═══════════════ RIGHT PANEL ═══════════════ */}
      <div style={{
        flex: 1,
        background: '#fff',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '64px 72px',
        animation: 'fadeUp 350ms 60ms ease-out both',
      }}>
        <div style={{ maxWidth: '440px' }}>
          {!selectedRole ? (
            /* ── Role Selection ────────────────────────────────── */
            <>
              <div style={{ fontSize: '11px', fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8B6F2E', marginBottom: '8px' }}>
                Kabarak University · Est. 2000
              </div>
              <h1 style={{
                fontFamily: "'Gloock', serif",
                fontSize: '36px',
                fontWeight: 400,
                color: '#1A0508',
                letterSpacing: '-0.01em',
                marginBottom: '6px',
                lineHeight: 1.15,
              }}>
                Welcome to KSAS
              </h1>
              <p style={{
                fontSize: '14px',
                fontWeight: 300,
                color: '#6B4A50',
                marginBottom: '40px',
                lineHeight: 1.5,
              }}>
                Select your role to access the dashboard
              </p>

              <div className="roles" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {ROLES.map((role) => {
                  const highlighted = isHighlighted(role.id);
                  return (
                    <div
                      key={role.id}
                      tabIndex={0}
                      role="button"
                      aria-label={`Sign in as ${role.title}`}
                      onClick={() => setSelectedRole(role.id)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedRole(role.id); } }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '16px',
                        padding: '18px 20px',
                        border: `1px solid ${highlighted ? '#7B1A2B' : '#EAD8DB'}`,
                        borderRadius: '16px',
                        background: highlighted ? '#7B1A2B' : '#fff',
                        cursor: 'pointer',
                        transition: 'border-color 160ms ease, background 160ms ease, box-shadow 160ms ease',
                        textDecoration: 'none',
                        position: 'relative',
                        outline: 'none',
                        boxShadow: highlighted ? '0 0 0 3px rgba(123,26,43,0.12)' : 'none',
                      }}
                      onMouseEnter={(e) => {
                        if (!highlighted) {
                          e.currentTarget.style.borderColor = '#E8A8B2';
                          e.currentTarget.style.background = '#FEF4F5';
                          e.currentTarget.style.boxShadow = '0 2px 12px rgba(123,26,43,0.08)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!highlighted) {
                          e.currentTarget.style.borderColor = '#EAD8DB';
                          e.currentTarget.style.background = '#fff';
                          e.currentTarget.style.boxShadow = 'none';
                        }
                      }}
                      onFocus={(e) => {
                        if (!highlighted) {
                          e.currentTarget.style.borderColor = '#7B1A2B';
                          e.currentTarget.style.background = '#F9E8EA';
                          e.currentTarget.style.boxShadow = '0 0 0 3px rgba(123,26,43,0.12)';
                        }
                      }}
                      onBlur={(e) => {
                        if (!highlighted) {
                          e.currentTarget.style.borderColor = '#EAD8DB';
                          e.currentTarget.style.background = '#fff';
                          e.currentTarget.style.boxShadow = 'none';
                        }
                      }}
                    >
                      <RoleIcon role={role.id} highlighted={highlighted} />
                      <div style={{ flex: 1 }}>
                        <span style={{
                          fontSize: '15px',
                          fontWeight: 600,
                          color: highlighted ? '#fff' : '#1A0508',
                          marginBottom: '2px',
                          display: 'block',
                        }}>
                          {role.title}
                        </span>
                        <span style={{
                          fontSize: '12.5px',
                          fontWeight: 300,
                          color: highlighted ? 'rgba(255,255,255,0.7)' : '#6B4A50',
                          lineHeight: 1.4,
                          display: 'block',
                        }}>
                          {role.desc}
                        </span>
                      </div>
                      <div style={{ color: highlighted ? '#fff' : '#9A7A82', opacity: highlighted ? 1 : 0, transition: 'opacity 160ms ease, transform 160ms ease' }}
                        className="role-arrow"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M5 12h14M12 5l7 7-7 7"/>
                        </svg>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Footer tagline */}
              <div style={{ marginTop: '48px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#C9A84C' }} />
                <span style={{ fontSize: '11px', fontWeight: 300, color: '#9A7A82', fontStyle: 'italic' }}>
                  Kenya's top private chartered institution of higher learning
                </span>
              </div>
            </>
          ) : (
            /* ── Login Form ────────────────────────────────────── */
            <div className="animate-slide-up">
              <button
                onClick={handleBack}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '13px',
                  fontWeight: 400,
                  color: '#6B4A50',
                  fontFamily: "'Outfit', sans-serif",
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                  marginBottom: '32px',
                  transition: 'color 160ms ease, transform 160ms ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = '#7B1A2B';
                  e.currentTarget.style.transform = 'translateX(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = '#6B4A50';
                  e.currentTarget.style.transform = 'translateX(0)';
                }}
              >
                <ArrowLeft className="w-4 h-4" />
                Change role
              </button>

              {/* Selected role indicator */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                padding: '16px 18px',
                background: '#F9E8EA',
                border: '1px solid #EAD8DB',
                borderRadius: '16px',
                marginBottom: '32px',
              }}>
                <RoleIcon role={selectedRole} />
                <div>
                  <p style={{ fontSize: '15px', fontWeight: 600, color: '#1A0508', margin: 0 }}>
                    {ROLES.find(r => r.id === selectedRole)?.title}
                  </p>
                  <p style={{ fontSize: '12px', fontWeight: 300, color: '#6B4A50', margin: '4px 0 0' }}>
                    Sign in to your account
                  </p>
                </div>
              </div>

              <div style={{ marginBottom: '32px' }}>
                <div style={{ fontSize: '11px', fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8B6F2E', marginBottom: '4px' }}>
                  Credentials
                </div>
                <h2 style={{
                  fontFamily: "'Gloock', serif",
                  fontSize: '24px',
                  fontWeight: 400,
                  color: '#1A0508',
                  letterSpacing: '-0.01em',
                  margin: '8px 0 4px',
                }}>
                  Welcome back
                </h2>
                <p style={{ fontSize: '13px', fontWeight: 300, color: '#6B4A50', margin: 0 }}>
                  Enter your credentials to continue.
                </p>
              </div>

              {error && (
                <div style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                  padding: '12px 16px',
                  background: '#FEF4F5',
                  border: '1px solid #E8A8B2',
                  borderRadius: '12px',
                  fontSize: '13px',
                  color: '#7B1A2B',
                  marginBottom: '24px',
                }}>
                  <AlertCircle className="w-4 h-4 shrink-0" style={{ marginTop: '1px' }} />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label htmlFor="email" style={{
                    fontSize: '11px',
                    fontWeight: 500,
                    color: '#6B4A50',
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    fontFamily: "'Outfit', sans-serif",
                  }}>
                    Email
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Mail className="absolute" style={{ left: '14px', top: '50%', transform: 'translateY(-50%)', width: '16px', height: '16px', color: '#9A7A82', pointerEvents: 'none' }} />
                    <input
                      id="email"
                      type="email"
                      required
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@kabarak.ac.ke"
                      style={{
                        width: '100%',
                        padding: '12px 16px 12px 40px',
                        borderRadius: '12px',
                        border: '1px solid #EAD8DB',
                        background: '#fff',
                        color: '#1A0508',
                        fontFamily: "'Outfit', sans-serif",
                        fontSize: '14px',
                        outline: 'none',
                        boxSizing: 'border-box',
                        transition: 'border-color 150ms ease, box-shadow 150ms ease',
                      }}
                      onFocus={(e) => { e.currentTarget.style.borderColor = '#7B1A2B'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(123,26,43,0.1)'; }}
                      onBlur={(e) => { e.currentTarget.style.borderColor = '#EAD8DB'; e.currentTarget.style.boxShadow = 'none'; }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label htmlFor="password" style={{
                    fontSize: '11px',
                    fontWeight: 500,
                    color: '#6B4A50',
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    fontFamily: "'Outfit', sans-serif",
                  }}>
                    Password
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Lock className="absolute" style={{ left: '14px', top: '50%', transform: 'translateY(-50%)', width: '16px', height: '16px', color: '#9A7A82', pointerEvents: 'none' }} />
                    <input
                      id="password"
                      type={showPw ? 'text' : 'password'}
                      required
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter password"
                      style={{
                        width: '100%',
                        padding: '12px 44px 12px 40px',
                        borderRadius: '12px',
                        border: '1px solid #EAD8DB',
                        background: '#fff',
                        color: '#1A0508',
                        fontFamily: "'Outfit', sans-serif",
                        fontSize: '14px',
                        outline: 'none',
                        boxSizing: 'border-box',
                        transition: 'border-color 150ms ease, box-shadow 150ms ease',
                      }}
                      onFocus={(e) => { e.currentTarget.style.borderColor = '#7B1A2B'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(123,26,43,0.1)'; }}
                      onBlur={(e) => { e.currentTarget.style.borderColor = '#EAD8DB'; e.currentTarget.style.boxShadow = 'none'; }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw((v) => !v)}
                      aria-label={showPw ? 'Hide password' : 'Show password'}
                      style={{
                        position: 'absolute',
                        right: '12px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: '#9A7A82',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '4px',
                        transition: 'color 150ms ease',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = '#1A0508'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = '#9A7A82'; }}
                    >
                      {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    width: '100%',
                    height: '48px',
                    fontFamily: "'Outfit', sans-serif",
                    fontWeight: 600,
                    fontSize: '14px',
                    letterSpacing: '0.03em',
                    background: loading ? '#8B6F2E' : '#7B1A2B',
                    color: '#fff',
                    borderRadius: '12px',
                    border: 'none',
                    cursor: loading ? 'wait' : 'pointer',
                    boxShadow: '0 4px 16px rgba(123,26,43,0.3)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    marginTop: '4px',
                    transition: 'box-shadow 200ms ease, transform 150ms ease',
                  }}
                  onMouseEnter={(e) => {
                    if (!loading) {
                      e.currentTarget.style.boxShadow = '0 6px 24px rgba(123,26,43,0.4)';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!loading) {
                      e.currentTarget.style.boxShadow = '0 4px 16px rgba(123,26,43,0.3)';
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

              <div style={{ marginTop: '40px', paddingTop: '24px', borderTop: '1px solid #EAD8DB' }}>
                <p style={{
                  textAlign: 'center',
                  fontSize: '12px',
                  fontWeight: 300,
                  color: '#9A7A82',
                  fontFamily: "'Outfit', sans-serif",
                }}>
                  Your account is created by your institution administrator.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Security warning banner */}
        <div style={{
          maxWidth: '440px',
          marginTop: '32px',
          padding: '14px 18px',
          background: '#FEF4F5',
          border: '1px solid #E8A8B2',
          borderRadius: '12px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '10px',
        }}>
          <ShieldAlert className="w-5 h-5 shrink-0" style={{ color: '#7B1A2B', marginTop: '1px' }} />
          <div>
            <p style={{ fontSize: '12px', fontWeight: 600, color: '#7B1A2B', margin: '0 0 2px' }}>
              Anti-Fraud Protection Active
            </p>
            <p style={{ fontSize: '11px', fontWeight: 300, color: '#6B4A50', margin: 0, lineHeight: 1.5 }}>
              This system uses device fingerprinting, GPS proximity checks, one-time QR tokens, and IP validation to prevent proxy attendance. All check-in attempts are logged with device metadata and violations are reported to administration.
            </p>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .animate-slide-up { animation: slideUp 0.25s ease-out forwards; }
        .role-arrow {
          transition: opacity 160ms ease, transform 160ms ease;
        }
        div[role="button"]:hover .role-arrow,
        div[role="button"]:focus-within .role-arrow {
          opacity: 1 !important;
          transform: translateX(2px);
        }
        @media (max-width: 720px) {
          div[style*="display: flex"][style*="min-height: 100vh"] { flex-direction: column !important; }
          div[style*="width: 380px"] { width: 100% !important; min-width: unset !important; padding: 40px 24px 32px !important; }
          div[style*="padding: 64px 72px"] { padding: 40px 24px !important; }
        }
        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
        }
      `}</style>
    </div>
  );
}
