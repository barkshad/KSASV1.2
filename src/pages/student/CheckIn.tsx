import React, { useState } from 'react';
import { QrCode, CheckCircle, Loader2, School, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Scanner } from '@yudiel/react-qr-scanner';
import { useAuth } from '../../hooks/useAuth';
import { checkInStudent } from '../../lib/db';
import { validateTOTP } from '../../lib/totp';
import { db, doc, getDoc } from '../../lib/firebase';
import { collections } from '../../lib/db';

export default function CheckIn() {
  const [scanned, setScanned] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manualMode, setManualMode] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  const [checkedInSession, setCheckedInSession] = useState<any>(null);

  const navigate = useNavigate();
  const { user } = useAuth();

  // Stable device fingerprint
  const deviceFingerprint = btoa(
    (navigator.userAgent + (window.screen?.width ?? 0)).substring(0, 64)
  ).substring(0, 16);

  const processQrData = async (qrData: string) => {
    setShowScanner(false);
    setLoading(true);
    setError(null);
    try {
      if (!qrData.startsWith('ksas://attend')) {
        throw new Error('Invalid QR code. Please scan the classroom QR code.');
      }

      const url = new URL(qrData);
      const sessionId = url.searchParams.get('sessionId');
      const token = url.searchParams.get('token');

      if (!sessionId || !token) throw new Error('QR code is missing session data.');

      if (!user) throw new Error('You must be logged in to check in.');

      // 1. Fetch Session
      const sessionRef = doc(db, collections.SESSIONS, sessionId);
      const sessionDoc = await getDoc(sessionRef);
      if (!sessionDoc.exists()) throw new Error('Session not found or has ended.');
      const sessionData = sessionDoc.data();

      if (sessionData.status !== 'open') throw new Error('This session is no longer accepting check-ins.');

      // 2. Validate TOTP token
      if (!validateTOTP(sessionData.totpSecret, token)) {
        throw new Error('QR code has expired. Please ask your lecturer to refresh the QR code and try again.');
      }

      // 3. Write Attendance - pass the full user object
      await checkInStudent(sessionId, user, token, deviceFingerprint);

      setCheckedInSession(sessionData);
      setScanned(true);

      setTimeout(() => {
        navigate('/student');
      }, 3000);
    } catch (err: any) {
      setError(err.message || 'Check-in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    processQrData(manualCode.trim());
  };

  return (
    <div className="flex-grow flex items-center justify-center p-md md:p-gutter max-w-7xl mx-auto w-full min-h-[80vh] animate-in fade-in zoom-in-95 duration-500">
      <div className="w-full max-w-[448px] bg-surface-container-lowest rounded-2xl shadow-lg border border-outline-variant/20 p-6 flex flex-col items-center relative overflow-hidden">

        <div className="text-center mb-6">
          <h2 className="font-headline-md text-primary mb-2">Attendance Check-In</h2>
          <p className="font-body-sm text-on-surface-variant">
            Scan the QR code displayed in your classroom to mark attendance.
          </p>
        </div>

        {user && (
          <div className="w-full bg-primary-container/20 rounded-xl px-4 py-3 mb-4 flex items-center gap-3 text-sm">
            <School className="w-4 h-4 text-primary shrink-0" />
            <span className="text-on-surface font-medium truncate">
              Checking in as <strong>{user.name}</strong> <span className="text-on-surface-variant font-mono text-xs">({user.uid})</span>
            </span>
          </div>
        )}

        {error && (
          <div className="w-full bg-error-container text-on-error-container p-4 rounded-xl mb-4 text-sm font-medium text-center flex items-center justify-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center gap-3 py-8">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
            <p className="text-on-surface-variant text-sm">Verifying your attendance...</p>
          </div>
        )}

        {!loading && !manualMode && (
          <>
            {!showScanner ? (
              <div
                onClick={() => setShowScanner(true)}
                className="w-full aspect-square max-w-[280px] bg-surface-container rounded-2xl border-2 border-dashed border-outline-variant relative flex items-center justify-center mb-8 cursor-pointer overflow-hidden group hover:border-primary transition-colors"
              >
                <div className="absolute inset-0 flex items-center justify-center z-10 transition-opacity">
                  <div className="flex flex-col items-center gap-3">
                    <QrCode className="w-16 h-16 text-outline group-hover:text-primary transition-colors" />
                    <span className="text-sm font-bold text-on-surface-variant group-hover:text-primary transition-colors">Tap to Open Camera</span>
                  </div>
                </div>
                {/* Corner brackets */}
                <div className="absolute top-4 left-4 w-8 h-8 border-t-4 border-l-4 border-primary rounded-tl-lg z-20"></div>
                <div className="absolute top-4 right-4 w-8 h-8 border-t-4 border-r-4 border-primary rounded-tr-lg z-20"></div>
                <div className="absolute bottom-4 left-4 w-8 h-8 border-b-4 border-l-4 border-primary rounded-bl-lg z-20"></div>
                <div className="absolute bottom-4 right-4 w-8 h-8 border-b-4 border-r-4 border-primary rounded-br-lg z-20"></div>
              </div>
            ) : (
              <div className="w-full aspect-square max-w-[280px] rounded-2xl overflow-hidden relative mb-8 border-2 border-primary">
                <Scanner
                  onScan={(result) => {
                    if (result?.[0]?.rawValue) {
                      processQrData(result[0].rawValue);
                    }
                  }}
                  formats={['qr_code']}
                />
                <button
                  onClick={() => setShowScanner(false)}
                  className="absolute top-2 right-2 bg-error text-on-error px-3 py-1 rounded-full text-xs font-bold z-10"
                >
                  Cancel
                </button>
              </div>
            )}

            <button
              onClick={() => setManualMode(true)}
              className="font-label-md text-primary hover:text-primary/70 transition-colors mt-2"
            >
              Having trouble scanning? Enter code manually
            </button>
          </>
        )}

        {!loading && manualMode && (
          <form onSubmit={handleManualSubmit} className="w-full space-y-4 mb-6">
            <div>
              <label className="block text-sm font-bold text-on-surface mb-1">
                Paste the QR Link
              </label>
              <textarea
                required
                rows={4}
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="ksas://attend?sessionId=...&token=..."
                className="w-full bg-surface-container border border-outline-variant/50 rounded-xl py-3 px-4 focus:outline-none focus:border-primary transition-all text-on-surface text-sm"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setManualMode(false); setError(null); }}
                className="flex-1 py-3 font-bold text-on-surface-variant hover:bg-surface-variant/20 rounded-xl transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 bg-primary text-on-primary py-3 rounded-xl font-bold flex items-center justify-center hover:bg-primary/90 transition-all"
              >
                Submit
              </button>
            </div>
          </form>
        )}

        {/* Success overlay */}
        {scanned && (
          <div className="absolute inset-0 bg-surface-container-lowest flex flex-col items-center justify-center p-6 text-center z-50 animate-in fade-in zoom-in duration-300">
            <div className="w-20 h-20 bg-success-container/20 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="w-12 h-12 text-success" />
            </div>
            <h3 className="font-title-lg text-success mb-2">Attendance Confirmed</h3>
            {checkedInSession && (
              <p className="font-body-md text-on-surface font-bold mb-1">
                {checkedInSession.courseName} ({checkedInSession.courseCode})
              </p>
            )}
            <p className="font-body-sm text-on-surface-variant mb-6">
              Redirecting to dashboard...
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
