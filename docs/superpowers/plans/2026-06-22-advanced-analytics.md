# KSAS Advanced Analytics Implementation Plan

> **For agentic workers:** Use inline execution to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 10 advanced analytics features to KSAS, all operating on real Firestore data (no mock data).

**Architecture:** Create a shared analytics computation module (`src/lib/analytics.ts`) that fetches from Firestore and computes all metrics. Enhance the existing admin Analytics page as the primary analytics hub. Add targeted sections to lecturer and student analytics pages.

**Tech Stack:** React 19, TypeScript, Recharts, Firebase Firestore, date-fns

---

## Data Sources (Firestore Collections)

| Collection | Key Fields | Used By |
|---|---|---|
| `sessions` | courseCode, courseName, lecturerId, lecturerName, date, startTime, endTime, status, enrolledCount | All analytics |
| `sessions/{id}/attendance` | studentId, studentName, timestamp, status, deviceFingerprint | All analytics |
| `users` | uid, name, role, department | Department, lecturer effectiveness |
| `courses` | code, name, department, lecturer | Department analytics |
| `enrollments` | courseCode, studentId, studentName, program | Cohort analytics |
| `feedback` | rating, comment, courseCode, lecturerId, studentId, createdAt | Feedback correlation |
| `audit_logs` | actionType, timestamp, userId | Operational analytics |

---

## File Structure

```
src/
  lib/
    analytics.ts              ← NEW: All analytics computation functions
  pages/
    admin/
      Analytics.tsx           ← REWRITE: Full analytics hub with all 10 features
    lecturer/
      Dashboard.tsx           ← MODIFY: Add lecturer effectiveness self-view
    student/
      Analytics.tsx           ← MODIFY: Add comparative analytics
```

---

### Task 1: Create Analytics Computation Module

**Files:**
- Create: `src/lib/analytics.ts`

**Interfaces:**

```typescript
// Core data types
interface SessionRecord { id, courseCode, courseName, lecturerId, lecturerName, date, startTime, endTime, enrolledCount, status }
interface AttendanceRecord { studentId, studentName, timestamp, status, deviceFingerprint }
interface UserRecord { uid, name, role, department }
interface FeedbackRecord { rating, comment, courseCode, lecturerId, studentId, createdAt }

// Analytics output types
interface LecturerEffectiveness { lecturerId, name, department, sessionCount, avgAttendanceRate, avgFeedbackScore, totalStudents, trend }
interface TimeHeatmapCell { day: number, hour: number, count: number, avgRate: number }
interface PredictiveRisk { studentId, name, courseCode, currentRate, projectedRate, riskLevel, sessionsToThreshold }
interface DepartmentStats { department, totalStudents, totalSessions, avgAttendanceRate, courseCount }
interface FeedbackCorrelation { courseCode, avgAttendance, avgFeedback, sessionCount }
interface GeoCompliance { totalCheckins, gpsCheckins, ipCheckins, gpsComplianceRate, ipComplianceRate }
interface CohortAnalytics { program, yearLevel, avgAttendanceRate, studentCount }
interface OperationalMetrics { totalSessions, avgSessionDuration, peakDay, peakHour, sessionsPerWeek }
interface Anomaly { type, description, severity, studentId?, courseCode?, date? }
interface GoalProgress { target, current, percentage, trend }
```

**Functions to implement:**
1. `fetchAllSessionData()` — fetches all sessions + attendance subcollections from Firestore
2. `computeLecturerEffectiveness(sessions, users, feedback)` — lecturer ranking
3. `computeTimeHeatmap(sessions)` — day/hour heatmap data
4. `computePredictiveRisk(sessions, enrollments)` — forecast at-risk students
5. `computeDepartmentStats(sessions, users, courses)` — department aggregation
6. `computeFeedbackCorrelation(sessions, feedback)` — attendance ↔ feedback
7. `computeGeoCompliance(sessions)` — GPS/IP compliance (from audit_logs if available)
8. `computeCohortAnalytics(sessions, enrollments)` — program-level stats
9. `computeOperationalMetrics(sessions)` — system usage stats
10. `detectAnomalies(sessions, attendanceData)` — outlier detection
11. `computeGoalProgress(sessions, target)` — target tracking

- [ ] **Step 1: Create `src/lib/analytics.ts` with all interfaces and the `fetchAllSessionData` function**

The function should:
- Fetch all docs from `sessions` collection
- For each session, fetch its `attendance` subcollection
- Fetch all docs from `users`, `courses`, `enrollments`, `feedback`
- Return a single object with all data

- [ ] **Step 2: Implement `computeLecturerEffectiveness`**

For each lecturer (user with role=lecturer):
- Count sessions taught
- Average attendance rate across all their sessions
- Average feedback score from feedback collection
- Total unique students taught
- Trend: compare first half vs second half session attendance

- [ ] **Step 3: Implement `computeTimeHeatmap`**

From all sessions with attendance:
- Extract day-of-week (0-6) from session date
- Extract hour from session startTime
- Count sessions per cell
- Average attendance rate per cell

- [ ] **Step 4: Implement `computePredictiveRisk`**

For each student enrolled in courses:
- Get their attendance history (last N sessions)
- Calculate current rate
- Project future rate based on trend (linear regression on last 5+ sessions)
- Flag students likely to fall below 75% within N sessions

- [ ] **Step 5: Implement `computeDepartmentStats`**

Group users by department:
- Match to sessions via lecturer department
- Compute per-department attendance metrics

- [ ] **Step 6: Implement `computeFeedbackCorrelation`**

For each course with both feedback and attendance data:
- Calculate average attendance rate
- Calculate average feedback rating
- Return paired data for scatter plot

- [ ] **Step 7: Implement `computeGeoCompliance`**

From audit_logs or attendance records:
- Count total check-ins
- Count GPS-validated check-ins (if GPS fields exist)
- Count IP-validated check-ins
- Compute compliance rates

- [ ] **Step 8: Implement `computeCohortAnalytics`**

From enrollments + sessions:
- Group by program field
- Calculate per-program attendance metrics

- [ ] **Step 9: Implement `computeOperationalMetrics`**

From sessions collection:
- Total sessions count
- Average session duration (startTime to endTime)
- Most common day of week
- Most common start hour
- Sessions per week trend

- [ ] **Step 10: Implement `detectAnomalies`**

Pattern detection:
- Sessions with 0% or 100% attendance (unusual)
- Students with sudden drops (>30% decrease between consecutive sessions)
- Sessions with unusually high late count
- Same device fingerprint used for multiple students in same session

- [ ] **Step 11: Implement `computeGoalProgress`**

Configurable target (default 85%):
- Overall university attendance rate
- Progress bar data
- Trend direction (improving/declining)

---

### Task 2: Rewrite Admin Analytics Page

**Files:**
- Modify: `src/pages/admin/Analytics.tsx`

Replace existing content with tabbed/sectioned analytics hub:

**Sections to implement (all with real Firestore data):**

1. **Stat Cards Row** — Total Sessions, Avg Rate, At-Risk Count, Total Students
2. **Attendance Trend** (existing, keep) — LineChart last 30 days
3. **Lecturer Effectiveness** — BarChart + ranked table
4. **Time Heatmap** — 7x24 grid visualization
5. **Department Analytics** — Grouped bar chart
6. **Attendance ↔ Feedback Correlation** — Scatter plot
7. **Predictive Risk** — Table with projected rates
8. **Cohort Analytics** — Program-level comparison
9. **Operational Metrics** — Summary cards + weekly trend
10. **Anomaly Detection** — Alert list with severity badges
11. **Goal Tracking** — Gauge/progress visualization
12. **At-Risk Students** (existing, keep) — Table with CSV export

- [ ] **Step 1: Rewrite the Analytics component to fetch real Firestore data instead of Cloudinary**

Replace `fetchJSONFromCloudinary('session-archive.json')` with calls to `fetchAllSessionData()` from analytics.ts. Use `useEffect` to load all data on mount.

- [ ] **Step 2: Add tabbed navigation for analytics sections**

Implement a horizontal tab bar at the top: Overview | Lecturers | Time Patterns | Departments | Correlations | Predictive | Cohort | Operations | Anomalies | Goals

- [ ] **Step 3: Implement Overview tab**

Stat cards (4 cards) + Attendance Trend LineChart + At-Risk Students table. This is the existing functionality but powered by Firestore data.

- [ ] **Step 4: Implement Lecturers tab**

- Horizontal BarChart showing each lecturer's avg attendance rate
- Ranked table: Rank, Lecturer Name, Department, Sessions, Avg Rate, Avg Feedback, Students
- Color-coded rates (green/yellow/red)

- [ ] **Step 5: Implement Time Patterns tab**

- 7-row × 24-column heatmap grid
- Rows = Mon-Sun, Columns = hours (6AM-9PM)
- Cell color intensity = number of sessions (darker = more sessions)
- Cell text = avg attendance rate
- Legend explaining colors

- [ ] **Step 6: Implement Departments tab**

- BarChart comparing departments
- Table: Department, Students, Courses, Sessions, Avg Rate
- Sortable columns

- [ ] **Step 7: Implement Correlations tab**

- Scatter plot: X = attendance rate, Y = feedback rating
- Each dot = one course
- Trend line
- Table below: Course, Attendance Rate, Feedback Score, Sessions

- [ ] **Step 8: Implement Predictive Risk tab**

- Table: Student, Course, Current Rate, Projected Rate (in N sessions), Risk Level
- Color-coded risk levels: High (will drop below 75% in ≤3 sessions), Medium (≤6), Low (>6)
- CSV export of predictive risk data

- [ ] **Step 9: Implement Cohort tab**

- BarChart: Program vs Attendance Rate
- Table: Program, Enrolled Students, Sessions, Avg Rate

- [ ] **Step 10: Implement Operations tab**

- Stat cards: Total Sessions, Avg Duration, Peak Day, Peak Hour
- Sessions-per-week line chart
- Session creation frequency visualization

- [ ] **Step 11: Implement Anomalies tab**

- Alert cards with severity (High/Medium/Low)
- Each anomaly: type icon, description, date, course/student involved
- Anomaly types: 0% session, sudden drop, high late rate, device reuse

- [ ] **Step 12: Implement Goals tab**

- Large circular gauge showing current vs target (default 85%)
- Progress bar with trend arrow
- Historical goal progress line chart

---

### Task 3: Enhance Lecturer Analytics

**Files:**
- Modify: `src/pages/lecturer/Dashboard.tsx`

- [ ] **Step 1: Add self-effectiveness metrics to AnalyticsSection**

In the existing `AnalyticsSection` component, add:
- Average feedback score across all sessions
- Average attendance rate comparison (lecturer vs university average)
- Session effectiveness score (composite of attendance + feedback)

---

### Task 4: Enhance Student Analytics

**Files:**
- Modify: `src/pages/student/Analytics.tsx`

- [ ] **Step 1: Add comparative analytics**

Add sections showing:
- Your attendance vs class average (per course)
- Your rank among peers (if data available)
- Semester trend (are you improving or declining?)

---

### Task 5: Route & Navigation Updates

**Files:**
- Modify: `src/App.tsx` (if new routes needed)
- Modify: `src/components/layout/DesktopSidebar.tsx` (if new nav items needed)

- [ ] **Step 1: Verify all analytics are accessible from existing routes**

No new routes needed — all analytics are embedded in existing pages.

---

## Verification

After each task:
1. Run `npm run build` (or equivalent) to verify TypeScript compilation
2. Check that no mock data is used — all data fetched from Firestore
3. Verify Recharts components render without errors
4. Check responsive layout on mobile breakpoints

## Final Verification

- [ ] Run full build: `npm run build`
- [ ] Verify all 10 analytics features display real data
- [ ] Verify no console errors related to data fetching
- [ ] Verify all charts render correctly
- [ ] Verify CSV exports work for all exportable analytics
