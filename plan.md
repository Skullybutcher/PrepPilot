# PrepPilot — UI Overhaul and Multi-Plan Workflow

> **Status**: Planning Phase
> **Goal**: Transform PrepPilot from a single-roadmap local tracker into a modern, multi-tenant SaaS platform featuring a stunning landing page, multi-plan dashboard, and a conversational AI onboarding wizard.

---

## 1. UI/UX Design System

To elevate PrepPilot's aesthetic to a premium, modern standard, we will aggressively implement the following design methodologies across the entire application. Where applicable, we will leverage modern components from **reactbits.dev** (like animated backgrounds or text effects).

### 1.1. Glassmorphism & Floating Layouts
- **Execution**: The main application surfaces (hero sections, dashboard cards, kanban columns) will float over dynamic backgrounds.
- **Implementation**: 
  - Use `backdrop-filter: blur(20px)` and a semi-transparent background (e.g., `rgba(255, 255, 255, 0.05)` in dark mode, or `rgba(255, 255, 255, 0.7)` in light mode).
  - Employ asymmetric designs by placing blurred colorful orbs (Aurora effect) or floating elements behind the glass layers.
  - Generous `border-radius: 16px` or `24px` on main containers to soften the UI.

### 1.2. Typography Pairing (Serif + Sans-Serif)
- **Execution**: High-contrast pairing to give the app a distinct, premium personality.
- **Headings (H1/H2)**: Use a high-contrast Serif like **Playfair Display** or **Merriweather** for landing page heroes, dashboard titles, and AI greetings. (e.g., "Navigate Your *Career*").
- **Body & UI**: Clean, highly legible Sans-Serif like **Inter** for all interactive elements (buttons, todo items, chat bubbles).

### 1.3. Strict CTA Visual Hierarchy & Whitespace
- **Primary CTAs**: Only the most important action (e.g., "Start New Plan", "Sign Up", "Deploy") gets a solid, vibrant, high-contrast pill button (e.g., a sleek gradient with hover glow).
- **Secondary Actions**: View options, settings, or dismissals use text links with subtle icons or faint outlines. No competing buttons.
- **Whitespace**: Massive negative space around the hero, wide padding inside glass cards (`2rem` to `3rem`), and soft gradient backgrounds to prevent cognitive overload.

### 1.4. Immediate Social Proof
- **Execution**: A horizontal scrolling marquee immediately below the landing page hero.
- **Implementation**: Display recognizable tech logos (NVIDIA NIM, Jira, React, Vite) and perhaps "Trusted by developers at..." to establish instant credibility.

---

## 2. Application Workflow & Architecture

The app will shift from a single view to a routed application (`react-router-dom`).

### 2.1. Landing Page (`/`)
- **Hero Section**: A massive glass card floating over a reactive animated background (Reactbits Aurora or Waves). Playfair Display header, Inter sub-text. Primary CTA: "Start Your Journey".
- **Social Proof**: Infinite scrolling marquee of integrated technologies.
- **Features**: Asymmetrical grid of glass cards highlighting the AI Planner, Jira Sync, and Adaptive Pacing.

### 2.2. Authentication (`/login`, `/signup`)
- Minimalist, centered glass cards for User Auth (JWT/Supabase/Firebase). Redirects to `/dashboard` upon success.

### 2.3. User Dashboard (`/dashboard`)
- **Multi-Plan View**: Instead of immediately showing tasks, the user sees a grid of their active roadmaps (e.g., "Interview Prep Q4", "Cloud AWS Architect").
- **Primary CTA**: A prominent "Create New Plan" floating action button.

### 2.4. Conversational Planning Wizard (`/plan/new`)
- When starting a new plan, the user enters an immersive, full-screen chat interface with the Planning Agent.
- **The Flow**:
  1. Agent introduces itself (Playfair Serif header).
  2. Asks for the overarching goal (e.g., SDE2 at FAANG).
  3. Asks for constraints (e.g., "How many months?", "Hours per week?").
  4. Generates and refines a customized `RoadmapConfig`.
  5. The user reviews the JSON/UI diff and clicks the solid Primary CTA: "Launch Plan".

### 2.5. The 4-Tab Project Dashboard (`/plan/:id`)
The existing core app becomes scoped to a specific Plan ID.
- **Global Header**: Breadcrumb (`Dashboard / Interview Prep Q4`).
- **Today Tab**: 
  - Glass cards for tasks.
  - Floating sidebar/widget showing daily streak and progress.
- **Board Tab**: 
  - Kanban columns with `backdrop-filter`. 
  - Cards lift dramatically (`transform: translateY(-4px)`) and cast a colored shadow when dragged.
- **Progress Tab**: 
  - Large Serif numbers for stats.
  - Glowing, animated progress bars for each track.
- **Plan Tab (Settings)**: 
  - The chat interface remains available here to *re-negotiate* or modify the active plan mid-way.

---

## 3. Phased Implementation Plan

### Phase 1: Foundation & Database Update
1. **Backend**: Update `better-sqlite3` schema to include `users` and `plans` tables. 
2. Update existing `/api/*` endpoints to accept and filter by `userId` and `planId`.
3. **Frontend**: Install `react-router-dom`. Setup root routes.

### Phase 2: Design System & Landing Page
1. Add `Playfair Display` to `index.html`. 
2. Define global CSS variables for glassmorphism tokens, gradients, and shadows.
3. Build the Landing Page (`Hero`, `SocialMarquee`, `FeatureGrid`).

### Phase 3: Auth & Dashboard Grid
1. Implement Login/Signup flows.
2. Build the `/dashboard` route displaying existing plans as floating glass cards.

### Phase 4: Conversational Wizard
1. Build `/plan/new`. Wire up a new backend route that uses a system prompt specifically tailored for *from-scratch onboarding* (asking questions rather than just modifying).
2. Save the final confirmed plan to the `plans` DB table, sync with Jira, and redirect to the project view.

### Phase 5: 4-Tab Dashboard Refactor
1. Move `App.jsx` core logic into a `ProjectView` component rendered at `/plan/:id`.
2. Ensure `TodayView`, `BoardView`, and `ProgressView` fetch data specific to `:id`.
3. Apply the final UI polish (Serif headers, extreme whitespace, stark CTA contrasts) to these existing views.

---

## 4. Additional UI/UX Recommendations

### 4.1. Motion Design & Page Transitions
- **Page Transitions**: Use `framer-motion`'s `AnimatePresence` to wrap route changes. Pages should fade-slide in from the bottom (`y: 20, opacity: 0` → `y: 0, opacity: 1`, ~300ms ease-out). This single addition makes the app feel alive instead of static.
- **Staggered Lists**: When the Today tab loads its todo cards, don't render them all at once. Stagger each card's entrance by 50ms (`staggerChildren: 0.05`). The user sees a gentle cascade rather than a jarring paint.
- **Micro-interactions on State Change**: When a todo is marked Done, animate the checkbox with a satisfying scale bounce (`scale: [1, 1.3, 1]` over 200ms) and briefly flash the row background green before fading it out. This gives tactile, rewarding feedback.
- **Tab Indicator**: Instead of a static underline, animate the active tab indicator sliding left/right using a `layoutId` animation (Framer Motion's shared layout). The underline physically travels between tabs.

### 4.2. Color Palette & Dual Theme (Light + Dark)

Both modes are first-class citizens — not an afterthought. The entire app must look premium in both.

#### Dark Mode Palette
| Token | Value | Usage |
|---|---|---|
| `--bg` | `#09090b` | Page background |
| `--bg-elevated` | `#111113` | Modals, dropdowns, command palette |
| `--surface` | `rgba(255,255,255,0.03)` | Glass cards, todo items, board cards |
| `--surface-hover` | `rgba(255,255,255,0.06)` | Hover state on cards |
| `--border` | `rgba(255,255,255,0.06)` | Card borders, dividers |
| `--border-focus` | `rgba(99,102,241,0.5)` | Focus rings |
| `--text` | `#fafafa` | Primary text |
| `--text-secondary` | `#a1a1aa` | Subtitles, timestamps |
| `--text-muted` | `#71717a` | Hints, placeholders |
| `--accent` | `#6366f1` | Solid accent color |
| `--accent-gradient` | `linear-gradient(135deg, #6366f1, #a855f7)` | CTA buttons, active tab indicator |
| `--accent-glow` | `0 0 24px rgba(99,102,241,0.4)` | Button hover glow |
| `--success` | `#22c55e` | Done states, approve |
| `--warning` | `#f59e0b` | Rebalance banners, caution |
| `--danger` | `#ef4444` | Errors, destructive actions |

#### Light Mode Palette
| Token | Value | Usage |
|---|---|---|
| `--bg` | `#fafaf9` | Page background (warm off-white) |
| `--bg-elevated` | `#ffffff` | Modals, dropdowns |
| `--surface` | `rgba(0,0,0,0.02)` | Glass cards (subtle gray tint) |
| `--surface-hover` | `rgba(0,0,0,0.04)` | Hover state |
| `--border` | `rgba(0,0,0,0.08)` | Card borders |
| `--border-focus` | `rgba(99,102,241,0.5)` | Focus rings (same) |
| `--text` | `#18181b` | Primary text |
| `--text-secondary` | `#52525b` | Subtitles |
| `--text-muted` | `#a1a1aa` | Hints, placeholders |
| `--accent` | `#6366f1` | Same accent works on both |
| `--accent-gradient` | `linear-gradient(135deg, #6366f1, #a855f7)` | Same gradient |
| `--accent-glow` | `0 0 24px rgba(99,102,241,0.25)` | Softer glow on light bg |
| `--success` | `#16a34a` | Slightly darker green for contrast |
| `--warning` | `#d97706` | Darker amber for readability |
| `--danger` | `#dc2626` | Darker red for readability |

#### Implementation Strategy
1. **CSS Custom Properties**: Define all tokens as `--var` on `:root` (dark default) and `html.light` (light override). Every component references `var(--bg)`, `var(--text)`, etc. — never raw hex values.
2. **Toggle Component**: A pill-shaped toggle in the top-right nav (sun/moon icon). On click: toggle `html.classList`, persist choice to `localStorage`, and read it on mount to apply before first paint (inline `<script>` in `index.html` to prevent flash of wrong theme).
3. **Smooth Transition**: Add `transition: background-color 0.3s ease, color 0.2s ease, border-color 0.2s ease` on `body` and major surfaces so the switch feels fluid, not jarring.
4. **Glassmorphism Adjustment**: In light mode, `backdrop-filter: blur(20px)` still works but the glass surface needs `rgba(255,255,255,0.7)` instead of `rgba(255,255,255,0.03)` — add a separate `--glass-bg` token per theme.
5. **System Preference**: Default to `prefers-color-scheme: dark` media query if no `localStorage` value exists. Respect the user's OS setting on first visit.
- **Accent Glow**: Primary CTA buttons should have a soft, colored `box-shadow` glow matching their gradient. On hover, pulse the glow intensity up slightly.

### 4.3. Empty States & First-Run Experience
- **Empty Dashboard** (no plans yet): Don't show a blank grid. Show a large, centered illustration (a simple SVG of a rocket or compass), a Playfair heading ("Your journey starts here"), and a single glowing CTA: "Create Your First Plan". This is the most critical conversion moment.
- **Empty Today Tab** (no tasks generated): Show a calm illustration with "All caught up for today" and a subtle secondary link: "Generate tasks manually".
- **Empty Board**: Show ghost columns with dashed borders and a hint: "Tasks will appear here once generated."

### 4.4. Responsive & Mobile Strategy
- **Breakpoints**: `640px` (mobile), `1024px` (tablet), `1280px` (desktop).
- **Landing Page**: Hero stacks vertically on mobile. Floating background elements scale down or hide. The social marquee becomes single-row.
- **Dashboard Grid**: 1 column on mobile, 2 on tablet, 3 on desktop.
- **4-Tab View**: Tabs become a bottom navigation bar on mobile (fixed, glass background, icons + labels). The Board tab switches from horizontal columns to a vertical accordion on screens < 640px.
- **Chat/Plan View**: Full-screen on mobile with the input pinned to the bottom (like a native messaging app).

### 4.5. Data Visualization Upgrades
- **Progress Tab — Radial Charts**: Replace the flat horizontal progress bars for the overall DSA completion with a large, animated radial/donut chart (use a lightweight library like `recharts` or pure SVG). The ring fills on mount with an eased animation. Center text shows the percentage in large Playfair numerals.
- **Streak Calendar**: Below the streak badge, render a small GitHub-style contribution heatmap grid (last 12 weeks). Each day is a tiny square; color intensity maps to number of tasks completed. This gives an at-a-glance view of consistency that a single number can't.
- **Velocity Sparkline**: On the Progress tab, show a tiny inline sparkline (last 4 weeks of tasks completed per week) next to each track. Trend going up = green line, down = red.

### 4.6. Notification & Feedback System
- **Toast Stack**: Replace the current inline toast with a proper notification stack in the bottom-right corner. Toasts slide in from the right, auto-dismiss after 4s, and stack vertically with a slight offset. Use distinct colors: green for success, amber for warnings, red for errors.
- **Confetti on Milestones**: When the user completes a major milestone (e.g., finishes an entire Striver step, or hits a 7-day streak), fire a brief confetti burst using `canvas-confetti`. It's a 3KB library and the dopamine hit is real.

### 4.7. Keyboard Shortcuts & Power User Features
- `Ctrl+K` / `Cmd+K`: Open a command palette (search plans, jump to tabs, quick-mark a task done). Use a centered glass modal with a text input and fuzzy-matched results.
- `Ctrl+N`: Create new plan.
- `1-4` keys: Switch between Today/Board/Progress/Plan tabs.

### 4.8. Specific Reactbits Components to Evaluate
Browse [reactbits.dev](https://reactbits.dev) and consider integrating:
- **Aurora / Threads Background**: For the landing page hero and the planning wizard backdrop. Gives an immediately premium, dynamic feel.
- **Text Animations (Split Text, Blur Text)**: For the landing page headline. Letters animate in with a blur-to-sharp or slide-up effect on load.
- **Marquee**: For the social proof tech logo strip. Infinite horizontal scroll, pausable on hover.
- **Magnet / Tilt Cards**: For the feature grid cards on the landing page. Cards subtly tilt toward the cursor, adding a 3D parallax feel.
- **Counter / Number Ticker**: For the Progress tab stats (e.g., "127 problems solved"). Numbers count up on mount instead of appearing static.

### 4.9. Accessibility (a11y) Non-Negotiables
- All interactive elements must have `focus-visible` outlines (use the accent color, not browser default blue).
- Color contrast ratios must meet WCAG AA (4.5:1 for body text, 3:1 for large text). Test with browser DevTools.
- The glassmorphism blur must not reduce text contrast below thresholds — always pair blur with a sufficiently opaque fallback background.
- All images/icons need `alt` text. All icon-only buttons need `aria-label`.
- Keyboard navigation must work for all flows (tab order, enter to submit, escape to close modals).

## Phase 6: Multi-tenant Auth & AI Planner Enhancements

### 6.1 Multi-tenant Auth & Jira Configuration (Powered by Supabase)
**Rationale:** Currently, the system relies on hardcoded `.env` variables for a single user's Jira/NIM configuration. We need to support multiple users who can bring their own Jira accounts and API keys. We will use **Supabase** to handle Authentication and PostgreSQL Database storage.

**Frontend (Supabase Auth):**
- **Auth Layer:** Integrate `@supabase/supabase-js`. Create a unified Login/Signup page.
- **Settings/Onboarding Modal:** After signup, prompt the user for their Jira details (`JIRA_BASE_URL`, `JIRA_EMAIL`, `JIRA_API_TOKEN`, `JIRA_PROJECT_KEY`).
- **Help Text:** Provide clear, inline instructions (with screenshots or list items) showing users exactly where to find these keys in Jira (e.g., Atlassian Account -> Security -> Create API Token).
- **Storage:** Send these details to the backend to be encrypted and upserted into the Supabase `profiles` table. **Never store API keys in plaintext.**

**Backend (Supabase DB & Encryption):**
- **Database (Supabase PostgreSQL):** Create a `profiles` table (`id` linked to `auth.users`, `jira_base_url`, `jira_email`, `encrypted_jira_token`, `jira_project_key`). Set up Row-Level Security (RLS) so users can only read/update their own config.
- **Application-Level Encryption:** Implement an encryption utility in Node.js (using `crypto` and a master `ENCRYPTION_KEY` env var) to encrypt the Jira token *before* sending it to Supabase, and decrypt it when reading it back for use.
- **Middleware:** Create a Supabase auth middleware using `@supabase/supabase-js` that verifies the incoming user's JWT from the request header.
- **Dynamic Config:** Update all Jira API wrappers to fetch and decrypt the authenticated user's credentials dynamically from the Supabase DB on each request, rather than `process.env`.

### 6.2 Fix API Deployment / Connectivity Errors
**Symptoms:** Users see "failed to load errors" and `Error: Unexpected token '<', "<!DOCTYPE "... is not valid JSON` in the chat.
**Cause:** The frontend `VITE_API_URL` environment variable is either unset or misconfigured on Vercel. When unset, `fetch` falls back to requesting relative paths (`/undefined/api/...`), which Vercel's SPA routing intercepts and serves `index.html` (hence the HTML parse error).
**Fixes:**
1. **Frontend:** Update `frontend/src/api.js` to handle missing backend URLs more gracefully (e.g., throwing a clear "Backend URL missing" error).
2. **Frontend Config:** Ensure Vite proxy is set in `vite.config.js` for local development (`/api` -> `http://localhost:4000`).
3. **Vercel Env:** The user must configure `VITE_API_URL` to point to the live Render backend URL (`https://<render-app>.onrender.com/api`).

### 6.3 AI Planner Context Modal
**Rationale:** The AI planner currently starts a chat cold. We need a way for the user to provide upfront context so the planner can generate a comprehensive roadmap immediately.

**Frontend:**
- **Plan Setup Modal:** When a user clicks "Create Plan" or opens the `/plan/new` view, show a modal before the chat interface appears.
- **Form Fields:** 
  - **Goal/Purpose:** What are you preparing for? (e.g., "SDE-1 at Amazon")
  - **Duration:** How many months/weeks?
  - **Course Materials/Links:** What courses or platforms are you using?
  - **Current Level:** Beginner / Intermediate / Advanced
- **Action:** On submit, structure this data into a formatted system message and send it as the *first* hidden user prompt to the `/api/plan/chat` backend, kickstarting the generation process.

**Backend:**
- Update `/api/plan/chat` to parse this initial context message and inject it into the LLM system prompt for highly tailored roadmap generation.
