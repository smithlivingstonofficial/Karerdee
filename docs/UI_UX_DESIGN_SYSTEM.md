# UI/UX Light Theme Design System Specification

This document defines the strict **Light Theme Design System** for the Safe Exam Platform, covering both the **Faculty/Admin Web Management Portal** and the **Windows Candidate Exam Interface**.

---

## 1. Design Philosophy: Accessible Academic Minimalism

1. **Anti-Glare Canvas**: Pure stark white (`#FFFFFF`) over an entire monitor creates visual fatigue during 2–3 hour examinations. The system pairs an ultra-soft, low-glare canvas (`#F8FAFC`) with crisp, elevated white cards (`#FFFFFF`).
2. **Cognitive Clarity**: Prioritizes scannability over decorative elements. Dense information (telemetry streams, question matrices, rubric criteria) is structured with strong typographic hierarchy and clean divider lines.
3. **Strict Light Mode Only**: Dark mode is intentionally excluded to ensure uniform optical contrast standards for all candidates and avoid inconsistency during institutional review.
4. **WCAG 2.1 / 2.2 AA & AAA Compliance**: All text elements meet a minimum 4.5:1 contrast ratio, with critical exam questions and timers exceeding 7:1.

---

## 2. Design Tokens & Color Palette

### 2.1 Core Neutral & Surface Tokens

| Token Name | Hex Code | Tailwind Class | Usage |
| :--- | :--- | :--- | :--- |
| `--canvas-bg` | `#F8FAFC` | `bg-slate-50` | Primary app background (low-glare) |
| `--surface-card` | `#FFFFFF` | `bg-white` | Question panels, dashboard metric cards, dialogs |
| `--surface-muted`| `#F1F5F9` | `bg-slate-100` | Secondary tabs, table headers, code blocks |
| `--border-subtle`| `#E2E8F0` | `border-slate-200` | Card borders, table dividers, question separators |
| `--border-strong`| `#CBD5E1` | `border-slate-300` | Interactive input borders, checkbox outlines |
| `--text-primary` | `#0F172A` | `text-slate-900` | Headings, questions, metric numbers, button labels |
| `--text-secondary`| `#475569`| `text-slate-600` | Instructions, metadata, table subtext, timestamps |
| `--text-muted`   | `#64748B` | `text-slate-500` | Placeholders, inactive breadcrumbs, helper notes |

### 2.2 Brand & Semantic Tokens

| Semantic Role | Foreground (Text) | Background (Surface) | Border / Outline | Tailwind Equivalent |
| :--- | :--- | :--- | :--- | :--- |
| **Primary Brand** | `#1D4ED8` (Blue 700) | `#EFF6FF` (Blue 50) | `#2563EB` (Blue 600) | `text-blue-700 bg-blue-50 border-blue-600` |
| **Success / Passed**| `#047857` (Emerald 700) | `#ECFDF5` (Emerald 50) | `#059669` (Emerald 600)| `text-emerald-700 bg-emerald-50 border-emerald-600` |
| **Warning / Flagged**| `#B45309` (Amber 700) | `#FFFBEB` (Amber 50) | `#D97706` (Amber 600) | `text-amber-700 bg-amber-50 border-amber-600` |
| **Danger / Lockout** | `#B91C1C` (Red 700) | `#FEF2F2` (Red 50) | `#DC2626` (Red 600) | `text-red-700 bg-red-50 border-red-600` |

### 2.3 Focus States
```css
/* Accessible High-Contrast Focus Ring */
:focus-visible {
  outline: 2px solid #1D4ED8;
  outline-offset: 2px;
}
```

---

## 3. Typography Scale & Guidelines

- **Primary Font Family**: `Inter, system-ui, -apple-system, sans-serif`
  - High x-height and clear distinction between uppercase `I`, lowercase `l`, and digit `1`.
- **Code / Monospace**: `JetBrains Mono, Consolas, monospace` (for code questions).

| Element | Size | Weight | Line Height | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **Page Title / Hero** | 24px (1.5rem) | 700 (Bold) | 32px | Admin section headers |
| **Section Header** | 18px (1.125rem) | 600 (Semibold) | 28px | Card titles, modal headers |
| **Exam Question Prompt** | 16px (1.0rem) | 500 (Medium) | 26px | Candidate question reading |
| **Body / Essay Text** | 15px (0.9375rem) | 400 (Regular) | 24px | Standard text and student essay input |
| **Table Data / Metadata** | 13px (0.8125rem) | 400 / 500 | 20px | Proctor grid cells, timestamp tags |
| **Countdown Timer** | 22px (1.375rem) | 700 (Bold) | 28px | Prominent test duration clock |

---

## 4. Candidate Exam Interface (Screen Anatomy)

```
+---------------------------------------------------------------------------------------------+
| SAFE EXAM PLATFORM  | Course: CS702 Advanced Algorithms  | Time Left: [ 01:24:15 ] | [SUBMIT] |
+---------------------------------------------------------------------------------------------+
| [Question Matrix]   | Question 14 of 40                           Marks: 2.0  | Negative: 0.5 |
| [ 1][ 2][ 3][ 4][ 5]|-----------------------------------------------------------------------|
| [ 6][ 7][ 8][ 9][10]| Explain the difference between B-Trees and B+ Trees in database       |
| [11][12][13][*14][15]| index structures. Detail how range queries are executed in both.      |
| [16][17][18][19][20]|                                                                       |
|                     | [ Essay Answer Input Area ]                                           |
| Legend:             | +-------------------------------------------------------------------+ |
| (*) Active          | | In a B-Tree, keys and satellite data records are stored in both   | |
| (G) Answered        | | internal and leaf nodes. In contrast, a B+ Tree stores all data   | |
| (Y) Marked Review   | | records solely in leaf nodes, with internal nodes only storing... | |
| ( ) Unanswered      | |                                                                   | |
|                     | +-------------------------------------------------------------------+ |
| Status:             | Words: 124 / 500 max                                                  |
| [● Saved Locally]   |                                        [< Previous]  [Next Question >]|
+---------------------------------------------------------------------------------------------+
```

### Visual Ergonomics:
- **Left Column (Navigation Matrix)**: Enables quick jump between questions. Uses clear color tags:
  - White with slate border: Unvisited.
  - Emerald green (`#ECFDF5`): Answered.
  - Amber yellow (`#FFFBEB`): Marked for Review.
  - Academic blue outline (`#1D4ED8`): Currently active question.
- **Center Canvas**: Single-column reading flow with clean padding (`p-8`), preventing eye strain across ultra-wide monitors.
- **Status Indicator**: Bottom-left pill indicating sync health:
  - `● All answers saved` (Green dot + `#047857`)
  - `▲ Buffering locally (Offline)` (Amber triangle + `#B45309`)

---

## 5. Admin & Proctoring Console Layout

- **Proctor Status Cards**:
  - Total Enrolled | In Session | Warning Flags | Disqualified
  - White surface cards with subtle borders (`border border-slate-200 shadow-sm`).
- **Live Candidate Data Table**:
  - Row hover state: `hover:bg-slate-50/80`.
  - Strikes badge:
    - 0 strikes: `bg-slate-100 text-slate-700`
    - 1–2 strikes: `bg-amber-50 text-amber-800 border-amber-300`
    - 3+ strikes (Locked): `bg-red-50 text-red-800 border-red-300 animate-pulse`
  - Inline action buttons: `Warn`, `Pause`, `+5m`, `Unlock` with distinct button variants.

