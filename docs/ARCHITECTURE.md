# Technical Architecture Specification

## 1. Executive Overview

The **Safe Exam Platform** is a dual-tier academic examination system built for high-stakes institutional assessments. It combines:
1. An **OS-level Lockdown Client** running on Windows candidates' machines.
2. A **Web-based Management & Realtime Proctoring Portal** accessible to academic faculty and invigilators.

---

## 2. High-Level Component Topology

```
+-----------------------------------------------------------------------------------+
|                            CANDIDATE WINDOWS CLIENT                               |
|                                                                                   |
|  +-----------------------------------------------------------------------------+  |
|  | C# .NET 8 WPF Security Host                                                 |  |
|  |                                                                             |  |
|  |  +--------------------+  +----------------------+  +---------------------+  |  |
|  |  | Low-Level Win32    |  | SetWindowDisplay     |  | Process Watchdog &  |  |  |
|  |  | Keyboard Hook      |  | Affinity             |  | VM Detector         |  |  |
|  |  +--------------------+  +----------------------+  +---------------------+  |  |
|  |                                                                             |  |
|  |  +--------------------+  +----------------------+  +---------------------+  |  |
|  |  | On-Device ONNX     |  | Offline Resilient    |  | Host-to-Web Bridge  |  |  |
|  |  | Vision Tracker     |  | SQLite Buffer        |  | (WebView2 RPC)      |  |  |
|  |  +--------------------+  +----------------------+  +---------------------+  |  |
|  |                                                                             |  |
|  |  +-----------------------------------------------------------------------+  |  |
|  |  | Microsoft WebView2 (Chromium Engine)                                  |  |  |
|  |  | - Student Test Interface (Questions, Rich Essay Editor)              |  |  |
|  |  | - Strict Light Theme (WCAG 2.1 AA Compliant)                          |  |  |
|  |  | - DevTools, Zoom, and Context Menus Disabled                          |  |  |
|  |  +-----------------------------------------------------------------------+  |  |
|  +-----------------------------------------------------------------------------+  |
+------------------------------------------+----------------------------------------+
                                           | HTTPS / WSS
                                           v
+-----------------------------------------------------------------------------------+
|                           NEXT.JS API & APPLICATION SERVICE                       |
|                                                                                   |
|  +-----------------------+  +-----------------------+  +-----------------------+  |
|  | /api/exam/auth        |  | /api/exam/sync        |  | /api/telemetry        |  |
|  | - Hardware verification|  | - Batched answer save |  | - Snapshot upload     |  |
|  | - Session JWT issuance|  | - Local tamper check  |  | - Strike increment    |  |
|  +-----------------------+  +-----------------------+  +-----------------------+  |
|                                                                                   |
|  +-----------------------------------------------------------------------------+  |
|  | Next.js App Router Web Portal (Faculty & Admin)                             |  |
|  | - Exam Authoring Studio (MCQs, negative marks, rubric definition)           |  |
|  | - Live Proctoring Console (Realtime candidate status grid)                  |  |
|  | - Bi-directional Command Dispatcher (Pause, Resume, Warn, Time, Unlock)     |  |
|  | - Subjective Evaluation Studio (Blind evaluation, rubric grading)           |  |
|  +-----------------------------------------------------------------------------+  |
+------------------------------------------+----------------------------------------+
                                           |
                                           v
+-----------------------------------------------------------------------------------+
|                                 SUPABASE CLOUD                                    |
|                                                                                   |
|  +-----------------------+  +-----------------------+  +-----------------------+  |
|  | PostgreSQL Database   |  | Supabase Realtime     |  | Supabase Storage      |  |
|  | - Relational integrity|  | - WebSocket broadcast |  | - Violation snapshots |  |
|  | - RLS security        |  | - Instant alert push  |  | - Pre-signed URLs     |  |
|  +-----------------------+  +-----------------------+  +-----------------------+  |
+-----------------------------------------------------------------------------------+
```

---

## 3. Communication & Data Flow

### 3.1 Exam Authentication & Initialization
1. **Passcode & Roll Entry**: Candidate opens the standalone desktop executable and inputs their **Student Roll Number** and **Exam Passcode**.
2. **Hardware Fingerprint Generation**: The client generates a SHA-256 fingerprint from:
   - CPU Processor ID
   - Motherboard Serial Number
   - Primary Disk Drive UUID
3. **Session Verification**: The client posts to `/api/exam/auth`.
   - The backend confirms the exam window is active.
   - Verifies whether an existing session is registered under a different hardware fingerprint (preventing credential sharing).
   - Generates an encrypted session token with a 5-minute renewal sliding window.
4. **Manifest Delivery**: The server returns the sanitized exam manifest:
   - Questions (MCQ options randomized if configured).
   - Correct answers and rubrics are **never** transmitted to the client.
   - Time limits, warning thresholds, and blackout rules.

---

### 3.2 Real-time Bi-directional Proctoring
- The Windows client connects to the Supabase Realtime channel `exam-telemetry:{exam_id}`.
- Every 10 seconds, the client sends a lightweight heartbeat `{ sessionId, status: "ACTIVE", lastHeartbeat: timestamp }`.
- When an administrator performs an action in the Live Proctoring Console, a broadcast event is emitted:
  - `CMD_WARN`: Triggers an on-screen modal alert on the candidate's monitor.
  - `CMD_PAUSE`: Blurs the exam content, halts local timer, and displays *"Exam Paused by Proctor"*.
  - `CMD_RESUME`: Re-enables the exam interface.
  - `CMD_ADD_TIME`: Adds $+N$ minutes to the candidate's remaining duration.
  - `CMD_UNLOCK`: Clears the lockout state if the candidate reached max strikes.
  - `CMD_TERMINATE`: Force-submits current answers and terminates the application.

---

### 3.3 Offline Resilience & Auto-Sync
In institutional test centers, Wi-Fi or LAN drops can happen. The platform guarantees **zero lost answers**:
1. When a candidate selects an MCQ or types a character into an essay box:
   - The answer is written to an encrypted in-memory and local SQLite queue.
   - The local queue is stamped with a monotonic timestamp.
2. A background worker attempts to flush pending answers to `/api/exam/sync` every 4 seconds.
3. If an HTTP 5xx error or connection timeout occurs:
   - The interface remains interactive; the candidate continues writing.
   - A subtle status pill changes from `All answers saved` (Green) to `Buffering locally` (Amber).
   - The worker uses exponential backoff to retry syncing.
   - Once connection returns, all buffered changes are sent in an ordered batch.

---

### 3.4 On-Device Vision & Snapshot Telemetry
To prevent high cloud bandwidth consumption:
- The Windows client uses `Microsoft.ML.OnnxRuntime` with an ultra-lightweight face detector (UltraFace / YuNet).
- Frame inference runs locally on the webcam feed at 1.5-second intervals.
- **Violation Triggers**:
  - `NO_FACE_DETECTED`: Candidate left the camera's field of view for $> 3$ consecutive checks.
  - `MULTIPLE_FACES_DETECTED`: More than one face detected in the frame.
  - `SUSPICIOUS_WINDOW_SWITCH`: Candidate attempted a key combination to switch focus.
- When a violation is flagged:
  1. The frame is compressed to JPEG (max 150 KB).
  2. The client uploads the snapshot to Supabase Storage bucket `exam-violations/{exam_id}/{session_id}/{timestamp}.jpg`.
  3. A violation record is written to `/api/telemetry/violation`.
  4. The candidate's strike counter increases. If strikes exceed `max_strikes`, the client activates the full-screen lockout banner.

