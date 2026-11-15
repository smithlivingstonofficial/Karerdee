const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const jwt = require('./admin-web/node_modules/jsonwebtoken');

// Load env
const envPath = path.join(__dirname, 'admin-web', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split(/\r?\n/).forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let val = match[2] || '';
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    env[match[1]] = val;
  }
});

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const JWT_SECRET = env.EXAM_JWT_SECRET || 'safe_exam_development_jwt_secret_key_minimum_32_characters_long';
const PORT = 3005;

const headers = {
  apikey: SUPABASE_SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
  'Content-Type': 'application/json',
  Prefer: 'return=representation'
};

async function waitForServer(url, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(2000) });
      if (res.status < 500) return true;
    } catch {}
    await new Promise(r => setTimeout(r, 800));
  }
  return false;
}

async function runTests() {
  console.log('=== TEST SUITE: EXAM ENVIRONMENT LOCKDOWN & AUTO-SUBMIT ===\n');

  // 1. Start local Next dev server on port 3005
  console.log(`Starting Next.js test server on port ${PORT}...`);
  const serverProc = spawn('node', [
    path.join(__dirname, 'admin-web/node_modules/next/dist/bin/next'),
    'dev',
    path.join(__dirname, 'admin-web'),
    '-p',
    String(PORT)
  ], {
    stdio: 'pipe',
    env: { ...process.env, PORT: String(PORT) }
  });

  serverProc.stdout.on('data', d => {
    const s = d.toString();
    if (s.includes('Ready') || s.includes('Local:')) {
      console.log('  [Server]', s.trim());
    }
  });

  let passed = 0;
  let failed = 0;

  function assert(condition, desc) {
    if (condition) {
      console.log(`[PASS] ${desc}`);
      passed++;
    } else {
      console.error(`[FAIL] ${desc}`);
      failed++;
    }
  }

  let createdStudentId = null;
  let createdSession1Id = null;

  try {
    const isReady = await waitForServer(`http://localhost:${PORT}`);
    assert(isReady, `Next.js test server responded on http://localhost:${PORT}`);
    if (!isReady) throw new Error('Server failed to start');

    // 2. Fetch an existing exam
    const examsRes = await fetch(`${SUPABASE_URL}/rest/v1/exams?select=id,title,start_time,end_time,duration_minutes&limit=1`, { headers });
    const exams = await examsRes.json();
    const testExam = exams[0];
    assert(testExam && testExam.id, `Found test exam: ${testExam?.title}`);

    // Fetch department
    const deptsRes = await fetch(`${SUPABASE_URL}/rest/v1/departments?select=id,code&limit=1`, { headers });
    const depts = await deptsRes.json();
    const testDept = depts[0];
    assert(testDept && testDept.id, `Found test department: ${testDept?.code}`);

    // Fetch questions for this exam
    const qRes = await fetch(`${SUPABASE_URL}/rest/v1/exam_questions?select=id,prompt,points,options:question_options(id,is_correct)&exam_id=eq.${testExam.id}&limit=2`, { headers });
    const questions = await qRes.json();
    assert(questions.length >= 2, `Retrieved ${questions.length} questions for exam`);

    // 3. Create a unique test student
    const uniqueSuffix = Date.now().toString().slice(-6);
    const studentRes = await fetch(`${SUPABASE_URL}/rest/v1/students`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        full_name: `Security Candidate ${uniqueSuffix}`,
        email: `candidate_${uniqueSuffix}@klu.ac.in`,
        roll_number: `LOCK${uniqueSuffix}`,
        application_number: `2026LK${uniqueSuffix}`,
        department_id: testDept.id,
        is_active: true
      })
    });
    const studentData = await studentRes.json();
    const testStudent = studentData[0];
    createdStudentId = testStudent.id;
    assert(testStudent && testStudent.id, `Created test student: ${testStudent.full_name} (${testStudent.roll_number})`);

    // 4. Create Exam Session 1 (for forceful exit auto-submit)
    const session1Res = await fetch(`${SUPABASE_URL}/rest/v1/exam_sessions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        exam_id: testExam.id,
        student_id: testStudent.id,
        hardware_fingerprint: 'TEST-BROWSER-WATCHDOG-001',
        client_version: '1.0.0-web',
        status: 'IN_PROGRESS',
        strikes_count: 0
      })
    });
    const session1Data = await session1Res.json();
    const testSession1 = session1Data[0];
    createdSession1Id = testSession1.id;
    assert(testSession1 && testSession1.id, `Created test exam session: ${testSession1.id}`);

    // Generate JWT token
    const token1 = jwt.sign(
      {
        sessionId: testSession1.id,
        examId: testExam.id,
        studentId: testStudent.id,
        rollNumber: testStudent.roll_number,
        hardwareFingerprint: 'TEST-BROWSER-WATCHDOG-001',
      },
      JWT_SECRET,
      { expiresIn: '2h' }
    );

    // 5. TEST: Beacon / Forceful Exit Auto-Submission Payload (NO Authorization Header)
    console.log('\n--- Test 5: Beacon / Forceful Exit Auto-Submission (No Auth Header, token in body) ---');
    const q1 = questions[0];
    const correctOpt1 = q1.options.find(o => o.is_correct) || q1.options[0];
    const answersPayload = [
      {
        questionId: q1.id,
        selectedOptionIds: [correctOpt1.id]
      }
    ];

    const beaconSubmitRes = await fetch(`http://localhost:${PORT}/api/exam/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
        // NO Authorization header - simulates navigator.sendBeacon!
      },
      body: JSON.stringify({
        sessionId: testSession1.id,
        token: token1,
        answers: answersPayload,
        submissionReason: 'FORCE_EXIT'
      })
    });

    const beaconData = await beaconSubmitRes.json();
    assert(beaconSubmitRes.status === 200, `Beacon submit endpoint HTTP 200 (Got ${beaconSubmitRes.status})`);
    assert(beaconData.success === true, `Submission result success: ${beaconData.success}`);
    assert(beaconData.referenceCode && beaconData.referenceCode.startsWith('KARE-SUB-'), `Submission reference code generated: ${beaconData.referenceCode}`);

    // 6. Verify Session in DB is marked SUBMITTED and score recorded
    const checkSessionRes = await fetch(`${SUPABASE_URL}/rest/v1/exam_sessions?id=eq.${testSession1.id}&select=id,status,auto_score,submitted_at`, { headers });
    const checkSession = (await checkSessionRes.json())[0];
    assert(checkSession.status === 'SUBMITTED', `Session status in DB is correctly finalized as SUBMITTED (Got ${checkSession.status})`);
    assert(checkSession.submitted_at !== null, `Session submitted_at timestamp is populated: ${checkSession.submitted_at}`);

    // 7. Verify Forensic Violation record for Forceful Exit
    const violationRes = await fetch(`${SUPABASE_URL}/rest/v1/violation_logs?session_id=eq.${testSession1.id}&select=id,violation_type,metadata`, { headers });
    const violations = await violationRes.json();
    const exitViolation = Array.isArray(violations)
      ? violations.find(v => v.violation_type === 'WINDOW_UNFOCUSED' && v.metadata?.incident === 'FORCEFUL_EXIT_AUTO_SUBMIT')
      : null;
    assert(Boolean(exitViolation), `Forensic violation record logged for FORCEFUL_EXIT_AUTO_SUBMIT in violation_logs`);

    const proctorAction1Res = await fetch(`${SUPABASE_URL}/rest/v1/proctor_actions?session_id=eq.${testSession1.id}&select=id,action_type,reason`, { headers });
    const proctorActions1 = await proctorAction1Res.json();
    const exitAction = Array.isArray(proctorActions1)
      ? proctorActions1.find(a => a.action_type === 'FORCE_SUBMIT')
      : null;
    assert(Boolean(exitAction), `Proctor action record logged for FORCE_SUBMIT upon window exit attempt`);

    // 8. TEST: Idempotent Submission (Handling already submitted sessions smoothly)
    console.log('\n--- Test 8: Idempotent Submission Handling ---');
    const retrySubmitRes = await fetch(`http://localhost:${PORT}/api/exam/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token1}`
      },
      body: JSON.stringify({
        sessionId: testSession1.id,
        token: token1,
        answers: answersPayload,
        submissionReason: 'NORMAL'
      })
    });
    const retryData = await retrySubmitRes.json();
    assert(retrySubmitRes.status === 200, `Retry submission returns HTTP 200 instead of error (Got ${retrySubmitRes.status})`);
    assert(retryData.alreadySubmitted === true, `Retry response acknowledges alreadySubmitted: ${retryData.alreadySubmitted}`);
    assert(retryData.referenceCode === beaconData.referenceCode, `Reference code remains identical on idempotent call: ${retryData.referenceCode}`);

    // 9. TEST: Schedule Expiration Auto-Conclude Session
    console.log('\n--- Test 9: Schedule Expiration Auto-Conclude Session ---');
    const student2Res = await fetch(`${SUPABASE_URL}/rest/v1/students`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        full_name: `Expiry Candidate ${uniqueSuffix}`,
        email: `expiry_${uniqueSuffix}@klu.ac.in`,
        roll_number: `EXP${uniqueSuffix}`,
        application_number: `2026EX${uniqueSuffix}`,
        department_id: testDept.id,
        is_active: true
      })
    });
    const student2Data = await student2Res.json();
    const testStudent2 = student2Data[0];
    const createdStudent2Id = testStudent2.id;

    const session2Res = await fetch(`${SUPABASE_URL}/rest/v1/exam_sessions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        exam_id: testExam.id,
        student_id: testStudent2.id,
        hardware_fingerprint: 'TEST-SCHEDULE-EXPIRED-002',
        client_version: '1.0.0-web',
        status: 'IN_PROGRESS',
        strikes_count: 0
      })
    });
    const testSession2 = (await session2Res.json())[0];
    const createdSession2Id = testSession2.id;

    const token2 = jwt.sign(
      {
        sessionId: testSession2.id,
        examId: testExam.id,
        studentId: testStudent2.id,
        rollNumber: testStudent2.roll_number,
        hardwareFingerprint: 'TEST-SCHEDULE-EXPIRED-002',
      },
      JWT_SECRET,
      { expiresIn: '2h' }
    );

    const schedSubmitRes = await fetch(`http://localhost:${PORT}/api/exam/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token2}`
      },
      body: JSON.stringify({
        sessionId: testSession2.id,
        token: token2,
        answers: answersPayload,
        submissionReason: 'SCHEDULE_EXPIRED'
      })
    });
    const schedData = await schedSubmitRes.json();
    assert(schedSubmitRes.status === 200, `Schedule expired auto-submit HTTP 200`);
    assert(schedData.success === true, `Schedule expired auto-submit success: ${schedData.success}`);

    const schedActionRes = await fetch(`${SUPABASE_URL}/rest/v1/proctor_actions?session_id=eq.${testSession2.id}&select=id,action_type,reason`, { headers });
    const schedActions = await schedActionRes.json();
    const schedAction = Array.isArray(schedActions) ? schedActions.find(a => a.action_type === 'FORCE_SUBMIT') : null;
    assert(Boolean(schedAction), `Proctor action record logged for FORCE_SUBMIT upon schedule duration expiry`);

    // Clean up student 2
    await fetch(`${SUPABASE_URL}/rest/v1/submissions?session_id=eq.${testSession2.id}`, { method: 'DELETE', headers });
    await fetch(`${SUPABASE_URL}/rest/v1/violation_logs?session_id=eq.${testSession2.id}`, { method: 'DELETE', headers });
    await fetch(`${SUPABASE_URL}/rest/v1/proctor_actions?session_id=eq.${testSession2.id}`, { method: 'DELETE', headers });
    await fetch(`${SUPABASE_URL}/rest/v1/exam_sessions?id=eq.${testSession2.id}`, { method: 'DELETE', headers });
    await fetch(`${SUPABASE_URL}/rest/v1/students?id=eq.${createdStudent2Id}`, { method: 'DELETE', headers });

  } catch (err) {
    console.error('Test execution error:', err);
    failed++;
  } finally {
    // Clean up records
    console.log('\n--- Cleaning up test records ---');
    if (createdSession1Id) {
      await fetch(`${SUPABASE_URL}/rest/v1/submissions?session_id=eq.${createdSession1Id}`, { method: 'DELETE', headers });
      await fetch(`${SUPABASE_URL}/rest/v1/violation_logs?session_id=eq.${createdSession1Id}`, { method: 'DELETE', headers });
      await fetch(`${SUPABASE_URL}/rest/v1/proctor_actions?session_id=eq.${createdSession1Id}`, { method: 'DELETE', headers });
      await fetch(`${SUPABASE_URL}/rest/v1/exam_sessions?id=eq.${createdSession1Id}`, { method: 'DELETE', headers });
    }
    if (createdStudentId) {
      await fetch(`${SUPABASE_URL}/rest/v1/students?id=eq.${createdStudentId}`, { method: 'DELETE', headers });
    }
    console.log('Cleanup complete.');

    // Stop server
    console.log('Stopping test server...');
    serverProc.kill();
  }

  console.log(`\n========================================`);
  console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log(`========================================\n`);

  if (failed > 0) process.exit(1);
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
