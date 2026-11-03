# Permanent Agent Instructions & Project Rules (Site-3.0)

These rules apply to all automated agents, subagents, and developers working on this codebase.

---

## 1. UI/UX Light Theme Strict Directive
- **Light Theme Only**: The user has explicitly mandated a pure, refined **Light Theme** across both the Admin Web Management Portal and the Windows Candidate Client.
- **Do NOT introduce dark mode toggles or dark-themed defaults**.
- All styles must use:
  - Canvas background: `#F8FAFC` (Slate-50) or `#F1F5F9` (Slate-100).
  - Card / Panel background: `#FFFFFF`.
  - Borders: `#E2E8F0` (Slate-200) or `#CBD5E1` (Slate-300).
  - Primary text: `#0F172A` (Slate-900).
  - Secondary text: `#475569` (Slate-600).
  - Primary action: Academic Blue `#1D4ED8` or `#2563EB`.
  - Violations / Danger: Crimson `#DC2626` / `#B91C1C`.
  - Success: Emerald `#059669` / `#047857`.
  - Warning: Amber `#D97706` / `#B45309`.
- Maintain **minimum 4.5:1 contrast ratio** for body text and **7:1 for critical exam metrics/questions**.

---

## 2. Architectural Boundaries
- **`admin-web/`**: Next.js 14/15 (App Router), TypeScript, Tailwind CSS, shadcn/ui (Light theme tokens), Supabase JS Client.
- **`client-windows/`**: C# .NET 8 WPF application with Microsoft WebView2.
- **Zero-Trust Client**: The Windows desktop app must never be trusted implicitly.
  - All exam submissions, heartbeats, and violation reports must pass through signed session tokens (`/api/exam/*`).
  - Never place direct Supabase database service keys inside the desktop client.

---

## 3. Windows Security & Lockdown Standards
- Always implement Win32 low-level keyboard hooks (`WH_KEYBOARD_LL`) to capture and drop system keys (`Alt+Tab`, `Win`, `Ctrl+Esc`, `Alt+F4`, `PrintScreen`).
- Always apply `SetWindowDisplayAffinity(hwnd, WDA_EXCLUDEFROMCAPTURE)` to block screen recorders and screenshots.
- Ensure the candidate interface handles temporary network drops gracefully by buffering answers locally in memory or encrypted SQLite before retrying upload.

---

## 4. Coding Conventions
- **TypeScript**: Strict type checking enabled (`strict: true`), avoid `any`.
- **C#**: Nullable reference types enabled (`<Nullable>enable</Nullable>`), adhere to standard .NET naming conventions (PascalCase for methods/classes, camelCase for local variables).
- **Documentation**: All new modules, Win32 P/Invoke signatures, and API endpoints must include clear explanatory comments.

