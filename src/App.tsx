import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';

import RoleSelection from './pages/RoleSelection';

import { AppLayout } from './components/layout/AppLayout';

import StudentDashboard from './pages/student/Dashboard';
import StudentCourses from './pages/student/Courses';
import StudentCourseDetails from './pages/student/CourseDetails';
import StudentAnalytics from './pages/student/Analytics';
import StudentProfile from './pages/student/Profile';
import StudentCheckIn from './pages/student/CheckIn';

import LecturerDashboard from './pages/lecturer/Dashboard';
import LecturerCourseManagement from './pages/lecturer/CourseManagement';
import LecturerLiveSession from './pages/lecturer/LiveSession';
import LecturerRiskMonitor from './pages/lecturer/RiskMonitor';

import AdminDashboard from './pages/admin/Dashboard';
import AdminUserManagement from './pages/admin/UserManagement';
import AdminCourseManagement from './pages/admin/CourseManagement';
import AdminSessionArchive from './pages/admin/SessionArchive';
import AdminAnalytics from './pages/admin/Analytics';
import AdminReports from './pages/admin/reports';
import NotFound from './pages/NotFound';
import ServerError from './pages/ServerError';

function App() {
  return (
    <ErrorBoundary>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<RoleSelection />} />
        
        {/* Student Routes */}
        <Route path="/student" element={<AppLayout role="student" />}>
          <Route index element={<StudentDashboard />} />
          <Route path="courses" element={<StudentCourses />} />
          <Route path="course-details" element={<StudentCourseDetails />} />
          <Route path="analytics" element={<StudentAnalytics />} />
          <Route path="profile" element={<StudentProfile />} />
          <Route path="checkin" element={<StudentCheckIn />} />
          <Route path="calendar" element={<StudentDashboard />} /> {/* Fallback */}
        </Route>

        {/* Lecturer Routes */}
        <Route path="/lecturer" element={<AppLayout role="lecturer" />}>
          <Route index element={<LecturerDashboard />} />
          <Route path="courses" element={<LecturerCourseManagement />} />
          <Route path="live" element={<LecturerLiveSession />} />
          <Route path="risk" element={<LecturerRiskMonitor />} />
          <Route path="profile" element={<StudentProfile />} />
          <Route path="reports" element={<LecturerDashboard />} /> {/* Fallback */}
          <Route path="calendar" element={<LecturerDashboard />} /> {/* Fallback */}
        </Route>

        {/* Admin Routes */}
        <Route path="/admin" element={<AppLayout role="admin" />}>
          <Route index element={<AdminDashboard />} />
          <Route path="users" element={<AdminUserManagement />} />
          <Route path="courses" element={<AdminCourseManagement />} />
          <Route path="archive" element={<AdminSessionArchive />} />
          <Route path="analytics" element={<AdminAnalytics />} />
          <Route path="reports" element={<AdminReports />} />
          <Route path="academics" element={<AdminDashboard />} /> {/* Fallback */}
          <Route path="settings" element={<AdminDashboard />} /> {/* Fallback */}
        </Route>
        
        <Route path="/500" element={<ServerError />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
