import React, { useMemo, useEffect, useState, useCallback } from 'react';
import { Radio, StopCircle, QrCode, AlertCircle, FileBarChart, Calendar, Loader2 } from 'lucide-react';
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

  // Real-time attendance count using onSnapshot (NOT one-time getDocs)
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
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
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
    <div className="max-w-[1280px] mx-auto px-margin-mobile md:px-gutter py-8 animate-in fade-in duration-500">
      <div className="mb-8">
        <h1 className="font-headline-lg text-on-surface mb-1">
          Welcome back, {user?.name || 'Lecturer'}
        </h1>
        <p className="font-body-md text-on-surface-variant">
          {activeSession
            ? `Active session: ${activeSession.courseName} — ${attendanceCount} students checked in`
            : 'No active session. Start one below to begin accepting check-ins.'}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-lg">

        {/* Active Session / Start Session Panel */}
        <div className="md:col-span-8 bg-surface-container-lowest rounded-2xl p-6 border border-outline-variant/20 relative overflow-hidden min-h-[320px]">
          {activeSession ? (
            <>
              <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                <Radio className="w-32 h-32" />
              </div>

              <div className="relative z-10 flex flex-col h-full justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <span className="flex h-3 w-3 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-success"></span>
                    </span>
                    <span className="font-label-md text-on-surface-variant tracking-wider">
                      Session Live
                    </span>
                  </div>

                  <h2 className="font-title-lg text-on-surface mb-1">
                    {activeSession.courseName}
                    <span className="text-on-surface-variant font-normal ml-2 text-base">
                      ({activeSession.courseCode})
                    </span>
                  </h2>
                  <p className="font-body-md text-on-surface-variant mb-6">
                    Room: {activeSession.room} · Started {activeSession.startTime}
                  </p>

                  {/* Attendance stats */}
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="bg-success-container/15 rounded-xl p-4 text-center">
                      <p className="font-headline-md text-success leading-none">{attendanceCount}</p>
                      <p className="font-label-md text-on-surface-variant mt-1">Present</p>
                    </div>
                    <div className="bg-error-container/30 rounded-xl p-4 text-center">
                      <p className="font-headline-md text-error leading-none">
                        {Math.max(0, enrolledCount - attendanceCount)}
                      </p>
                      <p className="font-label-md text-on-surface-variant mt-1">Absent</p>
                    </div>
                    <div className="bg-surface-container rounded-xl p-4 text-center">
                      <p className="font-headline-md text-on-surface leading-none">{attendancePct}%</p>
                      <p className="font-label-md text-on-surface-variant mt-1">Rate</p>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="mb-6">
                    <div className="flex justify-between text-xs text-on-surface-variant mb-1">
                      <span>Check-in progress</span>
                      <span>{attendanceCount} / {enrolledCount}</span>
                    </div>
                    <div className="w-full bg-surface-container-high rounded-full h-2.5 overflow-hidden">
                      <div
                        className="bg-success h-full rounded-full transition-all duration-500"
                        style={{ width: `${attendancePct}%` }}
                      ></div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={handleEndSession}
                    className="btn-danger px-6 py-3 rounded-xl text-sm active:scale-95"
                  >
                    <StopCircle className="w-4 h-4" />
                    End Session
                  </button>
                  <button
                    onClick={() => navigate(`/lecturer/live?sessionId=${activeSession.id}`)}
                    className="bg-surface-container-high text-on-surface px-6 py-3 rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-surface-container transition-colors active:scale-95"
                  >
                    <QrCode className="w-4 h-4" />
                    Show QR & Attendance
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              <h3 className="font-title-lg text-on-surface mb-4">Start New Session</h3>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  handleStartSession(
                    fd.get('code') as string,
                    fd.get('name') as string,
                    fd.get('room') as string
                  );
                }}
                className="space-y-4"
              >
                <div className="grid grid-cols-2 gap-4">
                  <div className="form-group">
                    <label className="form-label">Course Code</label>
                    <input
                      name="code"
                      required
                      placeholder="e.g. COMP 201"
                      className="input-base"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Room / Venue</label>
                    <input
                      name="room"
                      required
                      placeholder="e.g. Room 104"
                      className="input-base"
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Course Name</label>
                  <input
                    name="name"
                    required
                    placeholder="e.g. Data Structures & Algorithms"
                    className="input-base"
                  />
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
        <div className="md:col-span-4 bg-surface-container-lowest rounded-2xl p-6 flex flex-col border border-outline-variant/20">
          <h3 className="font-title-lg text-on-surface mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-3 flex-1">
            <button className="bg-surface-container hover:bg-surface-container-high border border-outline-variant/20 rounded-xl p-4 flex flex-col items-center justify-center text-center transition-colors group">
              <div className="w-11 h-11 rounded-full bg-primary-container/20 text-primary flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                <AlertCircle className="w-5 h-5" />
              </div>
              <span className="font-label-md text-on-surface text-[10px]">Notify Absentees</span>
            </button>
            <button className="bg-surface-container hover:bg-surface-container-high border border-outline-variant/20 rounded-xl p-4 flex flex-col items-center justify-center text-center transition-colors group">
              <div className="w-11 h-11 rounded-full bg-secondary-container/20 text-on-secondary-container flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                <FileBarChart className="w-5 h-5" />
              </div>
              <span className="font-label-md text-on-surface text-[10px]">Generate Report</span>
            </button>
            <button className="bg-surface-container hover:bg-surface-container-high border border-outline-variant/20 rounded-xl p-4 flex flex-col items-center justify-center text-center transition-colors group">
              <div className="w-11 h-11 rounded-full bg-success-container/20 text-success flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                <Calendar className="w-5 h-5" />
              </div>
              <span className="font-label-md text-on-surface text-[10px]">Schedule</span>
            </button>
            <button
              onClick={() => navigate('/lecturer/risk')}
              className="bg-surface-container hover:bg-surface-container-high border border-outline-variant/20 rounded-xl p-4 flex flex-col items-center justify-center text-center transition-colors group"
            >
              <div className="w-11 h-11 rounded-full bg-error-container/20 text-on-error-container flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                <AlertCircle className="w-5 h-5" />
              </div>
              <span className="font-label-md text-on-surface text-[10px]">Risk Monitor</span>
            </button>
          </div>
        </div>

        {/* Weekly Trend */}
        <div className="md:col-span-12 bg-surface-container-lowest rounded-2xl p-6 flex flex-col border border-outline-variant/20">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-title-lg text-on-surface">Weekly Attendance Trend</h3>
            <span className="px-3 py-1 bg-success-container/15 text-success rounded-full font-label-md text-[10px]">
              Avg: {weeklyAvg}%
            </span>
          </div>
          <div className="flex items-end space-x-2 min-h-[120px] relative pt-4">
            {weeklyTrend.map(({ day, pct }) => (
              <div key={day} className="flex-1 flex flex-col items-center justify-end h-full">
                <div
                  className="w-full max-w-[48px] bg-primary/20 hover:bg-primary rounded-t-md transition-colors cursor-pointer"
                  style={{ height: `${Math.max(pct, 4)}%`, minHeight: 8 }}
                  title={`${day}: ${pct}%`}
                ></div>
                <span className="font-label-md text-on-surface-variant mt-2 text-[10px]">{day}</span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
