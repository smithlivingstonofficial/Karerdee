# KARE-SES (Site-3.0) — Kalasalingam Secure Exam Software

A high-integrity institutional examination system designed for Kalasalingam Academy of Research and Education. The system pairs an OS-level **Windows Secure Exam Software Client** (for candidates) with a modern **Web-based Admin & Proctoring Management Portal** (for educators and invigilators).

---

## 🏛 System Architecture Overview

```
┌────────────────────────────────────────────────────────┐
│              Candidate Hardware (Windows)              │
│  ┌──────────────────────────────────────────────────┐  │
│  │ C# .NET 8 WPF Security Shell                     │  │
│  │ - Low-level Win32 Keyboard Hook (Alt+Tab, Win)   │  │
│  │ - SetWindowDisplayAffinity (Anti-screen capture) │  │
│  │ - Process & VM Watchdog                          │  │
│  │ - On-Device ONNX Face Tracker                    │  │
│  │ - Encrypted Local SQLite Buffer                  │  │
│  │ ┌──────────────────────────────────────────────┐ │  │
│  │ │ Microsoft WebView2 (Strict Light Theme UI)   │ │  │
│  │ └──────────────────────────────────────────────┘ │  │
│  └──────────────────────────────────────────────────┘  │
└───────────────────────────┬────────────────────────────┘
                            │ HTTPS / Signed Session Tokens
                            ▼
┌────────────────────────────────────────────────────────┐
│            Next.js App & API Service Layer             │
│  - /api/exam/auth (Hardware Hash + Passcode Validation)│
│  - /api/exam/sync (Buffered answer sync & heartbeat)   │
│  - /api/telemetry/violation (Snapshot storage handler) │
│  - Admin, Proctoring & Evaluator Web Studio            │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│               Supabase Cloud Platform                  │
│  - PostgreSQL: Relational Exam Data & Audit Logs       │
│  - Realtime: WebSocket Broadcasts for Live Proctoring  │
│  - Storage: Encrypted Buckets for Violation Snapshots  │
│  - Auth: Role-Based Access for Academic Staff          │
└────────────────────────────────────────────────────────┘
```

---

## 📂 Project Repository Structure

```text
Site-3.0/
├── .agents/
│   └── skills/
│       ├── light-theme-design-system/
│       │   └── SKILL.md          # Light theme UI/UX design tokens & guidelines
│       ├── wpf-security-lockdown/
│       │   └── SKILL.md          # Win32 security hooks, VM detection & WebView2
│       └── exam-platform-backend/
│           └── SKILL.md          # Next.js API, Supabase Realtime & DB schemas
├── docs/
│   ├── ARCHITECTURE.md           # Deep architectural specification
│   ├── DATABASE_SCHEMA.md        # PostgreSQL schemas, tables & RLS policies
│   ├── SECURITY_LOCKDOWN.md      # Low-level Windows security & anti-cheat engine
│   ├── UI_UX_DESIGN_SYSTEM.md    # Strict light theme academic design system
│   └── ROADMAP.md                # Phase-by-phase implementation plan & checklist
├── admin-web/                    # Next.js 14/15 Admin & Proctoring Portal (To be scaffolded)
│   ├── src/app/                  # App router pages (dashboard, exams, proctor, grading)
│   ├── src/components/           # Accessible shadcn/ui components (Light theme)
│   └── src/lib/                  # Supabase clients and helper utilities
├── client-windows/               # C# .NET 8 WPF Lockdown Client (To be scaffolded)
│   ├── Security/                 # Win32 hooks, VM checks, process monitor
│   ├── Vision/                   # ONNX face tracking engine
│   ├── Storage/                  # Local encrypted SQLite sync buffer
│   └── Views/                    # WPF shell window hosting WebView2
├── AGENTS.md                     # Permanent assistant rules & style constraints
└── README.md                     # Master project entrypoint
```

---

## 🎨 UI/UX Theme Directive

This platform strictly adheres to a **High-Contrast, Accessible Light Theme**:
- **Background**: Soft anti-glare canvas (`#F8FAFC`).
- **Cards/Surfaces**: Pure crisp white (`#FFFFFF`) with subtle slate borders (`#E2E8F0`).
- **Typography**: Dark charcoal/slate (`#0F172A`) for primary text to prevent visual fatigue.
- **Accents**: Academic Navy/Blue (`#1D4ED8` / `#2563EB`) with prominent 2px focus rings.
- **Dark Mode**: Strictly disabled across both Admin Portal and Candidate Exam Client to ensure consistent optical legibility and standardization during examinations.

---

## 🚀 Quick Links to Documentation

- [System Architecture](docs/ARCHITECTURE.md)
- [Database Schema & Migrations](docs/DATABASE_SCHEMA.md)
- [Security & Lockdown Engine](docs/SECURITY_LOCKDOWN.md)
- [UI/UX Light Theme Design System](docs/UI_UX_DESIGN_SYSTEM.md)
- [Implementation Roadmap](docs/ROADMAP.md)

