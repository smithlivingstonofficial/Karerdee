# High-Security Proctoring & Candidate Engine Specification

This document details the military-grade security architecture, anti-tamper mechanisms, deadman heartbeat protocols, and remote proctoring controls for the **Safe Exam Platform**.

---

## 1. Zero-Trust Security Threat Model & Defense Matrix

| Threat Vector | Attack Scenario | High-Security Defense Implementation |
| :--- | :--- | :--- |
| **Clock Tampering** | Candidate sets Windows system clock back 30 minutes to gain extra test time. | **Monotonic Hardware Timer**: The client uses CPU high-resolution tick counters (`Stopwatch.GetTimestamp()`) and server-synchronized epoch timestamps. Windows OS clock changes are detected and ignored. |
| **Local Answer Tampering** | Candidate modifies cached answers in local SQLite/RAM during an offline network drop. | **HMAC-SHA256 Payload Signing**: Every answer change is hashed with the candidate's ephemeral session token and an incrementing monotonic sequence nonce: `Signature = HMAC_SHA256(SessionSecret, AnswerData + SequenceNo)`. Tampered payloads are rejected upon sync. |
| **DevTools / DOM Injection** | Candidate uses Chrome DevTools or JavaScript console in WebView2 to alter questions or inject scripts. | **WebView2 Hardening**: Permanent disabling of DevTools (`AreDevToolsEnabled = false`), default context menus (`AreDefaultContextMenusEnabled = false`), and browser shortcut accelerators. CSS `user-select: none` and clipboard interceptors prevent copying prompts. |
| **Network Pulling / Stealth Drop** | Candidate unplugs Wi-Fi or LAN cable to look up answers while pretending to have network failure. | **Deadman Switch Heartbeat**: The client must emit a cryptographic heartbeat every 10 seconds. If missing for $> 25$ seconds, the server marks the candidate as `DISCONNECTED_SUSPICIOUS` and notifies the proctor console. |
| **Window Defocus & Multi-Tasking** | Candidate attempts to switch to background apps via specialized mouse gestures or secondary devices. | **Native Win32 Focus Guard**: The WPF host captures `WM_ACTIVATEAPP`, `WM_KILLFOCUS`, and global cursor leave events. Any mouse movement outside the exam boundary triggers an immediate strike. |
| **Credential & Passcode Leaks** | Candidate gives their exam passcode and roll number to a surrogate test-taker in another location. | **Hardware-Bound Session Lock**: The candidate's first authentication binds their roll number to their physical CPU and motherboard serial numbers. Subsequent login attempts from any other hardware are blocked with a `403 Hardware Mismatch`. |

---

## 2. Real-Time Telemetry & Deadman Protocol

```
Candidate Machine (WPF Client)                  Supabase Realtime Channel                  Admin Live Console
             │                                             │                                       │
             ├────── Heartbeat Ping (every 10s) ──────────>│────── Broadcast Live Status ─────────>│
             │       { sessionId, status, strikes }        │                                       │
             │                                             │                                       │
             │ [Candidate attempts Alt+Tab or leaves frame]│                                       │
             ├────── VIOLATION SNAPSHOT (Webcam frame) ───>│────── INSTANT CRITICAL ALERT ────────>│
             │       Strike count increments (e.g. 1 -> 2) │       Audio ping + Visual Red Badge   │
             │                                             │                                       │
             │<───── PROCTOR OVERRIDE (e.g. CMD_PAUSE) ────│<───── Proctor clicks "Freeze Exam" ───┤
             │       Screen masks & timer halts            │                                       │
```

### Heartbeat Payload Specification:
```json
{
  "sessionId": "4f18d72e-...",
  "examId": "8b23c10a-...",
  "hardwareFingerprint": "e3b0c442...",
  "sequenceNumber": 142,
  "remainingSeconds": 4120,
  "clientTimestamp": "2026-10-27T15:05:30.124Z",
  "status": "ACTIVE",
  "strikesCount": 1
}
```

---

## 3. Candidate Test-Taking Engine (UI/UX & Engine Specs)

The test interface runs inside the hardened Microsoft WebView2 control, adhering strictly to the **Accessible Light Theme Design System**:

```
+----------------------------------------------------------------------------------------------------+
| SAFE EXAM PLATFORM | Course: MCA-301 Advanced Systems | Time Left: [ 01:24:15 ]     [SUBMIT EXAM] |
+----------------------------------------------------------------------------------------------------+
| SECTION TABS: [ Part A: Research Core (25 Qs) ] [ Part B: Computer Science (50 Qs) ]               |
+----------------------+-----------------------------------------------------------------------------+
| QUESTION MATRIX      | Question 14 of 75                     [Points: 2.0] [Negative: -0.50]       |
| [ 1][ 2][ 3][ 4][ 5] |-----------------------------------------------------------------------------|
| [ 6][ 7][ 8][ 9][10] | Which mechanism in the Windows kernel executes hardware interrupt dispatch?|
| [11][12][13][*14][15]|                                                                             |
| [16][17][18][19][20] | (○) A. Global Descriptor Table (GDT)                                        |
|                      | (●) B. Interrupt Descriptor Table (IDT)                          [Selected] |
| Legend:              | (○) C. Task State Segment (TSS)                                             |
| (*) Active           | (○) D. Page Fault Handler (PFH)                                             |
| (●) Answered (Green) |                                                                             |
| (▲) Flagged (Yellow) |                                                                             |
| ( ) Unvisited        |                                                                             |
|                      |                                                                             |
| Status:              |                                                                             |
| [● Saved Locally]    | [Mark for Review]                  [< Previous Question]  [Next Question >]|
+----------------------+-----------------------------------------------------------------------------+
```

### Essential Candidate Experience & Safety Guardrails:
1. **Uninterrupted Writing**: Keystrokes and MCQ option clicks are saved instantly to the local buffer. Even if the network drops, the candidate continues testing with zero lag or popups.
2. **Deterministic Shuffling**: Questions and options appear in an individualized random order, ensuring candidates sitting side-by-side cannot glance at neighboring monitors.
3. **Question Matrix Navigation**: Quick visual grid allows jumping to any question, filtering by `Answered`, `Unanswered`, and `Marked for Review`.
4. **Controlled Submission**: A 2-step confirmation modal displays an answer breakdown (e.g., *"You have answered 72 of 75 questions. 3 questions remain unvisited."*) before final lock-in.

---

## 4. Live Proctoring Console (Admin Portal Specs)

The **Live Proctoring Console** (`admin-web/src/app/proctor/[examId]`) empowers invigilators with real-time surveillance and remote enforcement.

### 4.1 Real-Time Candidate Surveillance Grid
- **Status Cards**:
  - `Green (Normal)`: Hardware healthy, active heartbeat, 0–1 strikes.
  - `Yellow (Flagged)`: 1–2 strikes registered (e.g. face looking away, minor hotkey attempt).
  - `Red (Locked Out)`: Candidate reached max strikes ($N \ge 3$). Exam screen on candidate machine is locked.
  - `Gray (Disconnected)`: Deadman switch triggered (no ping in $> 25$ seconds).

### 4.2 Proctor Override Commands (Broadcast over Realtime)
- **Broadcast Warning**: Sends an on-screen alert banner directly over the student's exam interface (e.g., *"Candidate 042: Please look straight at the webcam"*).
- **Pause / Freeze Exam**: Instantly masks the student's exam screen with a *"Session Paused by Invigilator"* overlay and freezes their countdown clock.
- **Resume Exam**: Unfreezes the timer and restores the question paper.
- **Add Extra Time**: Dynamically extends the student's timer by $+5$, $+10$, or $+15$ minutes for technical hiccups.
- **Remote Unlock**: Clears the lockout state for a student who reached max strikes, resetting their strike counter and letting them resume.
- **Force-Submit & Disqualify**: Instantly terminates the session, captures current answers, and locks the client app.

### 4.3 Snapshot Evidence Viewer
- Clicking on any candidate card opens their **Audit Trail Drawer**:
  - Exact timestamps of all events (heartbeats, answer syncs, focus lost).
  - High-resolution webcam frames captured automatically at the exact second a violation occurred.
  - Diagnostic metadata (process name killed, key combination pressed, face tracking status).

