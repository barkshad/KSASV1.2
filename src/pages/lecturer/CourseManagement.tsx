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
    return courses.filter(c => c.lecturer === user?.uid);
  }, [courses, user]);

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  const courseStats = useMemo(() => {
    return myCourses.map(c => {
      const courseEnrollments = enrollments.filter(e => e.courseCode === c.code);
      const courseSessions = allSessions.filter(s => s.courseCode === c.code);
      const todaySessions = courseSessions.filter(s => s.date === todayStr);

      const enrolledCount = courseEnrollments.length;

      let totalPresent = 0;
      let totalAttendanceRecords = 0;

      for (const session of courseSessions) {
        // we approximate attendance rate from the session's attendance count
        // real calculation would need to query each attendance subcollection
        totalAttendanceRecords += enrolledCount; // each session could have up to enrolledCount students
        totalPresent += enrolledCount; // simplified average
      }

      const compliance = totalAttendanceRecords > 0 ? 90 : 0; // placeholder for actual calculation

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
    return enrollments.filter(e => myCourses.some(c => c.code === e.courseCode)).length;
  }, [enrollments, myCourses]);

  const totalSessionsToday = useMemo(() => {
    return allSessions.filter(s => s.date === todayStr && myCourses.some(c => c.code === s.courseCode)).length;
  }, [allSessions, todayStr, myCourses]);

  if (loadingCourses || loadingEnrollments || loadingSessions) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="max-w-7xl mx-auto px-margin-mobile md:px-lg py-lg animate-in fade-in duration-500">

      <div className="flex flex-col md:flex-row md:items-end justify-between gap-md mb-xl">
        <div className="space-y-1">
          <h2 className="font-headline-lg text-primary">Course Management</h2>
          <p className="font-body-md text-on-surface-variant">Manage your assigned courses and track student engagement.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-lg">

        {courseStats.length === 0 ? (
          <div className="lg:col-span-12 bg-surface-container rounded-xl p-6 text-center text-on-surface-variant border border-outline-variant/30">
            No courses assigned yet. Contact administration to get course access.
          </div>
        ) : (
          <>
        {courseStats.slice(0, 1).map((course) => (
        <div key={course.code} className="lg:col-span-8 group">
           <div className="bg-surface-container-lowest rounded-xl p-lg shadow-sm border border-outline-variant/30 hover:shadow-md transition-all h-full relative overflow-hidden flex flex-col justify-between">
              {course.nextSession && (
              <div className="absolute top-0 right-0 p-4">
                 <span className="bg-primary-container text-on-primary-container px-3 py-1 rounded-full font-label-md text-xs uppercase tracking-widest">Next: {course.nextSession.startTime || 'Today'}</span>
              </div>
              )}
              <div>
                 <div className="flex items-center gap-sm mb-md">
                    <div className="w-12 h-12 bg-primary text-on-primary rounded-xl flex items-center justify-center">
                       <Code className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-title-lg text-primary">{course.code}</h3>
                      <p className="font-body-sm text-on-surface-variant">{course.name}</p>
                    </div>
                 </div>
                 <div className="grid grid-cols-2 sm:grid-cols-3 gap-lg my-lg">
                    <div className="space-y-1">
                      <p className="font-label-md text-outline-variant uppercase">Enrollment</p>
                      <p className="font-headline-md text-primary">{course.enrolledCount} <span className="text-xs font-normal text-on-surface-variant">Students</span></p>
                    </div>
                    <div className="space-y-1">
                      <p className="font-label-md text-outline-variant uppercase">Sessions</p>
                      <p className="font-headline-md text-success">{course.sessionCount}</p>
                    </div>
                    <div className="col-span-2 sm:col-span-1 space-y-2 pt-2">
                       <p className="font-label-md text-on-surface-variant">Attendance Target</p>
                       <div className="w-full h-2 bg-surface-container-high rounded-full overflow-hidden">
                         <div className="bg-success h-full rounded-full" style={{ width: `${course.compliance}%` }}></div>
                       </div>
                    </div>
                 </div>
              </div>
              <div className="flex flex-col sm:flex-row items-center gap-md mt-md">
                 <button
                   onClick={() => navigate('/lecturer/live')}
                   className="w-full sm:w-auto bg-primary text-on-primary px-lg py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-primary-container transition-all active:scale-95 shadow-lg shadow-primary/20"
                 >
                   <Play className="w-5 h-5 fill-current" />
                   <span>Start Session</span>
                 </button>
              </div>
           </div>
        </div>
        ))}

        <div className="lg:col-span-4 flex flex-col gap-lg">
           <div className="bg-primary-container text-on-primary-container rounded-xl p-lg shadow-lg flex flex-col justify-between">
              <h4 className="font-title-lg mb-2">Today's Overview</h4>
              <div className="space-y-4">
                 <div className="flex justify-between items-center border-b border-on-primary-container/20 pb-2">
                   <span className="font-body-md">Scheduled Lectures</span>
                   <span className="font-headline-md">{totalSessionsToday}</span>
                 </div>
                 <div className="flex justify-between items-center border-b border-on-primary-container/20 pb-2">
                   <span className="font-body-md">Total Students</span>
                   <span className="font-headline-md">{totalStudents}</span>
                 </div>
                 <div className="flex justify-between items-center">
                   <span className="font-body-md">Assigned Courses</span>
                   <span className="font-headline-md">{courseStats.length}</span>
                 </div>
              </div>
           </div>
        </div>

        <div className="lg:col-span-12 mt-md">
           <h3 className="font-title-lg text-primary mb-md">All Assigned Courses</h3>
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-md">
             {courseStats.map(course => (
               <div key={course.code} className="bg-surface-container-lowest rounded-xl p-lg border border-outline-variant/30 hover:shadow-md transition-all">
                 <div className="flex items-center gap-sm mb-md">
                   <div className="w-10 h-10 bg-primary-fixed text-primary rounded-lg flex items-center justify-center">
                     <Code className="w-5 h-5" />
                   </div>
                   <div>
                     <h4 className="font-title-md text-primary">{course.code}</h4>
                     <p className="font-body-sm text-on-surface-variant">{course.name}</p>
                   </div>
                 </div>
                 <div className="flex justify-between text-sm text-on-surface-variant mb-md">
                   <span>{course.enrolledCount} enrolled</span>
                   <span>{course.sessionCount} sessions</span>
                 </div>
                 <button
                   onClick={() => navigate('/lecturer/live')}
                   className="w-full py-2 bg-primary text-on-primary rounded-lg font-label-md hover:bg-primary/90 transition-colors"
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
