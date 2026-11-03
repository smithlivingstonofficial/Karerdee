# Implementation Roadmap & Milestones

This document establishes the actionable, step-by-step engineering plan for developing the **Safe Exam Platform**.

---

## Phase 1: Environment Scaffolding & Database Foundation
- [ ] Initialize repository structure (`admin-web/` and `client-windows/`).
- [ ] Scaffold `admin-web/` using Next.js 14/15 (TypeScript, Tailwind CSS, shadcn/ui).
- [ ] Configure Tailwind CSS and CSS variables to enforce the strict **Light Theme Design System**.
- [ ] Deploy Supabase PostgreSQL migration scripts:
  - Core tables (`departments`, `courses`, `batches`, `students`, `exams`, `exam_questions`, `question_options`, `exam_sessions`, `submissions`, `violation_logs`, `proctor_actions`).
  - Configure Supabase Storage bucket `exam-violations` with authenticated access rules.
- [ ] Implement Next.js database client with connection pooling and typed database definitions.

---

## Phase 2: Admin Management & Exam Authoring Studio
- [ ] Implement Department, Course, Batch, and Student registration interfaces.
- [ ] Build **Exam Authoring Studio**:
  - Exam metadata configuration (Title, Course, Start/End time, Duration, Max Strikes, Passcode generation).
  - MCQ Creator (Single & Multi-select, option randomizer, negative marks).
  - Subjective Question Creator (Word limits, model answer, rubric criteria builder).
- [ ] Implement Exam Listing & Status management (Draft $\to$ Scheduled $\to$ Active $\to$ Completed).
- [ ] Build Candidate Passcode distribution and printable admission slips.

---

## Phase 3: Windows Client Core Security Shell
- [ ] Scaffold `client-windows/` using C# .NET 8 WPF.
- [ ] Implement low-level Win32 keyboard hook (`SetWindowsHookEx` with `WH_KEYBOARD_LL`):
  - Intercept and suppress `Alt+Tab`, `Win`, `Ctrl+Esc`, `Alt+F4`, `PrintScreen`.
- [ ] Implement `SetWindowDisplayAffinity(WDA_EXCLUDEFROMCAPTURE)` to prevent screenshots and screen shares.
- [ ] Implement Multi-Monitor detector and auxiliary screen blackout window.
- [ ] Implement Virtual Machine / Hypervisor detection (CPUID check + WMI model check).
- [ ] Implement background Process Watchdog with blacklisted process termination.

---

## Phase 4: Candidate Exam Engine & Offline Resilience
- [ ] Embed Microsoft WebView2 within the WPF shell window.
- [ ] Configure WebView2 security hardening (DevTools disabled, context menus disabled, accelerator keys blocked).
- [ ] Build Candidate Exam Client UI (HTML/React in WebView2 or hosted bundle):
  - Passcode & Roll number login modal.
  - Question matrix navigation (Answered, Unanswered, Marked for Review).
  - Question renderers (MCQ options with large hit areas, rich essay editor with word counter).
  - High-visibility countdown timer with low-time warning state.
- [ ] Build local encrypted SQLite sync buffer in C#:
  - Save candidate answers instantaneously to local buffer.
  - Periodic background flush to `/api/exam/sync`.
  - Offline banner with graceful reconnection handling.

---

## Phase 5: Real-time Proctoring & Bi-directional Remote Commands
- [ ] Configure Supabase Realtime broadcast channels (`exam-telemetry:{exam_id}`).
- [ ] Build Faculty **Live Proctoring Console** in `admin-web/`:
  - Real-time candidate card/table grid (Green = Normal, Yellow = Warned, Red = Locked, Gray = Disconnected).
  - Strike counter badge with violation history drawer.
- [ ] Implement remote action handlers:
  - Broadcast warning messages directly to candidate's screen.
  - Pause / Resume candidate exam timer remotely.
  - Add extra time ($+5$, $+10$, $+15$ mins).
  - Remote unlock for locked-out candidates.
  - Force-submit session for non-compliant candidates.

---

## Phase 6: On-Device Vision Engine & Snapshot Evidence
- [ ] Integrate `Microsoft.ML.OnnxRuntime` into the WPF client.
- [ ] Load lightweight face detection model (UltraFace ONNX) on webcam stream.
- [ ] Implement frame evaluation loop (every 1.5s):
  - Check for `NO_FACE_DETECTED` ($> 3$ consecutive frames).
  - Check for `MULTIPLE_FACES_DETECTED`.
- [ ] Implement automatic snapshot compressor and upload to Supabase Storage.
- [ ] Wire snapshot viewer into the Admin Live Proctoring Console.

---

## Phase 7: Subjective Evaluation Studio & Results
- [ ] Build **Subjective Evaluation Studio**:
  - Filter submissions by exam and question.
  - Support blind evaluation mode (anonymized student identity).
  - Side-by-side view: Candidate response vs. Instructor rubric and model answer.
  - Mark entry and qualitative feedback box.
- [ ] Auto-calculate final aggregate scores (Auto-graded MCQs $+$ Evaluated Subjective).
- [ ] Build Results & Analytics dashboard:
  - Score distribution histogram.
  - Class pass/fail rates.
  - Export comprehensive results and audit logs as PDF / Excel.

---

## Phase 8: Hardening, Stress Testing & Deployment
- [ ] Conduct anti-cheat penetration testing:
  - Attempt key bypassing, remote desktop software injection, VM bypass, and task killing.
- [ ] Simulate network drop scenarios (unplugging Ethernet/Wi-Fi for 2 minutes and verifying sync integrity).
- [ ] Perform database load testing (simulating concurrent answer batches from 500 candidates).
- [ ] Package Windows Client into an MSI / single-file signed executable installer.

