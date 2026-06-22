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
          } catch {
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

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--kabu-maroon)' }} />
      </div>
    );
  }

  return (
    <div className="animate-page-in" style={{ maxWidth: '1280px', margin: '0 auto', padding: '32px 48px' }}>

      {/* Summary Alert Widget */}
      <div
        style={{
          padding: '24px',
          background: 'var(--danger-bg)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--danger)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.4), 0 0 0 0.5px var(--bg-border)',
          marginBottom: '24px',
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div>
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-6 h-6" style={{ color: 'var(--danger)' }} />
            <h2 style={{ fontFamily: 'var(--font-editorial)', fontSize: '22px', color: 'var(--text-primary)' }}>Action Required</h2>
          </div>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '14px', color: 'var(--text-secondary)' }}>
            <span style={{ fontWeight: 600 }}>{riskStudents.length} Students</span> currently fall below the required attendance threshold. Their academic performance is at critical risk.
          </p>
        </div>
        <button
          className="btn-danger"
          style={{ padding: '8px 24px', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          Batch Intervene
        </button>
      </div>

      {/* Categorization Chips */}
      <div className="flex flex-wrap gap-3 mb-6">
        <span className="badge badge-danger" style={{ fontSize: '12px', padding: '6px 14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          High Risk (&lt;50%)
          <span style={{ background: 'var(--danger)', color: 'white', fontSize: '10px', padding: '2px 8px', borderRadius: '9999px' }}>{highRisk}</span>
        </span>
        <span className="badge badge-warning" style={{ fontSize: '12px', padding: '6px 14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          Medium Risk (50-75%)
          <span style={{ background: 'var(--warning)', color: 'var(--text-inverse)', fontSize: '10px', padding: '2px 8px', borderRadius: '9999px' }}>{medRisk}</span>
        </span>
      </div>

      {/* At-Risk Student List */}
      <div style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)', border: '0.5px solid var(--bg-border)', boxShadow: '0 1px 3px rgba(0,0,0,0.4), 0 0 0 0.5px var(--bg-border)', overflow: 'hidden' }}>
        {/* Mobile card view */}
        <div className="md:hidden">
          {riskStudents.length === 0 ? (
            <div style={{ padding: '48px 16px', textAlign: 'center', color: 'var(--text-tertiary)' }}>
              No at-risk students found. All enrolled students are above the 75% threshold.
            </div>
          ) : (
            riskStudents.map((student) => (
              <div key={student.id} style={{ padding: '16px', borderBottom: '0.5px solid var(--bg-border)' }}>
                <div className="flex items-center gap-3">
                  <div style={{ width: '40px', height: '40px', borderRadius: 'var(--radius-md)', background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', fontWeight: 700 }}>
                    {(student.name || '?').charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontFamily: 'var(--font-editorial)', fontSize: '16px', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{student.name || 'Unknown'}</p>
                    <p style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--text-tertiary)' }}>{student.program || ''}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between" style={{ marginTop: '12px' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-tertiary)' }}>{student.reg}</span>
                  <div className="flex items-center gap-1" style={{ color: student.trend < 0 ? 'var(--danger)' : student.trend > 0 ? 'var(--success)' : 'var(--text-tertiary)' }}>
                    {student.trend < 0 ? <TrendingDown className="w-4 h-4" /> : null}
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 600 }}>{student.trend > 0 ? '+' : ''}{student.trend}%</span>
                  </div>
                </div>
                <div style={{ marginTop: '8px' }}>
                  <div className="flex justify-between items-center" style={{ marginBottom: '4px' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 600, color: student.attendance < 50 ? 'var(--danger)' : 'var(--warning)' }}>{student.attendance}%</span>
                  </div>
                  <div style={{ height: '6px', width: '100%', background: 'var(--bg-elevated)', borderRadius: '9999px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: '9999px', background: student.attendance < 50 ? 'var(--danger)' : 'var(--warning)', width: `${student.attendance}%` }} />
                  </div>
                </div>
                <div className="flex justify-end gap-2" style={{ marginTop: '8px' }}>
                  <button style={{ padding: '8px', color: 'var(--kabu-maroon)', borderRadius: 'var(--radius-md)', background: 'transparent', border: 'none', cursor: 'pointer', transition: 'background 150ms' }} onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--kabu-maroon-tint)'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}><Eye className="w-5 h-5" /></button>
                  <button style={{ padding: '8px', color: 'var(--warning)', borderRadius: 'var(--radius-md)', background: 'transparent', border: 'none', cursor: 'pointer', transition: 'background 150ms' }} onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--warning-bg)'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}><Mail className="w-5 h-5" /></button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop table view */}
        <div className="hidden md:block" style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--bg-border)' }}>
                <th style={{ padding: '12px 24px', fontFamily: 'var(--font-body)', fontSize: '11px', fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>Student</th>
                <th style={{ padding: '12px 24px', fontFamily: 'var(--font-body)', fontSize: '11px', fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>Reg Number</th>
                <th style={{ padding: '12px 24px', fontFamily: 'var(--font-body)', fontSize: '11px', fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>Attendance</th>
                <th style={{ padding: '12px 24px', fontFamily: 'var(--font-body)', fontSize: '11px', fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>Trend</th>
                <th style={{ padding: '12px 24px', fontFamily: 'var(--font-body)', fontSize: '11px', fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {riskStudents.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-tertiary)' }}>
                    No at-risk students found. All enrolled students are above the 75% threshold.
                  </td>
                </tr>
              ) : (
                riskStudents.map((student) => (
                  <tr
                    key={student.id}
                    style={{ borderBottom: '0.5px solid var(--bg-border)', transition: 'background 150ms' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-elevated)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <td style={{ padding: '12px 24px' }}>
                      <div className="flex items-center gap-3">
                        <div style={{ width: '40px', height: '40px', borderRadius: 'var(--radius-md)', background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', fontWeight: 700 }}>
                          {(student.name || '?').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p style={{ fontFamily: 'var(--font-editorial)', fontSize: '16px', color: 'var(--text-primary)' }}>{student.name || 'Unknown'}</p>
                          <p style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--text-tertiary)' }}>{student.program || ''}</p>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '12px 24px', fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--text-tertiary)' }}>{student.reg}</td>
                    <td style={{ padding: '12px 24px' }}>
                      <div style={{ width: '128px' }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 600, color: student.attendance < 50 ? 'var(--danger)' : 'var(--warning)' }}>{student.attendance}%</span>
                        <div style={{ height: '6px', width: '100%', background: 'var(--bg-elevated)', borderRadius: '9999px', overflow: 'hidden', marginTop: '4px' }}>
                          <div style={{ height: '100%', borderRadius: '9999px', background: student.attendance < 50 ? 'var(--danger)' : 'var(--warning)', width: `${student.attendance}%` }} />
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '12px 24px' }}>
                      <div className="flex items-center gap-1" style={{ color: student.trend < 0 ? 'var(--danger)' : student.trend > 0 ? 'var(--success)' : 'var(--text-tertiary)' }}>
                        {student.trend < 0 ? <TrendingDown className="w-4 h-4" /> : null}
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 600 }}>{student.trend > 0 ? '+' : ''}{student.trend}%</span>
                      </div>
                    </td>
                    <td style={{ padding: '12px 24px' }}>
                      <div className="flex justify-end gap-2">
                        <button style={{ padding: '8px', color: 'var(--kabu-maroon)', borderRadius: 'var(--radius-md)', background: 'transparent', border: 'none', cursor: 'pointer', transition: 'background 150ms' }} onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--kabu-maroon-tint)'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}><Eye className="w-5 h-5" /></button>
                        <button style={{ padding: '8px', color: 'var(--warning)', borderRadius: 'var(--radius-md)', background: 'transparent', border: 'none', cursor: 'pointer', transition: 'background 150ms' }} onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--warning-bg)'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}><Mail className="w-5 h-5" /></button>
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
