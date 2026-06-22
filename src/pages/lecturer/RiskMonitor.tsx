import React, { useMemo, useState, useEffect } from 'react';
import { AlertTriangle, TrendingDown, Eye, Mail, Loader2 } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useFirestoreRealtimeCollection } from '../../hooks/useFirestoreRealtime';
import { getDocs, query, collection, where, db } from '../../lib/firebase';
import { collections } from '../../lib/db';

export default function RiskMonitor() {
  const { user } = useAuth();
  const { data: allSessions } = useFirestoreRealtimeCollection(collections.SESSIONS);
  const { data: allUsers } = useFirestoreRealtimeCollection(collections.USERS);
  const { data: enrollments } = useFirestoreRealtimeCollection(collections.ENROLLMENTS);

  const [attendanceData, setAttendanceData] = useState<Record<string, { present: number; total: number; early: number; earlyPresent: number; late: number; latePresent: number }>>({});
  const [loading, setLoading] = useState(true);

  const lecturerCourses = useMemo(() => {
    return allSessions
      .filter(s => s.lecturerId === user?.uid)
      .map(s => s.courseCode)
      .filter((v, i, a) => a.indexOf(v) === i);
  }, [allSessions, user]);

  const enrolledStudents = useMemo(() => {
    return enrollments.filter(e => lecturerCourses.includes(e.courseCode));
  }, [enrollments, lecturerCourses]);

  useEffect(() => {
    if (lecturerCourses.length === 0) {
      setLoading(false);
      return;
    }

    const fetchAllAttendance = async () => {
      const map: Record<string, { present: number; total: number; early: number; earlyPresent: number; late: number; latePresent: number }> = {};

      for (const code of lecturerCourses) {
        const courseSessions = allSessions.filter(s => s.courseCode === code).sort((a, b) => (a.date || '').localeCompare(b.date || ''));
        const midIdx = Math.floor(courseSessions.length / 2);

        for (let i = 0; i < courseSessions.length; i++) {
          const session = courseSessions[i];
          const isEarlyHalf = i < midIdx;
          try {
            const attSnap = await getDocs(collection(db, `${collections.SESSIONS}/${session.id}/attendance`));
            attSnap.forEach(d => {
              const data = d.data();
              const sid = data.studentId;
              if (!map[sid]) map[sid] = { present: 0, total: 0, early: 0, earlyPresent: 0, late: 0, latePresent: 0 };
              map[sid].total++;
              const attended = data.status === 'present' || data.status === 'late';
              if (attended) map[sid].present++;
              if (isEarlyHalf) {
                map[sid].early++;
                if (attended) map[sid].earlyPresent++;
              } else {
                map[sid].late++;
                if (attended) map[sid].latePresent++;
              }
            });
          } catch (e) {
            // skip
          }
        }
      }

      setAttendanceData(map);
      setLoading(false);
    };

    fetchAllAttendance();
  }, [lecturerCourses, allSessions]);

  const riskStudents = useMemo(() => {
    const result: any[] = [];
    const seen = new Set<string>();

    for (const enrollment of enrolledStudents) {
      const sid = enrollment.studentId;
      if (seen.has(sid)) continue;
      seen.add(sid);

      const att = (attendanceData[sid] || { present: 0, total: 0 }) as any;
      const pct = att.total > 0 ? Math.round((att.present / att.total) * 100) : 100;
      if (pct < 75) {
        const student = allUsers.find(u => u.uid === sid);
        const earlyRate = att.early > 0 ? Math.round((att.earlyPresent / att.early) * 100) : 0;
        const lateRate = att.late > 0 ? Math.round((att.latePresent / att.late) * 100) : 0;
        const trend = att.early > 0 && att.late > 0 ? lateRate - earlyRate : 0;
        result.push({
          id: sid,
          name: student?.name || 'Unknown',
          reg: sid,
          program: enrollment.program || '',
          attendance: pct,
          trend,
        });
      }
    }

    return result.sort((a, b) => a.attendance - b.attendance);
  }, [enrolledStudents, attendanceData, allUsers]);

  const highRisk = riskStudents.filter(s => s.attendance < 50).length;
  const medRisk = riskStudents.filter(s => s.attendance >= 50 && s.attendance < 75).length;
  const lowRisk = riskStudents.filter(s => s.attendance >= 75).length;

  if (loading) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="p-md md:p-lg max-w-7xl mx-auto w-full animate-in fade-in duration-500">
      
      {/* Summary Alert Widget */}
      <div className="mb-lg relative overflow-hidden bg-error-container rounded-xl p-6 shadow-sm border border-error/10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="text-error w-6 h-6 fill-current" />
            <h2 className="font-title-lg text-on-error-container">Action Required</h2>
          </div>
          <p className="font-body-md text-on-error-container/80">
            <span className="font-bold">{riskStudents.length} Students</span> currently fall below the required attendance threshold. Their academic performance is at critical risk.
          </p>
        </div>
        <button className="relative z-10 px-6 py-2 bg-error text-on-error rounded-full font-label-md flex items-center gap-2 hover:bg-error/90 transition-all active:scale-95">
          Batch Intervene
        </button>
      </div>

      {/* Categorization Chips */}
      <div className="flex flex-wrap gap-4 mb-lg">
        <button className="px-6 py-2 rounded-full border border-error bg-error/5 text-error font-bold flex items-center gap-2">
          High Risk (&lt;50%)
          <span className="bg-error text-on-error text-[10px] px-2 py-0.5 rounded-full">{highRisk}</span>
        </button>
        <button className="px-6 py-2 rounded-full border border-warning bg-warning-bg text-warning font-bold flex items-center gap-2">
          Medium Risk (50-75%)
          <span className="bg-warning text-[10px] px-2 py-0.5 rounded-full" style={{color: 'var(--color-text-inverse)'}}>{medRisk}</span>
        </button>
        <button className="px-6 py-2 rounded-full border border-success bg-success/5 text-success font-bold flex items-center gap-2">
          Low Risk (&gt;75%)
          <span className="bg-success text-on-success text-[10px] px-2 py-0.5 rounded-full">{lowRisk}</span>
        </button>
      </div>

      {/* At-Risk Student List */}
      <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant/30 overflow-hidden">
        {/* Mobile card view */}
        <div className="md:hidden divide-y divide-outline-variant/20">
          {riskStudents.length === 0 ? (
            <div className="px-4 py-12 text-center text-on-surface-variant">
              No at-risk students found. All enrolled students are above the 75% threshold.
            </div>
          ) : (
            riskStudents.map((student) => (
              <div key={student.id} className="p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-surface-variant flex items-center justify-center text-on-surface-variant font-bold">
                    {student.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-title-lg text-on-surface truncate">{student.name}</p>
                    <p className="text-xs text-outline">{student.program}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-on-surface-variant font-body-sm">{student.reg}</span>
                  <div className={`flex items-center gap-1 ${student.trend < 0 ? 'text-error' : student.trend > 0 ? 'text-success' : 'text-on-surface-variant'}`}>
                    {student.trend < 0 ? <TrendingDown className="w-4 h-4" /> : null}
                    <span className="text-xs font-bold">{student.trend > 0 ? '+' : ''}{student.trend}%</span>
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between items-center">
                    <span className={`text-xs font-bold ${student.attendance < 50 ? 'text-error' : 'text-warning'}`}>{student.attendance}%</span>
                   </div>
                   <div className="h-1.5 w-full bg-surface-variant rounded-full overflow-hidden">
                     <div className={`h-full rounded-full ${student.attendance < 50 ? 'bg-error' : 'bg-warning'}`} style={{ width: `${student.attendance}%` }}></div>
                   </div>
                 </div>
                 <div className="flex justify-end gap-2 pt-1">
                   <button className="p-2 text-primary hover:bg-primary/10 rounded-lg transition-colors"><Eye className="w-5 h-5"/></button>
                   <button className="p-2 text-warning hover:bg-warning-bg rounded-lg transition-colors"><Mail className="w-5 h-5"/></button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop table view */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-surface-container-low border-b border-outline-variant/30">
              <tr>
                <th className="px-6 py-4 font-label-md text-outline">STUDENT</th>
                <th className="px-6 py-4 font-label-md text-outline">REG NUMBER</th>
                <th className="px-6 py-4 font-label-md text-outline">ATTENDANCE</th>
                <th className="px-6 py-4 font-label-md text-outline">TREND</th>
                <th className="px-6 py-4 font-label-md text-outline text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/20">
              {riskStudents.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-on-surface-variant">
                    No at-risk students found. All enrolled students are above the 75% threshold.
                  </td>
                </tr>
              ) : (
                riskStudents.map((student) => (
                  <tr key={student.id} className="hover:bg-surface-container/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-surface-variant flex items-center justify-center text-on-surface-variant font-bold">
                          {student.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-title-lg text-on-surface">{student.name}</p>
                          <p className="text-xs text-outline">{student.program}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-on-surface-variant font-body-sm">{student.reg}</td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1 w-32">
                        <span className={`text-xs font-bold ${student.attendance < 50 ? 'text-error' : 'text-warning'}`}>{student.attendance}%</span>
                        <div className="h-1.5 w-full bg-surface-variant rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${student.attendance < 50 ? 'bg-error' : 'bg-warning'}`} style={{ width: `${student.attendance}%` }}></div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className={`flex items-center gap-1 ${student.trend < 0 ? 'text-error' : student.trend > 0 ? 'text-success' : 'text-on-surface-variant'}`}>
                        {student.trend < 0 ? <TrendingDown className="w-4 h-4" /> : null}
                        <span className="text-xs font-bold">{student.trend > 0 ? '+' : ''}{student.trend}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-2">
                        <button className="p-2 text-primary hover:bg-primary/10 rounded-lg transition-colors"><Eye className="w-5 h-5"/></button>
                        <button className="p-2 text-warning hover:bg-warning-bg rounded-lg transition-colors"><Mail className="w-5 h-5"/></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
