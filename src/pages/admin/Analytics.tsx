import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { BarChart3, Loader2, Download, X, TrendingUp, TrendingDown, Users, Calendar } from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { fetchJSONFromCloudinary } from '../../lib/cloudinary';
import { exportSessionCSV } from '../../lib/csvExport';

interface SessionRecord {
  id: string;
  courseName: string;
  courseCode: string;
  lecturerName: string;
  date: string;
  startTime: string;
  endTime: string;
  topicOfDay: string;
  totalStudents: number;
  present: number;
  absent: number;
  attendanceRate: number;
  csvFileName: string;
  csvData: string;
  createdAt: string;
}

interface StudentRisk {
  name: string;
  regNumber: string;
  course: string;
  totalSessions: number;
  attended: number;
  rate: number;
}

export default function Analytics() {
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [riskStudents, setRiskStudents] = useState<StudentRisk[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<StudentRisk | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const data = await fetchJSONFromCloudinary('session-archive.json') as any;
        if (data && Array.isArray(data.sessions)) {
          setSessions(data.sessions);
          computeRiskStudents(data.sessions);
        }
      } catch {
        setSessions([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const computeRiskStudents = (sessionsList: SessionRecord[]) => {
    const studentMap = new Map<string, { name: string; regNumber: string; course: string; total: number; attended: number }>();

    for (const s of sessionsList) {
      if (!s.csvData) continue;
      const lines = s.csvData.split('\n').slice(1).filter(Boolean);
      for (const line of lines) {
        const parts = line.split(',').map(p => p.replace(/^"|"$/g, ''));
        const name = parts[0] || '';
        const reg = parts[1] || '';
        const status = parts[3] || '';
        const key = `${reg}-${s.courseCode}`;
        const existing = studentMap.get(key);
        if (existing) {
          existing.total++;
          if (status === 'PRESENT') existing.attended++;
        } else {
          studentMap.set(key, { name, regNumber: reg, course: `${s.courseName} (${s.courseCode})`, total: 1, attended: status === 'PRESENT' ? 1 : 0 });
        }
      }
    }

    const risk: StudentRisk[] = [];
    studentMap.forEach(v => {
      const rate = v.total > 0 ? Math.round((v.attended / v.total) * 100) : 0;
      if (rate < 75) {
        risk.push({ name: v.name, regNumber: v.regNumber, course: v.course, totalSessions: v.total, attended: v.attended, rate });
      }
    });
    risk.sort((a, b) => a.rate - b.rate);
    setRiskStudents(risk);
  };

  const totalSessions = sessions.length;
  const totalEnrollments = sessions.reduce((s, x) => s + x.totalStudents, 0);
  const avgRate = sessions.length > 0 ? Math.round(sessions.reduce((s, x) => s + x.attendanceRate, 0) / sessions.length) : 0;

  const trendData = useMemo(() => {
    const dateMap = new Map<string, { date: string; rate: number; count: number }>();
    for (const s of sessions) {
      const d = s.date || '';
      if (!d) continue;
      const existing = dateMap.get(d);
      if (existing) {
        existing.rate += s.attendanceRate;
        existing.count++;
      } else {
        dateMap.set(d, { date: d, rate: s.attendanceRate, count: 1 });
      }
    }
    return Array.from(dateMap.values())
      .map(d => ({ ...d, rate: Math.round(d.rate / d.count) }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-30);
  }, [sessions]);

  const courseData = useMemo(() => {
    const map = new Map<string, { present: number; total: number }>();
    for (const s of sessions) {
      const existing = map.get(s.courseCode);
      if (existing) {
        existing.present += s.present;
        existing.total += s.totalStudents;
      } else {
        map.set(s.courseCode, { present: s.present, total: s.totalStudents });
      }
    }
    return Array.from(map.entries())
      .map(([code, v]) => ({ course: code, rate: v.total > 0 ? Math.round((v.present / v.total) * 100) : 0, present: v.present, total: v.total }))
      .sort((a, b) => a.rate - b.rate);
  }, [sessions]);

  const handleStudentDetail = (student: StudentRisk) => {
    const studentSessions = sessions
      .filter(s => {
        if (!s.csvData) return false;
        return s.csvData.split('\n').slice(1).some(line => {
          const reg = line.split(',')[1]?.replace(/^"|"$/g, '') || '';
          return reg === student.regNumber;
        });
      })
      .map(s => ({
        date: s.date,
        courseCode: s.courseCode,
        topicOfDay: s.topicOfDay,
        attendanceRate: s.attendanceRate,
        present: s.csvData.split('\n').slice(1).some(line => {
          const parts = line.split(',').map(p => p.replace(/^"|"$/g, ''));
          return parts[1] === student.regNumber && parts[3] === 'PRESENT';
        }),
      }));
    setSelectedStudent({ ...student });
  };

  const getRateColor = (rate: number) => {
    if (rate >= 75) return 'var(--success)';
    if (rate >= 50) return 'var(--warning)';
    return 'var(--danger)';
  };

  const chartTooltipStyle = {
    background: 'var(--bg-elevated)',
    border: '0.5px solid var(--bg-border)',
    borderRadius: 'var(--radius-md)',
    fontSize: '13px',
    fontFamily: 'Outfit, sans-serif',
  };

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '32px 48px' }}>
      {/* Header */}
      <div className="mb-8">
        <h1 style={{ fontFamily: 'var(--font-editorial)', fontSize: '28px', color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
          Analytics
        </h1>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: '14px', color: 'var(--text-secondary)', fontWeight: 300, marginTop: '4px' }}>
          Institution-wide attendance trends and at-risk student identification.
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {[
          { label: 'Total Sessions', value: totalSessions, icon: Calendar },
          { label: 'Total Enrollments', value: totalEnrollments, icon: Users },
          { label: 'Avg Attendance Rate', value: `${avgRate}%`, icon: BarChart3, color: getRateColor(avgRate) },
        ].map(stat => (
          <div
            key={stat.label}
            style={{
              background: 'var(--bg-surface)',
              border: '0.5px solid var(--bg-border)',
              borderRadius: 'var(--radius-lg)',
              padding: '20px',
            }}
          >
            <div className="flex items-center justify-between">
              <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--text-tertiary)', fontWeight: 400 }}>{stat.label}</p>
              <stat.icon className="w-4 h-4" style={{ color: 'var(--text-tertiary)', opacity: 0.6 }} />
            </div>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '28px', fontWeight: 500, marginTop: '4px', color: stat.color || 'var(--text-primary)' }}>
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--kabu-gold)' }} />
        </div>
      ) : sessions.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-tertiary)' }}>
          <BarChart3 className="w-10 h-10 mx-auto mb-3" style={{ opacity: 0.5 }} />
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '15px', fontWeight: 400 }}>No session data available yet.</p>
        </div>
      ) : (
        <>
          {/* Attendance Trend Line Chart */}
          <div
            className="mb-6"
            style={{
              background: 'var(--bg-surface)',
              border: '0.5px solid var(--bg-border)',
              borderRadius: 'var(--radius-lg)',
              padding: '24px',
            }}
          >
            <h2 style={{ fontFamily: 'var(--font-body)', fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px' }}>
              Attendance Rate Trend
            </h2>
            {trendData.length > 1 ? (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--bg-border)" />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: 'var(--text-tertiary)', fontSize: 11, fontFamily: 'Outfit, sans-serif' }}
                    tickLine={false}
                    axisLine={{ stroke: 'var(--bg-border)' }}
                    tickFormatter={(v) => {
                      const d = new Date(v);
                      return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
                    }}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fill: 'var(--text-tertiary)', fontSize: 11, fontFamily: 'Outfit, sans-serif' }}
                    tickLine={false}
                    axisLine={{ stroke: 'var(--bg-border)' }}
                    tickFormatter={(v) => `${v}%`}
                  />
                  <Tooltip
                    contentStyle={chartTooltipStyle}
                    labelStyle={{ color: 'var(--text-secondary)', fontWeight: 500 }}
                    formatter={(value: number) => [`${value}%`, 'Attendance Rate']}
                  />
                  <Line
                    type="monotone"
                    dataKey="rate"
                    stroke="var(--kabu-gold)"
                    strokeWidth={2}
                    dot={{ fill: 'var(--kabu-gold)', r: 3, strokeWidth: 0 }}
                    activeDot={{ r: 5, fill: 'var(--kabu-gold)', strokeWidth: 0 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--text-tertiary)', textAlign: 'center', padding: '40px 0' }}>
                Not enough data to show a trend line.
              </p>
            )}
          </div>

          {/* Course Attendance Bar Chart */}
          <div
            className="mb-6"
            style={{
              background: 'var(--bg-surface)',
              border: '0.5px solid var(--bg-border)',
              borderRadius: 'var(--radius-lg)',
              padding: '24px',
            }}
          >
            <h2 style={{ fontFamily: 'var(--font-body)', fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px' }}>
              Attendance by Course
            </h2>
            {courseData.length > 0 ? (
              <ResponsiveContainer width="100%" height={Math.max(200, courseData.length * 40)}>
                <BarChart data={courseData} layout="vertical" margin={{ left: 80 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--bg-border)" horizontal={false} />
                  <XAxis
                    type="number"
                    domain={[0, 100]}
                    tick={{ fill: 'var(--text-tertiary)', fontSize: 11, fontFamily: 'Outfit, sans-serif' }}
                    tickLine={false}
                    axisLine={{ stroke: 'var(--bg-border)' }}
                    tickFormatter={(v) => `${v}%`}
                  />
                  <YAxis
                    type="category"
                    dataKey="course"
                    tick={{ fill: 'var(--text-secondary)', fontSize: 12, fontFamily: 'Outfit, sans-serif' }}
                    tickLine={false}
                    axisLine={{ stroke: 'var(--bg-border)' }}
                    width={75}
                  />
                  <Tooltip
                    contentStyle={chartTooltipStyle}
                    formatter={(value: number, _name: string, props: any) => {
                      const d = props.payload;
                      return [`${value}% (${d.present}/${d.total})`, 'Attendance Rate'];
                    }}
                  />
                  <Bar dataKey="rate" radius={[0, 4, 4, 0]}>
                    {courseData.map((entry, index) => (
                      <rect key={index} fill={entry.rate >= 75 ? 'var(--success)' : entry.rate >= 50 ? 'var(--warning)' : 'var(--danger)'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--text-tertiary)', textAlign: 'center', padding: '40px 0' }}>
                No course data available.
              </p>
            )}
          </div>

          {/* At-Risk Students */}
          <div
            style={{
              background: 'var(--bg-surface)',
              border: '0.5px solid var(--bg-border)',
              borderRadius: 'var(--radius-lg)',
              overflow: 'hidden',
            }}
          >
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '0.5px solid var(--bg-border)' }}>
              <div>
                <h2 style={{ fontFamily: 'var(--font-body)', fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  At-Risk Students
                </h2>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--danger)', marginTop: '2px' }}>
                  {riskStudents.length} student{riskStudents.length !== 1 ? 's' : ''} below 75% attendance threshold
                </p>
              </div>
              {riskStudents.length > 0 && (
                <button
                  onClick={() => {
                    const csvRows = [['Student Name', 'Registration Number', 'Course', 'Total Sessions', 'Attended', 'Attendance Rate']];
                    riskStudents.forEach(s => csvRows.push([s.name, s.regNumber, s.course, String(s.totalSessions), String(s.attended), `${s.rate}%`]));
                    const csv = csvRows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
                    const blob = new Blob([csv], { type: 'text/csv' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `KSAS_AtRiskStudents_${new Date().toISOString().split('T')[0]}.csv`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="btn-ghost"
                  style={{ fontSize: '12px', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Download className="w-3.5 h-3.5" />
                  Export CSV
                </button>
              )}
            </div>
            {riskStudents.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-tertiary)' }}>
                <TrendingUp className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--success)', opacity: 0.6 }} />
                <p style={{ fontFamily: 'var(--font-body)', fontSize: '14px' }}>No at-risk students found. All attendance rates are above 75%.</p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '0.5px solid var(--bg-border)' }}>
                      {['Student Name', 'Registration No', 'Course', 'Sessions', 'Attended', 'Rate', ''].map(h => (
                        <th
                          key={h}
                          style={{
                            padding: '10px 16px',
                            textAlign: 'left',
                            fontFamily: 'Outfit, sans-serif',
                            fontSize: '11px',
                            fontWeight: 500,
                            letterSpacing: '0.06em',
                            textTransform: 'uppercase',
                            color: 'var(--text-tertiary)',
                          }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {riskStudents.slice(0, 50).map((s, i) => (
                      <tr
                        key={`${s.regNumber}-${s.course}-${i}`}
                        style={{ borderBottom: '0.5px solid var(--bg-border)', transition: 'background 120ms ease' }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-elevated)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                      >
                        <td style={{ padding: '10px 16px', fontFamily: 'Outfit, sans-serif', fontSize: '14px', color: 'var(--text-primary)', fontWeight: 500 }}>
                          {s.name}
                        </td>
                        <td style={{ padding: '10px 16px', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-secondary)' }}>
                          {s.regNumber}
                        </td>
                        <td style={{ padding: '10px 16px', fontFamily: 'Outfit, sans-serif', fontSize: '13px', color: 'var(--text-secondary)' }}>
                          {s.course}
                        </td>
                        <td style={{ padding: '10px 16px', fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--text-primary)' }}>
                          {s.totalSessions}
                        </td>
                        <td style={{ padding: '10px 16px', fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--text-primary)' }}>
                          {s.attended}
                        </td>
                        <td style={{ padding: '10px 16px', fontFamily: 'var(--font-mono)', fontSize: '14px', color: getRateColor(s.rate), fontWeight: 500 }}>
                          {s.rate}%
                        </td>
                        <td style={{ padding: '10px 16px' }}>
                          <button
                            onClick={() => handleStudentDetail(s)}
                            className="btn-ghost"
                            style={{ fontSize: '12px', padding: '4px 10px', whiteSpace: 'nowrap' }}
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {riskStudents.length > 50 && (
                  <p style={{ textAlign: 'center', padding: '12px', fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--text-tertiary)', borderTop: '0.5px solid var(--bg-border)' }}>
                    Showing 50 of {riskStudents.length} at-risk students.
                  </p>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* Student Detail Modal */}
      {selectedStudent && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-start justify-center p-4 pt-12 md:pt-24 overflow-y-auto"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
          onClick={() => setSelectedStudent(null)}
        >
          <div
            className="w-full max-w-lg"
            style={{
              background: 'var(--bg-elevated)',
              border: '0.5px solid var(--bg-border)',
              borderRadius: 'var(--radius-xl)',
              padding: '32px',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 style={{ fontFamily: 'var(--font-editorial)', fontSize: '22px', color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
                  {selectedStudent.name}
                </h2>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  {selectedStudent.regNumber} · {selectedStudent.course}
                </p>
              </div>
              <button
                onClick={() => setSelectedStudent(null)}
                className="btn-icon"
                style={{ width: '32px', height: '32px' }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-6">
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: '24px', color: 'var(--text-primary)', fontWeight: 500 }}>{selectedStudent.totalSessions}</p>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: '4px' }}>Sessions</p>
              </div>
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: '24px', color: 'var(--success)', fontWeight: 500 }}>{selectedStudent.attended}</p>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: '4px' }}>Attended</p>
              </div>
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: '24px', color: getRateColor(selectedStudent.rate), fontWeight: 500 }}>{selectedStudent.rate}%</p>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: '4px' }}>Rate</p>
              </div>
            </div>

            <p style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--danger)', textAlign: 'center', padding: '8px', borderRadius: 'var(--radius-md)', background: 'var(--danger-bg)', border: '0.5px solid var(--danger)' }}>
              Below 75% attendance threshold — intervention recommended.
            </p>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
