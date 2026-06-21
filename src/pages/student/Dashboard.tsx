import React, { useMemo } from 'react';
import { Book, AlertTriangle, Clock, MapPin, CheckCircle, QrCode, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useFirestoreRealtimeCollection } from '../../hooks/useFirestoreRealtime';
import { getDocs, query, collection, where, db } from '../../lib/firebase';
import { collections } from '../../lib/db';

export default function StudentDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Fetch enrolled courses
  const { data: enrollments, loading: loadingEnrollments } = useFirestoreRealtimeCollection(collections.ENROLLMENTS);
  const { data: allSessions, loading: loadingSessions } = useFirestoreRealtimeCollection(collections.SESSIONS);
  
  const [attendance, setAttendance] = React.useState<any[]>([]);
  const [loadingAttendance, setLoadingAttendance] = React.useState(true);

  React.useEffect(() => {
    if (!user?.uid) return;
    
    // Fetch attendance records across all sessions for this student.
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
    // simplistic next session logic
    return todaySessions.find(s => s.status === 'open' || s.status === 'scheduled') || todaySessions[0];
  }, [todaySessions]);

  const overallAttendance = useMemo(() => {
    if (attendance.length === 0) return 0;
    const present = attendance.filter(a => a.status === 'present' || a.status === 'late').length;
    return Math.round((present / attendance.length) * 100);
  }, [attendance]);

  if (loadingEnrollments || loadingSessions || loadingAttendance) {
      return <div className="flex h-screen items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="max-w-7xl mx-auto px-margin-mobile md:px-gutter py-8 animate-in fade-in duration-500">
      
      {/* Greeting Section */}
      <section className="mb-xl">
        <h1 className="font-headline-lg text-on-background mb-xs">Good morning, {user?.name || 'Student'}</h1>
        <p className="font-body-lg text-on-surface-variant">Ready for your classes today?</p>
      </section>

      {/* Quick Stats Bento */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-md mb-xl">
        
        {/* Overall Attendance */}
        <div className="bg-surface-container-lowest rounded-xl p-lg shadow-sm border border-outline-variant/30 flex items-center justify-between hover:shadow-md transition-shadow">
          <div>
            <h2 className="font-title-lg text-on-surface mb-xs">Overall Attendance</h2>
            <p className="font-body-sm text-on-surface-variant">Active Semester</p>
          </div>
          <div className="relative h-20 w-20 flex items-center justify-center">
            <svg className="transform -rotate-90 w-20 h-20">
              <circle cx="40" cy="40" r="36" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-surface-variant"></circle>
              <circle cx="40" cy="40" r="36" stroke="currentColor" strokeWidth="8" fill="transparent" strokeDasharray="226.2" strokeDashoffset={226.2 - ((overallAttendance/100) * 226.2)} className="text-success" strokeLinecap="round"></circle>
            </svg>
            <span className="absolute font-title-lg font-bold text-on-surface">{overallAttendance}%</span>
          </div>
        </div>

        {/* Classes Today */}
        <div className="bg-surface-container-lowest rounded-xl p-lg shadow-sm border border-outline-variant/30 flex flex-col justify-center hover:shadow-md transition-shadow">
          <div className="flex items-center gap-sm mb-xs">
            <div className="p-2 bg-primary-fixed rounded-lg text-on-primary-fixed">
              <Book className="w-5 h-5" />
            </div>
            <h2 className="font-title-lg text-on-surface">Classes Today</h2>
          </div>
          <div className="flex items-end gap-sm mt-auto">
            <span className="font-display-lg text-primary leading-none">{todaySessions.length}</span>
            <span className="font-body-md text-on-surface-variant mb-1">Scheduled</span>
          </div>
        </div>

        {/* Pending Check-ins */}
        <div className="bg-error-container/30 rounded-xl p-lg shadow-sm border border-error-container flex flex-col justify-center hover:shadow-md transition-shadow">
          <div className="flex items-center gap-sm mb-xs">
            <div className="p-2 bg-error rounded-lg text-on-error">
               <AlertTriangle className="w-5 h-5" />
            </div>
            <h2 className="font-title-lg text-on-surface">Action Required</h2>
          </div>
          <div className="flex items-end gap-sm mt-auto">
            <span className="font-display-lg text-error leading-none">{todaySessions.filter(s => s.status === 'open').length}</span>
            <span className="font-body-md text-error mb-1">Live Sessions</span>
          </div>
        </div>
      </section>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-xl">
        
        {/* Left Column: Upcoming Class */}
        <div className="lg:col-span-8">
          <h3 className="font-title-lg text-on-background mb-md">Upcoming Class</h3>
          {upcomingSession ? (
          <div className="bg-primary rounded-xl p-lg md:p-xl shadow-lg relative overflow-hidden text-on-primary">
            <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(#ffffff 1px, transparent 1px)", backgroundSize: "20px 20px" }}></div>
            <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-lg">
              <div>
                <div className="flex items-center gap-xs mb-sm">
                  <Clock className="w-4 h-4 text-on-primary/70" />
                  <span className="font-label-md tracking-wider text-on-primary/70">{upcomingSession.date} • {upcomingSession.startTime} - {upcomingSession.endTime}</span>
                </div>
                <h4 className="font-headline-md text-on-primary mb-xs">{upcomingSession.courseName}</h4>
                <p className="font-body-lg text-on-primary/70 mb-md">{upcomingSession.courseCode}</p>
                <div className="flex items-center gap-sm">
                  <MapPin className="w-5 h-5 text-on-primary/70" />
                  <span className="font-body-md text-on-primary">{upcomingSession.room}</span>
                </div>
              </div>
              <button 
                onClick={() => navigate('/student/checkin')}
                disabled={upcomingSession.status !== 'open'}
                className="w-full md:w-auto mt-sm md:mt-0 bg-white/20 hover:bg-white/30 text-on-primary font-bold py-3 px-6 rounded-xl shadow-md transition-all flex items-center justify-center gap-sm active:scale-95 group disabled:opacity-50 disabled:cursor-not-allowed backdrop-blur-sm"
              >
                <QrCode className="w-5 h-5 group-hover:scale-110 transition-transform" />
                <span>{upcomingSession.status === 'open' ? 'Check-in Now' : 'Not Open Yet'}</span>
              </button>
            </div>
          </div>
          ) : (
            <div className="bg-surface-container rounded-xl p-lg text-center shadow-sm border border-outline-variant/30 text-on-surface-variant">
              No upcoming classes today. Take a break!
            </div>
          )}
        </div>

        {/* Right Column: Recent Activity */}
        <div className="lg:col-span-4">
          <div className="flex items-center justify-between mb-md">
            <h3 className="font-title-lg text-on-background">Recent Activity</h3>
            <button className="font-label-md text-primary hover:underline">View All</button>
          </div>
          <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant/30 overflow-hidden">
            {attendance.length > 0 ? (
                <ul className="divide-y divide-outline-variant/30">
                  {attendance.slice(0, 5).map(att => (
                  <li key={att.id} className="p-md hover:bg-surface-container-low transition-colors flex items-center justify-between">
                    <div className="flex items-center gap-sm">
                      <div className="h-10 w-10 rounded-full bg-success-container/20 flex items-center justify-center text-success shrink-0">
                        <CheckCircle className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-bold text-on-surface">{att.sessionData?.courseName || att.sessionData?.courseCode}</p>
                        <p className="font-body-sm text-on-surface-variant">{new Date(att.timestamp?.toMillis() || Date.now()).toLocaleString()}</p>
                      </div>
                    </div>
                    <span className={`font-label-md px-2 py-1 rounded-full ${att.status === 'present' ? 'bg-success-container/20 text-success' : 'bg-error-container text-on-error-container'}`}>{att.status || 'Present'}</span>
                  </li>
                  ))}
                </ul>
            ) : (
                <div className="p-lg text-center text-on-surface-variant text-sm">
                    No recent check-ins found.
                </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
