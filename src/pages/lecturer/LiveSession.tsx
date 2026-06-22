/**
 * src/pages/lecturer/LiveSession.tsx
 * Live session management with 5-second QR refresh display.
 *
 * TOTP strategy:
 *  - Secret stored in session doc (unchanged)
 *  - TOTP period = 5s → token changes every QR refresh
 *  - UI countdown resets every 5s for visual security signal
 *  - Each QR refresh embeds a fresh TOTP token to prevent screenshot sharing
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import {
  Users, CheckCircle, Loader2, Clock, AlertCircle,
  Wifi, WifiOff, RefreshCw, RotateCcw, Download, Bookmark,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { db, doc, collection, onSnapshot, updateDoc } from '../../lib/firebase';
import { collections, archiveSession, closeSession } from '../../lib/db';
import { getCurrentTOTP } from '../../lib/totp';
import { buildAttendanceCsv, downloadCsv, formatTimeIn, AttendanceCsvRow } from '../../lib/csvExport';

const QR_DISPLAY_INTERVAL_MS = 5_000; // QR UI refreshes every 5 seconds
const TOTP_PERIOD_S = 5;              // TOTP token period (must match totp.ts)

export default function LiveSession() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const sessionId = searchParams.get('sessionId');

  // Session & attendance state
  const [sessionData, setSessionData] = useState<any>(null);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [ending, setEnding] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);

  // QR / TOTP state
  const [totpToken, setTotpToken] = useState('');
  const [countdown, setCountdown] = useState(5);       // 5→0 display countdown
  const [qrKey, setQrKey] = useState(0);               // forces QR re-mount on refresh
  const [qrFlash, setQrFlash] = useState(false);       // brief flash on refresh

  const qrIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Online / offline detection ─────────────────────────────────────────────
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  // ── Firestore listeners ────────────────────────────────────────────────────
  useEffect(() => {
    if (!sessionId) { setLoading(false); return; }
    setLoading(true);

    const unsubSession = onSnapshot(
      doc(db, collections.SESSIONS, sessionId),
      (snap) => {
        if (snap.exists()) setSessionData({ id: snap.id, ...snap.data() });
        setLoading(false);
      },
      () => setLoading(false)
    );

    const unsubAtt = onSnapshot(
      collection(db, `${collections.SESSIONS}/${sessionId}/attendance`),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        list.sort((a: any, b: any) => (b.timestamp?.toMillis?.() ?? 0) - (a.timestamp?.toMillis?.() ?? 0));
        setAttendance(list);
      }
    );

    return () => { unsubSession(); unsubAtt(); };
  }, [sessionId]);

  // ── QR refresh loop ────────────────────────────────────────────────────────
  const refreshQR = useCallback(() => {
    if (!sessionData?.totpSecret) return;
    const token = getCurrentTOTP(sessionData.totpSecret);
    setTotpToken(token);
    setQrKey((k) => k + 1);
    setCountdown(5);
    setQrFlash(true);
    setTimeout(() => setQrFlash(false), 300);
  }, [sessionData?.totpSecret]);

  useEffect(() => {
    if (!sessionData?.totpSecret || sessionData?.status !== 'open') return;

    // Initial token
    refreshQR();

    // Refresh every 5 seconds
    qrIntervalRef.current = setInterval(refreshQR, QR_DISPLAY_INTERVAL_MS);

    // Countdown tick every second
    countdownIntervalRef.current = setInterval(() => {
      setCountdown((c) => (c <= 1 ? 5 : c - 1));
    }, 1_000);

    return () => {
      if (qrIntervalRef.current) clearInterval(qrIntervalRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, [sessionData?.totpSecret, sessionData?.status, refreshQR]);

  // ── End session ────────────────────────────────────────────────────────────
  const handleEndSession = async () => {
    if (!sessionId || ending) return;
    if (!confirm('End this session? Attendance data will be archived.')) return;
    setEnding(true);
    try {
      await closeSession(sessionId);
      await archiveSession(sessionId);
      navigate('/lecturer');
    } catch (err) {
      console.error(err);
      toast.error('Failed to end session.');
      setEnding(false);
    }
  };

  // ── Reopen closed session ──────────────────────────────────────────────────
  const handleReopenSession = async () => {
    if (!sessionId) return;
    if (!confirm('Reopen this session to accept more check-ins?')) return;
    await updateDoc(doc(db, collections.SESSIONS, sessionId), { status: 'open' });
  };

  // ── CSV export ─────────────────────────────────────────────────────────────
  const handleExportCsv = () => {
    if (!sessionData) return;
    if (attendance.length === 0) {
      toast('No check-ins to export yet.', { icon: '📊' });
      return;
    }

    const rows: AttendanceCsvRow[] = attendance.map((a: any) => ({
      studentId: a.studentId || '',
      studentName: a.studentName || '',
      studentEmail: a.studentEmail || '',
      regNumber: a.studentId || '',
      status: a.status || 'present',
      date: sessionData.date || '',
      timeIn: formatTimeIn(a.timestamp),
      courseCode: sessionData.courseCode || '',
      courseName: sessionData.courseName || '',
      room: sessionData.room || '',
      lecturerName: sessionData.lecturerName || '',
      topicOfDay: sessionData.topicOfDay || '',
      deviceFingerprint: a.deviceFingerprint || '',
    }));

    const csv = buildAttendanceCsv(rows);
    const safeCourse = (sessionData.courseCode || 'session').replace(/[^a-zA-Z0-9]/g, '_');
    downloadCsv(`attendance_${safeCourse}_${sessionData.date || 'export'}.csv`, csv);
  };

  // ── Render guards ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!sessionData) {
    return (
      <div className="max-w-xl mx-auto p-8 text-center">
        <AlertCircle className="w-10 h-10 mx-auto text-error mb-3" />
        <h2 className="font-bold text-xl text-on-surface mb-2">Session not found</h2>
        <p className="text-on-surface-variant text-sm mb-6">
          This session may have ended or the link is invalid.
        </p>
        <button onClick={() => navigate('/lecturer')} className="bg-primary text-on-primary px-6 py-3 rounded-xl font-bold">
          Back to Dashboard
        </button>
      </div>
    );
  }

  const qrData = `ksas://attend?sessionId=${sessionId}&token=${totpToken}`;
  const isOpen = sessionData.status === 'open';
  const totalEnrolled = sessionData.enrolledCount || 0;
  const totalPresent = attendance.length;
  const lateCount = attendance.filter((a: any) => a.status === 'late').length;
  const attendancePct = totalEnrolled > 0 ? Math.min(100, Math.round((totalPresent / totalEnrolled) * 100)) : 0;

  // Countdown colour: green → yellow → red
  const countdownColor =
    countdown > 3 ? 'text-success' : countdown > 1 ? 'text-secondary' : 'text-error';

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 animate-in fade-in duration-400">

      {/* ── Session header ──────────────────────────────────────────────────── */}
      <div className="bg-surface-container-lowest rounded-2xl p-5 mb-6 shadow-sm border border-outline-variant/20">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className={`w-2.5 h-2.5 rounded-full ${isOpen ? 'bg-success animate-pulse' : 'bg-outline'}`} />
              <span className={`text-xs font-bold uppercase tracking-wider ${isOpen ? 'text-success' : 'text-on-surface-variant'}`}>
                {isOpen ? 'Session Live' : 'Session Closed'}
              </span>
              <span className="mx-2 text-outline-variant">·</span>
              {online ? (
                <span className="flex items-center gap-1 text-xs text-success">
                  <Wifi className="w-3 h-3" /> Connected
                </span>
              ) : (
                <span className="flex items-center gap-1 text-xs text-error">
                  <WifiOff className="w-3 h-3" /> Offline
                </span>
              )}
            </div>
            <h2 className="font-bold text-xl text-primary">{sessionData.courseName}</h2>
            <p className="text-sm text-on-surface-variant mt-0.5">
              {sessionData.courseCode} &nbsp;·&nbsp; Room {sessionData.room} &nbsp;·&nbsp;
              {sessionData.startTime}–{sessionData.endTime}
            </p>
            {sessionData.topicOfDay && (
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'var(--kabu-gold-subtle)',
                  border: '0.5px solid var(--kabu-gold-dark)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '4px 10px',
                  fontFamily: 'Outfit, sans-serif',
                  fontSize: '12px',
                  fontWeight: 400,
                  color: 'var(--kabu-gold)',
                  marginTop: '8px',
                  maxWidth: '420px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                <Bookmark className="w-4 h-4 shrink-0" style={{ color: 'var(--kabu-gold)' }} />
                <span>{sessionData.topicOfDay.length > 60 ? sessionData.topicOfDay.slice(0, 60) + '…' : sessionData.topicOfDay}</span>
              </div>
            )}
          </div>

          <div className="flex gap-2 flex-wrap">
            <button
              onClick={handleExportCsv}
              className="flex items-center gap-2 px-4 py-2.5 bg-surface-container border border-outline-variant rounded-xl text-sm font-bold text-on-surface hover:bg-surface-variant transition-colors"
            >
              <Download className="w-4 h-4" /> Export CSV
            </button>
            {!isOpen && (
              <button
                onClick={handleReopenSession}
                className="flex items-center gap-2 px-4 py-2.5 bg-surface-container border border-outline-variant rounded-xl text-sm font-bold text-on-surface hover:bg-surface-variant transition-colors"
              >
                <RotateCcw className="w-4 h-4" /> Reopen
              </button>
            )}
            <button
              onClick={handleEndSession}
              disabled={!isOpen || ending}
              className="flex items-center gap-2 px-5 py-2.5 bg-error text-on-error rounded-xl font-bold text-sm hover:bg-error/90 transition-colors disabled:opacity-50"
            >
              {ending && <Loader2 className="w-4 h-4 animate-spin" />}
              {ending ? 'Ending…' : 'End Session'}
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

        {/* ── Left: Stats + attendance feed ─────────────────────────────────── */}
        <div className="lg:col-span-7 space-y-5">

          {/* Stat cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Present', value: totalPresent, color: 'border-success', textColor: 'text-success' },
              { label: 'Absent', value: Math.max(0, totalEnrolled - totalPresent), color: 'border-error', textColor: 'text-error' },
              { label: 'Late', value: lateCount, color: 'border-secondary-fixed-dim', textColor: 'text-secondary' },
              { label: 'Enrolled', value: totalEnrolled, color: 'border-primary-container', textColor: 'text-primary' },
            ].map((s) => (
              <div key={s.label} className={`bg-surface-container-lowest p-4 rounded-xl shadow-sm border-l-4 ${s.color}`}>
                <p className="text-xs text-on-surface-variant mb-1">{s.label}</p>
                <p className={`text-2xl font-bold ${s.textColor}`}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Progress bar */}
          <div className="bg-surface-container-lowest rounded-xl p-4 border border-outline-variant/20 shadow-sm">
            <div className="flex justify-between text-sm mb-2">
              <span className="font-semibold text-on-surface">Check-in progress</span>
              <span className="text-on-surface-variant">{totalPresent}/{totalEnrolled} ({attendancePct}%)</span>
            </div>
            <div className="w-full bg-surface-container-high rounded-full h-3 overflow-hidden">
              <div
                className="bg-success h-full rounded-full transition-all duration-700"
                style={{ width: `${attendancePct}%` }}
              />
            </div>
          </div>

          {/* Attendance feed */}
          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/20 shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-outline-variant/20 bg-surface-container-low flex items-center justify-between">
              <h3 className="font-bold text-primary flex items-center gap-2 text-sm">
                <Users className="w-4 h-4" /> Check-ins ({totalPresent})
              </h3>
              {isOpen && totalPresent === 0 && (
                <span className="text-xs text-on-surface-variant flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" /> Waiting for students…
                </span>
              )}
            </div>

            <div className="divide-y divide-outline-variant/15 max-h-[420px] overflow-y-auto">
              {attendance.length === 0 ? (
                <div className="py-10 text-center text-on-surface-variant">
                  <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No check-ins yet.</p>
                  <p className="text-xs mt-1 opacity-70">Students scan the QR code to register.</p>
                </div>
              ) : (
                attendance.map((att: any) => (
                  <div
                    key={att.id}
                    className="flex items-center justify-between px-5 py-3 hover:bg-surface-container/60 transition-colors animate-in slide-in-from-left-3 fade-in duration-300"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-primary text-on-primary font-bold text-xs flex items-center justify-center shrink-0">
                        {att.studentName?.charAt(0)?.toUpperCase() || '?'}
                      </div>
                      <div>
                        <p className="font-semibold text-sm text-on-surface">{att.studentName}</p>
                        <p className="text-xs text-on-surface-variant">{att.studentId}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${
                        att.status === 'late'
                          ? 'bg-secondary-container/30 text-on-secondary-container'
                          : 'bg-success-container/20 text-on-success-container'
                      }`}>
                        {att.status || 'present'}
                      </span>
                      <span className="text-xs text-on-surface-variant">
                        {att.timestamp?.toDate
                          ? att.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                          : '—'}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* ── Right: QR code panel ───────────────────────────────────────────── */}
        <div className="lg:col-span-5">
          <div className="bg-primary rounded-3xl p-6 shadow-xl sticky top-20">

            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="font-bold text-on-primary text-lg">Attendance QR</h3>
                <p className="text-on-primary/60 text-xs mt-0.5">Token refreshes every 5 seconds</p>
              </div>

              {/* Countdown ring */}
              <div className="relative w-14 h-14 flex items-center justify-center">
                <svg className="w-14 h-14 -rotate-90 absolute" viewBox="0 0 56 56">
                  <circle cx="28" cy="28" r="24" fill="none" stroke="currentColor" strokeWidth="3" className="text-on-primary/20" />
                  <circle
                    cx="28" cy="28" r="24"
                    fill="none" stroke="currentColor" strokeWidth="3"
                    strokeDasharray={`${2 * Math.PI * 24}`}
                    strokeDashoffset={`${2 * Math.PI * 24 * (1 - countdown / 5)}`}
                    strokeLinecap="round"
                    className="text-on-primary transition-all duration-1000"
                  />
                </svg>
                <span className={`font-bold text-xl text-on-primary z-10 ${countdown <= 1 ? 'animate-pulse' : ''}`}>
                  {countdown}
                </span>
              </div>
            </div>

            {/* QR code */}
            <div className={`bg-white rounded-2xl p-4 flex items-center justify-center aspect-square transition-opacity duration-200 ${!isOpen ? 'opacity-20 pointer-events-none' : qrFlash ? 'opacity-60' : 'opacity-100'}`}>
              {totpToken && isOpen ? (
                <QRCodeSVG
                  key={qrKey}
                  value={qrData}
                  size={256}
                  className="w-full h-full"
                  includeMargin={false}
                />
              ) : (
                <div className="flex flex-col items-center gap-3 text-on-surface-variant">
                  <Loader2 className="w-8 h-8 animate-spin" />
                  <p className="text-xs">{isOpen ? 'Generating…' : 'Session closed'}</p>
                </div>
              )}
            </div>

            {/* Info row */}
            <div className="mt-4 space-y-2.5">
              <div className="flex items-center gap-2 text-on-primary/80 text-xs">
                <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                <span>QR updates every 5s · Token changes each refresh</span>
              </div>
              <div className="flex items-center gap-2 text-on-primary/80 text-xs">
                <RefreshCw className="w-3.5 h-3.5 shrink-0" />
                <span>Students can scan within the validity window</span>
              </div>
            </div>

            {/* Manual copy link */}
            {isOpen && totpToken && (
              <button
                onClick={() => navigator.clipboard?.writeText(qrData).then(() => toast.success('QR link copied to clipboard.'))}
                className="mt-4 w-full py-2.5 bg-on-primary/10 hover:bg-on-primary/20 text-on-primary font-bold rounded-xl text-xs transition-colors border border-on-primary/20"
              >
                Copy QR Link for Manual Entry
              </button>
            )}

            {!isOpen && (
              <div className="mt-4 p-3 bg-error/20 rounded-xl text-center">
                <p className="text-on-primary font-bold text-sm">Session Ended</p>
                <p className="text-on-primary/60 text-xs mt-0.5">QR code is no longer active.</p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
