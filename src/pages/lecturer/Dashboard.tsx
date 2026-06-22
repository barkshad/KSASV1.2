import React, { useMemo, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Radio, StopCircle, QrCode, AlertCircle, FileBarChart, Calendar, Loader2, Bookmark, DownloadCloud, CheckCircle, X, TrendingUp, Star } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  LineChart, Line, BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { useAuth } from '../../hooks/useAuth';
import { useFirestoreRealtimeCollection } from '../../hooks/useFirestoreRealtime';
import { db, collection, addDoc, serverTimestamp, doc, updateDoc, onSnapshot, getDocs, query, where } from '../../lib/firebase';
import { collections, archiveSession } from '../../lib/db';
import { generateSessionTOTPSecret } from '../../lib/totp';
import { exportSessionCSV } from '../../lib/csvExport';

export default function LecturerDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: allSessions, loading: loadingSessions } = useFirestoreRealtimeCollection(collections.SESSIONS);

  const activeSession = useMemo(() => {
    return allSessions.find(s => s.lecturerId === user?.uid && s.status === 'open');
  }, [allSessions, user]);

  const [starting, setStarting] = useState(false);
  const [attendanceCount, setAttendanceCount] = useState(0);
  const [ending, setEnding] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [endResult, setEndResult] = useState<{ session: any; attendance: any[] } | null>(null);

  useEffect(() => {
    if (!activeSession?.id) {
      setAttendanceCount(0);
      return;
    }

    const attCollRef = collection(db, `${collections.SESSIONS}/${activeSession.id}/attendance`);
    const unsubscribe = onSnapshot(attCollRef, (snapshot) => {
      setAttendanceCount(snapshot.docs.length);
    }, (error) => {
      console.error('Attendance count listener error:', error);
    });

    return () => unsubscribe();
  }, [activeSession?.id]);

  const handleStartSession = async (courseCode: string, courseName: string, room: string, topicOfDay: string = '', securityConfig?: {
    requireGps?: boolean;
    requireIpRange?: boolean;
    campusLat?: number;
    campusLng?: number;
    allowedRadiusMeters?: number;
  }) => {
    setStarting(true);
    try {
      const secret = generateSessionTOTPSecret();
      const dateStr = new Date().toISOString().split('T')[0];

      let enrolledCount = 0;
      try {
        const enrollQ = query(collection(db, collections.ENROLLMENTS), where('courseCode', '==', courseCode));
        const enrollSnap = await getDocs(enrollQ);
        enrolledCount = enrollSnap.size;
      } catch {
        enrolledCount = 0;
      }

      const newSessionRef = await addDoc(collection(db, collections.SESSIONS), {
        courseCode,
        courseName,
        lecturerId: user?.uid,
        lecturerName: user?.name || 'Lecturer',
        room,
        date: dateStr,
        startTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        endTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        windowMinutes: 15,
        status: 'open',
        totpSecret: secret,
        enrolledCount,
        createdAt: serverTimestamp(),
        topicOfDay,
        // Security config
        requireGps: securityConfig?.requireGps || false,
        requireIpRange: securityConfig?.requireIpRange || false,
        campusLat: securityConfig?.campusLat,
        campusLng: securityConfig?.campusLng,
        allowedRadiusMeters: securityConfig?.allowedRadiusMeters || 500,
      });

      navigate(`/lecturer/live?sessionId=${newSessionRef.id}`);
    } catch (err) {
      console.error('Failed to start session', err);
      toast.error('Failed to start session.');
    } finally {
      setStarting(false);
    }
  };

  const handleEndSession = async () => {
    if (!activeSession) return;
    setShowEndConfirm(true);
  };

  const confirmEndSession = async () => {
    if (!activeSession || ending) return;
    setEnding(true);
    try {
      const attCollRef = collection(db, `${collections.SESSIONS}/${activeSession.id}/attendance`);
      const snapshot = await getDocs(attCollRef);
      const records = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

      // Build CSV data for archive
      const headers = ['Student Name','Registration Number','Check-In Time','Status','Device Fingerprint'];
      const rows = records.map((r: any) => [
        r.studentName || '',
        r.studentId || '',
        r.timestamp?.toDate ? r.timestamp.toDate().toLocaleString() : '—',
        r.status || 'PRESENT',
        r.deviceFingerprint || 'N/A',
      ]);
      const escape = (cell: string) => `"${String(cell).replace(/"/g, '""')}"`;
      const csvStr = [headers, ...rows].map(row => row.map(escape).join(',')).join('\n');

      await updateDoc(doc(db, collections.SESSIONS, activeSession.id), { status: 'closed' });
      await archiveSession(activeSession.id, csvStr);

      setEndResult({ session: { ...activeSession, id: activeSession.id }, attendance: records });
      setShowEndConfirm(false);
    } catch (err) {
      console.error('Failed to end session', err);
      toast.error('Failed to end session.');
    } finally {
      setEnding(false);
    }
  };

  const handleDownloadCsv = () => {
    if (!endResult) return;
    exportSessionCSV(endResult.session, endResult.attendance);
  };

  if (loadingSessions) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--kabu-maroon)' }} />
      </div>
    );
  }

  const enrolledCount = activeSession?.enrolledCount || 0;
  const attendancePct = enrolledCount > 0 ? Math.min(100, Math.round((attendanceCount / enrolledCount) * 100)) : 0;

  const weeklyTrend = useMemo(() => {
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const lecturerSessions = allSessions.filter(s => s.lecturerId === user?.uid);
    const dayCount: Record<string, { present: number; total: number }> = {};
    dayNames.forEach(d => { dayCount[d] = { present: 0, total: 0 }; });

    lecturerSessions.forEach(s => {
      if (!s.date) return;
      const day = dayNames[new Date(s.date).getDay()];
      if (day) dayCount[day].total++;
    });

    return dayNames.filter(d => d !== 'Sun' && d !== 'Sat').map(day => {
      const { present, total } = dayCount[day];
      return { day, pct: total > 0 ? Math.round((present / total) * 100) : 0 };
    });
  }, [allSessions, user]);

  const weeklyAvg = useMemo(() => {
    const vals = weeklyTrend.filter(d => d.pct > 0);
    if (vals.length === 0) return 0;
    return Math.round(vals.reduce((s, d) => s + d.pct, 0) / vals.length);
  }, [weeklyTrend]);

  return (
    <div className="animate-page-in" style={{ maxWidth: '1280px', margin: '0 auto', padding: '32px 48px' }}>
      <div className="mb-8">
        <h1 style={{ fontFamily: 'var(--font-editorial)', fontSize: '28px', color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
          Welcome back, {user?.name || 'Lecturer'}
        </h1>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 300, fontStyle: 'italic' }}>
          Education in Biblical Perspective · {user?.department || 'Lecturer'}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">

        {/* Active Session / Start Session Panel */}
        <div
          className="md:col-span-8 relative overflow-hidden"
          style={{
            minHeight: '320px',
            padding: '24px',
            background: 'var(--bg-surface)',
            borderRadius: 'var(--radius-lg)',
            border: '0.5px solid var(--bg-border)',
            boxShadow: '0 1px 3px rgba(0,0,0,0.4), 0 0 0 0.5px var(--bg-border)',
          }}
        >
          {activeSession ? (
            <>
              <div className="relative z-10 flex flex-col h-full justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <span className="flex h-3 w-3 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: 'var(--success)' }}></span>
                      <span className="relative inline-flex rounded-full h-3 w-3" style={{ background: 'var(--success)' }}></span>
                    </span>
                    <span style={{ fontFamily: 'var(--font-body)', fontSize: '11px', fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                      Session Live
                    </span>
                  </div>

                  <h2 style={{ fontFamily: 'var(--font-editorial)', fontSize: '20px', color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
                    {activeSession.courseName}
                    <span className="font-normal ml-2" style={{ fontFamily: 'var(--font-body)', fontSize: '15px', color: 'var(--text-secondary)' }}>
                      ({activeSession.courseCode})
                    </span>
                  </h2>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: '15px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                    Room: {activeSession.room} · Started {activeSession.startTime}
                  </p>

                  {/* Attendance stats */}
                  <div className="grid grid-cols-3 gap-4 mt-6">
                    <div className="p-4 text-center" style={{ background: 'var(--success-bg)', borderRadius: 'var(--radius-md)' }}>
                      <p style={{ fontFamily: 'var(--font-mono)', fontSize: '24px', fontWeight: 500, color: 'var(--success)' }}>{attendanceCount}</p>
                      <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginTop: '4px' }}>Present</p>
                    </div>
                    <div className="p-4 text-center" style={{ background: 'var(--danger-bg)', borderRadius: 'var(--radius-md)' }}>
                      <p style={{ fontFamily: 'var(--font-mono)', fontSize: '24px', fontWeight: 500, color: 'var(--danger)' }}>
                        {Math.max(0, enrolledCount - attendanceCount)}
                      </p>
                      <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginTop: '4px' }}>Absent</p>
                    </div>
                    <div className="p-4 text-center" style={{ background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)' }}>
                      <p style={{ fontFamily: 'var(--font-mono)', fontSize: '24px', fontWeight: 500, color: attendancePct >= 75 ? 'var(--success)' : attendancePct >= 50 ? 'var(--warning)' : 'var(--danger)' }}>
                        {attendancePct}%
                      </p>
                      <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginTop: '4px' }}>Rate</p>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="mt-6">
                    <div className="flex justify-between" style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                      <span>Check-in progress</span>
                      <span>{attendanceCount} / {enrolledCount}</span>
                    </div>
                    <div className="w-full" style={{ background: 'var(--bg-elevated)', borderRadius: '9999px', height: '8px', overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${attendancePct}%`,
                          height: '100%',
                          background: attendancePct >= 75 ? 'var(--success)' : attendancePct >= 50 ? 'var(--warning)' : 'var(--danger)',
                          borderRadius: '9999px',
                          transition: 'width 500ms ease',
                        }}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3 mt-6">
                  <button
                    onClick={handleEndSession}
                    className="btn-danger px-6 py-3 text-sm"
                  >
                    <StopCircle className="w-4 h-4" />
                    End Session
                  </button>
                  <button
                    onClick={() => navigate(`/lecturer/live?sessionId=${activeSession.id}`)}
                    className="btn-ghost px-6 py-3 text-sm flex items-center gap-2"
                  >
                    <QrCode className="w-4 h-4" />
                    Show QR & Attendance
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              <h3 style={{ fontFamily: 'var(--font-editorial)', fontSize: '20px', color: 'var(--text-primary)', letterSpacing: '-0.01em', marginBottom: '16px' }}>
                Start New Session
              </h3>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  const securityConfig = {
                    requireGps: fd.get('requireGps') === 'on',
                    requireIpRange: fd.get('requireIpRange') === 'on',
                    campusLat: fd.get('campusLat') ? parseFloat(fd.get('campusLat') as string) : undefined,
                    campusLng: fd.get('campusLng') ? parseFloat(fd.get('campusLng') as string) : undefined,
                    allowedRadiusMeters: fd.get('allowedRadiusMeters') ? parseInt(fd.get('allowedRadiusMeters') as string) : 500,
                  };
                  handleStartSession(
                    fd.get('code') as string,
                    fd.get('name') as string,
                    fd.get('room') as string,
                    (fd.get('topic') as string) || '',
                    securityConfig
                  );
                }}
                className="space-y-4"
              >
                <div className="grid grid-cols-2 gap-4">
                  <div className="form-group">
                    <label className="form-label">Course Code</label>
                    <input name="code" required placeholder="e.g. COMP 201" className="input-base" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Room / Venue</label>
                    <input name="room" required placeholder="e.g. Room 104" className="input-base" />
                  </div>
                </div>
                <div className="form-group">
                    <label className="form-label">Course Name</label>
                    <input name="name" required placeholder="e.g. Data Structures & Algorithms" className="input-base" />
                  </div>
                   <div className="form-group">
                    <label className="font-label-md uppercase tracking-widest" style={{ color: 'var(--color-text-tertiary)' }}>Topic of Day</label>
                    <input
                      name="topic"
                      maxLength={120}
                      placeholder="e.g. Constitutional Law — Chapter 3"
                      style={{
                        fontFamily: 'Outfit, sans-serif',
                        fontSize: '14px',
                        background: 'var(--bg-surface)',
                        border: '0.5px solid var(--bg-border)',
                        borderRadius: 'var(--radius-md)',
                        padding: '10px 14px',
                        width: '100%',
                        color: 'var(--text-primary)',
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                      onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--kabu-gold-dark)'; }}
                      onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--bg-border)'; }}
                      onChange={(e) => {
                        const next = e.currentTarget.nextElementSibling;
                        if (next) next.textContent = `${e.currentTarget.value.length} / 120`;
                      }}
                    />
                    <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: '11px', color: 'var(--text-tertiary)', textAlign: 'right', marginTop: '4px' }}>0 / 120</div>
                  </div>

                  {/* Security Settings */}
                  <div className="p-4 rounded-xl" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)' }}>
                    <div className="flex items-center gap-2 mb-3">
                      <svg className="w-4 h-4" style={{ color: 'var(--gold-primary)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                      </svg>
                      <span className="font-label-md" style={{ color: 'var(--text-secondary)' }}>Anti-Fraud Security</span>
                    </div>
                    
                    <div className="space-y-3">
                      <label className="flex items-center justify-between cursor-pointer">
                        <span className="text-sm" style={{ color: 'var(--text-primary)' }}>GPS Proximity Check</span>
                        <input type="checkbox" name="requireGps" className="w-4 h-4 accent-[var(--gold-primary)]" />
                      </label>
                      
                      <label className="flex items-center justify-between cursor-pointer">
                        <span className="text-sm" style={{ color: 'var(--text-primary)' }}>IP Range Validation</span>
                        <input type="checkbox" name="requireIpRange" className="w-4 h-4 accent-[var(--gold-primary)]" />
                      </label>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Campus Latitude</label>
                          <input
                            name="campusLat"
                            type="number"
                            step="any"
                            placeholder="-0.3031"
                            style={{
                              fontFamily: 'var(--font-mono)',
                              fontSize: '12px',
                              background: 'var(--bg-surface)',
                              border: '0.5px solid var(--bg-border)',
                              borderRadius: 'var(--radius-sm)',
                              padding: '6px 8px',
                              width: '100%',
                              color: 'var(--text-primary)',
                              outline: 'none',
                            }}
                          />
                        </div>
                        <div>
                          <label className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Campus Longitude</label>
                          <input
                            name="campusLng"
                            type="number"
                            step="any"
                            placeholder="35.9403"
                            style={{
                              fontFamily: 'var(--font-mono)',
                              fontSize: '12px',
                              background: 'var(--bg-surface)',
                              border: '0.5px solid var(--bg-border)',
                              borderRadius: 'var(--radius-sm)',
                              padding: '6px 8px',
                              width: '100%',
                              color: 'var(--text-primary)',
                              outline: 'none',
                            }}
                          />
                        </div>
                      </div>
                      
                      <div>
                        <label className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Allowed Radius (meters)</label>
                        <input
                          name="allowedRadiusMeters"
                          type="number"
                          min="50"
                          max="2000"
                          defaultValue="500"
                          style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: '12px',
                            background: 'var(--bg-surface)',
                            border: '0.5px solid var(--bg-border)',
                            borderRadius: 'var(--radius-sm)',
                            padding: '6px 8px',
                            width: '100%',
                            color: 'var(--text-primary)',
                            outline: 'none',
                          }}
                        />
                      </div>
                    </div>
                    
                    <p className="mt-2 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                      Device binding + token consumption are always enabled. GPS and IP checks are optional.
                    </p>
                  </div>
                  <button
                    type="submit"
                    disabled={starting}
                    className="btn-primary w-full h-12 text-sm disabled:opacity-60"
                  >
                    {starting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" /> Starting...
                      </>
                    ) : (
                      <>
                        <Radio className="w-4 h-4" />
                        Start Session
                      </>
                    )}
                  </button>
              </form>
            </>
          )}
        </div>

        {/* Quick Actions */}
        <div
          className="md:col-span-4 flex flex-col"
          style={{
            padding: '24px',
            background: 'var(--bg-surface)',
            borderRadius: 'var(--radius-lg)',
            border: '0.5px solid var(--bg-border)',
            boxShadow: '0 1px 3px rgba(0,0,0,0.4), 0 0 0 0.5px var(--bg-border)',
          }}
        >
          <h3 style={{ fontFamily: 'var(--font-editorial)', fontSize: '20px', color: 'var(--text-primary)', letterSpacing: '-0.01em', marginBottom: '16px' }}>
            Quick Actions
          </h3>
          <div className="grid grid-cols-2 gap-3 flex-1">
            {[
              { icon: AlertCircle, label: 'Notify Absentees', bg: 'var(--kabu-maroon-tint)', color: 'var(--kabu-maroon)' },
              { icon: FileBarChart, label: 'Generate Report', bg: 'var(--bg-elevated)', color: 'var(--text-secondary)' },
              { icon: Calendar, label: 'Schedule', bg: 'var(--success-bg)', color: 'var(--success)' },
              { icon: AlertCircle, label: 'Risk Monitor', bg: 'var(--danger-bg)', color: 'var(--danger)' },
            ].map((action, i) => (
              <button
                key={action.label}
                onClick={i === 3 ? () => navigate('/lecturer/risk') : undefined}
                className="flex flex-col items-center justify-center p-4 text-center transition-colors"
                style={{
                  background: action.bg,
                  border: '0.5px solid var(--bg-border)',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                }}
              >
                <div className="w-11 h-11 rounded-full flex items-center justify-center mb-2" style={{ background: 'var(--bg-surface)' }}>
                  <action.icon className="w-5 h-5" style={{ color: action.color }} />
                </div>
                <span style={{ fontFamily: 'var(--font-body)', fontSize: '10px', fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-primary)' }}>
                  {action.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Weekly Trend */}
        <div
          className="md:col-span-12 flex flex-col"
          style={{
            padding: '24px',
            background: 'var(--bg-surface)',
            borderRadius: 'var(--radius-lg)',
            border: '0.5px solid var(--bg-border)',
            boxShadow: '0 1px 3px rgba(0,0,0,0.4), 0 0 0 0.5px var(--bg-border)',
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 style={{ fontFamily: 'var(--font-editorial)', fontSize: '20px', color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
              Weekly Attendance Trend
            </h3>
            <span className="badge badge-success">
              Avg: {weeklyAvg}%
            </span>
          </div>
          <div className="flex items-end space-x-2 relative pt-4" style={{ minHeight: '120px' }}>
            {weeklyTrend.map(({ day, pct }) => (
              <div key={day} className="flex-1 flex flex-col items-center justify-end h-full">
                <div
                  className="w-full rounded-t-md transition-colors cursor-pointer"
                  style={{
                    maxWidth: '48px',
                    height: `${Math.max(pct, 4)}%`,
                    minHeight: '8px',
                    background: 'var(--kabu-maroon)',
                    opacity: 0.3,
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.3'; }}
                  title={`${day}: ${pct}%`}
                />
                <span style={{ fontFamily: 'var(--font-body)', fontSize: '10px', fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginTop: '8px' }}>
                  {day}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Attendance Analytics */}
        <div
          className="md:col-span-12"
          style={{
            padding: '24px',
            background: 'var(--bg-surface)',
            borderRadius: 'var(--radius-lg)',
            border: '0.5px solid var(--bg-border)',
            boxShadow: '0 1px 3px rgba(0,0,0,0.4), 0 0 0 0.5px var(--bg-border)',
          }}
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 style={{ fontFamily: 'var(--font-editorial)', fontSize: '20px', color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
                Attendance Analytics
              </h3>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 300, marginTop: '2px' }}>
                Course attendance rates and recent session history
              </p>
            </div>
            <button
              onClick={() => navigate('/lecturer/reports')}
              className="btn-ghost"
              style={{ fontSize: '12px', padding: '6px 14px', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <FileBarChart className="w-3.5 h-3.5" />
              View Reports
            </button>
          </div>

          <AnalyticsSection sessions={allSessions} userId={user?.uid} />
        </div>

      </div>

      {/* End Session Confirmation Modal */}
      {showEndConfirm && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
          onClick={() => { if (!ending) setShowEndConfirm(false); }}
        >
          <div
            className="w-full max-w-md animate-scale-in"
            style={{
              background: 'var(--bg-elevated)',
              border: '0.5px solid var(--bg-border)',
              borderRadius: 'var(--radius-xl)',
              padding: '32px',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: 'var(--radius-full)',
                  background: 'var(--danger-bg)',
                  border: '0.5px solid var(--danger)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px',
                }}
              >
                <StopCircle className="w-5 h-5" style={{ color: 'var(--danger)' }} />
              </div>
              <h3 style={{ fontFamily: 'var(--font-editorial)', fontSize: '22px', color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
                End Session
              </h3>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: '14px', color: 'var(--text-secondary)', marginTop: '8px' }}>
                This will close {activeSession?.courseName}. Attendance data will be archived and a CSV download will be offered.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowEndConfirm(false)}
                disabled={ending}
                className="btn-ghost flex-1"
              >
                Cancel
              </button>
              <button
                onClick={confirmEndSession}
                disabled={ending}
                className="btn-danger flex-1"
              >
                {ending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {ending ? 'Ending…' : 'End Session'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* End Session Success Modal */}
      {endResult && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
          onClick={() => setEndResult(null)}
        >
          <div
            className="w-full max-w-md animate-scale-in"
            style={{
              background: 'var(--bg-elevated)',
              border: '0.5px solid var(--bg-border)',
              borderRadius: 'var(--radius-xl)',
              padding: '32px',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: 'var(--radius-full)',
                  background: 'var(--success-bg)',
                  border: '0.5px solid var(--success)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px',
                }}
              >
                <CheckCircle className="w-5 h-5" style={{ color: 'var(--success)' }} />
              </div>
              <h3 style={{ fontFamily: 'var(--font-editorial)', fontSize: '22px', color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
                Session ended
              </h3>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: '14px', color: 'var(--text-secondary)', marginTop: '8px' }}>
                {endResult.session.courseName} &nbsp;·&nbsp; {endResult.session.date && new Date(endResult.session.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })} &nbsp;·&nbsp; {endResult.attendance.length} students
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <button
                onClick={handleDownloadCsv}
                className="btn-primary w-full flex items-center justify-center gap-2"
                style={{ fontFamily: 'Outfit, sans-serif', fontSize: '14px', fontWeight: 500, padding: '10px 20px' }}
              >
                <DownloadCloud className="w-4 h-4" />
                Download Attendance CSV
              </button>
              <button
                onClick={() => setEndResult(null)}
                className="btn-ghost w-full"
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

function AnalyticsSection({ sessions, userId }: { sessions: any[]; userId?: string }) {
  const [feedbackList, setFeedbackList] = useState<any[]>([]);
  const [loadingFeedback, setLoadingFeedback] = useState(true);
  const [allSessionsForAvg, setAllSessionsForAvg] = useState<any[]>([]);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      setLoadingFeedback(true);
      try {
        const q = query(collection(db, collections.FEEDBACK), where('lecturerId', '==', userId));
        const snap = await getDocs(q);
        setFeedbackList(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a: any, b: any) => {
          const ta = a.createdAt?.toMillis?.() || 0;
          const tb = b.createdAt?.toMillis?.() || 0;
          return tb - ta;
        }));
      } catch {
        setFeedbackList([]);
      } finally {
        setLoadingFeedback(false);
      }
    })();
    // Fetch all sessions for university average comparison
    (async () => {
      try {
        const snap = await getDocs(collection(db, collections.SESSIONS));
        setAllSessionsForAvg(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch {
        setAllSessionsForAvg([]);
      }
    })();
  }, [userId]);
  const mySessions = useMemo(() => sessions.filter(s => s.lecturerId === userId), [sessions, userId]);

  const courseStats = useMemo(() => {
    const map = new Map<string, { total: number; present: number; name: string }>();
    mySessions.forEach(s => {
      if (!s.courseCode) return;
      const existing = map.get(s.courseCode);
      const p = s.enrolledCount || 50;
      if (existing) {
        existing.total += p;
        existing.present += s.attendanceCount || 0;
      } else {
        map.set(s.courseCode, { total: p, present: s.attendanceCount || 0, name: s.courseName || s.courseCode });
      }
    });
    return Array.from(map.entries())
      .map(([code, v]) => ({
        course: code,
        name: v.name,
        rate: v.total > 0 ? Math.round((v.present / v.total) * 100) : 0,
        present: v.present,
        total: v.total,
      }))
      .sort((a, b) => a.rate - b.rate);
  }, [mySessions]);

  const recentSessions = useMemo(() => {
    return [...mySessions]
      .filter(s => s.status === 'closed')
      .sort((a, b) => {
        if (a.date < b.date) return 1;
        if (a.date > b.date) return -1;
        return 0;
      })
      .slice(0, 10);
  }, [mySessions]);

  const totalSessions = mySessions.length;
  const avgRate = courseStats.length > 0 ? Math.round(courseStats.reduce((s, c) => s + c.rate, 0) / courseStats.length) : 0;

  // Effectiveness metrics
  const avgFeedbackScore = useMemo(() => {
    if (feedbackList.length === 0) return 0;
    return Math.round((feedbackList.reduce((s, f) => s + (f.rating || 0), 0) / feedbackList.length) * 10) / 10;
  }, [feedbackList]);

  const universityAvgRate = useMemo(() => {
    if (allSessionsForAvg.length === 0) return 0;
    let totalRate = 0;
    let count = 0;
    for (const s of allSessionsForAvg) {
      const enrolled = s.enrolledCount || 0;
      if (enrolled === 0) continue;
      const attended = s.attendanceCount || 0;
      totalRate += Math.min(100, Math.round((attended / enrolled) * 100));
      count++;
    }
    return count > 0 ? Math.round(totalRate / count) : 0;
  }, [allSessionsForAvg]);

  const effectivenessScore = useMemo(() => {
    if (totalSessions === 0) return 0;
    const attendanceComponent = avgRate * 0.6;
    const feedbackComponent = (avgFeedbackScore / 5) * 100 * 0.3;
    const consistencyComponent = courseStats.length > 0 ? Math.min(100, courseStats.length * 20) * 0.1 : 0;
    return Math.round(attendanceComponent + feedbackComponent + consistencyComponent);
  }, [avgRate, avgFeedbackScore, courseStats, totalSessions]);

  const getRateColor = (rate: number) => {
    if (rate >= 75) return 'var(--success)';
    if (rate >= 50) return 'var(--warning)';
    return 'var(--danger)';
  };

  const chartTooltipStyle = {
    background: 'var(--bg-elevated)',
    border: '0.5px solid var(--bg-border)',
    borderRadius: 'var(--radius-md)',
    fontSize: '13px',
    fontFamily: 'Outfit, sans-serif',
  };

  if (mySessions.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-tertiary)' }}>
        <TrendingUp className="w-8 h-8 mx-auto mb-2" style={{ opacity: 0.5 }} />
        <p style={{ fontFamily: 'var(--font-body)', fontSize: '14px' }}>No session data yet. Start a session to see analytics.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Mini stat row */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div style={{ padding: '16px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '24px', color: 'var(--text-primary)', fontWeight: 500 }}>{totalSessions}</p>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: '4px' }}>Sessions</p>
        </div>
        <div style={{ padding: '16px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '24px', color: 'var(--text-primary)', fontWeight: 500 }}>{courseStats.length}</p>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: '4px' }}>Courses</p>
        </div>
        <div style={{ padding: '16px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '24px', color: getRateColor(avgRate), fontWeight: 500 }}>{avgRate}%</p>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: '4px' }}>Avg Rate</p>
        </div>
      </div>

      {/* Effectiveness Metrics */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div style={{ padding: '16px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Your Avg Feedback</p>
          <div className="flex items-center justify-center gap-1 mt-2">
            <Star className="w-5 h-5" style={{ fill: 'var(--gold-primary)', color: 'var(--gold-primary)' }} />
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '24px', color: 'var(--gold-primary)', fontWeight: 500 }}>{avgFeedbackScore > 0 ? avgFeedbackScore : '—'}</p>
            <span style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--text-tertiary)' }}>/5</span>
          </div>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '4px' }}>{feedbackList.length} reviews</p>
        </div>
        <div style={{ padding: '16px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>vs University Avg</p>
          <p className="mt-2" style={{ fontFamily: 'var(--font-mono)', fontSize: '24px', fontWeight: 500, color: avgRate >= universityAvgRate ? 'var(--success)' : 'var(--warning)' }}>
            {avgRate >= universityAvgRate ? '+' : ''}{avgRate - universityAvgRate}%
          </p>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
            Uni avg: {universityAvgRate}%
          </p>
        </div>
        <div style={{ padding: '16px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Effectiveness Score</p>
          <p className="mt-2" style={{ fontFamily: 'var(--font-mono)', fontSize: '24px', fontWeight: 500, color: effectivenessScore >= 75 ? 'var(--success)' : effectivenessScore >= 50 ? 'var(--warning)' : 'var(--danger)' }}>
            {effectivenessScore}
          </p>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '4px' }}>of 100</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Course bar chart */}
        <div>
          <h4 style={{ fontFamily: 'var(--font-body)', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '12px' }}>
            Attendance by Course
          </h4>
          {courseStats.length > 0 ? (
            <ResponsiveContainer width="100%" height={Math.max(180, courseStats.length * 36)}>
              <BarChart data={courseStats} layout="vertical" margin={{ left: 80 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--bg-border)" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} tick={{ fill: 'var(--text-tertiary)', fontSize: 10, fontFamily: 'Outfit, sans-serif' }} tickLine={false} axisLine={{ stroke: 'var(--bg-border)' }} tickFormatter={v => `${v}%`} />
                <YAxis type="category" dataKey="course" tick={{ fill: 'var(--text-secondary)', fontSize: 11, fontFamily: 'Outfit, sans-serif' }} tickLine={false} axisLine={{ stroke: 'var(--bg-border)' }} width={75} />
                <Tooltip contentStyle={chartTooltipStyle} formatter={(value: number, _n: string, props: any) => [`${value}% (${props.payload.present}/${props.payload.total})`, 'Rate']} />
                <Bar dataKey="rate" radius={[0, 4, 4, 0]}>
                  {courseStats.map((entry, i) => (
                    <Cell key={i} fill={entry.rate >= 75 ? 'var(--success)' : entry.rate >= 50 ? 'var(--warning)' : 'var(--danger)'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--text-tertiary)', textAlign: 'center', padding: '24px 0' }}>No data</p>
          )}
        </div>

        {/* Recent sessions */}
        <div>
          <h4 style={{ fontFamily: 'var(--font-body)', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '12px' }}>
            Recent Sessions
          </h4>
          {recentSessions.length > 0 ? (
            <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
              {recentSessions.map(s => {
                const pct = s.enrolledCount ? Math.min(100, Math.round(((s.attendanceCount || 0) / s.enrolledCount) * 100)) : 0;
                return (
                  <div
                    key={s.id}
                    className="flex items-center justify-between py-2.5 px-3"
                    style={{ borderBottom: '0.5px solid var(--bg-border)', borderRadius: 'var(--radius-sm)' }}
                  >
                    <div className="min-w-0 flex-1 mr-3">
                      <p style={{ fontFamily: 'Outfit, sans-serif', fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {s.courseName || s.courseCode}
                      </p>
                      <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                        {s.date || '—'} · {s.startTime || '—'} · {s.room || '—'}
                      </p>
                    </div>
                    <span
                      className="badge"
                      style={{
                        background: pct >= 75 ? 'var(--success-bg)' : pct >= 50 ? 'var(--warning-bg)' : 'var(--danger-bg)',
                        color: pct >= 75 ? 'var(--success)' : pct >= 50 ? 'var(--warning)' : 'var(--danger)',
                        border: `0.5px solid ${pct >= 75 ? 'var(--success)' : pct >= 50 ? 'var(--warning)' : 'var(--danger)'}`,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {pct}%
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--text-tertiary)', textAlign: 'center', padding: '24px 0' }}>No sessions yet — start one to begin tracking attendance.</p>
          )}
        </div>
      </div>

      {/* Student Feedback */}
      <div className="mt-6">
        <h4 style={{ fontFamily: 'var(--font-body)', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '12px' }}>
          Student Feedback ({feedbackList.length})
        </h4>
        {loadingFeedback ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--kabu-maroon)' }} />
          </div>
        ) : feedbackList.length === 0 ? (
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--text-tertiary)', textAlign: 'center', padding: '24px 0' }}>
            No feedback received yet.
          </p>
        ) : (
          <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
            {feedbackList.slice(0, 20).map((fb: any) => (
              <div
                key={fb.id}
                style={{
                  padding: '12px 16px',
                  marginBottom: '8px',
                  background: 'var(--bg-elevated)',
                  border: '0.5px solid var(--bg-border)',
                  borderRadius: 'var(--radius-md)',
                }}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span style={{ fontFamily: 'Outfit, sans-serif', fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>
                      {fb.studentName || 'Anonymous'}
                    </span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-tertiary)' }}>
                      {fb.courseCode}
                    </span>
                  </div>
                  <div className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map(n => (
                      <Star
                        key={n}
                        className="w-3.5 h-3.5"
                        style={{
                          fill: n <= (fb.rating || 0) ? 'var(--kabu-maroon)' : 'none',
                          color: n <= (fb.rating || 0) ? 'var(--kabu-maroon)' : 'var(--text-tertiary)',
                        }}
                      />
                    ))}
                  </div>
                </div>
                {fb.comment && (
                  <p style={{ fontFamily: 'Outfit, sans-serif', fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                    {fb.comment}
                  </p>
                )}
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-tertiary)', marginTop: '6px' }}>
                  {fb.createdAt?.toDate?.()?.toLocaleString() || '—'}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ marginTop: '48px', paddingTop: '16px', borderTop: '0.5px solid var(--bg-border)', textAlign: 'center' }}>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--text-tertiary)' }}>
          KSAS is built exclusively for Kabarak University · kabarak.ac.ke
        </p>
      </div>
    </div>
  );
}
