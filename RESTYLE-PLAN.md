# KSAS Restyle Plan — Dark to Light Enterprise Dashboard

## Objective
Transform the KSAS application from its current **dark maroon theme** to the **light "Soft Enterprise Dashboard"** aesthetic shown in the HTML reference file. Preserve ALL business logic, routing, Firebase calls, hooks, state management, and application workflow.

---

## Current State Analysis

| Aspect | Current | Target (HTML Reference) |
|--------|---------|------------------------|
| **Background** | Dark (#1C0509, #2E0A10) | Light off-white (#FAFAFB) |
| **Cards** | Dark surface (#3D0E15) | White (#FFFFFF) with subtle shadows |
| **Primary accent** | Gold (#C9A84C) | Burgundy (#7B1A2B) |
| **Sidebar** | Dark void (#1C0509) | White with light border |
| **Active nav** | Gold text + gold glow | Soft pink bg (#F9E8EA) + maroon text |
| **Text** | Light on dark (#F5F0ED) | Dark on light (#1A0508, #6B4A50) |
| **Borders** | Dark (#6B1A26) | Light gray (#EAD8DB) |
| **Shadows** | Heavy dark shadows | Very soft, subtle shadows |
| **Buttons** | Gold primary | Burgundy primary |
| **Font** | Outfit (keep) | Outfit (compatible) |

---

## Implementation Plan — 7 Phases

### Phase 1: CSS Theme Overhaul (`src/index.css`)
**Goal:** Flip the entire color system from dark to light.

**Changes:**
- Replace all `:root` CSS custom properties with light equivalents
- Replace all `@theme` Tailwind tokens with light equivalents
- Update `.sidebar`, `.sidebar-item`, `.top-bar`, `.mobile-nav` base styles
- Update `.card`, `.card-elevated` to white backgrounds with soft shadows
- Update `.btn-primary` from gold to burgundy
- Update `.btn-ghost` for light theme
- Update `.input-base` for light backgrounds
- Update `.badge-*` variants for light theme
- Update scrollbar styles for light theme
- Update `.form-label`, `.form-hint` for light theme
- Keep all animation keyframes unchanged

**Tokens to change:**
```
--bg-void:       #FFFFFF     (was #1C0509)
--bg-base:       #FAFAFB     (was #2E0A10)
--bg-surface:    #FFFFFF     (was #3D0E15)
--bg-elevated:   #F8F7F5     (was #4E121B)
--bg-border:     #EAD8DB     (was #6B1A26)

--kabu-maroon:   #7B1A2B     (keep same, now used as accent not bg)
--kabu-gold:     #C9A84C     (demote to secondary accent)

--text-primary:  #1A0508     (was #F5F0ED)
--text-secondary:#6B4A50     (was #B0A090)
--text-tertiary: #9A7A82     (was #7A6055)
--text-inverse:  #FFFFFF     (was #1C0509)
--text-on-maroon:#FFFFFF     (keep)

--success:       #2C6B3F     (slightly adjust for light bg)
--warning:       #D4A017     
--danger:        #C0392B     

New additions:
--sidebar-active-bg: #F9E8EA
--sidebar-hover-bg:  #FEF4F5
--pink-border:       #E8A8B2
```

---

### Phase 2: Sidebar (`src/components/layout/DesktopSidebar.tsx`)
**Goal:** White sidebar with burgundy active states.

**Changes:**
- Brand header: white bg, maroon logo icon, dark text
- User card: light bg on hover
- Nav items: dark text, active = pink bg + maroon text + maroon left bar
- Logout: danger color on light bg
- Replace all `style={{ }}` color references to match new tokens
- Keep all props, hooks, functions, navigation structure identical

---

### Phase 3: Top Bar (`src/components/layout/TopAppBar.tsx`)
**Goal:** Clean white top bar.

**Changes:**
- White background with light bottom border
- Dark text for page title area
- Bell icon in dark/muted color
- Avatar: burgundy bg with white initials (instead of gold)
- Dropdown: white bg, light border, soft shadow
- Keep all menu logic, state, event handlers identical

---

### Phase 4: App Layout Shell (`src/components/layout/AppLayout.tsx`)
**Goal:** Light background shell.

**Changes:**
- Body/main bg: #FAFAFB
- Loading spinner: burgundy instead of gold
- Keep auth gating, Toaster, Outlet, all logic identical

---

### Phase 5: Mobile Nav (`src/components/layout/MobileNav.tsx`)
**Goal:** Light mobile bottom nav.

**Changes:**
- White bg with light top border
- Active item: burgundy text/icon
- Highlight CTA: burgundy bg
- Keep all NavLink structure and routing identical

---

### Phase 6: Landing Page (`src/pages/RoleSelection.tsx`)
**Goal:** Match the HTML reference exactly.

**Changes:**
- This page already closely matches the HTML reference
- Minor color adjustments if needed to match exact tokens
- Keep all login logic, Firebase queries, state, handlers identical

---

### Phase 7: Dashboard Pages (All)
**Goal:** Light cards, burgundy accents, soft shadows.

**Files:**
- `src/pages/admin/Dashboard.tsx`
- `src/pages/student/Dashboard.tsx`
- `src/pages/lecturer/Dashboard.tsx`
- `src/pages/admin/UserManagement.tsx`
- `src/pages/admin/CourseManagement.tsx`
- `src/pages/admin/Analytics.tsx`
- `src/pages/admin/SessionArchive.tsx`
- `src/pages/admin/reports.tsx`
- `src/pages/student/Courses.tsx`
- `src/pages/student/CourseDetails.tsx`
- `src/pages/student/Analytics.tsx`
- `src/pages/student/CheckIn.tsx`
- `src/pages/student/Profile.tsx`
- `src/pages/lecturer/CourseManagement.tsx`
- `src/pages/lecturer/LiveSession.tsx`
- `src/pages/lecturer/RiskMonitor.tsx`
- `src/pages/NotFound.tsx`
- `src/pages/ServerError.tsx`

**Changes per page:**
- Replace `var(--bg-surface)` → white/light bg
- Replace `var(--bg-elevated)` → light elevated bg
- Replace `var(--bg-border)` → light border
- Replace `var(--kabu-gold)` accent → `var(--kabu-maroon)` where appropriate
- Update card shadows to soft/light
- Update stat number colors
- Update badge colors for light theme
- Update chart colors if needed
- Keep ALL business logic, hooks, Firebase calls, state, handlers, types identical

---

## Preservation Checklist

Every file modified must preserve:
- ✅ Firebase Authentication
- ✅ Firestore Queries
- ✅ React Query / Realtime hooks
- ✅ Context Providers
- ✅ Routing (react-router-dom)
- ✅ Protected Routes
- ✅ Form Validation
- ✅ Loading States
- ✅ Toasts (react-hot-toast)
- ✅ Dialog Logic (createPortal)
- ✅ API Calls
- ✅ Functions
- ✅ Types / Interfaces
- ✅ Database Schema references
- ✅ Component Props
- ✅ All imports (unless unused)
- ✅ All event handlers
- ✅ All hooks (useState, useEffect, useMemo, useCallback)
- ✅ All Firebase calls (getDocs, addDoc, updateDoc, onSnapshot, etc.)

---

## Execution Order

1. **Phase 1** — `index.css` (theme tokens + base styles)
2. **Phase 2** — `DesktopSidebar.tsx`
3. **Phase 3** — `TopAppBar.tsx`
4. **Phase 4** — `AppLayout.tsx`
5. **Phase 5** — `MobileNav.tsx`
6. **Phase 6** — `RoleSelection.tsx`
7. **Phase 7** — All dashboard/page files (batch by role)

Each phase should be tested visually before moving to the next.
