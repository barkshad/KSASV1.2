import React, { useMemo, useState } from 'react';
import { Book, AlertTriangle, Clock, MapPin, CheckCircle, QrCode, Loader2, Star, Send } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../../hooks/useAuth';
import { useFirestoreRealtimeCollection } from '../../hooks/useFirestoreRealtime';
import { getDocs, query, collection, where, db, addDoc, serverTimestamp } from '../../lib/firebase';
import { collections } from '../../lib/db';

export default function StudentDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: enrollments, loading: loadingEnrollments } = useFirestoreRealtimeCollection(collections.ENROLLMENTS);
  const { data: allSessions, loading: loadingSessions } = useFirestoreRealtimeCollection(collections.SESSIONS);
  
  const [attendance, setAttendance] = React.useState<any[]>([]);
  const [loadingAttendance, setLoadingAttendance] = React.useState(true);

  React.useEffect(() => {
    if (!user?.uid) return;
    
    const fetchAttendance = async () => {
       try {
         const sessionsSnap = await getDocs(collection(db, collections.SESSIONS));
         let attList: any[] = [];
         
         for (const sDoc of sessionsSnap.docs) {
             const attQ = query(collection(db, `${collections.SESSIONS}/${sDoc.id}/attendance`), where('studentId', '==', user.uid));
             const attSnap = await getDocs(attQ);
             attSnap.forEach(d => {
                 attList.push({ id: d.id, sessionId: sDoc.id, sessionData: sDoc.data(), ...d.data() });
             });
         }
         
         setAttendance(attList.sort((a,b) => b.timestamp?.toMillis() - a.timestamp?.toMillis()));
       } catch (err) {
         console.error(err);
       } finally {
         setLoadingAttendance(false);
       }
    };
    fetchAttendance();
  }, [user]);

  const studentCourses = useMemo(() => {
    return enrollments.filter(e => e.studentId === user?.uid).map(e => e.courseCode);
  }, [enrollments, user]);

  const todaySessions = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    return allSessions.filter(s => s.date === todayStr);
  }, [allSessions]);

  const upcomingSession = useMemo(() => {
    return todaySessions.find(s => s.status === 'open' || s.status === 'scheduled') || todaySessions[0];
  }, [todaySessions]);

  const overallAttendance = useMemo(() => {
    if (attendance.length === 0) return 0;
    const present = attendance.filter(a => a.status === 'present' || a.status === 'late').length;
    return Math.round((present / attendance.length) * 100);
  }, [attendance]);

  const [feedbackRating, setFeedbackRating] = useState(0);
  const [feedbackComment, setFeedbackComment] = useState('');
  const [feedbackSession, setFeedbackSession] = useState('');
  const [submittingFeedback, setSubmittingFeedback] = useState(false);

  const handleSubmitFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedbackSession || !feedbackRating || !user?.uid) return;
    setSubmittingFeedback(true);
    try {
      const session = allSessions.find(s => s.id === feedbackSession);
      await addDoc(collection(db, collections.FEEDBACK), {
        sessionId: feedbackSession,
        courseCode: session?.courseCode || '',
        courseName: session?.courseName || '',
        lecturerId: session?.lecturerId || '',
        lecturerName: session?.lecturerName || '',
        studentId: user.uid,
        studentName: user.name || 'Student',
        rating: feedbackRating,
        comment: feedbackComment,
        createdAt: serverTimestamp(),
      });
      setFeedbackRating(0);
      setFeedbackComment('');
      setFeedbackSession('');
      toast('Feedback submitted. Thank you!', { icon: '✅' });
    } catch (err) {
      console.error('Failed to submit feedback', err);
      toast.error('Failed to submit feedback.');
    } finally {
      setSubmittingFeedback(false);
    }
  };

  if (loadingEnrollments || loadingSessions || loadingAttendance) {
      return (
        <div className="flex h-screen items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--kabu-maroon)' }} />
        </div>
      );
  }

  return (
    <div className="animate-page-in" style={{ maxWidth: '1280px', margin: '0 auto', padding: '40px 48px' }}>
      
      {/* Greeting Section */}
      <section className="mb-10">
        <h1 style={{ fontFamily: 'var(--font-editorial)', fontSize: '28px', color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
          Good morning, {user?.name || 'Student'}
        </h1>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 300, fontStyle: 'italic' }}>
          As members of the Kabarak family, excellence is our calling.
        </p>
      </section>

      {/* Quick Stats Bento */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
        
        {/* Overall Attendance */}
        <div
          className="p-6 flex items-center justify-between"
          style={{
            background: 'var(--bg-surface)',
            borderRadius: 'var(--radius-lg)',
            border: '0.5px solid var(--bg-border)',
            boxShadow: '0 1px 3px rgba(0,0,0,0.4), 0 0 0 0.5px var(--bg-border)',
          }}
        >
          <div>
            <h2 style={{ fontFamily: 'var(--font-editorial)', fontSize: '20px', color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
              Overall Attendance
            </h2>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 300, marginTop: '4px' }}>
              Active Semester
            </p>
          </div>
          <div className="relative" style={{ width: '80px', height: '80px' }}>
            <svg className="transform -rotate-90" style={{ width: '80px', height: '80px' }}>
              <circle cx="40" cy="40" r="36" stroke="var(--bg-border)" strokeWidth="6" fill="transparent" />
              <circle
                cx="40" cy="40" r="36"
                stroke={overallAttendance >= 75 ? 'var(--success)' : overallAttendance >= 50 ? 'var(--warning)' : 'var(--danger)'}
                strokeWidth="6"
                fill="transparent"
                strokeDasharray="226.2"
                strokeDashoffset={226.2 - ((overallAttendance/100) * 226.2)}
                strokeLinecap="round"
              />
            </svg>
            <span
              className="absolute inset-0 flex items-center justify-center"
              style={{ fontFamily: 'var(--font-mono)', fontSize: '20px', fontWeight: 500, color: overallAttendance >= 75 ? 'var(--success)' : overallAttendance >= 50 ? 'var(--warning)' : 'var(--danger)' }}
            >
              {overallAttendance}%
            </span>
          </div>
        </div>

        {/* Classes Today */}
        <div
          className="p-6 flex flex-col justify-center"
          style={{
            background: 'var(--bg-surface)',
            borderRadius: 'var(--radius-lg)',
            border: '0.5px solid var(--bg-border)',
            boxShadow: '0 1px 3px rgba(0,0,0,0.4), 0 0 0 0.5px var(--bg-border)',
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2" style={{ background: 'var(--kabu-maroon-tint)', borderRadius: 'var(--radius-md)' }}>
              <Book className="w-5 h-5" style={{ color: 'var(--kabu-maroon)' }} />
            </div>
            <h2 style={{ fontFamily: 'var(--font-editorial)', fontSize: '20px', color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
              Classes Today
            </h2>
          </div>
          <div className="flex items-end gap-2 mt-auto">
            <span style={{ fontFamily: 'var(--font-display)', fontSize: '36px', fontWeight: 800, color: 'var(--kabu-maroon)', lineHeight: 1 }}>
              {todaySessions.length}
            </span>
            <span style={{ fontFamily: 'var(--font-body)', fontSize: '15px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
              Scheduled
            </span>
          </div>
        </div>

        {/* Pending Check-ins */}
        <div
          className="p-6 flex flex-col justify-center"
          style={{
            background: 'var(--danger-bg)',
            borderRadius: 'var(--radius-lg)',
            border: '0.5px solid var(--danger)',
            boxShadow: '0 1px 3px rgba(0,0,0,0.4), 0 0 0 0.5px var(--danger)',
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2" style={{ background: 'var(--danger)', borderRadius: 'var(--radius-md)' }}>
              <AlertTriangle className="w-5 h-5" style={{ color: 'var(--text-on-maroon)' }} />
            </div>
            <h2 style={{ fontFamily: 'var(--font-editorial)', fontSize: '20px', color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
              Action Required
            </h2>
          </div>
          <div className="flex items-end gap-2 mt-auto">
            <span style={{ fontFamily: 'var(--font-display)', fontSize: '36px', fontWeight: 800, color: 'var(--danger)', lineHeight: 1 }}>
              {todaySessions.filter(s => s.status === 'open').length}
            </span>
            <span style={{ fontFamily: 'var(--font-body)', fontSize: '15px', color: 'var(--danger)', marginBottom: '4px' }}>
              Live Sessions
            </span>
          </div>
        </div>
      </section>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Upcoming Class */}
        <div className="lg:col-span-8">
          <h3 style={{ fontFamily: 'var(--font-editorial)', fontSize: '20px', color: 'var(--text-primary)', letterSpacing: '-0.01em', marginBottom: '16px' }}>
            Upcoming Class
          </h3>
          {upcomingSession ? (
          <div
            className="p-6 md:p-8 relative overflow-hidden"
            style={{
              background: 'var(--kabu-maroon)',
              borderRadius: 'var(--radius-lg)',
              border: '0.5px solid var(--kabu-maroon)',
              boxShadow: '0 8px 32px rgba(139,26,43,0.3), 0 0 0 0.5px var(--kabu-maroon)',
            }}
          >
            <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Clock className="w-4 h-4" style={{ color: 'rgba(244,160,168,0.7)' }} />
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: '11px', fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(244,160,168,0.7)' }}>
                    {upcomingSession.date} • {upcomingSession.startTime} - {upcomingSession.endTime}
                  </span>
                </div>
                <h4 style={{ fontFamily: 'var(--font-editorial)', fontSize: '24px', color: 'var(--text-on-maroon)', letterSpacing: '-0.01em' }}>
                  {upcomingSession.courseName}
                </h4>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: '15px', color: 'rgba(244,160,168,0.7)', marginTop: '4px' }}>
                  {upcomingSession.courseCode}
                </p>
                <div className="flex items-center gap-2 mt-4">
                  <MapPin className="w-4 h-4" style={{ color: 'rgba(244,160,168,0.7)' }} />
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: '15px', color: 'var(--text-on-maroon)' }}>
                    {upcomingSession.room}
                  </span>
                </div>
              </div>
              <button 
                onClick={() => navigate('/student/checkin')}
                disabled={upcomingSession.status !== 'open'}
                className="w-full md:w-auto flex items-center justify-center gap-2 py-3 px-6 transition-all"
                style={{
                  background: 'rgba(255,255,255,0.15)',
                  color: 'var(--text-on-maroon)',
                  borderRadius: 'var(--radius-md)',
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-body)',
                  fontWeight: 500,
                  fontSize: '14px',
                  backdropFilter: 'blur(8px)',
                  opacity: upcomingSession.status === 'open' ? 1 : 0.5,
                }}
              >
                <QrCode className="w-5 h-5" />
                <span>{upcomingSession.status === 'open' ? 'Check-in Now' : 'Not Open Yet'}</span>
              </button>
            </div>
          </div>
          ) : (
            <div
              className="p-6 text-center"
              style={{
                background: 'var(--bg-surface)',
                borderRadius: 'var(--radius-lg)',
                border: '0.5px solid var(--bg-border)',
                color: 'var(--text-secondary)',
                fontFamily: 'var(--font-body)',
                fontSize: '14px',
              }}
            >
              No upcoming classes today. Take a break!
            </div>
          )}
        </div>

        {/* Right Column: Recent Activity */}
        <div className="lg:col-span-4">
          <div className="flex items-center justify-between mb-4">
            <h3 style={{ fontFamily: 'var(--font-editorial)', fontSize: '20px', color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
              Recent Activity
            </h3>
            <button
              style={{ fontFamily: 'var(--font-body)', fontSize: '11px', fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--kabu-maroon)', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              View All
            </button>
          </div>
          <div
            style={{
              background: 'var(--bg-surface)',
              borderRadius: 'var(--radius-lg)',
              border: '0.5px solid var(--bg-border)',
              boxShadow: '0 1px 3px rgba(0,0,0,0.4), 0 0 0 0.5px var(--bg-border)',
              overflow: 'hidden',
            }}
          >
            {attendance.length > 0 ? (
                <ul>
                  {attendance.slice(0, 5).map((att, i) => (
                  <li
                    key={att.id}
                    className="flex items-center justify-between"
                    style={{
                      padding: '16px',
                      borderBottom: i < 4 ? '0.5px solid var(--bg-border)' : 'none',
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="flex items-center justify-center shrink-0"
                        style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '50%',
                          background: 'var(--success-bg)',
                        }}
                      >
                        <CheckCircle className="w-5 h-5" style={{ color: 'var(--success)' }} />
                      </div>
                      <div>
                        <p className="font-medium" style={{ fontFamily: 'var(--font-body)', fontSize: '14px', color: 'var(--text-primary)' }}>
                          {att.sessionData?.courseName || att.sessionData?.courseCode}
                        </p>
                        <p style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                          {new Date(att.timestamp?.toMillis() || Date.now()).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <span
                      className="badge"
                      style={{
                        background: att.status === 'present' ? 'var(--success-bg)' : 'var(--danger-bg)',
                        color: att.status === 'present' ? 'var(--success)' : 'var(--danger)',
                        border: `0.5px solid ${att.status === 'present' ? 'var(--success)' : 'var(--danger)'}`,
                      }}
                    >
                      {att.status || 'Present'}
                    </span>
                  </li>
                  ))}
                </ul>
            ) : (
                <div className="p-6 text-center" style={{ fontFamily: 'var(--font-body)', fontSize: '14px', color: 'var(--text-secondary)' }}>
                    No classes attended yet. Check in to your first session above.
                </div>
            )}
          </div>
        </div>

      </div>

      {/* Feedback Section */}
      <section className="mt-10">
        <h3 style={{ fontFamily: 'var(--font-editorial)', fontSize: '20px', color: 'var(--text-primary)', letterSpacing: '-0.01em', marginBottom: '4px' }}>
          Session Feedback
        </h3>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 300, marginBottom: '16px' }}>
          Help improve your learning experience — rate today's session.
        </p>
        <form
          onSubmit={handleSubmitFeedback}
          style={{
            background: 'var(--bg-surface)',
            border: '0.5px solid var(--bg-border)',
            borderRadius: 'var(--radius-lg)',
            padding: '24px',
          }}
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label style={{ fontFamily: 'var(--font-body)', fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '6px', display: 'block' }}>
                Session
              </label>
              <select
                value={feedbackSession}
                onChange={e => setFeedbackSession(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  fontFamily: 'Outfit, sans-serif',
                  fontSize: '14px',
                  background: 'var(--bg-elevated)',
                  border: '0.5px solid var(--bg-border)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--text-primary)',
                  outline: 'none',
                  cursor: 'pointer',
                }}
              >
                <option value="">Select a session</option>
                {allSessions.filter(s => s.status === 'closed').slice(0, 20).map(s => (
                  <option key={s.id} value={s.id}>{s.courseName || s.courseCode} — {s.date}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontFamily: 'var(--font-body)', fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '6px', display: 'block' }}>
                Rating
              </label>
              <div className="flex items-center gap-1" style={{ padding: '4px 0' }}>
                {[1, 2, 3, 4, 5].map(n => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setFeedbackRating(n)}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '4px',
                    }}
                  >
                    <Star
                      className="w-6 h-6"
                      style={{
                        fill: n <= feedbackRating ? 'var(--kabu-maroon)' : 'none',
                        color: n <= feedbackRating ? 'var(--kabu-maroon)' : 'var(--text-tertiary)',
                        transition: 'fill 120ms ease, color 120ms ease',
                      }}
                    />
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                disabled={submittingFeedback || !feedbackSession || !feedbackRating}
                className="btn-primary w-full flex items-center justify-center gap-2"
                style={{ fontFamily: 'Outfit, sans-serif', fontSize: '14px', fontWeight: 500, padding: '10px 20px' }}
              >
                {submittingFeedback ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {submittingFeedback ? 'Submitting...' : 'Submit Feedback'}
              </button>
            </div>
          </div>
          <div>
            <textarea
              value={feedbackComment}
              onChange={e => setFeedbackComment(e.target.value)}
              placeholder="Any additional comments? (optional)"
              maxLength={500}
              rows={2}
              style={{
                width: '100%',
                padding: '10px 14px',
                fontFamily: 'Outfit, sans-serif',
                fontSize: '14px',
                background: 'var(--bg-elevated)',
                border: '0.5px solid var(--bg-border)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-primary)',
                outline: 'none',
                resize: 'vertical',
                boxSizing: 'border-box',
              }}
              onFocus={e => { e.currentTarget.style.borderColor = 'var(--gold-muted)'; }}
              onBlur={e => { e.currentTarget.style.borderColor = 'var(--bg-border)'; }}
            />
            <p style={{ fontFamily: 'Outfit, sans-serif', fontSize: '11px', color: 'var(--text-tertiary)', textAlign: 'right', marginTop: '4px' }}>
              {feedbackComment.length} / 500
            </p>
          </div>
        </form>
      </section>

      {/* Footer */}
      <div style={{ marginTop: '48px', paddingTop: '16px', borderTop: '0.5px solid var(--bg-border)', textAlign: 'center' }}>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--text-tertiary)' }}>
          KSAS is built exclusively for Kabarak University · kabarak.ac.ke
        </p>
      </div>

    </div>
  );
}
