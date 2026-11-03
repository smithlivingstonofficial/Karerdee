---
name: exam-platform-backend
description: Use this skill when building or testing Next.js API route handlers, Supabase database queries, Realtime broadcast channels, session token issuance, and auto-grading logic for the Safe Exam Platform.
---

# Exam Platform Backend & Realtime Architecture Guide

This skill provides step-by-step procedures for implementing and maintaining the backend API layer and Supabase integration in `admin-web/`.

---

## 1. Candidate Authentication & Token Issuance (`/api/exam/auth`)

### Flow Requirements:
1. Candidate client submits `{ rollNumber, examPasscode, hardwareFingerprint }`.
2. Verify exam is in `ACTIVE` or `SCHEDULED` status and current UTC time falls between `start_time` and `end_time`.
3. Check `exam_sessions` for an existing entry:
   - If session exists: ensure `hardware_fingerprint` matches (prevents session hijacking / multi-device login).
   - If no session exists: create new session record with status `IN_PROGRESS`.
4. Return:
   - `sessionToken`: Signed JWT containing `{ sessionId, examId, rollNumber, exp }`.
   - `manifest`: Questions with correct answers and rubrics strictly removed.

```typescript
// Example Next.js Route Handler pattern
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import jwt from "jsonwebtoken";

export async function POST(req: NextRequest) {
  const { rollNumber, examPasscode, hardwareFingerprint } = await req.json();

  // 1. Fetch exam
  const { data: exam, error } = await supabaseAdmin
    .from("exams")
    .select("*, exam_questions(*, question_options(id, option_text, order_index))")
    .eq("passcode", examPasscode)
    .single();

  if (error || !exam) {
    return NextResponse.json({ error: "Invalid Exam Passcode" }, { status: 401 });
  }

  // 2. Fetch or create session
  // ... verify hardware fingerprint ...

  // 3. Strip correct answers from questions
  const sanitizedQuestions = exam.exam_questions.map((q) => ({
    id: q.id,
    type: q.question_type,
    prompt: q.prompt,
    code_snippet: q.code_snippet,
    points: q.points,
    min_words: q.min_words,
    max_words: q.max_words,
    options: q.question_options?.sort((a, b) => a.order_index - b.order_index),
  }));

  // 4. Issue session token
  const token = jwt.sign(
    { sessionId: session.id, examId: exam.id, roll: rollNumber },
    process.env.EXAM_JWT_SECRET!,
    { expiresIn: "4h" }
  );

  return NextResponse.json({
    token,
    durationMinutes: exam.duration_minutes,
    maxStrikes: exam.max_strikes,
    questions: sanitizedQuestions,
  });
}
```

---

## 2. Supabase Realtime Bi-directional Proctoring

### Proctor Command Dispatch
When an administrator clicks an action in the Live Proctoring Console, broadcast to the channel:

```typescript
import { supabaseClient } from "@/lib/supabase/client";

export async function sendProctorCommand(examId: string, command: {
  type: "CMD_WARN" | "CMD_PAUSE" | "CMD_RESUME" | "CMD_ADD_TIME" | "CMD_UNLOCK" | "CMD_TERMINATE";
  targetSessionId: string; // Specific candidate or "*" for all
  payload?: any;
}) {
  const channel = supabaseClient.channel(`exam-telemetry:${examId}`);
  await channel.send({
    type: "broadcast",
    event: "proctor_override",
    payload: command,
  });
}
```

### Candidate Client Listener (C# or WebView2)
The candidate client subscribes to `exam-telemetry:{examId}` and filters messages where `targetSessionId == currentSessionId || targetSessionId == "*"`.

---

## 3. Auto-Grading Engine for MCQs

When a candidate submits or an exam ends, execute automated scoring:

```typescript
export function calculateMcqScore(
  question: { points: number; negative_points: number },
  correctOptionIds: string[],
  selectedOptionIds: string[]
): number {
  if (selectedOptionIds.length === 0) return 0;

  const isExactMatch =
    correctOptionIds.length === selectedOptionIds.length &&
    correctOptionIds.every((id) => selectedOptionIds.includes(id));

  if (isExactMatch) {
    return question.points;
  } else {
    return -Math.abs(question.negative_points || 0);
  }
}
```

