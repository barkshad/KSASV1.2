# KSAS — Kabarak Smart Attendance System

A secure, real-time university attendance platform built for Kabarak University. QR-based session verification, device-bound authentication, 5-layer anti-fraud protection, live analytics, and risk monitoring — all in a single-page React application backed by Firebase/Firestore.

---

## Features

### Student Portal
- Secure QR-code attendance check-in with TOTP token verification
- Real-time attendance updates via Firestore listeners
- Attendance history and percentage tracking per course
- Course enrollment visibility
- Academic calendar access
- Profile and password management
- Comparative analytics (vs university average)
- Attendance trend charts

### Lecturer Portal
- Start and end attendance sessions with one click
- Live QR code display with 5-second TOTP refresh (anti-screenshot protection)
- Real-time student check-in feed during sessions
- Attendance analytics dashboard (weekly trends, course breakdown, effectiveness score)
- Risk monitor — identifies at-risk students below 75% threshold with trend analysis
- Dedicated reports page with course/date filtering and CSV export
- Student notification queueing (absentee alerts)
- Anti-fraud security config per session (GPS proximity, IP range validation)
- Course management with enrollment and compliance tracking
- Session archiving to Cloudinary

### Administrator Portal
- System-wide user management (create, edit, suspend, delete users)
- Course administration and lecturer assignment
- Academic structure configuration (departments, programs, years)
- Session archive browser with Cloudinary-backed records
- Organization-wide analytics and reporting
- Attendance monitoring across all sessions
- CSV export for institutional records

---

## Security — 5-Layer Anti-Fraud System

KSAS implements a multi-layered verification pipeline for every student check-in:

| Layer | Mechanism | Purpose |
|-------|-----------|---------|
| 1 | **Device Fingerprint Binding** | Locks each student's check-in to a unique device hash; prevents proxy attendance |
| 2 | **One-Time QR Token Consumption** | Each TOTP token is consumed on use; prevents QR screenshot sharing |
| 3 | **GPS Proximity Verification** | Optional check against campus coordinates (configurable radius in meters) |
| 4 | **IP Range Validation** | Optional verification that the student's IP falls within campus network ranges |
| 5 | **Session-Specific Device Lock** | Prevents a single device from registering attendance for multiple students |

Additional protections:
- **Dynamic QR codes** refresh every 5 seconds with new TOTP tokens
- **Anti-screenshot measures**: keyboard shortcut interception (Ctrl+Shift+S, PrintScreen, F12), CSS drag/selection blocking, QR watermark overlay
- **Role-based access control**: Student, Lecturer, Administrator
- **SHA-256 password hashing** via CryptoJS

---

## Tech Stack

### Frontend
- **React 19** + TypeScript
- **Vite 6** (build tool)
- **Tailwind CSS v4** with CSS custom properties (Soft Enterprise Dashboard theme)
- **React Router DOM v7** (client-side routing)
- **Recharts v3** (analytics charts)
- **Lucide React** (icons)
- **Motion** (Framer Motion successor — animations)
- **react-hot-toast** (notifications)
- **qrcode.react** + `@yudiel/react-qr-scanner` (QR generation/scanning)
- **otpauth** (TOTP token generation, 5-second period)
- **PapaParse** (CSV export)
- **date-fns** (date utilities)

### Backend / Database
- **Firebase / Firestore** — real-time NoSQL database with `onSnapshot` listeners
- **Cloudinary** — JSON archival for ended session records
- Custom Firebase initialization with environment variable fallbacks

### Authentication
- Custom localStorage-based auth (not Firebase Auth SDK)
- SHA-256 hashed passwords via CryptoJS
- Role-based session management

---

## Project Structure

```
KSASV1.0-main/
├── src/
│   ├── App.tsx                    # Root router (all role routes)
│   ├── main.tsx                   # React entry point
│   ├── index.css                  # Global CSS theme (700+ lines)
│   ├── components/
│   │   ├── ErrorBoundary.tsx      # React class-based error boundary
│   │   └── layout/
│   │       ├── AppLayout.tsx      # Shell layout (sidebar + topbar + mobile nav)
│   │       ├── DesktopSidebar.tsx # Desktop navigation
│   │       ├── MobileNav.tsx      # Mobile bottom tab bar
│   │       └── TopAppBar.tsx      # Top bar with notifications + profile
│   ├── hooks/
│   │   ├── useAuth.ts             # Auth hook (localStorage)
│   │   ├── useCloudinaryCache.ts  # Cloudinary caching
│   │   └── useFirestoreRealtime.ts # Realtime Firestore collection hook
│   ├── lib/
│   │   ├── analytics.ts           # Analytics utilities
│   │   ├── auth.ts                # Password hashing (SHA-256)
│   │   ├── cloudinary.ts          # Cloudinary upload/fetch
│   │   ├── collections.ts         # Firestore collection constants
│   │   ├── csvExport.ts           # CSV export utilities
│   │   ├── db.ts                  # Core DB operations (checkIn, archive, close)
│   │   ├── firebase.ts            # Firebase initialization
│   │   ├── gamification.ts        # Gamification features
│   │   ├── security.ts            # 5-layer anti-fraud validation
│   │   ├── seed-admin.ts          # Admin account seeder
│   │   ├── totp.ts                # TOTP generation/validation (5s period)
│   │   └── utils.ts               # General utilities
│   └── pages/
│       ├── RoleSelection.tsx      # Landing page + role-based login
│       ├── NotFound.tsx           # 404 page
│       ├── ServerError.tsx        # 500 page
│       ├── admin/                 # 7 admin pages
│       ├── lecturer/              # 5 lecturer pages (Dashboard, CourseManagement,
│       │                          #   LiveSession, RiskMonitor, Reports)
│       └── student/               # 6 student pages
├── firestore.rules               # Firestore security rules
├── index.html                    # HTML entry point
├── package.json                  # Dependencies & scripts
├── tsconfig.json                 # TypeScript config
└── vite.config.ts                # Vite build config
```

---

## Getting Started

### Prerequisites
- Node.js 18+ (recommended: 20+)
- npm or yarn
- Firebase project with Firestore enabled
- Cloudinary account (for session archival)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd KSASV1.0-main

# Install dependencies
npm install

# Configure environment variables
cp .env.example .env
# Edit .env with your Firebase and Cloudinary credentials

# Start development server
npm run dev
```

The app runs at `http://localhost:3000`.

### Environment Variables

```env
# Firebase
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id

# Cloudinary
VITE_CLOUDINARY_CLOUD_NAME=your_cloud_name
VITE_CLOUDINARY_UPLOAD_PRESET=your_upload_preset
```

### Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server on port 3000 |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Preview production build |
| `npm run lint` | TypeScript type-check (no emit) |
| `npm run clean` | Remove dist and server.js |

---

## User Workflow

### Student
1. Select "Student" role on the landing page and log in
2. View today's scheduled sessions on the dashboard
3. Navigate to Check-In and scan the session QR code
4. Device fingerprint, GPS, and IP are validated against session rules
5. Attendance is recorded in real-time; view history and analytics

### Lecturer
1. Select "Lecturer" role and log in
2. Start a new session from the dashboard (select course, room, topic, security settings)
3. Display the live QR code — it refreshes every 5 seconds with a new TOTP token
4. Monitor real-time check-ins in the live session view
5. End the session — attendance is archived and CSV is available for download
6. Review analytics, risk monitor, and reports throughout the semester

### Administrator
1. Log in as admin
2. Manage users (students, lecturers) — create, edit, suspend, delete
3. Configure courses and assign lecturers
4. Browse session archives backed up to Cloudinary
5. View organization-wide analytics and export reports

---

## Key Modules

### Attendance Engine
Session-based check-in pipeline: lecturer creates session → QR code generated with TOTP → student scans QR → 5-layer security validation → attendance logged to Firestore subcollection → real-time sync to all connected clients.

### Live QR System
QR codes embed a TOTP token (5-second validity window). The token changes on every refresh, making screenshot sharing ineffective. A visual countdown timer and flash animation signal each refresh cycle.

### Analytics Dashboard
Real-time charts powered by Recharts: weekly attendance trends, course-by-course breakdown, effectiveness scoring (weighted: 60% attendance, 30% feedback, 10% consistency), university average comparison.

### Risk Monitoring
Automated identification of students below the 75% attendance threshold. Categorizes into high risk (<50%) and medium risk (50-75%). Trend analysis compares early-semester vs late-semester performance.

### Reporting System
Filterable attendance records with course and date range filters. Export to CSV with student details, timestamps, room, and device fingerprints.

---

## License

This project is intended for educational and institutional use.

KSAS — Kabarak Smart Attendance System
