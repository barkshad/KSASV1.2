import React, { useMemo, useEffect, useState, useCallback } from 'react';
import { Radio, StopCircle, QrCode, AlertCircle, FileBarChart, Calendar, Loader2, Bookmark } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../../hooks/useAuth';
import { useFirestoreRealtimeCollection } from '../../hooks/useFirestoreRealtime';
import { db, collection, addDoc, serverTimestamp, doc, updateDoc, onSnapshot } from '../../lib/firebase';
import { collections, archiveSession } from '../../lib/db';
import { generateSessionTOTPSecret } from '../../lib/totp';

export default function LecturerDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: allSessions, loading: loadingSessions } = useFirestoreRealtimeCollection(collections.SESSIONS);

  const activeSession = useMemo(() => {
    return allSessions.find(s => s.lecturerId === user?.uid && s.status === 'open');
  }, [allSessions, user]);

  const [starting, setStarting] = useState(false);
  const [attendanceCount, setAttendanceCount] = useState(0);

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

  const handleStartSession = async (courseCode: string, courseName: string, room: string) => {
    setStarting(true);
    try {
      const secret = generateSessionTOTPSecret();
      const dateStr = new Date().toISOString().split('T')[0];
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
        enrolledCount: 50,
        createdAt: serverTimestamp()
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
    if (confirm('End this session? Attendance data will be archived.')) {
      try {
        await updateDoc(doc(db, collections.SESSIONS, activeSession.id), { status: 'closed' });
        await archiveSession(activeSession.id);
      } catch (err) {
        console.error('Failed to end session', err);
        toast.error('Failed to end session.');
      }
    }
  };

  if (loadingSessions) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--gold-primary)' }} />
      </div>
    );
  }

  const enrolledCount = activeSession?.enrolledCount || 50;
  const attendancePct = Math.min(100, Math.round((attendanceCount / enrolledCount) * 100));

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
        <p style={{ fontFamily: 'var(--font-body)', fontSize: '15px', color: 'var(--text-secondary)', fontWeight: 300, marginTop: '4px' }}>
          {activeSession
            ? `Active session: ${activeSession.courseName} — ${attendanceCount} students checked in`
            : 'No active session. Start one below to begin accepting check-ins.'}
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
                  handleStartSession(
                    fd.get('code') as string,
                    fd.get('name') as string,
                    fd.get('room') as string,
                    (fd.get('topic') as string) || ''
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
                      onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--gold-muted)'; }}
                      onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--bg-border)'; }}
                      onChange={(e) => {
                        const next = e.currentTarget.nextElementSibling;
                        if (next) next.textContent = `${e.currentTarget.value.length} / 120`;
                      }}
                    />
                    <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: '11px', color: 'var(--text-tertiary)', textAlign: 'right', marginTop: '4px' }}>0 / 120</div>
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
              { icon: AlertCircle, label: 'Notify Absentees', bg: 'var(--gold-subtle)', color: 'var(--gold-primary)' },
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
                    background: 'var(--gold-primary)',
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

      </div>
    </div>
  );
}
