# Plan: Make KSAS Responsive & Fix All Errors

## Overview
KSAS (Kabarak Smart Attendance System) is a React 19 + TypeScript + Tailwind CSS v4 SPA. The app has a mobile-first dual navigation pattern (desktop sidebar + mobile bottom nav) that is structurally sound, but has critical spacing/layout bugs and several code errors that need fixing.

---

## Phase 1: Fix Undefined Spacing Utilities (CRITICAL — 93+ occurrences)

**Problem:** The codebase uses ~20 custom spacing utility classes (`gap-xs`, `gap-sm`, `gap-md`, `gap-lg`, `gap-xl`, `p-xs`, `p-sm`, `p-md`, `p-lg`, `p-xl`, `mb-xs`, `mb-sm`, `mb-md`, `mb-lg`, `mb-xl`, `my-lg`, `mt-sm`, `mt-md`, `px-margin-mobile`, `px-gutter`, `md:px-gutter`, `md:px-lg`, `space-x-sm`, `space-x-md`, `text-headline-md`, `text-body-sm`) that are **never defined** in the Tailwind v4 `@theme` block or CSS. These produce no CSS output, causing broken layouts across 10+ files.

**Fix:** Add spacing tokens to `@theme` in `src/index.css`:

```css
@theme {
  /* ...existing color/font vars... */
  
  /* Spacing tokens */
  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-md: 16px;
  --spacing-lg: 24px;
  --spacing-xl: 32px;
  --spacing-2xl: 48px;
  --spacing-margin-mobile: 16px;
  --spacing-gutter: 24px;
}
```

**Files affected:** `src/index.css`, and all pages that use these classes (already works once tokens are defined).

---

## Phase 2: Fix Admin Reports Route (Missing Import)

**Problem:** `src/App.tsx:59` renders `<div>Reports (WIP)</div>` instead of the fully implemented `Reports` component from `src/pages/admin/reports.tsx`.

**Fix:** 
1. Add import: `import AdminReports from './pages/admin/reports';`
2. Replace route element: `<Route path="reports" element={<AdminReports />} />`

**File:** `src/App.tsx`

---

## Phase 3: Fix Unused Imports

**Problem:** Several files import symbols that are never used, causing lint warnings.

**Fixes:**
1. `src/pages/lecturer/Dashboard.tsx:2` — Remove `PlusCircle` from import
2. `src/pages/student/CourseDetails.tsx:2` — Remove `User` and `Book` from import  
3. `src/pages/admin/CourseManagement.tsx:2` — Remove `Book` from import (check if used)

**Files:** 3 files

---

## Phase 4: Responsive Improvements

### 4a. Admin Dashboard Stats Cards (Horizontal Scroll → Responsive Grid)
**File:** `src/pages/admin/Dashboard.tsx:22-47`
- The stat cards use `flex space-x-md overflow-x-auto` which causes horizontal scroll on mobile
- **Fix:** Change to `grid grid-cols-2 md:grid-cols-4 gap-md` for a proper responsive grid

### 4b. Lecturer RiskMonitor Table → Mobile Card Layout
**File:** `src/pages/lecturer/RiskMonitor.tsx:134-195`
- The data table has `overflow-x-auto` which allows horizontal scroll on mobile — poor UX
- **Fix:** Add a mobile card view that shows below `md` breakpoint, hide table on mobile

### 4c. Page Container Max-Width
**File:** `src/index.css:250-254`
- `.page-container` has `max-width: 672px` which is too narrow for tablet/desktop
- **Fix:** Make it responsive: `max-w-4xl` (896px) for better desktop utilization

### 4d. Admin CourseManagement Button Alignment
**File:** `src/pages/admin/CourseManagement.tsx:80-88`
- The header with "Add Course" button doesn't stack on mobile
- **Fix:** Add `flex-col sm:flex-row` for proper stacking

---

## Phase 5: Minor Code Quality Fixes

### 5a. Missing `key` prop patterns (if any found)
### 5b. Inconsistent padding classes in admin pages (normalize to use the new spacing tokens)
### 5c. Admin `reports.tsx` file naming (lowercase) — rename to `Reports.tsx` for React convention

---

## Execution Order

| Step | Action | Files |
|------|--------|-------|
| 1 | Add spacing tokens to `@theme` | `src/index.css` |
| 2 | Fix admin reports route | `src/App.tsx` |
| 3 | Remove unused imports | 3 component files |
| 4 | Fix admin dashboard responsive grid | `src/pages/admin/Dashboard.tsx` |
| 5 | Add mobile card view for RiskMonitor | `src/pages/lecturer/RiskMonitor.tsx` |
| 6 | Update page-container max-width | `src/index.css` |
| 7 | Fix admin CourseManagement header responsive | `src/pages/admin/CourseManagement.tsx` |
| 8 | Run `npx tsc --noEmit` to verify no type errors | — |
| 9 | Run `npx vite build` to verify build passes | — |

---

## Verification

After all changes:
1. TypeScript: `npx tsc --noEmit` — zero errors
2. Build: `npx vite build` — succeeds
3. Visual check: All pages render correctly at 375px, 768px, 1024px, 1440px widths
4. No horizontal scroll on any page at mobile widths
5. All spacing utilities produce visible CSS output
