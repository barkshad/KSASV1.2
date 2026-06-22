import React, { useMemo } from 'react';
import { Code, Play, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useFirestoreRealtimeCollection } from '../../hooks/useFirestoreRealtime';
import { collections } from '../../lib/db';

export default function CourseManagement() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: courses, loading: loadingCourses } = useFirestoreRealtimeCollection(collections.COURSES);
  const { data: enrollments, loading: loadingEnrollments } = useFirestoreRealtimeCollection(collections.ENROLLMENTS);
  const { data: allSessions, loading: loadingSessions } = useFirestoreRealtimeCollection(collections.SESSIONS);

  const myCourses = useMemo(() => {
    return (courses || []).filter(c => c.lecturer === user?.uid);
  }, [courses, user]);

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  const courseStats = useMemo(() => {
    return myCourses.map(c => {
      const courseEnrollments = (enrollments || []).filter(e => e.courseCode === c.code);
      const courseSessions = (allSessions || []).filter(s => s.courseCode === c.code);
      const todaySessions = courseSessions.filter(s => s.date === todayStr);

      const enrolledCount = courseEnrollments.length;

      let totalPresent = 0;
      let totalEnrolled = 0;

      for (const session of courseSessions) {
        const sessionEnrolled = session.enrolledCount || enrolledCount;
        const sessionPresent = session.attendanceCount || 0;
        totalEnrolled += sessionEnrolled;
        totalPresent += sessionPresent;
      }

      const compliance = totalEnrolled > 0 ? Math.round((totalPresent / totalEnrolled) * 100) : 0;

      const nextSession = todaySessions.find(s => s.status === 'open' || s.status === 'scheduled') || todaySessions[0];

      return {
        ...c,
        enrolledCount,
        sessionCount: courseSessions.length,
        compliance,
        nextSession: nextSession || null,
        todaySessions: todaySessions.length,
      };
    });
  }, [myCourses, enrollments, allSessions, todayStr]);

  const totalStudents = useMemo(() => {
    return (enrollments || []).filter(e => (myCourses || []).some(c => c.code === e.courseCode)).length;
  }, [enrollments, myCourses]);

  const totalSessionsToday = useMemo(() => {
    return (allSessions || []).filter(s => s.date === todayStr && (myCourses || []).some(c => c.code === s.courseCode)).length;
  }, [allSessions, todayStr, myCourses]);

  if (loadingCourses || loadingEnrollments || loadingSessions) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--kabu-maroon)' }} />
      </div>
    );
  }

  return (
    <div className="animate-page-in" style={{ maxWidth: '1280px', margin: '0 auto', padding: '32px 48px' }}>
      <div className="mb-8">
        <h1 style={{ fontFamily: 'var(--font-editorial)', fontSize: '28px', color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
          Course Management
        </h1>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 300, fontStyle: 'italic' }}>
          Manage your assigned courses and track student engagement.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {courseStats.length === 0 ? (
          <div
            className="lg:col-span-12"
            style={{
              padding: '24px',
              background: 'var(--bg-surface)',
              borderRadius: 'var(--radius-lg)',
              border: '0.5px solid var(--bg-border)',
              textAlign: 'center',
              color: 'var(--text-tertiary)',
            }}
          >
            No courses assigned yet. Contact administration to get course access.
          </div>
        ) : (
          <>
            {/* Primary Course Card */}
            {courseStats.slice(0, 1).map((course) => (
              <div key={course.code} className="lg:col-span-8">
                <div
                  style={{
                    padding: '24px',
                    background: 'var(--bg-surface)',
                    borderRadius: 'var(--radius-lg)',
                    border: '0.5px solid var(--bg-border)',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.4), 0 0 0 0.5px var(--bg-border)',
                    display: 'flex',
                    flexDirection: 'column',
                    height: '100%',
                    justifyContent: 'space-between',
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  {course.nextSession && (
                    <div style={{ position: 'absolute', top: '16px', right: '16px' }}>
                      <span className="badge badge-info">Next: {course.nextSession.startTime || 'Today'}</span>
                    </div>
                  )}

                  <div>
                    <div className="flex items-center gap-3 mb-4">
                      <div
                        style={{
                          width: '48px',
                          height: '48px',
                          borderRadius: 'var(--radius-lg)',
                          background: 'var(--kabu-maroon)',
                          color: 'var(--text-inverse)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Code className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 style={{ fontFamily: 'var(--font-editorial)', fontSize: '20px', color: 'var(--text-primary)' }}>
                          {course.code}
                        </h3>
                        <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--text-secondary)' }}>
                          {course.name}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 my-4">
                      <div>
                        <p className="form-label">Enrollment</p>
                        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '24px', fontWeight: 500, color: 'var(--text-primary)' }}>
                          {course.enrolledCount} <span style={{ fontFamily: 'var(--font-body)', fontSize: '12px', fontWeight: 400, color: 'var(--text-secondary)' }}>Students</span>
                        </p>
                      </div>
                      <div>
                        <p className="form-label">Sessions</p>
                        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '24px', fontWeight: 500, color: 'var(--success)' }}>
                          {course.sessionCount}
                        </p>
                      </div>
                      <div>
                        <p className="form-label">Attendance Target</p>
                        <div style={{ width: '100%', height: '8px', background: 'var(--bg-elevated)', borderRadius: '9999px', overflow: 'hidden', marginTop: '6px' }}>
                          <div
                            style={{
                              height: '100%',
                              borderRadius: '9999px',
                              background: course.compliance >= 75 ? 'var(--success)' : course.compliance >= 50 ? 'var(--warning)' : 'var(--danger)',
                              width: `${course.compliance}%`,
                              transition: 'width 500ms ease',
                            }}
                          />
                        </div>
                        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                          {course.compliance}%
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center gap-3 mt-4">
                    <button
                      onClick={() => navigate('/lecturer')}
                      className="btn-primary w-full sm:w-auto"
                      style={{ fontFamily: 'var(--font-body)', fontSize: '14px', fontWeight: 600, padding: '10px 20px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                    >
                      <Play className="w-4 h-4" />
                      Start Session
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {/* Today's Overview */}
            <div className="lg:col-span-4 flex flex-col gap-4">
              <div
                style={{
                  padding: '24px',
                  background: 'var(--kabu-maroon-tint)',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--bg-border)',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <h4 style={{ fontFamily: 'var(--font-editorial)', fontSize: '20px', color: 'var(--kabu-maroon)', marginBottom: '16px' }}>
                  Today's Overview
                </h4>
                <div className="space-y-4">
                  <div className="flex justify-between items-center" style={{ paddingBottom: '8px', borderBottom: '0.5px solid var(--bg-border)' }}>
                    <span style={{ fontFamily: 'var(--font-body)', fontSize: '14px', color: 'var(--text-secondary)' }}>Scheduled Lectures</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '20px', fontWeight: 500, color: 'var(--text-primary)' }}>{totalSessionsToday}</span>
                  </div>
                  <div className="flex justify-between items-center" style={{ paddingBottom: '8px', borderBottom: '0.5px solid var(--bg-border)' }}>
                    <span style={{ fontFamily: 'var(--font-body)', fontSize: '14px', color: 'var(--text-secondary)' }}>Total Students</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '20px', fontWeight: 500, color: 'var(--text-primary)' }}>{totalStudents}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span style={{ fontFamily: 'var(--font-body)', fontSize: '14px', color: 'var(--text-secondary)' }}>Assigned Courses</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '20px', fontWeight: 500, color: 'var(--text-primary)' }}>{courseStats.length}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* All Assigned Courses Grid */}
            <div className="lg:col-span-12 mt-2">
              <h3 style={{ fontFamily: 'var(--font-editorial)', fontSize: '20px', color: 'var(--text-primary)', marginBottom: '16px' }}>
                All Assigned Courses
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {courseStats.map(course => (
                  <div
                    key={course.code}
                    style={{
                      padding: '20px',
                      background: 'var(--bg-surface)',
                      borderRadius: 'var(--radius-lg)',
                      border: '0.5px solid var(--bg-border)',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.4), 0 0 0 0.5px var(--bg-border)',
                      transition: 'box-shadow 150ms ease',
                    }}
                  >
                    <div className="flex items-center gap-3 mb-4">
                      <div
                        style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: 'var(--radius-md)',
                          background: 'var(--bg-elevated)',
                          color: 'var(--kabu-maroon)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Code className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 style={{ fontFamily: 'var(--font-editorial)', fontSize: '16px', color: 'var(--text-primary)' }}>
                          {course.code}
                        </h4>
                        <p style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--text-secondary)' }}>
                          {course.name}
                        </p>
                      </div>
                    </div>
                    <div className="flex justify-between mb-4" style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--text-secondary)' }}>
                      <span>{course.enrolledCount} enrolled</span>
                      <span>{course.sessionCount} sessions</span>
                    </div>
                    <button
                      onClick={() => navigate('/lecturer')}
                      className="btn-ghost w-full"
                      style={{ fontSize: '13px', padding: '8px 16px' }}
                    >
                      Start Session
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
