import React, { useMemo } from 'react';
import { Shield, Users, UserPlus, Activity, Info } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useFirestoreRealtimeCollection } from '../../hooks/useFirestoreRealtime';
import { collections } from '../../lib/db';

export default function AdminDashboard() {
  const navigate = useNavigate();
  
  const { data: users } = useFirestoreRealtimeCollection(collections.USERS);
  const { data: courses } = useFirestoreRealtimeCollection(collections.COURSES);
  const { data: sessions } = useFirestoreRealtimeCollection(collections.SESSIONS);

  const totalStudents = useMemo(() => users.filter(u => u.role === 'student').length, [users]);
  const totalLecturers = useMemo(() => users.filter(u => u.role === 'lecturer').length, [users]);
  
  const activeSessions = useMemo(() => sessions.filter(s => s.status === 'open').length, [sessions]);

  return (
    <div className="animate-page-in" style={{ padding: '40px 48px', maxWidth: '1280px', margin: '0 auto', width: '100%' }}>
      
      {/* Page Header */}
      <div className="mb-8">
        <h1 style={{ fontFamily: 'var(--font-editorial)', fontSize: '28px', color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
          Good morning, Administrator
        </h1>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 300 }}>
          System overview and quick actions
        </p>
      </div>

      {/* Stat Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total Students', value: totalStudents, color: 'var(--kabu-gold)' },
          { label: 'Total Lecturers', value: totalLecturers, color: 'var(--kabu-gold)' },
          { label: 'Active Courses', value: courses.length, color: 'var(--kabu-gold)' },
          { label: 'Live Sessions', value: activeSessions, color: activeSessions > 0 ? 'var(--success)' : 'var(--kabu-gold)' },
        ].map((stat) => (
          <div
            key={stat.label}
            className="p-6"
            style={{
              background: 'var(--bg-surface)',
              border: '0.5px solid var(--bg-border)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: '0 1px 3px rgba(0,0,0,0.4), 0 0 0 0.5px var(--bg-border)',
            }}
          >
            <span style={{ fontFamily: 'var(--font-body)', fontSize: '11px', fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>
              {stat.label}
            </span>
            <p className="mt-2" style={{ fontFamily: 'var(--font-mono)', fontSize: '32px', fontWeight: 500, color: stat.color }}>
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        
        {/* Overview Card */}
        <div
          className="lg:col-span-2 p-6"
          style={{
            background: 'var(--bg-surface)',
            border: '0.5px solid var(--bg-border)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: '0 1px 3px rgba(0,0,0,0.4), 0 0 0 0.5px var(--bg-border)',
          }}
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
            <div>
              <h3 style={{ fontFamily: 'var(--font-editorial)', fontSize: '20px', color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
                Institutional Overview
              </h3>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 300 }}>
                Real-time attendance and system status
              </p>
            </div>
            {activeSessions > 0 && (
              <div className="badge badge-success">
                <span className="animate-pulse-dot" style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--success)' }} />
                {activeSessions} Live
              </div>
            )}
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Users', value: users.length },
              { label: 'Courses', value: courses.length },
              { label: 'Sessions', value: sessions.length },
              { label: 'Live Now', value: activeSessions, color: 'var(--success)' },
            ].map((item) => (
              <div
                key={item.label}
                className="p-4 text-center"
                style={{
                  background: 'var(--bg-elevated)',
                  borderRadius: 'var(--radius-md)',
                }}
              >
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: '24px', fontWeight: 500, color: item.color || 'var(--kabu-gold)' }}>
                  {item.value}
                </p>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                  {item.label}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* System Summary Card */}
        <div
          className="p-6 flex flex-col justify-between"
          style={{
            background: 'var(--kabu-maroon)',
            border: '0.5px solid var(--kabu-maroon)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: '0 1px 3px rgba(0,0,0,0.4), 0 0 0 0.5px var(--kabu-maroon)',
          }}
        >
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-4">
              <Activity className="w-5 h-5" style={{ color: '#F4A0A8' }} />
              <h3 style={{ fontFamily: 'var(--font-body)', fontSize: '11px', fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#F4A0A8' }}>
                System Summary
              </h3>
            </div>
            <div className="space-y-3">
              <div
                className="p-3"
                style={{
                  background: 'rgba(244,160,168,0.1)',
                  border: '0.5px solid rgba(244,160,168,0.2)',
                  borderRadius: 'var(--radius-md)',
                }}
              >
                <p className="font-medium" style={{ fontFamily: 'var(--font-body)', fontSize: '14px', color: '#F4A0A8' }}>
                  Students: {totalStudents}
                </p>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'rgba(244,160,168,0.7)', marginTop: '4px' }}>
                  Enrolled across {courses.length} courses
                </p>
              </div>
              <div
                className="p-3"
                style={{
                  background: 'rgba(244,160,168,0.1)',
                  border: '0.5px solid rgba(244,160,168,0.2)',
                  borderRadius: 'var(--radius-md)',
                }}
              >
                <p className="font-medium" style={{ fontFamily: 'var(--font-body)', fontSize: '14px', color: '#F4A0A8' }}>
                  Lecturers: {totalLecturers}
                </p>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'rgba(244,160,168,0.7)', marginTop: '4px' }}>
                  Active instructors in the system
                </p>
              </div>
            </div>
          </div>
          <button
            onClick={() => navigate('/admin/users')}
            className="mt-6 w-full py-2.5 font-bold text-xs uppercase tracking-wider transition-all z-10 relative"
            style={{
              background: 'var(--text-inverse)',
              color: 'var(--kabu-maroon)',
              borderRadius: 'var(--radius-md)',
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'var(--font-body)',
            }}
          >
            Manage Users
          </button>
        </div>
      </div>

      {/* Quick Stats & Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div
          className="p-6"
          style={{
            background: 'var(--bg-surface)',
            border: '0.5px solid var(--bg-border)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: '0 1px 3px rgba(0,0,0,0.4), 0 0 0 0.5px var(--bg-border)',
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 style={{ fontFamily: 'var(--font-editorial)', fontSize: '20px', color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>Quick Stats</h3>
            <Info style={{ color: 'var(--text-tertiary)', width: '20px', height: '20px' }} />
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--kabu-gold)' }} />
                <span style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--text-secondary)' }}>Student-to-Lecturer Ratio</span>
              </div>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: 500, color: 'var(--kabu-gold)' }}>
                {totalLecturers > 0 ? (totalStudents / totalLecturers).toFixed(1) : '--'}:1
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--success)' }} />
                <span style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--text-secondary)' }}>Avg Sessions/Course</span>
              </div>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: 500, color: 'var(--kabu-gold)' }}>
                {courses.length > 0 ? (sessions.length / courses.length).toFixed(1) : '--'}
              </span>
            </div>
          </div>
        </div>

        <div
          className="p-6"
          style={{
            background: 'var(--bg-surface)',
            border: '0.5px solid var(--bg-border)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: '0 1px 3px rgba(0,0,0,0.4), 0 0 0 0.5px var(--bg-border)',
          }}
        >
          <h3 style={{ fontFamily: 'var(--font-editorial)', fontSize: '20px', color: 'var(--text-primary)', letterSpacing: '-0.01em', marginBottom: '16px' }}>
            Quick Actions
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => navigate('/admin/users')}
              className="flex flex-col items-center justify-center p-4 transition-colors"
              style={{
                background: 'var(--gold-subtle)',
                border: '0.5px solid var(--gold-muted)',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
              }}
            >
              <UserPlus className="w-6 h-6 mb-2" style={{ color: 'var(--kabu-gold)' }} />
              <span style={{ fontFamily: 'var(--font-body)', fontSize: '11px', fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--kabu-gold)', textAlign: 'center' }}>
                Create User
              </span>
            </button>
            <button
              onClick={() => navigate('/admin/courses')}
              className="flex flex-col items-center justify-center p-4 transition-colors"
              style={{
                background: 'var(--bg-elevated)',
                border: '0.5px solid var(--bg-border)',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
              }}
            >
              <Shield className="w-6 h-6 mb-2" style={{ color: 'var(--text-secondary)' }} />
              <span style={{ fontFamily: 'var(--font-body)', fontSize: '11px', fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-secondary)', textAlign: 'center' }}>
                Enroll Student
              </span>
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}
