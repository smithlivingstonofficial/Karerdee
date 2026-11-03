---
name: light-theme-design-system
description: Use this skill when developing UI components, layouts, pages, or styles for the Safe Exam Platform. Enforces strict light theme design tokens, WCAG 2.1 AA/AAA contrast ratios, anti-glare academic ergonomics, and prohibits dark-mode leakage.
---

# Light Theme Design System for Safe Exam Platform

This skill guides the construction of user interfaces for both the **Next.js Web Portal** and the **Candidate Exam Interface (WebView2)**. All styling must strictly obey an accessible, institutional **Light Theme**.

---

## 1. Core Color Tokens (Tailwind & CSS Variables)

When creating components, use the following standardized tokens:

```css
:root {
  /* Canvas Background: Low-glare soft slate */
  --background: 210 40% 98%;          /* #F8FAFC (slate-50) */
  --foreground: 222 47% 11%;          /* #0F172A (slate-900) */

  /* Surface Cards: Crisp white with subtle slate border */
  --card: 0 0% 100%;                  /* #FFFFFF */
  --card-foreground: 222 47% 11%;     /* #0F172A */
  --border: 214 32% 91%;              /* #E2E8F0 (slate-200) */
  --input: 215 20% 80%;               /* #CBD5E1 (slate-300) */

  /* Muted / Secondary */
  --muted: 210 40% 96%;               /* #F1F5F9 (slate-100) */
  --muted-foreground: 215 16% 35%;    /* #475569 (slate-600) */

  /* Brand / Primary: Academic Blue */
  --primary: 221 83% 53%;             /* #1D4ED8 (blue-700) */
  --primary-foreground: 210 40% 98%;  /* #FFFFFF */

  /* Semantic Feedback */
  --success: 158 64% 25%;             /* #047857 (emerald-700) */
  --success-bg: 152 76% 96%;          /* #ECFDF5 (emerald-50) */
  --warning: 32 95% 37%;              /* #B45309 (amber-700) */
  --warning-bg: 48 100% 96%;          /* #FFFBEB (amber-50) */
  --destructive: 0 74% 42%;           /* #B91C1C (red-700) */
  --destructive-bg: 0 86% 97%;        /* #FEF2F2 (red-50) */

  /* Focus ring */
  --ring: 221 83% 53%;
}
```

---

## 2. Component Construction Rules

### A. Surface Elevations & Cards
- Never use heavy black drop shadows (`shadow-2xl` with black).
- Use soft, low-intensity elevation: `border border-slate-200 bg-white shadow-sm rounded-lg`.
- For interactive cards, use `hover:border-slate-300 hover:shadow transition-all`.

### B. Typography & Contrast (WCAG 2.1 AA/AAA)
- **Primary Text**: Always use `text-slate-900` (`#0F172A`). Never use pure `#000000` on white to prevent contrast fatigue over long reading sessions.
- **Secondary / Descriptive Text**: Use `text-slate-600` (`#475569`). Minimum contrast ratio 4.5:1.
- **Captions / Footnotes**: Use `text-slate-500` (`#64748B`).
- **Focus Rings**: Always provide a prominent outline on interactive elements:
  ```html
  <button class="focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2 ...">
  ```

### C. Data Tables (Student Submissions & Proctoring Grid)
- Headers: `bg-slate-100/75 text-slate-700 font-semibold text-xs uppercase tracking-wider border-b border-slate-200`.
- Alternating or clean rows: `hover:bg-slate-50/80 transition-colors border-b border-slate-100`.
- Cells: `px-4 py-3 text-sm text-slate-800`.

### D. Question Matrix & Badges
- **Unanswered**: `bg-white text-slate-700 border border-slate-300`
- **Active Question**: `bg-blue-50 text-blue-800 border-2 border-blue-600 font-bold`
- **Answered**: `bg-emerald-50 text-emerald-800 border border-emerald-300`
- **Marked for Review**: `bg-amber-50 text-amber-800 border border-amber-300`
- **Locked / Strike Max**: `bg-red-50 text-red-800 border border-red-300 animate-pulse`

---

## 3. Dark Mode Prohibition
- **Do NOT** include `dark:` utility variants in components.
- **Do NOT** install `next-themes` or render theme toggle switches.
- Ensure the root `<html>` element has class `light` and `style="color-scheme: light;"`.

