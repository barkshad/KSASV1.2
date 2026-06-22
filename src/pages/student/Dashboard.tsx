import React, { useMemo, useState, useEffect } from 'react';
import {
  Book, AlertTriangle, Clock, MapPin, CheckCircle, QrCode, Loader2, Star, Send,
  Flame, Trophy, Award, Shield, Sunrise, MessageCircle, Zap, Target, Check, X,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../../hooks/useAuth';
import { useFirestoreRealtimeCollection } from '../../hooks/useFirestoreRealtime';
import { getDocs, query, collection, where, db, addDoc, serverTimestamp } from '../../lib/firebase';
import { collections } from '../../lib/db';
import {
  computeGamificationData, computeLeaderboard, computeStreak, computeTotalXp,
  computeLevel, computeRank, computeBadges, computeWeeklyChallenges,
  computeCourseEligibility, GamificationData, Badge, EXAM_ELIGIBILITY_THRESHOLD,
} from '../../lib/gamification';

const BADGE_ICONS: Record<string, any> = {
  'footprints': Target,
  'calendar-check': CheckCircle,
  'flame': Flame,
  'zap': Zap,
  'sunrise': Sunrise,
  'award': Award,
  'message-circle': MessageCircle,
  'shield': Shield,
};

function ConfettiExplosion() {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), 3000);
    return () => clearTimeout(timer);
  }, []);
  if (!visible) return null;

  const particles = Array.from({ length: 40 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    delay: Math.random() * 0.5,
    color: ['var(--gold-primary)', 'var(--success)', 'var(--kabu-maroon)', '#FFD700', '#FF6B6B'][i % 5],
    size: Math.random() * 8 + 4,
    rotation: Math.random() * 360,
  }));

  return (
    <div className="fixed inset-0 z-[10000] pointer-events-none overflow-hidden">
      {particles.map(p => (
        <div
          key={p.id}
          className="absolute animate-bounce"
          style={{
            left: `${p.x}%`,
            top: '-20px',
            width: `${p.size}px`,
            height: `${p.size}px`,
            background: p.color,
            borderRadius: p.id % 2 === 0 ? '50%' : '2px',
            animation: `confetti-fall 2.5s ease-out ${p.delay}s forwards`,
            transform: `rotate(${p.rotation}deg)`,
          }}
        />
      ))}
      <style>{`
        @keyframes confetti-fall {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

export default function StudentDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: enrollments, loading: loadingEnrollments } = useFirestoreRealtimeCollection(collections.ENROLLMENTS);
  const { data: allSessions, loading: loadingSessions } = useFirestoreRealtimeCollection(collections.SESSIONS);
  const { data: courses } = useFirestoreRealtimeCollection(collections.COURSES);

  const [attendance, setAttendance] = React.useState<any[]>([]);
  const [loadingAttendance, setLoadingAttendance] = React.useState(true);
  const [feedbackCount, setFeedbackCount] = useState(0);
  const [selectedCourse, setSelectedCourse] = useState('');
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

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
            const sData = sDoc.data();
            attList.push({
              id: d.id,
              sessionId: sDoc.id,
              sessionData: sData,
              courseCode: sData.courseCode || '',
              courseName: sData.courseName || '',
              date: sData.date || '',
              ...d.data(),
            });
          });
        }

        setAttendance(attList.sort((a, b) => b.timestamp?.toMillis() - a.timestamp?.toMillis()));
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingAttendance(false);
      }
    };
    fetchAttendance();

    // Fetch feedback count
    (async () => {
      try {
        const q = query(collection(db, collections.FEEDBACK), where('studentId', '==', user.uid));
        const snap = await getDocs(q);
        setFeedbackCount(snap.size);
      } catch { setFeedbackCount(0); }
    })();
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

  // ── Gamification Data ────────────────────────────────────────────────────────
  const gamification = useMemo((): GamificationData => {
    return computeGamificationData(attendance, allSessions, studentCourses, courses, feedbackCount, user?.uid || '');
  }, [attendance, allSessions, studentCourses, courses, feedbackCount, user]);

  // Detect new badges for celebration
  useEffect(() => {
    const unlockedBadges = gamification.badges.filter(b => b.unlocked).map(b => b.id);
    const stored = localStorage.getItem('ksas_unlocked_badges');
    const prevList: string[] = stored ? JSON.parse(stored) : [];

    if (prevList.length > 0) {
      const newBadges = unlockedBadges.filter(id => !prevList.includes(id));
      if (newBadges.length > 0) {
        setShowConfetti(true);
        const badge = gamification.badges.find(b => b.id === newBadges[0]);
        if (badge) toast(`Achievement Unlocked: ${badge.name}!`, { icon: '🏆', duration: 5000 });
      }
    }

    localStorage.setItem('ksas_unlocked_badges', JSON.stringify(unlockedBadges));
  }, [gamification.badges]);

  // ── Leaderboard ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedCourse || !user?.uid) {
      setLeaderboard([]);
      return;
    }
    setLoadingLeaderboard(true);
    computeLeaderboard(selectedCourse, user.uid, allSessions)
      .then(setLeaderboard)
      .catch(() => setLeaderboard([]))
      .finally(() => setLoadingLeaderboard(false));
  }, [selectedCourse, user, allSessions]);

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
      setFeedbackCount(c => c + 1);
      toast('Feedback submitted. +20 XP earned!', { icon: '✅' });
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

  const eligibleCourses = gamification.courseEligibility.filter(c => c.eligible);
  const atRiskCourses = gamification.courseEligibility.filter(c => !c.eligible);

  return (
    <div className="animate-page-in px-4 py-6 sm:px-6 md:px-8 lg:px-12 lg:py-10" style={{ maxWidth: '1280px', margin: '0 auto' }}>
      {showConfetti && <ConfettiExplosion />}

      {/* Greeting Section */}
      <section className="mb-6">
        <div className="flex items-center gap-3 mb-1 flex-wrap">
          <h1 className="text-xl sm:text-2xl md:text-3xl truncate min-w-0" style={{ fontFamily: 'var(--font-editorial)', color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
            Good morning, {user?.name || 'Student'}
          </h1>
          <span className="shrink-0" style={{
            fontFamily: 'Outfit', fontSize: '10px', fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase',
            padding: '3px 10px', borderRadius: 'var(--radius-sm)',
            background: `${gamification.rank.color}20`, color: gamification.rank.color,
            border: `0.5px solid ${gamification.rank.color}40`,
          }}>
            {gamification.rank.icon} {gamification.rank.name}
          </span>
        </div>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 300, fontStyle: 'italic' }}>
          As members of the Kabarak family, excellence is our calling.
        </p>
      </section>

      {/* XP Bar & Level */}
      <section className="mb-6 p-4 sm:p-6" style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)', border: '0.5px solid var(--bg-border)' }}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-3 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="shrink-0" style={{
              width: '48px', height: '48px', borderRadius: 'var(--radius-md)',
              background: 'var(--gold-subtle)', border: '1px solid var(--gold-muted)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--font-mono)', fontSize: '18px', fontWeight: 700, color: 'var(--gold-primary)',
            }}>
              {gamification.level.level}
            </div>
            <div className="min-w-0">
              <p className="truncate" style={{ fontFamily: 'var(--font-editorial)', fontSize: '18px', color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
                {gamification.level.name}
              </p>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--gold-primary)' }}>
                {gamification.totalXp.toLocaleString()} XP
              </p>
            </div>
          </div>
          <div className="text-left sm:text-right shrink-0">
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Next Level
            </p>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-secondary)' }}>
              {gamification.level.xpForNext > gamification.level.xpCurrent
                ? `${(gamification.level.xpForNext - gamification.level.xpCurrent).toLocaleString()} XP to go`
                : 'Max Level'}
            </p>
          </div>
        </div>
        <div className="w-full" style={{ background: 'var(--bg-elevated)', borderRadius: '9999px', height: '10px', overflow: 'hidden' }}>
          <div
            style={{
              width: `${gamification.level.progress}%`, height: '100%',
              background: 'linear-gradient(90deg, var(--gold-muted), var(--gold-primary))',
              borderRadius: '9999px', transition: 'width 800ms ease',
            }}
          />
        </div>
        <div className="flex justify-between mt-1">
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-tertiary)' }}>{gamification.level.xpCurrent} XP</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-tertiary)' }}>{gamification.level.xpForNext} XP</span>
        </div>
      </section>

      {/* Exam Eligibility Alert */}
      {atRiskCourses.length > 0 && (
        <section className="mb-6 p-5" style={{ background: 'var(--danger-bg)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--danger)' }}>
          <div className="flex items-start gap-2 mb-3">
            <AlertTriangle className="w-5 h-5 shrink-0" style={{ color: 'var(--danger)' }} />
            <h3 className="text-sm sm:text-base" style={{ fontFamily: 'var(--font-body)', fontWeight: 600, color: 'var(--danger)' }}>
              Exam Eligibility Warning — {EXAM_ELIGIBILITY_THRESHOLD}% Minimum Required
            </h3>
          </div>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--danger)', opacity: 0.8, marginBottom: '12px' }}>
            You must maintain {EXAM_ELIGIBILITY_THRESHOLD}% attendance per unit to sit for exams.
          </p>
          <div className="space-y-3">
            {atRiskCourses.map(c => (
              <div key={c.courseCode} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3" style={{ background: 'rgba(139,26,43,0.1)', borderRadius: 'var(--radius-md)' }}>
                <div className="min-w-0">
                  <p className="font-medium truncate" style={{ fontFamily: 'Outfit', fontSize: '13px', color: 'var(--text-primary)' }}>{c.courseCode} — {c.courseName}</p>
                  <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--danger)', marginTop: '2px' }}>
                    {c.sessionsAttended}/{c.totalSessions} sessions · {c.sessionsNeeded} more needed for 80%
                  </p>
                </div>
                <span className="shrink-0" style={{ fontFamily: 'var(--font-mono)', fontSize: '18px', fontWeight: 700, color: 'var(--danger)' }}>
                  {c.attendanceRate}%
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {eligibleCourses.length > 0 && atRiskCourses.length === 0 && (
        <section className="mb-6 p-4" style={{ background: 'var(--success-bg)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--success)' }}>
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5" style={{ color: 'var(--success)' }} />
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', fontWeight: 500, color: 'var(--success)' }}>
              All {eligibleCourses.length} courses meet the {EXAM_ELIGIBILITY_THRESHOLD}% exam eligibility threshold.
            </p>
          </div>
        </section>
      )}

      {/* Quick Stats Bento */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        {/* Overall Attendance */}
        <div className="p-3 sm:p-5 flex items-center justify-between" style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)', border: '0.5px solid var(--bg-border)' }}>
          <div>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Attendance</p>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '24px', fontWeight: 500, marginTop: '2px', color: overallAttendance >= EXAM_ELIGIBILITY_THRESHOLD ? 'var(--success)' : 'var(--danger)' }}>
              {overallAttendance}%
            </p>
          </div>
          <div className="relative shrink-0" style={{ width: '44px', height: '44px' }}>
            <svg className="transform -rotate-90" style={{ width: '44px', height: '44px' }}>
              <circle cx="22" cy="22" r="18" stroke="var(--bg-border)" strokeWidth="4" fill="transparent" />
              <circle cx="22" cy="22" r="18" stroke={overallAttendance >= EXAM_ELIGIBILITY_THRESHOLD ? 'var(--success)' : 'var(--danger)'} strokeWidth="4" fill="transparent"
                strokeDasharray="113.1" strokeDashoffset={113.1 - ((overallAttendance / 100) * 113.1)} strokeLinecap="round" />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center" style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: overallAttendance >= EXAM_ELIGIBILITY_THRESHOLD ? 'var(--success)' : 'var(--danger)' }}>
              {overallAttendance >= EXAM_ELIGIBILITY_THRESHOLD ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
            </span>
          </div>
        </div>

        {/* Streak */}
        <div className="p-3 sm:p-5 flex items-center justify-between" style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)', border: '0.5px solid var(--bg-border)' }}>
          <div>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Streak</p>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '24px', fontWeight: 500, marginTop: '2px', color: 'var(--gold-primary)' }}>
              {gamification.streak.current}
            </p>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '10px', color: 'var(--text-tertiary)' }}>Best: {gamification.streak.longest}</p>
          </div>
          <div className="p-2.5 shrink-0" style={{ background: 'var(--gold-subtle)', borderRadius: 'var(--radius-md)' }}>
            <Flame className="w-5 h-5" style={{ color: 'var(--gold-primary)' }} />
          </div>
        </div>

        {/* Classes Today */}
        <div className="p-3 sm:p-5 flex items-center justify-between" style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)', border: '0.5px solid var(--bg-border)' }}>
          <div>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Today</p>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '24px', fontWeight: 500, marginTop: '2px', color: 'var(--text-primary)' }}>
              {todaySessions.length}
            </p>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '10px', color: 'var(--text-tertiary)' }}>classes</p>
          </div>
          <div className="p-2.5 shrink-0" style={{ background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)' }}>
            <Book className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} />
          </div>
        </div>

        {/* Badges */}
        <div className="p-3 sm:p-5 flex items-center justify-between" style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)', border: '0.5px solid var(--bg-border)' }}>
          <div>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Badges</p>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '24px', fontWeight: 500, marginTop: '2px', color: 'var(--text-primary)' }}>
              {gamification.badges.filter(b => b.unlocked).length}<span style={{ fontSize: '14px', color: 'var(--text-tertiary)' }}>/{gamification.badges.length}</span>
            </p>
          </div>
          <div className="p-2.5 shrink-0" style={{ background: 'var(--success-bg)', borderRadius: 'var(--radius-md)' }}>
            <Trophy className="w-5 h-5" style={{ color: 'var(--success)' }} />
          </div>
        </div>
      </section>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">

        {/* Left Column */}
        <div className="lg:col-span-8 space-y-6">
          {/* Upcoming Class */}
          <div>
            <h3 style={{ fontFamily: 'var(--font-editorial)', fontSize: '18px', color: 'var(--text-primary)', letterSpacing: '-0.01em', marginBottom: '16px' }}>
              Upcoming Class
            </h3>
            {upcomingSession ? (
              <div className="p-6 md:p-8 relative overflow-hidden" style={{ background: 'var(--kabu-maroon)', borderRadius: 'var(--radius-lg)', border: '0.5px solid var(--kabu-maroon)', boxShadow: '0 8px 32px rgba(139,26,43,0.3)' }}>
                <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Clock className="w-4 h-4" style={{ color: 'rgba(244,160,168,0.7)' }} />
                      <span style={{ fontFamily: 'var(--font-body)', fontSize: '11px', fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(244,160,168,0.7)' }}>
                        {upcomingSession.date} · {upcomingSession.startTime}
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
                      <span style={{ fontFamily: 'var(--font-body)', fontSize: '15px', color: 'var(--text-on-maroon)' }}>{upcomingSession.room}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => navigate('/student/checkin')}
                    disabled={upcomingSession.status !== 'open'}
                    className="w-full md:w-auto flex items-center justify-center gap-2 py-3 px-6 transition-all"
                    style={{ background: 'rgba(255,255,255,0.15)', color: 'var(--text-on-maroon)', borderRadius: 'var(--radius-md)', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: '14px', backdropFilter: 'blur(8px)', opacity: upcomingSession.status === 'open' ? 1 : 0.5 }}
                  >
                    <QrCode className="w-5 h-5" />
                    <span>{upcomingSession.status === 'open' ? 'Check-in Now (+10 XP)' : 'Not Open Yet'}</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-6 text-center" style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)', border: '0.5px solid var(--bg-border)', color: 'var(--text-secondary)', fontFamily: 'var(--font-body)', fontSize: '14px' }}>
                No upcoming classes today. Take a break!
              </div>
            )}
          </div>

          {/* Weekly Challenges */}
          <div>
            <h3 style={{ fontFamily: 'var(--font-editorial)', fontSize: '18px', color: 'var(--text-primary)', letterSpacing: '-0.01em', marginBottom: '16px' }}>
              Weekly Challenges
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {gamification.weeklyChallenges.map(challenge => {
                const ChallengeIcon = BADGE_ICONS[challenge.icon] || Target;
                return (
                  <div
                    key={challenge.id}
                    className="p-3 sm:p-4 transition-all"
                    style={{
                      background: challenge.completed ? 'var(--success-bg)' : 'var(--bg-surface)',
                      border: challenge.completed ? '1px solid var(--success)' : '0.5px solid var(--bg-border)',
                      borderRadius: 'var(--radius-lg)',
                      opacity: challenge.completed ? 0.8 : 1,
                    }}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="p-2" style={{ background: challenge.completed ? 'var(--success)' : 'var(--bg-elevated)', borderRadius: 'var(--radius-md)' }}>
                          <ChallengeIcon className="w-4 h-4" style={{ color: challenge.completed ? 'var(--text-inverse)' : 'var(--text-secondary)' }} />
                        </div>
                        <div>
                          <p style={{ fontFamily: 'Outfit', fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', textDecoration: challenge.completed ? 'line-through' : 'none' }}>
                            {challenge.title}
                          </p>
                          <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--text-tertiary)' }}>{challenge.description}</p>
                        </div>
                      </div>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 500, color: 'var(--gold-primary)', background: 'var(--gold-subtle)', padding: '2px 8px', borderRadius: 'var(--radius-sm)' }}>
                        +{challenge.xpReward} XP
                      </span>
                    </div>
                    <div className="w-full" style={{ background: 'var(--bg-elevated)', borderRadius: '9999px', height: '6px', overflow: 'hidden' }}>
                      <div style={{
                        width: `${Math.min(100, (challenge.progress / challenge.target) * 100)}%`,
                        height: '100%',
                        background: challenge.completed ? 'var(--success)' : 'var(--gold-primary)',
                        borderRadius: '9999px', transition: 'width 500ms ease',
                      }} />
                    </div>
                    <p style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-tertiary)', marginTop: '4px', textAlign: 'right' }}>
                      {challenge.progress}/{challenge.target} {challenge.completed ? '— Complete!' : ''}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Badges */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 style={{ fontFamily: 'var(--font-editorial)', fontSize: '18px', color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
                Achievements
              </h3>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-secondary)' }}>
                {gamification.badges.filter(b => b.unlocked).length}/{gamification.badges.length} unlocked
              </span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
              {gamification.badges.map(badge => {
                const BadgeIcon = BADGE_ICONS[badge.icon] || Award;
                return (
                  <div
                    key={badge.id}
                    className="p-3 sm:p-4 text-center transition-all"
                    style={{
                      background: badge.unlocked ? 'var(--gold-subtle)' : 'var(--bg-surface)',
                      border: badge.unlocked ? '1px solid var(--gold-muted)' : '0.5px solid var(--bg-border)',
                      borderRadius: 'var(--radius-lg)',
                      opacity: badge.unlocked ? 1 : 0.5,
                      filter: badge.unlocked ? 'none' : 'grayscale(0.8)',
                    }}
                  >
                    <div className="mx-auto mb-2 flex items-center justify-center" style={{
                      width: '40px', height: '40px', borderRadius: 'var(--radius-md)',
                      background: badge.unlocked ? 'var(--gold-primary)' : 'var(--bg-elevated)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <BadgeIcon className="w-6 h-6" style={{ color: badge.unlocked ? 'var(--text-inverse)' : 'var(--text-tertiary)' }} />
                    </div>
                    <p style={{ fontFamily: 'Outfit', fontSize: '12px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '2px' }}>{badge.name}</p>
                    <p style={{ fontFamily: 'var(--font-body)', fontSize: '10px', color: 'var(--text-tertiary)' }}>{badge.description}</p>
                    {!badge.unlocked && badge.maxProgress && badge.maxProgress > 1 && (
                      <div className="mt-2">
                        <div className="w-full" style={{ background: 'var(--bg-elevated)', borderRadius: '9999px', height: '4px', overflow: 'hidden' }}>
                          <div style={{ width: `${((badge.progress || 0) / badge.maxProgress) * 100}%`, height: '100%', background: 'var(--gold-muted)', borderRadius: '9999px' }} />
                        </div>
                        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text-tertiary)', marginTop: '2px' }}>{badge.progress}/{badge.maxProgress}</p>
                      </div>
                    )}
                    {badge.unlocked && (
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--success)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Unlocked</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recent Activity */}
          <div>
            <h3 style={{ fontFamily: 'var(--font-editorial)', fontSize: '18px', color: 'var(--text-primary)', letterSpacing: '-0.01em', marginBottom: '16px' }}>
              Recent Activity
            </h3>
            <div style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)', border: '0.5px solid var(--bg-border)', overflow: 'hidden' }}>
              {attendance.length > 0 ? (
                <ul>
                  {attendance.slice(0, 5).map((att, i) => (
                    <li key={att.id} className="flex items-center justify-between gap-3 py-3 px-3 sm:px-4" style={{ borderBottom: i < 4 ? '0.5px solid var(--bg-border)' : 'none' }}>
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex items-center justify-center shrink-0" style={{ width: '36px', height: '36px', borderRadius: '50%', background: att.status === 'present' ? 'var(--success-bg)' : 'var(--danger-bg)' }}>
                          <CheckCircle className="w-4 h-4" style={{ color: att.status === 'present' ? 'var(--success)' : 'var(--danger)' }} />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate" style={{ fontFamily: 'var(--font-body)', fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>
                            {att.courseName || att.sessionData?.courseName || att.sessionData?.courseCode}
                          </p>
                          <p className="truncate" style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--text-secondary)', marginTop: '1px' }}>
                            {new Date(att.timestamp?.toMillis() || Date.now()).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <span style={{
                        fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 500, padding: '2px 8px', borderRadius: 'var(--radius-sm)',
                        background: att.status === 'present' ? 'var(--success-bg)' : 'var(--danger-bg)',
                        color: att.status === 'present' ? 'var(--success)' : 'var(--danger)',
                        border: `0.5px solid ${att.status === 'present' ? 'var(--success)' : 'var(--danger)'}`,
                      }}>
                        {att.status === 'present' ? '+10 XP' : att.status === 'late' ? '+10 XP' : '-3 XP'}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="p-6 text-center" style={{ fontFamily: 'var(--font-body)', fontSize: '14px', color: 'var(--text-secondary)' }}>
                  No classes attended yet. Check in to start earning XP!
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="lg:col-span-4 space-y-6">
          {/* Leaderboard */}
          <div style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)', border: '0.5px solid var(--bg-border)', overflow: 'hidden' }}>
            <div className="p-3 sm:p-4" style={{ borderBottom: '0.5px solid var(--bg-border)' }}>
              <h3 style={{ fontFamily: 'var(--font-editorial)', fontSize: '18px', color: 'var(--text-primary)', letterSpacing: '-0.01em', marginBottom: '8px' }}>
                Course Leaderboard
              </h3>
              <select
                value={selectedCourse}
                onChange={e => setSelectedCourse(e.target.value)}
                style={{ width: '100%', padding: '6px 10px', fontFamily: 'Outfit', fontSize: '12px', background: 'var(--bg-elevated)', border: '0.5px solid var(--bg-border)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', outline: 'none', cursor: 'pointer' }}
              >
                <option value="">Select a course</option>
                {[...new Set(studentCourses)].map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            {selectedCourse && (
              <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                {loadingLeaderboard ? (
                  <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--gold-primary)' }} /></div>
                ) : leaderboard.length === 0 ? (
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--text-tertiary)', textAlign: 'center', padding: '24px' }}>No data for this course yet.</p>
                ) : (
                  leaderboard.slice(0, 20).map((entry, i) => (
                    <div
                      key={entry.studentId}
                      className="flex items-center justify-between gap-2 px-4 py-2.5"
                      style={{
                        borderBottom: '0.5px solid var(--bg-border)',
                        background: entry.isCurrentUser ? 'var(--gold-subtle)' : 'transparent',
                      }}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="shrink-0" style={{
                          fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 500, width: '24px', textAlign: 'center',
                          color: entry.rank <= 3 ? 'var(--gold-primary)' : 'var(--text-tertiary)',
                        }}>
                          {entry.rank <= 3 ? ['🥇', '🥈', '🥉'][entry.rank - 1] : `#${entry.rank}`}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate" style={{ fontFamily: 'Outfit', fontSize: '12px', fontWeight: entry.isCurrentUser ? 600 : 400, color: entry.isCurrentUser ? 'var(--gold-primary)' : 'var(--text-primary)' }}>
                            {entry.isCurrentUser ? 'You' : `Student ${entry.studentId.slice(-4)}`}
                          </p>
                          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-tertiary)' }}>
                            {entry.attendanceRate}% attendance
                          </p>
                        </div>
                      </div>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--gold-primary)' }}>
                        {entry.xp} XP
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Exam Eligibility Per Course */}
          <div style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)', border: '0.5px solid var(--bg-border)', overflow: 'hidden' }}>
            <div className="p-3 sm:p-4" style={{ borderBottom: '0.5px solid var(--bg-border)' }}>
              <h3 style={{ fontFamily: 'var(--font-editorial)', fontSize: '18px', color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
                Exam Eligibility
              </h3>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                {EXAM_ELIGIBILITY_THRESHOLD}% minimum per unit
              </p>
            </div>
            <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
              {gamification.courseEligibility.map(c => (
                <div key={c.courseCode} className="px-4 py-3" style={{ borderBottom: '0.5px solid var(--bg-border)' }}>
                  <div className="flex items-center justify-between mb-1.5 gap-2">
                    <p className="truncate min-w-0" style={{ fontFamily: 'Outfit', fontSize: '12px', fontWeight: 500, color: 'var(--text-primary)' }}>{c.courseCode}</p>
                    <span style={{
                      fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 600,
                      color: c.eligible ? 'var(--success)' : 'var(--danger)',
                    }}>
                      {c.attendanceRate}%
                    </span>
                  </div>
                  <div className="w-full" style={{ background: 'var(--bg-elevated)', borderRadius: '9999px', height: '4px', overflow: 'hidden' }}>
                    <div style={{
                      width: `${Math.min(100, c.attendanceRate)}%`, height: '100%',
                      background: c.eligible ? 'var(--success)' : 'var(--danger)',
                      borderRadius: '9999px', transition: 'width 500ms ease',
                    }} />
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <p style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text-tertiary)' }}>
                      {c.sessionsAttended}/{c.totalSessions} sessions
                    </p>
                    {c.eligible ? (
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--success)' }}>Eligible</span>
                    ) : (
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--danger)' }}>{c.sessionsNeeded} more needed</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Semester Rank */}
          <div className="p-4 sm:p-5" style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)', border: '0.5px solid var(--bg-border)' }}>
            <h3 style={{ fontFamily: 'var(--font-editorial)', fontSize: '18px', color: 'var(--text-primary)', letterSpacing: '-0.01em', marginBottom: '16px' }}>
              Semester Rank
            </h3>
            <div className="space-y-3">
              {[
                { id: 'bronze', name: 'Bronze', icon: '🥉', xp: 0, color: '#CD7F32' },
                { id: 'silver', name: 'Silver', icon: '🥈', xp: 500, color: '#C0C0C0' },
                { id: 'gold', name: 'Gold', icon: '🥇', xp: 1500, color: '#FFD700' },
                { id: 'diamond', name: 'Diamond', icon: '💎', xp: 3000, color: '#B9F2FF' },
              ].map(tier => {
                const isCurrentOrPassed = gamification.totalXp >= tier.xp;
                const isCurrent = gamification.rank.id === tier.id;
                return (
                  <div key={tier.id} className="flex items-center gap-3" style={{ opacity: isCurrentOrPassed ? 1 : 0.4 }}>
                    <span style={{ fontSize: '20px' }}>{tier.icon}</span>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <p style={{ fontFamily: 'Outfit', fontSize: '12px', fontWeight: isCurrent ? 600 : 400, color: isCurrent ? tier.color : 'var(--text-primary)' }}>
                          {tier.name} {isCurrent && <span style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>(current)</span>}
                        </p>
                        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-tertiary)' }}>{tier.xp} XP</p>
                      </div>
                      <div className="w-full mt-1" style={{ background: 'var(--bg-elevated)', borderRadius: '9999px', height: '3px', overflow: 'hidden' }}>
                        <div style={{
                          width: isCurrentOrPassed ? '100%' : `${(gamification.totalXp / tier.xp) * 100}%`,
                          height: '100%', background: tier.color, borderRadius: '9999px',
                        }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Feedback Section */}
      <section className="mt-8">
        <h3 style={{ fontFamily: 'var(--font-editorial)', fontSize: '18px', color: 'var(--text-primary)', letterSpacing: '-0.01em', marginBottom: '4px' }}>
          Session Feedback
        </h3>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 300, marginBottom: '16px' }}>
          Rate a session and earn +20 XP. Help improve your learning experience.
        </p>
        <form onSubmit={handleSubmitFeedback} className="p-4 sm:p-6" style={{ background: 'var(--bg-surface)', border: '0.5px solid var(--bg-border)', borderRadius: 'var(--radius-lg)' }}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-4">
            <div>
              <label style={{ fontFamily: 'var(--font-body)', fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '6px', display: 'block' }}>Session</label>
              <select value={feedbackSession} onChange={e => setFeedbackSession(e.target.value)} required style={{ width: '100%', padding: '8px 12px', fontFamily: 'Outfit', fontSize: '14px', background: 'var(--bg-elevated)', border: '0.5px solid var(--bg-border)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', outline: 'none', cursor: 'pointer' }}>
                <option value="">Select a session</option>
                {allSessions.filter(s => s.status === 'closed').slice(0, 20).map(s => (
                  <option key={s.id} value={s.id}>{s.courseName || s.courseCode} — {s.date}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontFamily: 'var(--font-body)', fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '6px', display: 'block' }}>Rating</label>
              <div className="flex items-center gap-1" style={{ padding: '4px 0' }}>
                {[1, 2, 3, 4, 5].map(n => (
                  <button key={n} type="button" onClick={() => setFeedbackRating(n)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}>
                    <Star className="w-6 h-6" style={{ fill: n <= feedbackRating ? 'var(--kabu-maroon)' : 'none', color: n <= feedbackRating ? 'var(--kabu-maroon)' : 'var(--text-tertiary)' }} />
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-end">
              <button type="submit" disabled={submittingFeedback || !feedbackSession || !feedbackRating} className="btn-primary w-full flex items-center justify-center gap-2" style={{ fontFamily: 'Outfit', fontSize: '14px', fontWeight: 500, padding: '10px 20px' }}>
                {submittingFeedback ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {submittingFeedback ? 'Submitting...' : 'Submit (+20 XP)'}
              </button>
            </div>
          </div>
          <textarea value={feedbackComment} onChange={e => setFeedbackComment(e.target.value)} placeholder="Any additional comments? (optional)" maxLength={500} rows={2} style={{ width: '100%', padding: '10px 14px', fontFamily: 'Outfit', fontSize: '14px', background: 'var(--bg-elevated)', border: '0.5px solid var(--bg-border)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
        </form>
      </section>

      {/* Footer */}
      <div style={{ marginTop: '32px', paddingTop: '16px', borderTop: '0.5px solid var(--bg-border)', textAlign: 'center' }}>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--text-tertiary)' }}>
          KSAS is built exclusively for Kabarak University · kabarak.ac.ke
        </p>
      </div>
    </div>
  );
}
