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
    <div className="p-margin-mobile md:p-gutter max-w-7xl mx-auto w-full space-y-lg animate-in fade-in duration-500">
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-md">
        <div className="min-w-[160px] bg-surface-container-lowest border border-outline-variant/20 p-md rounded-2xl">
          <span className="font-label-md text-on-surface-variant">Total Students</span>
          <p className="font-headline-md font-bold text-primary mt-1">{totalStudents}</p>
        </div>
        <div className="min-w-[160px] bg-surface-container-lowest border border-outline-variant/20 p-md rounded-2xl">
          <span className="font-label-md text-on-surface-variant">Total Lecturers</span>
          <p className="font-headline-md font-bold text-primary mt-1">{totalLecturers}</p>
        </div>
        <div className="min-w-[160px] bg-surface-container-lowest border border-outline-variant/20 p-md rounded-2xl">
          <span className="font-label-md text-on-surface-variant">Active Courses</span>
          <p className="font-headline-md font-bold text-primary mt-1">{courses.length}</p>
        </div>
        <div className="min-w-[160px] bg-surface-container-lowest border border-outline-variant/20 p-md rounded-2xl">
          <span className="font-label-md text-on-surface-variant">Live Sessions</span>
          <p className="font-headline-md font-bold text-primary mt-1">{activeSessions}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-lg">
        
        <div className="lg:col-span-2 bg-surface-container-lowest border border-outline-variant/20 rounded-2xl p-lg">
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-lg gap-4">
            <div>
              <h3 className="font-title-lg font-bold text-on-surface">Institutional Overview</h3>
              <p className="font-body-sm text-on-surface-variant">Real-time attendance and system status</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="bg-success/10 text-success px-3 py-1.5 rounded-full flex items-center gap-2">
                <span className="w-2 h-2 bg-success rounded-full animate-pulse"></span>
                <span className="font-label-md">{activeSessions} Live</span>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-md">
            <div className="bg-surface-container rounded-xl p-4 text-center">
              <p className="font-headline-md text-primary leading-none">{users.length}</p>
              <p className="font-label-md text-on-surface-variant mt-1">Users</p>
            </div>
            <div className="bg-surface-container rounded-xl p-4 text-center">
              <p className="font-headline-md text-primary leading-none">{courses.length}</p>
              <p className="font-label-md text-on-surface-variant mt-1">Courses</p>
            </div>
            <div className="bg-surface-container rounded-xl p-4 text-center">
              <p className="font-headline-md text-primary leading-none">{sessions.length}</p>
              <p className="font-label-md text-on-surface-variant mt-1">Sessions</p>
            </div>
            <div className="bg-surface-container rounded-xl p-4 text-center">
              <p className="font-headline-md text-success leading-none">{activeSessions}</p>
              <p className="font-label-md text-on-surface-variant mt-1">Live Now</p>
            </div>
          </div>
        </div>

        <div className="bg-primary text-on-primary rounded-2xl p-lg shadow-lg relative overflow-hidden flex flex-col justify-between">
           <div className="absolute top-0 right-0 w-32 h-32 bg-on-primary/10 rounded-full -mr-16 -mt-16 blur-3xl"></div>
           <div className="relative z-10">
             <div className="flex items-center gap-2 mb-md">
               <Activity className="w-5 h-5" />
               <h3 className="font-label-md tracking-wider">System Summary</h3>
             </div>
             <div className="space-y-3">
               <div className="bg-on-primary/10 border border-on-primary/20 p-3 rounded-xl">
                 <p className="font-body-md font-semibold">Students: {totalStudents}</p>
                 <p className="text-xs opacity-80 mt-1">Enrolled across {courses.length} courses</p>
               </div>
               <div className="bg-on-primary/10 border border-on-primary/20 p-3 rounded-xl">
                 <p className="font-body-md font-semibold">Lecturers: {totalLecturers}</p>
                 <p className="text-xs opacity-80 mt-1">Active instructors in the system</p>
               </div>
             </div>
           </div>
           <button onClick={() => navigate('/admin/users')} className="mt-lg w-full py-2.5 bg-on-primary text-primary rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-on-primary/90 transition-all z-10 relative">Manage Users</button>
        </div>

      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-lg">
        <div className="bg-surface-container-lowest border border-outline-variant/20 rounded-2xl p-lg">
          <div className="flex items-center justify-between mb-md">
            <h3 className="font-title-lg font-bold text-on-surface">Quick Stats</h3>
            <Info className="text-on-surface-variant w-5 h-5" />
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
               <div className="flex items-center gap-2">
                 <div className="w-2 h-2 bg-primary rounded-full"></div>
                 <span className="font-body-sm text-on-surface-variant">Student-to-Lecturer Ratio</span>
               </div>
               <span className="font-body-sm font-bold text-primary">{totalLecturers > 0 ? (totalStudents / totalLecturers).toFixed(1) : '--'}:1</span>
            </div>
            <div className="flex items-center justify-between">
               <div className="flex items-center gap-2">
                 <div className="w-2 h-2 bg-success rounded-full"></div>
                 <span className="font-body-sm text-on-surface-variant">Avg Sessions/Course</span>
               </div>
               <span className="font-body-sm font-bold text-primary">{courses.length > 0 ? (sessions.length / courses.length).toFixed(1) : '--'}</span>
            </div>
          </div>
        </div>

        <div className="bg-surface-container-lowest border border-outline-variant/20 rounded-2xl p-lg">
          <h3 className="font-title-lg font-bold text-on-surface mb-md">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-3">
             <button onClick={() => navigate('/admin/users')} className="flex flex-col items-center justify-center p-4 bg-primary-container/20 rounded-xl hover:bg-primary-container/30 transition-colors border border-primary/10">
               <UserPlus className="w-6 h-6 text-primary mb-2" />
               <span className="font-label-md text-primary text-center">Create User</span>
             </button>
              <button onClick={() => navigate('/admin/courses')} className="flex flex-col items-center justify-center p-4 bg-secondary-container/20 rounded-xl hover:bg-secondary-container/30 transition-colors border border-secondary/10">
                <Shield className="w-6 h-6 text-on-secondary-container mb-2" />
                <span className="font-label-md text-on-secondary-container text-center">Enroll Student</span>
              </button>
          </div>
        </div>

      </div>

    </div>
  );
}
