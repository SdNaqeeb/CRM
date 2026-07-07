# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm start        # Dev server on localhost:3000
npm run build    # Production build
npm test         # Run tests (jest/react-testing-library)
npm test -- --testPathPattern=App  # Run a single test file
```

Environment variable: `REACT_APP_API_URL` (defaults to `https://crm.smartlearners.ai/backend-api/`)

## Architecture

**Smartlearners.ai CRM** — a React 19 + TypeScript frontend for managing student engagement across schools. No CSS framework; all styling is inline with a consistent design token object (typically named `C`) defined at the top of each page component.

### Role-based routing (`src/App.tsx`)
Three user roles map to three dashboard routes:
- `teacher` → `/teacher` → `TeacherDashboard`
- `school_admin` → `/school` → `SchoolDashboard`
- `orcalex_admin` → `/orcalex` → `OrcaLexDashboard`

Auth is client-side only (no JWT/session): `AuthContext` stores a mock `User` object in `localStorage`. Login just sets role + username/schoolCode — there is no real authentication endpoint.

### Data flow
- `src/services/api.ts` — all API calls via axios, grouped as `dashboardAPI`, `engagementAPI`, `alertAPI`, `activityAPI`, `challengeAPI`, `quizAPI`, `examAPI`, `scheduledAssignmentAPI`, `chatAPI`
- `src/context/DashboardContext.tsx` — shares dashboard data between pages (used by the ChatBot)
- `src/types/index.ts` — single source of truth for all TypeScript interfaces and enums

### TeacherDashboard tab structure
`TeacherDashboard` is the most complex page. It renders one of many sub-views via an `activeTab` state:
`students` | `track-status` | `assignments` | `daily-quizzes` | `weekly-exams` | `mock-exams` | `mock-exam-analysis` | `compare-mock-exams` | `jee-exams` | `pre-assessment` | `activity`

Each tab lazy-loads its data on first activation. Heavy sub-components: `MockExamResults`, `MockExamAnalysis`, `StudentTrackGrid`, `ScheduledAssignmentsPanel`.

### Key component conventions
- Inline styles everywhere; color tokens defined locally in a `C` constant
- Primary font: `"Plus Jakarta Sans"` (loaded via Google Fonts or system fallback)
- Primary brand color: `#7C3AED` (purple)
- `KaTeXText` component handles math rendering via `react-katex`
- `recharts` for all charts (bar, scatter, line)
- `exceljs` / `xlsx` for Excel export in `src/utils/buildClass10SummerExcel.ts` and scripts in `scripts/`

### Scripts
`scripts/` contains Node.js data-processing scripts (not part of the React build):
- `fetchMockExamResults.js` — fetches exam data from the backend API
- `buildSectionSummerComparison.js` — builds comparison JSON written to `src/data/`
