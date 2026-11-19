"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { formatTime, formatDateTime } from "@/lib/date";
import { supabaseClient } from "@/lib/supabase/client";
import { isBogusDepartmentSnippet } from "@/lib/snippets";
import {
  Clock,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Flag,
  Calculator,
  FileEdit,
  ArrowLeft,
  ArrowRight,
  ShieldAlert,
  Bell,
  Send,
  Loader2,
  RotateCcw,
  BookOpen,
  Layers,
  ChevronRight,
  ShieldCheck,
  Check,
  Building2,
  KeyRound,
  X,
  Wifi,
  WifiOff,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Camera,
  CameraOff,
  AlertOctagon,
  Maximize2,
  Minimize2,
  Printer,
  AlertTriangle,
  MonitorCheck,
  Globe,
  RefreshCw,
  MessageSquare,
  MessageCircle,
  Radio,
  Unlock,
  UserCheck,
  User,
  Sparkles,
} from "lucide-react";
import { MathText } from "@/components/MathText";

interface OptionItem {
  id: string;
  text: string;
}

interface QuestionItem {
  id: string;
  sectionId: string;
  questionType: "MCQ_SINGLE" | "MCQ_MULTIPLE";
  prompt: string;
  codeSnippet?: string;
  points: number;
  negativePoints: number;
  orderIndex: number;
  options: OptionItem[];
}

interface SectionItem {
  id: string;
  title: string;
  is_common: boolean;
  target_departments?: string[];
  order_index?: number;
}

interface CandidateData {
  id?: string;
  rollNumber: string;
  applicationNumber?: string;
  email?: string;
  fullName: string;
  department: string;
}

interface ExamData {
  id: string;
  title: string;
  instructions?: string;
  durationMinutes: number;
  maxStrikes: number;
  currentStrikes: number;
  enableNegativeMarking: boolean;
  calculatorMode?: "NONE" | "BASIC" | "SCIENTIFIC";
  enableScratchpad?: boolean;
  enableQuestionFlagging?: boolean;
  strikeAction?: string;
  lockdownPolicy?: {
    blockKeyboardHooks?: boolean;
    blockDisplayAffinity?: boolean;
    blockMultipleMonitors?: boolean;
    blockVirtualMachines?: boolean;
    blockBlacklistedProcesses?: boolean;
    lockHardwareFingerprint?: boolean;
  };
  serverTime?: string;
  serverEpochMs?: number;
  startTime?: string;
  endTime?: string;
  remainingSeconds?: number;
  sections: SectionItem[];
  questions: QuestionItem[];
}

export default function CandidateExamSittingPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 flex items-center justify-center text-xs font-semibold text-slate-500">
          <Loader2 className="w-5 h-5 mr-2 animate-spin text-blue-700" />
          Initializing Secure Examination Environment...
        </div>
      }
    >
      <CandidateSittingContent />
    </Suspense>
  );
}

function CandidateSittingContent() {
  const searchParams = useSearchParams();

  // Lifecycle States: Candidate Pre-Waiting Area is the default entry lobby
  const [stage, setStage] = useState<"WAITING_ROOM" | "INSTRUCTIONS" | "ACTIVE_EXAM" | "SUBMITTED">("WAITING_ROOM");
  const [token, setToken] = useState<string>("");
  const [sessionId, setSessionId] = useState<string>("");
  const [candidate, setCandidate] = useState<CandidateData | null>(null);
  const [exam, setExam] = useState<ExamData | null>(null);

  // Candidate Authentication Form State
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginPasscode, setLoginPasscode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Waiting Room (Pre-Exam Lobby & Scheduled Auto-Commencement)
  const [waitingRoomData, setWaitingRoomData] = useState<{
    candidate: {
      id?: string;
      fullName: string;
      email: string;
      rollNumber?: string;
      applicationNumber?: string;
      department?: { name?: string; code?: string };
    };
    exam: {
      id: string;
      title: string;
      durationMinutes?: number;
      startTime: string;
      startTimeIST?: string;
      endTime: string;
      endTimeIST?: string;
      totalQuestions?: number;
    };
    startTimeEpochMs: number;
  } | null>(null);
  const [storedAuthCredentials, setStoredAuthCredentials] = useState<{
    email: string;
    password: string;
    passcode: string;
    ticket?: string;
  } | null>(null);
  const [waitingCountdown, setWaitingCountdown] = useState<number>(0);
  const [isAdmittingAuto, setIsAdmittingAuto] = useState<boolean>(false);
  const isAdmittingAutoRef = useRef<boolean>(false);
  const [admissionStatus, setAdmissionStatus] = useState<
    "IDLE" | "ADMITTING" | "FAILED" | "CONCLUDED" | "ACCESS_DENIED"
  >("IDLE");
  const admissionStatusRef = useRef<
    "IDLE" | "ADMITTING" | "FAILED" | "CONCLUDED" | "ACCESS_DENIED"
  >("IDLE");
  const hasTriggeredAdmissionAtZeroRef = useRef<boolean>(false);
  const admissionRetryCountRef = useRef<number>(0);

  // Active Exam State
  const [activeSectionId, setActiveSectionId] = useState<string>("");
  const [activeQuestionIndex, setActiveQuestionIndex] = useState<number>(0);
  const [answers, setAnswers] = useState<Record<string, string[]>>({}); // questionId -> optionIds
  const [flaggedQuestions, setFlaggedQuestions] = useState<Set<string>>(new Set());
  const [secondsRemaining, setSecondsRemaining] = useState<number>(90 * 60);
  const [clockSkewMs, setClockSkewMs] = useState<number>(0);
  const [examEndTime, setExamEndTime] = useState<string | null>(null);
  const [currentServerIST, setCurrentServerIST] = useState<string>("");
  const [liveEntranceIST, setLiveEntranceIST] = useState<string>("");
  const [lateEntryNotice, setLateEntryNotice] = useState<{
    delayMinutes: number;
    graceCutoff: string;
    pendingProctorApproval: boolean;
  } | null>(null);
  const [strikes, setStrikes] = useState<number>(0);
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSyncedTime, setLastSyncedTime] = useState<string>("Just now");
  const [isWorkstationLocked, setIsWorkstationLocked] = useState(false);
  const [lockoutReason, setLockoutReason] = useState("");

  // In-Exam Digital Aids Modals
  const [isCalculatorOpen, setIsCalculatorOpen] = useState(false);
  const [calcInput, setCalcInput] = useState("");
  const [calcResult, setCalcResult] = useState("");
  const [isScratchpadOpen, setIsScratchpadOpen] = useState(false);
  const [scratchpadText, setScratchpadText] = useState("");

  // Candidate Helpdesk & Invigilator Contact States
  const [isHelpdeskOpen, setIsHelpdeskOpen] = useState(false);
  const [helpdeskMessages, setHelpdeskMessages] = useState<{
    id: string;
    sender: "CANDIDATE" | "PROCTOR";
    message: string;
    category?: string;
    questionNumber?: number | null;
    createdAt: string;
  }[]>([]);
  const [helpdeskCategory, setHelpdeskCategory] = useState<
    "QUESTION_DOUBT" | "TECH_ISSUE" | "SUBMISSION_ISSUE" | "GENERAL_DOUBT" | "LOCKOUT_APPEAL"
  >("QUESTION_DOUBT");
  const [helpdeskQuestionNumber, setHelpdeskQuestionNumber] = useState<number | null>(null);
  const [helpdeskMessage, setHelpdeskMessage] = useState("");
  const [isSendingInquiry, setIsSendingInquiry] = useState(false);
  const [inquiryNotice, setInquiryNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [unreadProctorReplies, setUnreadProctorReplies] = useState(0);
  const [proctorReplyToast, setProctorReplyToast] = useState<{ message: string; timestamp: string } | null>(null);
  const [isSendingLockoutAppeal, setIsSendingLockoutAppeal] = useState<boolean>(false);
  const [lockoutAppealSent, setLockoutAppealSent] = useState<boolean>(false);

  // Submission Flow & Watchdog States
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionReceipt, setSubmissionReceipt] = useState<any>(null);
  const [submissionReason, setSubmissionReason] = useState<string>("NORMAL");
  const [navLockWarning, setNavLockWarning] = useState<string | null>(null);
  const [autoConcludeNotice, setAutoConcludeNotice] = useState<string | null>(null);

  // Synchronous State Reference Mirrors (for reliable execution inside popstate/beforeunload/pagehide)
  const hasSubmittedRef = useRef<boolean>(false);
  const stageRef = useRef<typeof stage>(stage);
  const tokenRef = useRef<string>(token);
  const sessionIdRef = useRef<string>(sessionId);
  const answersRef = useRef<Record<string, string[]>>(answers);

  useEffect(() => {
    stageRef.current = stage;
  }, [stage]);
  useEffect(() => {
    tokenRef.current = token;
  }, [token]);
  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);
  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);
  useEffect(() => {
    if (!isWorkstationLocked) {
      setLockoutAppealSent(false);
    }
  }, [isWorkstationLocked]);

  // Instructions Agreement & Pre-Flight Diagnostics
  const [hasAgreedRules, setHasAgreedRules] = useState(false);

  // Compensatory Extra Time Banner State
  const prevExtraTimeRef = useRef<number>(0);
  const [extraTimeNotice, setExtraTimeNotice] = useState<string | null>(null);

  // Proctor Live Warning & Announcement Overlays
  const [proctorWarningMessage, setProctorWarningMessage] = useState<string | null>(null);
  const [proctorAnnouncement, setProctorAnnouncement] = useState<string | null>(null);

  // Fullscreen Watchdog States
  const [isFullscreenExited, setIsFullscreenExited] = useState(false);
  const [fullscreenGraceCountdown, setFullscreenGraceCountdown] = useState(15);
  const fullscreenTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Upcoming Exam Info for Pre-Exam Candidate Waiting Awareness
  const [upcomingExamInfo, setUpcomingExamInfo] = useState<any>(null);

  // Webcam & Security Watchdog States (Zero-Lag Background Camera + Watermark Engine)
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const instructionsVideoRef = useRef<HTMLVideoElement | null>(null);
  const waitingRoomVideoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [cameraDeviceLabel, setCameraDeviceLabel] = useState<string>("Integrated Webcam");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isCameraPreviewOpen, setIsCameraPreviewOpen] = useState<boolean>(false);
  const [faceWarningCountdown, setFaceWarningCountdown] = useState<number | null>(null);
  const faceMissingTicksRef = useRef<number>(0);
  const lastViolationTimeRef = useRef<number>(0);

  // Initialize Secure Background Webcam (Pre-Exam Diagnostics & Active Exam)
  async function initializeSecureCamera() {
    if (typeof window === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      console.warn("MediaDevices API not supported in this browser environment.");
      return;
    }

    try {
      // 1. Anti-Virtual Camera Check: Detect OBS, vMix, ManyCam, DroidCam, etc.
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = devices.filter((d) => d.kind === "videoinput");
        const virtualPattern = /obs|vmix|manycam|fake|splitcam|droidcam|iriun|snap camera|virtual/i;
        const suspiciousCam = videoInputs.find((d) => virtualPattern.test(d.label));
        if (suspiciousCam) {
          console.warn("Virtual camera driver identified:", suspiciousCam.label);
          reportSecurityViolation(
            "VIRTUAL_CAMERA_DRIVER",
            `Candidate running virtual camera driver: ${suspiciousCam.label}`
          );
        }
        if (videoInputs.length > 0 && videoInputs[0].label) {
          setCameraDeviceLabel(videoInputs[0].label);
        }
      } catch (enumErr) {
        console.warn("Device enumeration notice:", enumErr);
      }

      // 2. Request lightweight 640x480 @ 15fps video stream (ultra-low CPU/RAM footprint)
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 15, max: 20 },
        },
        audio: false,
      });

      streamRef.current = stream;

      // Attach stream to background capture element
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }

      // Attach stream to instructions diagnostics preview element
      if (instructionsVideoRef.current) {
        instructionsVideoRef.current.srcObject = stream;
        await instructionsVideoRef.current.play().catch(() => {});
      }

      // Attach stream to waiting room diagnostics preview element
      if (waitingRoomVideoRef.current) {
        waitingRoomVideoRef.current.srcObject = stream;
        await waitingRoomVideoRef.current.play().catch(() => {});
      }

      // Add hardware disconnect and stream mute watchdog listeners
      stream.getVideoTracks().forEach((track) => {
        track.onended = () => {
          setIsCameraActive(false);
          reportSecurityViolation(
            "CAMERA_HARDWARE_DISCONNECTED",
            "Webcam hardware was disconnected or disabled during active examination"
          );
        };
        track.onmute = () => {
          reportSecurityViolation(
            "CAMERA_STREAM_MUTED",
            "Webcam video stream muted or hardware privacy shutter closed"
          );
        };
      });

      setIsCameraActive(true);
      setCameraError(null);
    } catch (err: any) {
      console.warn("Webcam access error:", err);
      setCameraError(
        err.name === "NotAllowedError"
          ? "Camera permission denied by browser. Please allow camera access in your URL bar."
          : "Webcam initialization failed. Please verify your hardware connection."
      );
      setIsCameraActive(false);
    }
  }

  // Stop Webcam Stream
  function stopSecureCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    if (instructionsVideoRef.current) {
      instructionsVideoRef.current.srcObject = null;
    }
    if (waitingRoomVideoRef.current) {
      waitingRoomVideoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  }

  // Pre-initialize camera during INSTRUCTIONS & WAITING_ROOM to avoid focus loss during ACTIVE_EXAM
  useEffect(() => {
    if (stage === "INSTRUCTIONS" || stage === "WAITING_ROOM") {
      initializeSecureCamera();
    } else if (stage === "SUBMITTED") {
      stopSecureCamera();
    }
    return () => {
      if (stage === "SUBMITTED") {
        stopSecureCamera();
      }
    };
  }, [stage]);

  // Keep preview videos wired when stream changes
  useEffect(() => {
    if (streamRef.current) {
      if (instructionsVideoRef.current) {
        instructionsVideoRef.current.srcObject = streamRef.current;
        instructionsVideoRef.current.play().catch(() => {});
      }
      if (waitingRoomVideoRef.current) {
        waitingRoomVideoRef.current.srcObject = streamRef.current;
        waitingRoomVideoRef.current.play().catch(() => {});
      }
    }
  }, [stage, isCameraActive]);

  // Continuously guarantee background capture video element is permanently wired to webcam stream
  useEffect(() => {
    if (videoRef.current && streamRef.current) {
      if (videoRef.current.srcObject !== streamRef.current) {
        videoRef.current.srcObject = streamRef.current;
      }
      videoRef.current.play().catch(() => {});
    }
  }, [stage, isCameraActive]);

  // Fullscreen Entry Helper
  async function enterFullscreen() {
    try {
      const docEl = document.documentElement as any;
      if (docEl.requestFullscreen) {
        await docEl.requestFullscreen();
      } else if (docEl.webkitRequestFullscreen) {
        await docEl.webkitRequestFullscreen();
      } else if (docEl.msRequestFullscreen) {
        await docEl.msRequestFullscreen();
      }
      setIsFullscreenExited(false);
      setFullscreenGraceCountdown(15);
      if (fullscreenTimerRef.current) {
        clearInterval(fullscreenTimerRef.current);
        fullscreenTimerRef.current = null;
      }
    } catch (err) {
      console.warn("Fullscreen request error:", err);
    }
  }

  // Forceful Exit Auto-Submission Engine (Beacon / Keepalive Fetch)
  function triggerForcefulExitSubmission(reason: string = "FORCE_EXIT") {
    if (hasSubmittedRef.current || stageRef.current !== "ACTIVE_EXAM") return;
    const currentSessId = sessionIdRef.current;
    const currentTok = tokenRef.current;
    const currentAnswers = answersRef.current;
    if (!currentSessId || !currentTok) return;

    hasSubmittedRef.current = true;

    const payloadAnswers = Object.entries(currentAnswers).map(([qId, opts]) => ({
      questionId: qId,
      selectedOptionIds: opts,
    }));

    const payloadData = JSON.stringify({
      sessionId: currentSessId,
      token: currentTok,
      answers: payloadAnswers,
      submissionReason: reason,
    });

    // A. W3C sendBeacon: specifically preserved by browsers across window destruction
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      try {
        const blob = new Blob([payloadData], { type: "application/json" });
        navigator.sendBeacon("/api/exam/submit", blob);
      } catch (beaconErr) {
        console.warn("sendBeacon execution notice:", beaconErr);
      }
    }

    // B. Supplementary keepalive fetch: ensures guaranteed transmission
    try {
      fetch("/api/exam/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${currentTok}`,
        },
        body: payloadData,
        keepalive: true,
      }).catch(() => {});
    } catch {}
  }

  // Transition from INSTRUCTIONS to ACTIVE_EXAM with mandatory Fullscreen & Navigation Trap
  async function handleBeginExamination() {
    await enterFullscreen();
    if (typeof window !== "undefined") {
      try {
        window.history.pushState({ examLocked: true, t: Date.now() }, "", window.location.href);
        window.history.pushState({ examLocked: true, t: Date.now() + 1 }, "", window.location.href);
      } catch (histErr) {
        console.warn("History push error:", histErr);
      }
    }
    // Ensure background camera stream is wired to off-screen capture video element
    if (videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    } else if (!isCameraActive) {
      await initializeSecureCamera();
    }
    setStage("ACTIVE_EXAM");
  }

  // Generate Evidentiary Watermarked JPEG Frame (Canvas 2D)
  function captureWatermarkedSnapshot(violationType: string): string | null {
    try {
      let video = videoRef.current;
      const canvas = canvasRef.current;

      // Fallback to preview videos if primary hidden capture video is not yet loaded
      if ((!video || video.readyState < 2) && instructionsVideoRef.current && instructionsVideoRef.current.readyState >= 2) {
        video = instructionsVideoRef.current;
      } else if ((!video || video.readyState < 2) && waitingRoomVideoRef.current && waitingRoomVideoRef.current.readyState >= 2) {
        video = waitingRoomVideoRef.current;
      }

      // If video element exists but stream is not bound or paused, attempt instant binding
      if (video && streamRef.current && (!video.srcObject || video.readyState < 2)) {
        if (video.srcObject !== streamRef.current) {
          video.srcObject = streamRef.current;
        }
        video.play().catch(() => {});
      }

      if (!video || !canvas || video.readyState < 2) {
        console.warn("captureWatermarkedSnapshot: camera video stream not ready (readyState: " + (video?.readyState ?? "null") + ")");
        return null;
      }

      const ctx = canvas.getContext("2d");
      if (!ctx) return null;

      canvas.width = 640;
      canvas.height = 480;

      // 1. Draw raw camera frame
      ctx.drawImage(video, 0, 0, 640, 480);

      // 2. Draw Forensic Watermark Overlay at bottom 76px
      const barHeight = 76;
      const barY = 480 - barHeight;
      const isAudit =
        violationType === "PROCTOR_REQUESTED_SNAPSHOT" ||
        violationType === "ROUTINE_SURVEILLANCE" ||
        violationType === "SURVEILLANCE_SNAPSHOT" ||
        violationType === "EXAM_COMMENCED_BASELINE" ||
        violationType === "BASELINE_SURVEILLANCE" ||
        violationType === "CANDIDATE_ENTRANCE_VERIFICATION" ||
        violationType === "ENTRANCE_VERIFICATION";

      // Semi-transparent deep slate banner
      ctx.fillStyle = "rgba(15, 23, 42, 0.95)";
      ctx.fillRect(0, barY, 640, barHeight);

      // Accent line: Emerald for on-demand audit & routine surveillance, Crimson for integrity infractions
      ctx.fillStyle = isAudit ? "#059669" : "#DC2626";
      ctx.fillRect(0, barY, 640, 3);

      // Row 1: Header / Watchdog Label
      ctx.font = "bold 10px monospace, sans-serif";
      ctx.fillStyle = isAudit ? "#34D399" : "#38BDF8"; // Emerald-400 or Sky-400
      ctx.fillText(
        isAudit
          ? "KARE-SES PROCTOR AUDIT • VERIFIED CANDIDATE BIOMETRIC SURVEILLANCE"
          : "KARE-SES SECURE EXAM INTEGRITY WATCHDOG • FORENSIC AUDIT EVIDENCE",
        14,
        barY + 18
      );

      // Row 2: Candidate Name, ID, Department
      ctx.font = "bold 11px sans-serif";
      ctx.fillStyle = "#FFFFFF";
      const candidateStr = `CANDIDATE: ${candidate?.fullName || "Candidate"} (${
        candidate?.applicationNumber || candidate?.rollNumber || "ID"
      })`;
      const deptStr = `DEPT: ${candidate?.department || "CSE"}`;
      ctx.fillText(`${candidateStr}  •  ${deptStr}`, 14, barY + 36);

      // Row 3: Infraction Type & Strike Counter
      ctx.font = "bold 11px monospace, sans-serif";
      ctx.fillStyle = isAudit ? "#6EE7B7" : "#F87171"; // Emerald-300 or Red-400
      const strikeNum = (strikes || 0) + 1;
      const maxStrk = exam?.maxStrikes || 3;
      ctx.fillText(
        isAudit
          ? `STATUS: ${violationType.replace(/_/g, " ")} [Active Proctored Sitting]`
          : `INFRACTION: ${violationType}  [Strike #${strikeNum} of ${maxStrk}]`,
        14,
        barY + 54
      );

      // Row 4: Session & IST Server Timestamp (Slate-400)
      ctx.font = "9px monospace, sans-serif";
      ctx.fillStyle = "#94A3B8"; // Slate-400
      const istTimeStr = formatDateTime(new Date(), true, true);
      const sessStr = `SESSION: ${sessionId ? sessionId.slice(0, 16) : "WEB-SESSION"}`;
      ctx.fillText(`TIME: ${istTimeStr}  •  ${sessStr}`, 14, barY + 68);

      return canvas.toDataURL("image/jpeg", 0.70);
    } catch (err) {
      console.warn("Watermarked frame grabber exception:", err);
      return null;
    }
  }

  // Report Security Violation / Surveillance Snapshot to Telemetry Backend (/api/telemetry/violation)
  async function reportSecurityViolation(violationType: string, reason?: string) {
    if (!token || !sessionId) return;

    const isAudit =
      violationType === "PROCTOR_REQUESTED_SNAPSHOT" ||
      violationType === "ROUTINE_SURVEILLANCE" ||
      violationType === "SURVEILLANCE_SNAPSHOT" ||
      violationType === "EXAM_COMMENCED_BASELINE" ||
      violationType === "BASELINE_SURVEILLANCE" ||
      violationType === "CANDIDATE_ENTRANCE_VERIFICATION" ||
      violationType === "ENTRANCE_VERIFICATION";

    // 3-second cooldown to prevent event flood cascades (bypassed for on-demand proctor snap & routine surveillance)
    const now = Date.now();
    if (!isAudit && now - lastViolationTimeRef.current < 3000) return;
    lastViolationTimeRef.current = now;

    try {
      // Capture watermarked forensic snapshot
      const snapshotBase64 = captureWatermarkedSnapshot(violationType);

      const res = await fetch("/api/telemetry/violation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          sessionId,
          violationType,
          snapshotBase64,
          metadata: {
            reason: reason || violationType,
            timestamp: new Date().toISOString(),
            deviceLabel: cameraDeviceLabel,
            isAudit,
            isSurveillance: isAudit,
            candidateName: candidate?.fullName,
            applicationNumber: candidate?.applicationNumber || candidate?.rollNumber,
            department: candidate?.department,
          },
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (typeof data.currentStrikes === "number" && !isAudit) {
          setStrikes(data.currentStrikes);
        }
        if (data.isLocked && !isAudit) {
          setIsWorkstationLocked(true);
          setLockoutReason(
            "Security Infraction Threshold Reached. Workstation locked by Safe Exam Watchdog."
          );
        }
      }
    } catch (err) {
      console.warn("Telemetry violation dispatch exception:", err);
    }
  }

  // Option A: 10-Second Face Absence Grace Watchdog
  useEffect(() => {
    if (stage !== "ACTIVE_EXAM" || !isCameraActive) return;

    const faceCheckInterval = setInterval(async () => {
      let faceDetected = true;
      let faceCount = 1;

      // Tier 1: Hardware-accelerated browser FaceDetector API (Chromium / WebView2)
      if ("FaceDetector" in window && videoRef.current && videoRef.current.readyState >= 2) {
        try {
          const detector = new (window as any).FaceDetector({
            fastMode: true,
            maxDetectedFaces: 3,
          });
          const faces = await detector.detect(videoRef.current);
          faceCount = faces.length;
          faceDetected = faces.length > 0;
        } catch {
          faceDetected = true;
        }
      } else if (canvasRef.current && videoRef.current && videoRef.current.readyState >= 2) {
        // Tier 2: Adaptive Canvas Luminance & Optical Variance Analysis
        try {
          const c = canvasRef.current;
          const ctx = c.getContext("2d", { willReadFrequently: true });
          if (ctx) {
            ctx.drawImage(videoRef.current, 0, 0, 160, 120);
            const imgData = ctx.getImageData(30, 20, 100, 80);
            let totalLum = 0;
            let minLum = 255;
            let maxLum = 0;
            for (let i = 0; i < imgData.data.length; i += 4) {
              const lum =
                (imgData.data[i] * 299 + imgData.data[i + 1] * 587 + imgData.data[i + 2] * 114) /
                1000;
              totalLum += lum;
              if (lum < minLum) minLum = lum;
              if (lum > maxLum) maxLum = lum;
            }
            const avgLum = totalLum / (imgData.data.length / 4);
            const variance = maxLum - minLum;
            // Blank dummy screen or covered camera lens (< 12 lum or < 15 variance)
            if (avgLum < 12 || variance < 15) {
              faceDetected = false;
            }
          }
        } catch {
          faceDetected = true;
        }
      }

      // Check for multiple faces
      if (faceDetected && faceCount > 1) {
        reportSecurityViolation(
          "MULTIPLE_FACES_DETECTED",
          "Multiple candidate faces detected simultaneously in proctor viewport"
        );
      }

      // Grace Window Countdown Logic
      if (!faceDetected) {
        faceMissingTicksRef.current += 1;
        // Trigger 10-second warning banner after 2 consecutive missing ticks
        if (faceMissingTicksRef.current >= 2) {
          const remaining = Math.max(0, 12 - faceMissingTicksRef.current);
          setFaceWarningCountdown(remaining);
          if (remaining === 0) {
            reportSecurityViolation(
              "FACE_ABSENCE_EXCEEDED",
              "No candidate face visible in camera viewport for 10 seconds"
            );
            faceMissingTicksRef.current = 0;
            setFaceWarningCountdown(null);
          }
        }
      } else {
        // Face visible: instantly cancel warning and reset grace timer
        if (faceMissingTicksRef.current > 0 || faceWarningCountdown !== null) {
          faceMissingTicksRef.current = 0;
          setFaceWarningCountdown(null);
        }
      }
    }, 1000);

    return () => clearInterval(faceCheckInterval);
  }, [stage, isCameraActive, token, sessionId, strikes, exam, candidate]);

  // Fullscreen Watchdog Event Listeners
  useEffect(() => {
    if (stage !== "ACTIVE_EXAM") return;

    function handleFullscreenChange() {
      const isCurrentlyFullscreen = !!(
        document.fullscreenElement || (document as any).webkitFullscreenElement
      );

      if (!isCurrentlyFullscreen) {
        setIsFullscreenExited(true);
        setFullscreenGraceCountdown(15);

        if (fullscreenTimerRef.current) clearInterval(fullscreenTimerRef.current);
        fullscreenTimerRef.current = setInterval(() => {
          setFullscreenGraceCountdown((prev) => {
            if (prev <= 1) {
              if (fullscreenTimerRef.current) {
                clearInterval(fullscreenTimerRef.current);
                fullscreenTimerRef.current = null;
              }
              reportSecurityViolation(
                "FULLSCREEN_EXITED",
                "Candidate exited fullscreen examination mode and did not return within 15 seconds"
              );
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      } else {
        setIsFullscreenExited(false);
        if (fullscreenTimerRef.current) {
          clearInterval(fullscreenTimerRef.current);
          fullscreenTimerRef.current = null;
        }
      }
    }

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
      if (fullscreenTimerRef.current) {
        clearInterval(fullscreenTimerRef.current);
        fullscreenTimerRef.current = null;
      }
    };
  }, [stage, token, sessionId, strikes, exam, candidate]);

  // Strict Browser Security & Interceptors (DevTools, Reload, Navigation Trap, Forceful Exit Beacon, Clipboard, Shortcuts, Focus)
  useEffect(() => {
    if (stage !== "ACTIVE_EXAM") return;

    // 1. Browser Navigation Trap (Prevent Back/Forward or History Navigation)
    function handlePopState(e: PopStateEvent) {
      if (typeof window !== "undefined") {
        window.history.pushState({ examLocked: true, t: Date.now() }, "", window.location.href);
      }
      setNavLockWarning(
        "⚠️ NAVIGATION LOCKED: Browser Back and Forward navigation is strictly disabled during an active examination. Your session remains locked and secure."
      );
      setTimeout(() => setNavLockWarning(null), 6000);
      reportSecurityViolation(
        "NAVIGATION_INTERCEPTED",
        "Candidate attempted browser back/forward history navigation during locked examination"
      );
    }

    function handleVisibilityChange() {
      if (document.hidden) {
        reportSecurityViolation(
          "TAB_SWITCH_OR_MINIMIZE",
          "Candidate minimized window or switched browser tabs"
        );
      }
    }

    function handleWindowBlur() {
      reportSecurityViolation(
        "WINDOW_FOCUS_LOST",
        "Examination application window lost foreground focus"
      );
    }

    function handleContextMenu(e: MouseEvent) {
      e.preventDefault();
    }

    function handleClipboard(e: ClipboardEvent) {
      e.preventDefault();
      reportSecurityViolation(
        "CLIPBOARD_ACCESS_ATTEMPT",
        `Attempted unauthorized clipboard ${e.type} action`
      );
    }

    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (stageRef.current !== "ACTIVE_EXAM" || hasSubmittedRef.current) return;
      // Preemptively submit progress via sendBeacon / keepalive fetch
      triggerForcefulExitSubmission("WINDOW_BEFOREUNLOAD");
      e.preventDefault();
      const exitPrompt =
        "Active examination in progress! If you navigate away or close this window, your examination will be finalized and submitted automatically.";
      e.returnValue = exitPrompt;
      return exitPrompt;
    }

    function handlePageHide(e: PageTransitionEvent) {
      if (stageRef.current === "ACTIVE_EXAM" && !hasSubmittedRef.current) {
        triggerForcefulExitSubmission("WINDOW_PAGEHIDE");
      }
    }

    function handleDragStart(e: DragEvent) {
      e.preventDefault();
    }

    function handleKeyDown(e: KeyboardEvent) {
      const isDevTools =
        e.key === "F12" ||
        ((e.ctrlKey || e.metaKey) &&
          e.shiftKey &&
          ["I", "i", "J", "j", "C", "c"].includes(e.key));

      const isReload =
        e.key === "F5" ||
        ((e.ctrlKey || e.metaKey) && (e.key === "r" || e.key === "R"));

      const isSavePrintSource =
        (e.ctrlKey || e.metaKey) &&
        ["u", "U", "p", "P", "s", "S"].includes(e.key);

      const isClipboardKey =
        (e.ctrlKey || e.metaKey) &&
        ["c", "C", "v", "V", "x", "X", "a", "A"].includes(e.key);

      const isSystemKey =
        e.key === "PrintScreen" ||
        e.key === "Meta" ||
        (e.altKey && (e.key === "Tab" || e.key === "Escape"));

      const isBackNav =
        (e.altKey && (e.key === "ArrowLeft" || e.key === "ArrowRight" || e.key === "Home")) ||
        (e.key === "Backspace" &&
          !(
            e.target instanceof HTMLInputElement ||
            e.target instanceof HTMLTextAreaElement ||
            (e.target as any)?.isContentEditable
          ));

      if (isBackNav) {
        e.preventDefault();
        e.stopPropagation();
        setNavLockWarning("⚠️ Navigation shortcut disabled during examination.");
        setTimeout(() => setNavLockWarning(null), 4000);
        reportSecurityViolation(
          "NAVIGATION_INTERCEPTED",
          `Browser navigation keystroke intercepted: ${e.key}`
        );
        return;
      }

      if (isDevTools || isReload || isSavePrintSource || isClipboardKey || isSystemKey) {
        e.preventDefault();
        e.stopPropagation();
        const reason = isDevTools
          ? "Developer Inspection Tools shortcut intercepted"
          : isReload
          ? "Page reload command intercepted"
          : isSavePrintSource
          ? "Source/Print/Save command intercepted"
          : isClipboardKey
          ? "Clipboard shortcut intercepted"
          : `System keystroke intercepted: ${e.key}`;
        reportSecurityViolation("PROHIBITED_KEY_INPUT", reason);
      }
    }

    window.addEventListener("popstate", handlePopState);
    window.addEventListener("pagehide", handlePageHide);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleWindowBlur);
    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("copy", handleClipboard);
    document.addEventListener("paste", handleClipboard);
    document.addEventListener("cut", handleClipboard);
    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("dragstart", handleDragStart);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("popstate", handlePopState);
      window.removeEventListener("pagehide", handlePageHide);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleWindowBlur);
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("copy", handleClipboard);
      document.removeEventListener("paste", handleClipboard);
      document.removeEventListener("cut", handleClipboard);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("dragstart", handleDragStart);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [stage, token, sessionId, strikes, exam, candidate]);

  // Real-Time Invigilator Push Events via Supabase Realtime Channel
  useEffect(() => {
    if ((stage !== "ACTIVE_EXAM" && stage !== "INSTRUCTIONS") || !sessionId) return;

    const channel = supabaseClient
      .channel(`exam-session-${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "exam_sessions",
          filter: `id=eq.${sessionId}`,
        },
        (payload: any) => {
          const newRow = payload.new;
          if (!newRow) return;

          // 1. Remote Proctor Workstation Freeze / Unfreeze
          if (newRow.status === "LOCKED") {
            setIsWorkstationLocked(true);
            setLockoutReason(
              "Workstation Frozen by Invigilator in real time. Please raise your hand and await assistance."
            );
          } else if (newRow.status === "IN_PROGRESS") {
            setIsWorkstationLocked(false);
            setLockoutReason("");
          }

          // 2. Dynamic Compensatory Extra Time
          if (
            typeof newRow.extra_time_minutes === "number" &&
            newRow.extra_time_minutes > prevExtraTimeRef.current
          ) {
            const addedMinutes = newRow.extra_time_minutes - prevExtraTimeRef.current;
            prevExtraTimeRef.current = newRow.extra_time_minutes;
            setSecondsRemaining((prev) => prev + addedMinutes * 60);
            setExtraTimeNotice(
              `⏱️ Compensatory Time Added: +${addedMinutes} minutes granted by invigilator.`
            );
            setTimeout(() => setExtraTimeNotice(null), 10000);
          }

          // 3. Live Strikes Sync
          if (typeof newRow.strikes_count === "number") {
            setStrikes(newRow.strikes_count);
            if (exam && newRow.strikes_count >= (exam.maxStrikes || 3)) {
              setIsWorkstationLocked(true);
              setLockoutReason(
                "Infraction Limit Reached. Workstation locked by Safe Exam Watchdog."
              );
            }
          }
        }
      )
      .on(
        "broadcast",
        { event: "proctor_command" },
        (eventPayload: any) => {
          const payload = eventPayload?.payload || eventPayload;
          const cmd = payload?.command;
          const msg = payload?.message;

          if (cmd === "CMD_WARN") {
            setProctorWarningMessage(
              msg || "Official Warning from Invigilator: Please adhere strictly to examination integrity rules."
            );
          } else if (cmd === "CMD_ANNOUNCE") {
            setProctorAnnouncement(msg || "Announcement from Invigilation Desk.");
            setTimeout(() => setProctorAnnouncement(null), 12000);
          } else if (cmd === "CMD_REQUEST_SNAP") {
            // Immediate on-demand webcam snapshot capture requested by proctor
            reportSecurityViolation(
              "PROCTOR_REQUESTED_SNAPSHOT",
              "On-demand invigilator audit snap"
            );
          } else if (cmd === "CMD_TERMINATE") {
            setIsWorkstationLocked(true);
            setLockoutReason(
              "Examination terminated by invigilator: " + (msg || "Integrity protocol enforcement.")
            );
          } else if (cmd === "CMD_RESUME") {
            setIsWorkstationLocked(false);
            setLockoutReason("");
            setProctorWarningMessage(null);
          }
        }
      )
      .on(
        "broadcast",
        { event: "proctor_chat_reply" },
        (eventPayload: any) => {
          const payload = eventPayload?.payload || eventPayload;
          if (!payload) return;
          const replyText = payload.message || "New message from invigilator";
          const newMsg = {
            id: payload.messageId || `reply_${Date.now()}`,
            sender: "PROCTOR" as const,
            message: replyText,
            createdAt: payload.timestamp || new Date().toISOString(),
          };

          setHelpdeskMessages((prev) => [...prev, newMsg]);
          setUnreadProctorReplies((prev) => prev + 1);
          setProctorReplyToast({
            message: replyText,
            timestamp: new Date().toLocaleTimeString(),
          });
          setTimeout(() => setProctorReplyToast(null), 12000);
        }
      )
      .subscribe();

    return () => {
      supabaseClient.removeChannel(channel);
    };
  }, [stage, sessionId, exam]);

  // Entrance Identity Verification Snapshot (captured when candidate enters INSTRUCTIONS stage and camera activates)
  useEffect(() => {
    if (stage !== "INSTRUCTIONS" || !sessionId || !token || !isCameraActive) return;

    // After 2.0s to allow camera auto-exposure and white balance to stabilize
    const entranceTimer = setTimeout(() => {
      reportSecurityViolation(
        "CANDIDATE_ENTRANCE_VERIFICATION",
        "Candidate entered examination instructions portal - biometric verification photo"
      );
    }, 2000);

    return () => clearTimeout(entranceTimer);
  }, [stage, sessionId, token, isCameraActive]);

  // Automated Candidate Biometric Surveillance (Baseline Snapshot on Commencing + Every 60s Routine Check)
  useEffect(() => {
    if (stage !== "ACTIVE_EXAM" || !sessionId || !token || !isCameraActive) return;

    // 1. Initial verified commencement baseline snapshot after 2.5s camera stabilization
    const baselineTimer = setTimeout(() => {
      reportSecurityViolation(
        "EXAM_COMMENCED_BASELINE",
        "Initial examination commencement baseline webcam snapshot"
      );
    }, 2500);

    // 2. Continuous background surveillance snapshot every 60 seconds
    const surveillanceInterval = setInterval(() => {
      reportSecurityViolation(
        "ROUTINE_SURVEILLANCE",
        "Periodic background candidate biometric surveillance snapshot"
      );
    }, 60000);

    return () => {
      clearTimeout(baselineTimer);
      clearInterval(surveillanceInterval);
    };
  }, [stage, sessionId, token, isCameraActive]);

  // Load existing conversation thread on active exam entrance
  useEffect(() => {
    if (stage !== "ACTIVE_EXAM" || !sessionId || !token) return;
    fetch(`/api/exam/chat?sessionId=${sessionId}&token=${encodeURIComponent(token)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.messages)) {
          setHelpdeskMessages(data.messages);
        }
      })
      .catch((err) => console.warn("Chat history fetch notice:", err));
  }, [stage, sessionId, token]);

  // Candidate Inquiry Submission Handler
  async function handleSendCandidateInquiry() {
    if (!helpdeskMessage.trim() || !token || !sessionId) return;
    setIsSendingInquiry(true);
    setInquiryNotice(null);

    try {
      const res = await fetch("/api/exam/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          token,
          sessionId,
          message: helpdeskMessage.trim(),
          category: helpdeskCategory,
          questionNumber: helpdeskCategory === "QUESTION_DOUBT" ? helpdeskQuestionNumber : null,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setInquiryNotice({ type: "error", text: data.error || "Failed to dispatch message to proctor." });
      } else {
        const newInq = {
          id: data.message?.messageId || `inq_${Date.now()}`,
          sender: "CANDIDATE" as const,
          message: helpdeskMessage.trim(),
          category: helpdeskCategory,
          questionNumber: helpdeskCategory === "QUESTION_DOUBT" ? helpdeskQuestionNumber : null,
          createdAt: new Date().toISOString(),
        };
        setHelpdeskMessages((prev) => [...prev, newInq]);
        setHelpdeskMessage("");
        setInquiryNotice({
          type: "success",
          text: "Your message has been dispatched to the invigilator in real time. Please await response.",
        });
        setTimeout(() => setInquiryNotice(null), 6000);
      }
    } catch (err: any) {
      setInquiryNotice({ type: "error", text: err.message || "Failed to send message." });
    } finally {
      setIsSendingInquiry(false);
    }
  }

  // Listen for WebView2 PostMessage from C# Windows Client
  useEffect(() => {
    function handleNativeMessage(event: any) {
      try {
        let data = event.data;
        if (typeof data === "string") {
          try {
            data = JSON.parse(data);
          } catch {}
        }
        if (!data) return;

        // Message from C# Desktop Client (Auto-initialize session without showing login)
        if (data.type === "INIT_SESSION" || (data.token && data.exam && data.candidate)) {
          initializeSession(data.token, data.sessionId, data.candidate, data.exam);
        } else if (data.type === "SECURITY_VIOLATION") {
          reportSecurityViolation(
            "NATIVE_SYSTEM_HOOK",
            data.reason || "Win32 native security hook triggered by host client"
          );
        }
      } catch (err) {
        console.warn("Native bridge message notice:", err);
      }
    }

    // Standard web message listener
    window.addEventListener("message", handleNativeMessage);

    // Microsoft WebView2 native message event
    if ((window as any).chrome?.webview) {
      (window as any).chrome.webview.addEventListener("message", handleNativeMessage);
    }

    return () => {
      window.removeEventListener("message", handleNativeMessage);
      if ((window as any).chrome?.webview) {
        (window as any).chrome.webview.removeEventListener("message", handleNativeMessage);
      }
    };
  }, []);

  // Automatically resume / initialize session if direct launch ticket or token is provided
  useEffect(() => {
    const queryTicket = searchParams.get("ticket");
    const queryToken = searchParams.get("token");
    const querySession = searchParams.get("sessionId");

    if (queryTicket) {
      setIsAuthenticating(true);
      setAuthError(null);

      fetch("/api/exam/launch-ticket/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticket: queryTicket,
          clientVersion: "1.0.0-web",
          hardwareFingerprint:
            "WEB-CLIENT-" +
            (typeof window !== "undefined" && window.navigator?.userAgent
              ? window.navigator.userAgent.slice(0, 24)
              : "GENERIC"),
        }),
      })
        .then(async (res) => {
          const data = await res.json();
          if (!res.ok) {
            if (data.code === "EXAM_NOT_STARTED" && data.exam) {
              if (typeof data.serverEpochMs === "number") {
                setClockSkewMs(data.serverEpochMs - Date.now());
              }
              const cand = data.candidate || {
                id: "candidate",
                fullName: "Registered Candidate",
                email: "",
                applicationNumber: "",
                rollNumber: "",
                department: { name: "Department Specialization Track", code: "GEN" },
              };
              setWaitingRoomData({
                candidate: cand,
                exam: data.exam,
                startTimeEpochMs: new Date(data.startTime || data.exam.startTime).getTime(),
              });
              setStoredAuthCredentials({
                email: cand.email || "",
                password: "",
                passcode: "",
                ticket: queryTicket,
              });
              setStage("WAITING_ROOM");
              return;
            }
            if (data.code === "EXAM_CONCLUDED") {
              if (data.candidate && data.exam) {
                setWaitingRoomData({
                  candidate: data.candidate,
                  exam: data.exam,
                  startTimeEpochMs: new Date(data.startTime || data.exam.startTime).getTime(),
                });
              }
              setAdmissionStatus("CONCLUDED");
              admissionStatusRef.current = "CONCLUDED";
              setAuthError(data.error || "This examination has concluded. Access is strictly closed.");
              setStage("WAITING_ROOM");
              return;
            }
            if (data.code === "STUDENT_NOT_ASSIGNED_TO_EXAM") {
              setAdmissionStatus("ACCESS_DENIED");
              admissionStatusRef.current = "ACCESS_DENIED";
              setAuthError(data.error || "Access Denied: You are not authorized on the examination roster.");
              setStage("WAITING_ROOM");
              return;
            }
            throw new Error(data.error || "Failed to verify examination launch ticket.");
          }
          if (data.candidate && data.exam) {
            initializeSession(data.token, data.sessionId, data.candidate, data.exam);
          }
        })
        .catch((err: any) => {
          console.warn("Direct ticket init notice:", err);
          setAuthError(err.message || "Failed to load examination session from launch ticket.");
        })
        .finally(() => {
          setIsAuthenticating(false);
        });
      return;
    }

    if (queryToken) {
      setToken(queryToken);
      if (querySession) setSessionId(querySession);

      // Fetch session curriculum automatically to bypass web login gate
      setIsAuthenticating(true);
      setAuthError(null);

      fetch(
        `/api/exam/session?token=${encodeURIComponent(queryToken)}&sessionId=${encodeURIComponent(
          querySession || ""
        )}`,
        {
          headers: {
            Authorization: `Bearer ${queryToken}`,
          },
        }
      )
        .then(async (res) => {
          const data = await res.json();
          if (!res.ok) {
            throw new Error(data.error || "Failed to load examination session.");
          }
          if (data.candidate && data.exam) {
            initializeSession(
              queryToken,
              data.sessionId || querySession || "",
              data.candidate,
              data.exam
            );
          }
        })
        .catch((err: any) => {
          console.warn("Auto-session init notice:", err);
          setAuthError(err.message || "Failed to load examination session.");
        })
        .finally(() => {
          setIsAuthenticating(false);
        });
    }

    const queryEmail = searchParams.get("email");
    const queryApp =
      searchParams.get("app") || searchParams.get("applicationId") || searchParams.get("appNo");
    const queryCode = searchParams.get("passcode") || searchParams.get("code");
    if (queryEmail) setLoginEmail(queryEmail);
    if (queryApp) setLoginPassword(queryApp);
    if (queryCode) setLoginPasscode(queryCode);

    // Auto-authenticate in the background if candidate credentials arrived via redirect
    if (!queryTicket && !queryToken && queryEmail && queryApp) {
      setIsAuthenticating(true);
      setAuthError(null);

      fetch("/api/exam/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: queryEmail.trim(),
          password: queryApp.trim(),
          applicationNumber: queryApp.trim(),
          examPasscode: (queryCode || "").trim(),
          hardwareFingerprint: "BROWSER-SITTING-WEB-CLIENT",
          clientVersion: "1.0.0-web",
        }),
      })
        .then(async (res) => {
          const data = await res.json();
          if (typeof data.serverEpochMs === "number") {
            setClockSkewMs(data.serverEpochMs - Date.now());
          }
          if (!res.ok) {
            if (data.code === "EXAM_NOT_STARTED" && data.exam) {
              const cand = data.candidate || {
                id: "candidate",
                fullName: queryEmail.trim(),
                email: queryEmail.trim(),
                applicationNumber: queryApp.trim(),
                rollNumber: queryApp.trim(),
                department: { name: "Department Curricula", code: "GEN" },
              };
              setWaitingRoomData({
                candidate: cand,
                exam: data.exam,
                startTimeEpochMs: new Date(data.startTime || data.exam.startTime).getTime(),
              });
              setStoredAuthCredentials({
                email: queryEmail.trim(),
                password: queryApp.trim(),
                passcode: (queryCode || "").trim(),
              });
              setStage("WAITING_ROOM");
              return;
            }
            if (data.code === "EXAM_CONCLUDED") {
              if (data.candidate && data.exam) {
                setWaitingRoomData({
                  candidate: data.candidate,
                  exam: data.exam,
                  startTimeEpochMs: new Date(data.startTime || data.exam.startTime).getTime(),
                });
              }
              setAdmissionStatus("CONCLUDED");
              admissionStatusRef.current = "CONCLUDED";
              setAuthError(data.error || "This examination has concluded. Access is strictly closed.");
              setStage("WAITING_ROOM");
              return;
            }
            if (data.code === "STUDENT_NOT_ASSIGNED_TO_EXAM") {
              setAdmissionStatus("ACCESS_DENIED");
              admissionStatusRef.current = "ACCESS_DENIED";
              setAuthError(data.error || "Access Denied: You are not authorized on the examination roster.");
              setStage("WAITING_ROOM");
              return;
            }
            if (data.code === "LATE_ENTRY_DENIED") {
              setLateEntryNotice({
                delayMinutes: data.delayMinutes ?? 15,
                graceCutoff: data.graceCutoff,
                pendingProctorApproval: true,
              });
            }
            setAuthError(data.error || "Authentication failed. Please verify candidate registration on Home Portal.");
            return;
          }

          setLateEntryNotice(null);
          initializeSession(data.token, data.sessionId, data.candidate, {
            ...data.exam,
            serverEpochMs: data.serverEpochMs,
            endTime: data.endTime,
            remainingSeconds: data.remainingSeconds,
          });
        })
        .catch((err: any) => {
          console.warn("Auto-auth background verification error:", err);
          setAuthError(err.message || "Failed to verify credentials.");
        })
        .finally(() => {
          setIsAuthenticating(false);
        });
    }
  }, [searchParams]);

  // Fetch upcoming scheduled exam info for candidate waiting area notice
  useEffect(() => {
    fetch("/api/exam/upcoming")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.upcomingExam) {
          setUpcomingExamInfo(data.upcomingExam);
          if (typeof data.serverEpochMs === "number") {
            setClockSkewMs(data.serverEpochMs - Date.now());
          }
          // Do not overwrite waitingRoomData if a direct ticket or auth parameter is present
          const hasDirectParams =
            Boolean(searchParams.get("ticket")) ||
            Boolean(searchParams.get("token")) ||
            (Boolean(searchParams.get("email")) && Boolean(searchParams.get("app")));

          if (hasDirectParams) return;

          setWaitingRoomData((prev) => {
            if (prev) return prev;
            return {
              candidate: {
                fullName: "Candidate (Awaiting Verification)",
                email: "",
                applicationNumber: "",
                department: { name: "General Research Track", code: "GEN" },
              },
              exam: {
                id: data.upcomingExam.id,
                title: data.upcomingExam.title,
                durationMinutes: data.upcomingExam.durationMinutes,
                startTime: data.upcomingExam.startTime,
                startTimeIST: data.upcomingExam.startTimeIST,
                endTime: data.upcomingExam.endTime,
                endTimeIST: data.upcomingExam.endTimeIST,
              },
              startTimeEpochMs: new Date(data.upcomingExam.startTime).getTime(),
            };
          });
        }
      })
      .catch((err) => console.warn("Upcoming exam fetch notice:", err));
  }, [searchParams]);

  // Check online status
  useEffect(() => {
    function handleOnline() {
      setIsOnline(true);
    }
    function handleOffline() {
      setIsOnline(false);
    }
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Continuous Indian Standard Time (IST) Clock Engine
  useEffect(() => {
    function tickISTClock() {
      const now = Date.now();
      setLiveEntranceIST(formatDateTime(now, true, true));
      const authoritativeServerEpoch = now + clockSkewMs;
      setCurrentServerIST(formatTime(authoritativeServerEpoch, true, true));
    }

    tickISTClock();
    const interval = setInterval(tickISTClock, 1000);
    return () => clearInterval(interval);
  }, [clockSkewMs]);

  // Initialize Session
  function initializeSession(
    jwtToken: string,
    sessId: string,
    cand: CandidateData,
    examData: ExamData,
    directToActiveExam: boolean = false
  ) {
    setToken(jwtToken);
    setSessionId(sessId);
    setCandidate(cand);
    setExam(examData);

    const serverEpoch = (examData as any)?.serverEpochMs || Date.now();
    const skew = serverEpoch - Date.now();
    setClockSkewMs(skew);
    setExamEndTime((examData as any)?.endTime || null);

    const initialSeconds =
      typeof (examData as any)?.remainingSeconds === "number"
        ? (examData as any).remainingSeconds
        : (examData.durationMinutes || 90) * 60;

    setSecondsRemaining(initialSeconds);
    setStrikes(examData.currentStrikes || 0);

    if (examData.sections && examData.sections.length > 0) {
      setActiveSectionId(examData.sections[0].id);
    }

    // 1. Load any locally buffered answers
    const cached = localStorage.getItem(`exam_answers_${sessId}`);
    if (cached) {
      try {
        setAnswers(JSON.parse(cached));
      } catch {}
    }

    // 2. Fetch server-persisted submissions from DB to ensure complete answer restoration across devices/refresh
    fetch(`/api/exam/answers/restore?sessionId=${encodeURIComponent(sessId)}`, {
      headers: { Authorization: `Bearer ${jwtToken}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.answers && Object.keys(data.answers).length > 0) {
          setAnswers((prev) => {
            const merged = { ...data.answers, ...prev };
            if (typeof window !== "undefined") {
              localStorage.setItem(`exam_answers_${sessId}`, JSON.stringify(merged));
            }
            return merged;
          });
        }
      })
      .catch((err) => console.warn("Answer restore fetch notice:", err));

    if (directToActiveExam) {
      handleBeginExamination();
    } else {
      setStage("INSTRUCTIONS");
    }
  }

  // Candidate Authentication against /api/exam/auth
  async function handleAuthenticate(e: React.FormEvent) {
    e.preventDefault();
    if (!loginEmail.trim()) {
      setAuthError("Please enter your registered / institutional Email ID.");
      return;
    }
    if (!loginPassword.trim()) {
      setAuthError("Please enter your Application ID (as password).");
      return;
    }
    if (!loginPasscode.trim()) {
      setAuthError("Please enter the Examination Security Passcode.");
      return;
    }

    setIsAuthenticating(true);
    setAuthError(null);

    try {
      const res = await fetch("/api/exam/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: loginEmail.trim(),
          password: loginPassword.trim(),
          applicationNumber: loginPassword.trim(),
          examPasscode: loginPasscode.trim(),
          hardwareFingerprint: "BROWSER-SITTING-WEB-CLIENT",
          clientVersion: "1.0.0-web",
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (typeof data.serverEpochMs === "number") {
          setClockSkewMs(data.serverEpochMs - Date.now());
        }
        if (data.code === "EXAM_NOT_STARTED" && data.exam) {
          const cand = data.candidate || {
            id: "candidate",
            fullName: loginEmail.trim(),
            email: loginEmail.trim(),
            applicationNumber: loginPassword.trim(),
            rollNumber: loginPassword.trim(),
            department: { name: "Department Curricula", code: "GEN" },
          };
          setWaitingRoomData({
            candidate: cand,
            exam: data.exam,
            startTimeEpochMs: new Date(data.startTime || data.exam.startTime).getTime(),
          });
          setStoredAuthCredentials({
            email: loginEmail.trim(),
            password: loginPassword.trim(),
            passcode: loginPasscode.trim(),
          });
          setStage("WAITING_ROOM");
          setAuthError(null);
          setIsAuthenticating(false);
          return;
        }
        if (data.code === "LATE_ENTRY_DENIED") {
          setLateEntryNotice({
            delayMinutes: data.delayMinutes ?? 15,
            graceCutoff: data.graceCutoff,
            pendingProctorApproval: true,
          });
        }
        setAuthError(data.error || "Authentication failed. Please check your credentials.");
        setIsAuthenticating(false);
        return;
      }

      setLateEntryNotice(null);
      initializeSession(data.token, data.sessionId, data.candidate, {
        ...data.exam,
        serverEpochMs: data.serverEpochMs,
        endTime: data.endTime,
        remainingSeconds: data.remainingSeconds,
      });
    } catch (err: any) {
      setAuthError(err.message || "Failed to connect to authentication server.");
    } finally {
      setIsAuthenticating(false);
    }
  }

  // Trigger Automatic or Manual Admission from Waiting Room once start time arrives
  async function triggerAdmission(directToExam: boolean = true) {
    if (
      isAdmittingAutoRef.current ||
      admissionStatusRef.current === "CONCLUDED" ||
      admissionStatusRef.current === "ACCESS_DENIED"
    ) {
      return;
    }

    isAdmittingAutoRef.current = true;
    setIsAdmittingAuto(true);
    setAdmissionStatus("ADMITTING");
    admissionStatusRef.current = "ADMITTING";

    try {
      const ticketToUse = storedAuthCredentials?.ticket || searchParams.get("ticket");

      if (ticketToUse) {
        const res = await fetch("/api/exam/launch-ticket/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ticket: ticketToUse,
            clientVersion: "1.0.0-web",
            hardwareFingerprint:
              "WEB-CLIENT-" +
              (typeof window !== "undefined" && window.navigator?.userAgent
                ? window.navigator.userAgent.slice(0, 24)
                : "GENERIC"),
          }),
        });

        const data = await res.json();

        if (res.ok && data.candidate && data.exam) {
          admissionStatusRef.current = "IDLE";
          setAdmissionStatus("IDLE");
          setIsAdmittingAuto(false);
          isAdmittingAutoRef.current = false;
          initializeSession(data.token, data.sessionId, data.candidate, data.exam, directToExam);
          return;
        }

        if (data.code === "EXAM_CONCLUDED") {
          admissionStatusRef.current = "CONCLUDED";
          setAdmissionStatus("CONCLUDED");
          setIsAdmittingAuto(false);
          isAdmittingAutoRef.current = false;
          setAuthError(data.error || "This examination has concluded. Access is strictly closed.");
          if (data.candidate && data.exam) {
            setWaitingRoomData((prev) => (prev ? { ...prev, candidate: data.candidate, exam: data.exam } : null));
          }
          return;
        }

        if (data.code === "STUDENT_NOT_ASSIGNED_TO_EXAM") {
          admissionStatusRef.current = "ACCESS_DENIED";
          setAdmissionStatus("ACCESS_DENIED");
          setIsAdmittingAuto(false);
          isAdmittingAutoRef.current = false;
          setAuthError(data.error);
          return;
        }

        if (data.code === "EXAM_NOT_STARTED") {
          if (admissionRetryCountRef.current < 2) {
            admissionRetryCountRef.current += 1;
            setTimeout(() => {
              isAdmittingAutoRef.current = false;
              admissionStatusRef.current = "IDLE";
              setAdmissionStatus("IDLE");
              triggerAdmission(directToExam);
            }, 3000);
            return;
          }
          admissionStatusRef.current = "IDLE";
          setAdmissionStatus("IDLE");
          setIsAdmittingAuto(false);
          isAdmittingAutoRef.current = false;
          return;
        }

        admissionStatusRef.current = "FAILED";
        setAdmissionStatus("FAILED");
        setIsAdmittingAuto(false);
        isAdmittingAutoRef.current = false;
        setAuthError(data.error || "Admission failed. Please try again.");
      } else if (storedAuthCredentials?.email && storedAuthCredentials?.passcode) {
        const res = await fetch("/api/exam/auth", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: storedAuthCredentials.email,
            password: storedAuthCredentials.password,
            applicationNumber: storedAuthCredentials.password,
            examPasscode: storedAuthCredentials.passcode,
            hardwareFingerprint: "BROWSER-SITTING-WEB-CLIENT",
            clientVersion: "1.0.0-web",
          }),
        });

        const data = await res.json();

        if (res.ok && data.candidate && data.exam) {
          admissionStatusRef.current = "IDLE";
          setAdmissionStatus("IDLE");
          setIsAdmittingAuto(false);
          isAdmittingAutoRef.current = false;
          initializeSession(
            data.token,
            data.sessionId,
            data.candidate,
            {
              ...data.exam,
              serverEpochMs: data.serverEpochMs,
              endTime: data.endTime,
              remainingSeconds: data.remainingSeconds,
            },
            directToExam
          );
          return;
        }

        if (data.code === "EXAM_CONCLUDED") {
          admissionStatusRef.current = "CONCLUDED";
          setAdmissionStatus("CONCLUDED");
          setIsAdmittingAuto(false);
          isAdmittingAutoRef.current = false;
          setAuthError(data.error || "This examination has concluded. Access is strictly closed.");
          if (data.candidate && data.exam) {
            setWaitingRoomData((prev) => (prev ? { ...prev, candidate: data.candidate, exam: data.exam } : null));
          }
          return;
        }

        if (data.code === "STUDENT_NOT_ASSIGNED_TO_EXAM") {
          admissionStatusRef.current = "ACCESS_DENIED";
          setAdmissionStatus("ACCESS_DENIED");
          setIsAdmittingAuto(false);
          isAdmittingAutoRef.current = false;
          setAuthError(data.error);
          return;
        }

        if (data.code === "EXAM_NOT_STARTED") {
          if (admissionRetryCountRef.current < 2) {
            admissionRetryCountRef.current += 1;
            setTimeout(() => {
              isAdmittingAutoRef.current = false;
              admissionStatusRef.current = "IDLE";
              setAdmissionStatus("IDLE");
              triggerAdmission(directToExam);
            }, 3000);
            return;
          }
          admissionStatusRef.current = "IDLE";
          setAdmissionStatus("IDLE");
          setIsAdmittingAuto(false);
          isAdmittingAutoRef.current = false;
          return;
        }

        admissionStatusRef.current = "FAILED";
        setAdmissionStatus("FAILED");
        setIsAdmittingAuto(false);
        isAdmittingAutoRef.current = false;
        setAuthError(data.error || "Admission failed. Please try again.");
      } else {
        setIsAdmittingAuto(false);
        isAdmittingAutoRef.current = false;
        setAdmissionStatus("IDLE");
        admissionStatusRef.current = "IDLE";
      }
    } catch (err: any) {
      console.warn("Waiting room admission notice:", err);
      setIsAdmittingAuto(false);
      isAdmittingAutoRef.current = false;
      setAdmissionStatus("FAILED");
      admissionStatusRef.current = "FAILED";
      setAuthError(err.message || "Failed to contact examination gateway.");
    }
  }

  // Waiting Room Countdown Timer & Automatic Admittance Effect
  useEffect(() => {
    if (stage !== "WAITING_ROOM" || !waitingRoomData) return;

    function tickWaitingRoom() {
      if (!waitingRoomData) return;
      const currentServerTime = Date.now() + clockSkewMs;
      const diffMs = waitingRoomData.startTimeEpochMs - currentServerTime;
      const secs = Math.max(0, Math.ceil(diffMs / 1000));
      setWaitingCountdown(secs);

      // Trigger automatic admittance ONLY ONCE when countdown reaches 0
      if (
        secs <= 0 &&
        !hasTriggeredAdmissionAtZeroRef.current &&
        admissionStatusRef.current !== "CONCLUDED" &&
        admissionStatusRef.current !== "ACCESS_DENIED"
      ) {
        hasTriggeredAdmissionAtZeroRef.current = true;
        triggerAdmission(true);
      }
    }

    tickWaitingRoom();
    const interval = setInterval(tickWaitingRoom, 1000);
    return () => clearInterval(interval);
  }, [stage, waitingRoomData, clockSkewMs, storedAuthCredentials]);

  // Server-Authoritative Countdown Timer & Continuous Schedule Watchdog
  useEffect(() => {
    if (stage !== "ACTIVE_EXAM") return;

    function checkScheduleAndCountdown() {
      if (hasSubmittedRef.current) return;
      const currentServerTime = Date.now() + clockSkewMs;

      // 1. Authoritative Exam Schedule Window End Check
      let isScheduleConcluded = false;
      let remainingUntilScheduleEnd = 999999;
      if (examEndTime) {
        const scheduleEndEpoch = new Date(examEndTime).getTime();
        remainingUntilScheduleEnd = Math.max(
          0,
          Math.floor((scheduleEndEpoch - currentServerTime) / 1000)
        );
        if (currentServerTime >= scheduleEndEpoch || remainingUntilScheduleEnd <= 0) {
          isScheduleConcluded = true;
        }
      }

      setSecondsRemaining((prev) => {
        const currentRemaining = examEndTime
          ? Math.min(prev, remainingUntilScheduleEnd)
          : prev;

        if (isScheduleConcluded || currentRemaining <= 0) {
          clearInterval(timer);
          autoConcludeAndSubmit(
            isScheduleConcluded ? "SCHEDULE_EXPIRED" : "DURATION_EXPIRED"
          );
          return 0;
        }
        return currentRemaining - 1;
      });
    }

    checkScheduleAndCountdown();
    const timer = setInterval(checkScheduleAndCountdown, 1000);

    return () => clearInterval(timer);
  }, [stage, examEndTime, clockSkewMs]);

  // Periodic Unified Telemetry Heartbeat (Single 10-Second Interval)
  useEffect(() => {
    if (stage !== "ACTIVE_EXAM" || !token || !sessionId) return;

    let isHeartbeatRunning = false;

    async function sendUnifiedHeartbeat() {
      if (isHeartbeatRunning || !isOnline || !token || !sessionId || hasSubmittedRef.current) return;
      isHeartbeatRunning = true;
      try {
        const res = await fetch("/api/telemetry/heartbeat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            sessionId,
            hardwareFingerprint: "BROWSER-CLIENT-WEB",
            questionsAnsweredCount: Object.keys(answers).length,
          }),
        });

        if (res.ok) {
          const hbData = await res.json();
          if (hbData.serverEpochMs) {
            setClockSkewMs(hbData.serverEpochMs - Date.now());
          }
          if (typeof hbData.serverCalculatedSecondsRemaining === "number") {
            setSecondsRemaining(hbData.serverCalculatedSecondsRemaining);
          }
          if (
            hbData.isExpired ||
            (typeof hbData.serverCalculatedSecondsRemaining === "number" &&
              hbData.serverCalculatedSecondsRemaining <= 0)
          ) {
            autoConcludeAndSubmit("SCHEDULE_EXPIRED");
            return;
          }
          if (hbData.sessionStatus === "LOCKED") {
            setIsWorkstationLocked(true);
            setLockoutReason("Workstation locked by invigilator or security protocol.");
          } else if (hbData.sessionStatus === "IN_PROGRESS" && isWorkstationLocked) {
            setIsWorkstationLocked(false);
          }
          if (typeof hbData.strikesCount === "number") {
            setStrikes(hbData.strikesCount);
            if (exam && hbData.strikesCount >= (exam.maxStrikes || 3)) {
              setIsWorkstationLocked(true);
              setLockoutReason("Infraction Limit Reached. Workstation locked by Safe Exam Watchdog.");
            }
          }
          if (
            typeof hbData.extraTimeMinutes === "number" &&
            hbData.extraTimeMinutes > prevExtraTimeRef.current
          ) {
            const addedMinutes = hbData.extraTimeMinutes - prevExtraTimeRef.current;
            prevExtraTimeRef.current = hbData.extraTimeMinutes;
            setSecondsRemaining((prev) => prev + addedMinutes * 60);
            setExtraTimeNotice(
              `⏱️ Compensatory Time Added: +${addedMinutes} minutes granted by invigilator.`
            );
            setTimeout(() => setExtraTimeNotice(null), 10000);
          }
        }
      } catch (hbErr) {
        console.warn("Unified heartbeat notice:", hbErr);
      } finally {
        isHeartbeatRunning = false;
      }
    }

    sendUnifiedHeartbeat();
    const hbInterval = setInterval(sendUnifiedHeartbeat, 10000);

    return () => clearInterval(hbInterval);
  }, [stage, token, sessionId, answers, isOnline, exam, isWorkstationLocked]);

  // Periodic Background Answer Sync to /api/exam/sync (Every 15 seconds)
  useEffect(() => {
    if (stage !== "ACTIVE_EXAM" || !token || !sessionId) return;

    const syncInterval = setInterval(() => {
      syncAnswersToServer();
    }, 15000);

    return () => clearInterval(syncInterval);
  }, [stage, token, sessionId, answers]);

  // Sync Answers helper
  async function syncAnswersToServer() {
    if (!isOnline || !token || !sessionId) return;

    setIsSyncing(true);
    try {
      const payloadAnswers = Object.entries(answers).map(([qId, opts]) => ({
        questionId: qId,
        selectedOptionIds: opts,
        clientTimestamp: new Date().toISOString(),
      }));

      const res = await fetch("/api/exam/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          sessionId,
          answers: payloadAnswers,
        }),
      });

      if (res.ok) {
        setLastSyncedTime(formatTime(new Date(), true, true));
      }
    } catch (err) {
      console.warn("Background sync retry queued:", err);
    } finally {
      setIsSyncing(false);
    }
  }

  // Answer selection handler (Synchronous LocalStorage Preservation)
  function handleSelectOption(questionId: string, optionId: string, isMultiple: boolean) {
    setAnswers((prev) => {
      let updated: string[];
      if (isMultiple) {
        const current = prev[questionId] || [];
        updated = current.includes(optionId)
          ? current.filter((id) => id !== optionId)
          : [...current, optionId];
      } else {
        updated = [optionId];
      }

      const nextState = { ...prev, [questionId]: updated };
      // Buffer locally in localStorage immediately
      if (sessionId) {
        localStorage.setItem(`exam_answers_${sessionId}`, JSON.stringify(nextState));
      }
      return nextState;
    });
  }

  // Clear answer
  function handleClearOption(questionId: string) {
    setAnswers((prev) => {
      const nextState = { ...prev };
      delete nextState[questionId];
      if (sessionId) {
        localStorage.setItem(`exam_answers_${sessionId}`, JSON.stringify(nextState));
      }
      return nextState;
    });
  }

  // Toggle Flag
  function toggleFlag(questionId: string) {
    setFlaggedQuestions((prev) => {
      const next = new Set(prev);
      if (next.has(questionId)) {
        next.delete(questionId);
      } else {
        next.add(questionId);
      }
      return next;
    });
  }

  // Auto-conclude and submit when schedule or duration expires
  async function autoConcludeAndSubmit(reason: "SCHEDULE_EXPIRED" | "DURATION_EXPIRED") {
    if (hasSubmittedRef.current || isSubmitting) return;
    hasSubmittedRef.current = true;
    setSubmissionReason(reason);
    setAutoConcludeNotice(
      reason === "SCHEDULE_EXPIRED"
        ? "⏰ Examination Schedule Concluded: Authoritative exam end-time has been reached. All recorded answers are being automatically finalized and submitted."
        : "⏱️ Examination Duration Expired: Your allotted examination time has ended. All recorded answers are being automatically finalized and submitted."
    );
    await submitFinalExam(reason);
  }

  // Final Submit Handler
  async function submitFinalExam(reason: string = "NORMAL") {
    const currentToken = tokenRef.current || token;
    const currentSessionId = sessionIdRef.current || sessionId;
    if (!currentToken || !currentSessionId) return;

    hasSubmittedRef.current = true;
    setIsSubmitting(true);
    setSubmissionReason(reason);

    try {
      const payloadAnswers = Object.entries(answersRef.current || answers).map(
        ([qId, opts]) => ({
          questionId: qId,
          selectedOptionIds: opts,
        })
      );

      const res = await fetch("/api/exam/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${currentToken}`,
        },
        body: JSON.stringify({
          sessionId: currentSessionId,
          token: currentToken,
          answers: payloadAnswers,
          submissionReason: reason,
        }),
      });

      const data = await res.json();
      if (!res.ok && !data.alreadySubmitted) {
        console.error("Submission failed:", data.error);
        alert(data.error || "Failed to submit examination.");
        setIsSubmitting(false);
        hasSubmittedRef.current = false;
        return;
      }

      setSubmissionReceipt(data);
      setSubmissionReason(reason);
      setStage("SUBMITTED");
      setIsSubmitModalOpen(false);
      setAutoConcludeNotice(null);

      // Clean local cache
      localStorage.removeItem(`exam_answers_${currentSessionId}`);

      // Exit fullscreen mode cleanly upon submission
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }

      // Notify C# Host Client if running in WebView2
      if ((window as any).chrome?.webview) {
        (window as any).chrome.webview.postMessage({
          type: "EXAM_SUBMITTED",
          referenceCode: data.referenceCode,
          reason,
        });
      }
    } catch (err: any) {
      console.warn("Submission error notice:", err);
      // Fallback: trigger background beacon exit submission
      triggerForcefulExitSubmission(reason);
      setStage("SUBMITTED");
      setAutoConcludeNotice(null);
    } finally {
      setIsSubmitting(false);
    }
  }

  // Calculator evaluation helper
  function evaluateCalc() {
    try {
      const sanitized = calcInput.replace(/[^0-9+\-*/().]/g, "");
      // eslint-disable-next-line no-eval
      const result = Function(`'use strict'; return (${sanitized})`)();
      setCalcResult(String(result));
    } catch {
      setCalcResult("Error");
    }
  }

  // Format Timer
  const hours = Math.floor(secondsRemaining / 3600);
  const minutes = Math.floor((secondsRemaining % 3600) / 60);
  const seconds = secondsRemaining % 60;
  const timerDisplay = `${hours > 0 ? `${hours.toString().padStart(2, "0")}:` : ""}${minutes
    .toString()
    .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  const isTimeCritical = secondsRemaining < 300; // < 5 mins

  // Active section and filtered questions
  const sectionList = exam?.sections || [];
  const activeSection = sectionList.find((s) => s.id === activeSectionId) || sectionList[0];
  const currentSectionQuestions = (exam?.questions || []).filter(
    (q) => q.sectionId === activeSectionId
  );
  const activeQuestion = currentSectionQuestions[activeQuestionIndex];

  // Section Boundary & Next Section Navigation Resolution
  const currentSectionIndex = sectionList.findIndex((s) => s.id === (activeSection?.id || activeSectionId));
  const isLastQuestionInSection =
    currentSectionQuestions.length > 0 &&
    activeQuestionIndex === currentSectionQuestions.length - 1;
  const hasNextSection =
    currentSectionIndex !== -1 && currentSectionIndex < sectionList.length - 1;
  const nextSection = hasNextSection ? sectionList[currentSectionIndex + 1] : null;
  const nextSectionQuestions = nextSection
    ? (exam?.questions || []).filter((q) => q.sectionId === nextSection.id)
    : [];
  const isLastQuestionOfExam = isLastQuestionInSection && !hasNextSection;

  // Global question counts
  const totalQuestionsCount = (exam?.questions || []).length;
  const totalAnsweredCount = Object.keys(answers).length;
  const totalFlaggedCount = flaggedQuestions.size;
  const totalUnansweredCount = totalQuestionsCount - totalAnsweredCount;

  // =========================================================================
  // STAGE: CANDIDATE PRE-WAITING AREA & SCHEDULED AUTOMATIC COMMENCEMENT
  // =========================================================================
  if (stage === "WAITING_ROOM") {
    if (!waitingRoomData) {
      return (
        <div className="min-h-screen bg-slate-100/70 flex items-center justify-center p-4 font-sans">
          <div className="w-full max-w-md bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm text-center space-y-4">
            <div className="w-11 h-11 rounded-xl bg-blue-700 text-white flex items-center justify-center mx-auto shadow-xs font-bold text-base">
              K
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                Department of Research &amp; Development
              </span>
              <h1 className="text-base font-bold text-slate-900 tracking-tight pt-1">
                KARE-SES Candidate Waiting Lobby
              </h1>
              <p className="text-xs text-slate-500">
                Connecting to Institutional Examination Gateway...
              </p>
            </div>
            <div className="flex justify-center pt-2">
              <Loader2 className="w-5 h-5 animate-spin text-blue-700" />
            </div>
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
              <span className="flex items-center gap-1.5 text-emerald-700 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Secure Waiting Lobby Active
              </span>
              <span>Authoritative IST Clock</span>
            </div>
          </div>
        </div>
      );
    }

    const hours = Math.floor(waitingCountdown / 3600);
    const minutes = Math.floor((waitingCountdown % 3600) / 60);
    const seconds = waitingCountdown % 60;
    const isZero = waitingCountdown <= 0;
    const isConcluded = admissionStatus === "CONCLUDED";

    return (
      <div className="min-h-screen lg:h-screen lg:max-h-screen flex flex-col justify-center items-center p-3 sm:p-4 lg:p-5 bg-slate-100/70 overflow-hidden font-sans">
        <div className="w-full max-w-4xl lg:max-w-5xl bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 lg:p-6 shadow-sm flex flex-col justify-between max-h-[96vh] overflow-y-auto lg:overflow-hidden space-y-3.5">
          {/* Institutional Top Header */}
          <div className="border-b border-slate-100 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-blue-700 text-white flex items-center justify-center shadow-xs font-bold text-base shrink-0">
                K
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                    KARE-SES Ph.D Examination Engine
                  </span>
                  <span className="text-[10px] font-semibold text-slate-400 hidden sm:inline">•</span>
                  <span className="text-[11px] font-semibold text-slate-500 hidden sm:inline">Candidate Waiting Lobby</span>
                </div>
                <h1 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight truncate max-w-xl">
                  {waitingRoomData.exam.title || "Ph.D Research Eligibility & Entrance Examination"}
                </h1>
              </div>
            </div>

            <div className="flex items-center space-x-2 self-start sm:self-auto">
              <div
                className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border shadow-2xs ${
                  isConcluded
                    ? "bg-rose-50 text-rose-800 border-rose-200"
                    : isZero
                    ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                    : "bg-blue-50 text-blue-800 border-blue-200"
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isConcluded ? "bg-rose-500" : isZero ? "bg-emerald-500 animate-pulse" : "bg-blue-600"
                  }`}
                />
                <span>
                  {isConcluded
                    ? "Examination Concluded"
                    : isZero
                    ? "Exam Window Open"
                    : "Scheduled Start Pending"}
                </span>
              </div>

              <div className="hidden md:inline-flex items-center text-[10px] font-mono text-slate-500 bg-slate-100 px-2 py-1 rounded-lg border border-slate-200">
                IST: {liveEntranceIST || "Synchronized"}
              </div>
            </div>
          </div>

          {/* Special State: Examination Concluded */}
          {isConcluded ? (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 sm:p-8 text-center space-y-4 my-auto">
              <div className="w-12 h-12 rounded-full bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto shadow-2xs">
                <AlertCircle className="w-6 h-6" />
              </div>

              <div className="space-y-1.5 max-w-lg mx-auto">
                <h2 className="text-base font-bold text-slate-900">This Examination Has Concluded</h2>
                <p className="text-xs text-slate-600 leading-relaxed">
                  The scheduled examination window for <strong>{waitingRoomData.exam.title}</strong> has
                  officially ended. Access to question submission and the live sitting room is strictly closed.
                </p>
                {authError && (
                  <p className="text-[11px] text-rose-700 font-mono bg-rose-50/70 border border-rose-200 px-3 py-1.5 rounded-lg inline-block mt-2">
                    {authError}
                  </p>
                )}
              </div>

              {/* Candidate Info Ribbon */}
              <div className="inline-flex flex-wrap items-center justify-center gap-2 p-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-600 shadow-2xs">
                <span>
                  Candidate: <strong className="text-slate-900">{waitingRoomData.candidate.fullName}</strong>
                </span>
                <span className="text-slate-300">•</span>
                <span className="font-mono">
                  App ID: <strong className="text-blue-700">{waitingRoomData.candidate.applicationNumber || waitingRoomData.candidate.rollNumber || "N/A"}</strong>
                </span>
                <span className="text-slate-300">•</span>
                <span>
                  Dept: <strong className="text-slate-800">{waitingRoomData.candidate.department?.code || "GEN"}</strong>
                </span>
              </div>

              <div className="pt-2">
                <Link
                  href="/"
                  className="inline-flex items-center px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
                  <span>Return to Institutional Examination Portal Home</span>
                </Link>
              </div>
            </div>
          ) : (
            /* Standard Pre-Exam Waiting Room: 2-Column Grid */
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 lg:gap-5 items-stretch flex-1">
              {/* Left Column (7 cols): Digital Countdown, Enter Button, and Compact Camera */}
              <div className="lg:col-span-7 flex flex-col justify-between space-y-3">
                {/* Countdown Box */}
                <div className="bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 border border-blue-200/80 rounded-xl p-4 text-center space-y-3 shadow-2xs">
                  <div className="flex items-center justify-center space-x-1.5 text-[11px] font-bold text-blue-900 uppercase tracking-wider">
                    <Clock className="w-3.5 h-3.5 text-blue-700" />
                    <span>Time Until Examination Commences</span>
                  </div>

                  {/* 3 Compact Tiles */}
                  <div className="grid grid-cols-3 gap-2.5 max-w-xs mx-auto">
                    <div className="bg-white border border-slate-200 rounded-lg p-2 shadow-2xs">
                      <span className="block text-2xl sm:text-3xl font-extrabold font-mono text-slate-900">
                        {String(hours).padStart(2, "0")}
                      </span>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                        Hours
                      </span>
                    </div>
                    <div className="bg-white border border-slate-200 rounded-lg p-2 shadow-2xs">
                      <span className="block text-2xl sm:text-3xl font-extrabold font-mono text-blue-700">
                        {String(minutes).padStart(2, "0")}
                      </span>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                        Minutes
                      </span>
                    </div>
                    <div className="bg-white border border-slate-200 rounded-lg p-2 shadow-2xs">
                      <span className="block text-2xl sm:text-3xl font-extrabold font-mono text-blue-700">
                        {String(seconds).padStart(2, "0")}
                      </span>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                        Seconds
                      </span>
                    </div>
                  </div>

                  {/* Scheduled Start Ribbon */}
                  <div className="flex items-center justify-center gap-1.5 text-xs text-slate-600 border-t border-blue-100 pt-2">
                    <span className="text-slate-400 text-[11px]">Scheduled Start:</span>
                    <strong className="text-slate-800 text-[11px] font-bold">
                      {waitingRoomData.exam.startTimeIST || formatDateTime(waitingRoomData.exam.startTime, false, true)}
                    </strong>
                  </div>

                  {/* Enter Button */}
                  <div className="space-y-1 pt-0.5">
                    <button
                      type="button"
                      disabled={!isZero || isAdmittingAuto}
                      onClick={() => triggerAdmission(true)}
                      className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center space-x-2 select-none ${
                        isZero
                          ? "bg-blue-700 hover:bg-blue-800 text-white ring-2 ring-blue-500/20 cursor-pointer shadow-sm animate-pulse"
                          : "bg-slate-100 text-slate-400 border border-slate-300 cursor-not-allowed opacity-90"
                      }`}
                    >
                      {isAdmittingAuto ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                          <span>Admitting to Examination Page...</span>
                        </>
                      ) : isZero ? (
                        <>
                          <Unlock className="w-3.5 h-3.5 mr-1" />
                          <span>Enter Examination Now</span>
                          <ArrowRight className="w-3.5 h-3.5 ml-1" />
                        </>
                      ) : (
                        <>
                          <Lock className="w-3.5 h-3.5 mr-1 text-slate-400" />
                          <span>Enter (Locked until Scheduled Start Time)</span>
                        </>
                      )}
                    </button>

                    <p className="text-[10px] text-slate-500 text-center">
                      {isZero
                        ? "Scheduled start time reached! Admitting you automatically, or click above to enter."
                        : `Button unlocks automatically at scheduled start time (${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")} remaining).`}
                    </p>
                  </div>
                </div>

                {/* Compact Live Webcam Pre-Calibration Box */}
                <div className="bg-slate-50 border border-slate-200/90 rounded-xl p-2.5 sm:p-3 space-y-2">
                  <div className="flex items-center justify-between pb-1">
                    <span className="text-[11px] font-bold text-slate-800 flex items-center">
                      <Camera className="w-3.5 h-3.5 mr-1.5 text-blue-700" />
                      Live Pre-Exam Camera Diagnostics
                    </span>
                    <span
                      className={`text-[9px] font-bold px-2 py-0.5 rounded-full border flex items-center space-x-1 ${
                        isCameraActive
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-amber-50 text-amber-800 border-amber-200"
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          isCameraActive ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
                        }`}
                      />
                      <span>{isCameraActive ? "Camera Calibrated" : "Initializing Camera..."}</span>
                    </span>
                  </div>

                  <div className="relative rounded-lg overflow-hidden bg-slate-950 h-28 sm:h-32 border border-slate-200 shadow-inner flex items-center justify-center w-full">
                    <video
                      ref={waitingRoomVideoRef}
                      autoPlay
                      playsInline
                      muted
                      className={`w-full h-full object-cover ${isCameraActive ? "block" : "hidden"}`}
                    />
                    {!isCameraActive && (
                      <div className="p-3 text-center text-slate-400 text-xs space-y-1.5">
                        <CameraOff className="w-5 h-5 mx-auto text-slate-500" />
                        <p className="text-[10px] text-slate-400">
                          {cameraError || "Initializing video stream for proctoring verification..."}
                        </p>
                        <button
                          type="button"
                          onClick={initializeSecureCamera}
                          className="px-2.5 py-1 bg-blue-700 text-white rounded-lg text-[10px] font-bold hover:bg-blue-800 transition-colors cursor-pointer inline-flex items-center space-x-1"
                        >
                          <RefreshCw className="w-3 h-3 mr-1" />
                          <span>Enable Camera</span>
                        </button>
                      </div>
                    )}
                    {isCameraActive && (
                      <div className="absolute top-1.5 left-1.5 px-2 py-0.5 rounded-full bg-slate-900/80 text-emerald-300 border border-emerald-500/40 text-[9px] font-bold flex items-center space-x-1 backdrop-blur-xs">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        <span>LIVE PREVIEW • 640x480</span>
                      </div>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-500 text-center">
                    Webcam pre-warmed for seamless biometric surveillance with zero transition delay.
                  </p>
                </div>
              </div>

              {/* Right Column (5 cols): Verified Candidate Pass & Examination Details */}
              <div className="lg:col-span-5 flex flex-col justify-between space-y-3">
                {/* Candidate Pass Card */}
                <div className="bg-slate-50 border border-slate-200/90 rounded-xl p-3.5 space-y-2.5 shadow-2xs">
                  <div className="flex items-center justify-between border-b border-slate-200/70 pb-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 flex items-center">
                      <ShieldCheck className="w-3.5 h-3.5 mr-1 text-blue-700" />
                      Verified Candidate Pass
                    </span>
                    <span className="text-[9px] font-mono font-extrabold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      Roster Verified
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs">
                    <div>
                      <span className="text-slate-400 text-[10px] block">Candidate Name</span>
                      <strong className="text-slate-900 font-bold text-xs sm:text-sm block truncate">
                        {waitingRoomData.candidate.fullName || "Candidate"}
                      </strong>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-0.5">
                      <div>
                        <span className="text-slate-400 text-[10px] block">Application ID</span>
                        <span className="font-mono font-bold text-blue-700 text-xs bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200 inline-block">
                          {waitingRoomData.candidate.applicationNumber || waitingRoomData.candidate.rollNumber || "N/A"}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[10px] block">Department Track</span>
                        <span className="font-bold text-slate-800 text-xs truncate block" title={waitingRoomData.candidate.department?.name}>
                          {waitingRoomData.candidate.department?.code || "GEN"} • {waitingRoomData.candidate.department?.name || "Specialization"}
                        </span>
                      </div>
                    </div>

                    {waitingRoomData.candidate.email && (
                      <div className="pt-0.5">
                        <span className="text-slate-400 text-[10px] block">Institutional Email</span>
                        <span className="text-slate-600 font-mono text-[11px] truncate block">
                          {waitingRoomData.candidate.email}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Exam Parameters Summary */}
                <div className="bg-white border border-slate-200 rounded-xl p-3.5 space-y-2.5 shadow-2xs text-xs flex-1">
                  <h4 className="font-bold text-slate-900 flex items-center text-xs">
                    <BookOpen className="w-3.5 h-3.5 mr-1.5 text-blue-700" />
                    Examination Format &amp; Security
                  </h4>

                  <ul className="space-y-1.5 text-[11px] text-slate-600">
                    <li className="flex items-start space-x-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                      <span>
                        <strong>50 Questions Total:</strong> 25 Common Core + 25 Specialization Track.
                      </span>
                    </li>
                    <li className="flex items-start space-x-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                      <span>
                        <strong>Timed Window:</strong> {waitingRoomData.exam.durationMinutes || 90} Minutes synchronized with authoritative IST time.
                      </span>
                    </li>
                    <li className="flex items-start space-x-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                      <span>
                        <strong>Zero-Trust Watchdog:</strong> Fullscreen mode, face detection, and anti-tamper monitoring active.
                      </span>
                    </li>
                  </ul>
                </div>

                {/* System Readiness Strip */}
                <div className="p-2.5 bg-emerald-50/70 border border-emerald-200 rounded-xl flex items-center justify-between text-xs">
                  <span className="text-[11px] font-semibold text-emerald-900 flex items-center space-x-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>System Status: Pre-Flight Armed</span>
                  </span>
                  <span className="text-[10px] font-bold text-emerald-800 bg-white px-2 py-0.5 rounded border border-emerald-200 shadow-2xs">
                    Ready to Sit
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Clean Institutional Bottom Footer */}
          <div className="border-t border-slate-100 pt-2 flex flex-col sm:flex-row items-center justify-between text-[10px] text-slate-400 gap-1 text-center sm:text-left">
            <span>Kalasalingam Academy of Research and Education • Online Examination Engine</span>
            <span className="flex items-center gap-1 font-medium text-slate-500">
              <ShieldCheck className="w-3 h-3 text-emerald-600" />
              Secure Anti-Tamper Lockdown Active
            </span>
          </div>
        </div>

        {/* Off-Screen Video and Canvas for Pre-Wired Snapshot Synthesis */}
        <video
          ref={videoRef}
          playsInline
          autoPlay
          muted
          style={{
            position: "fixed",
            top: -9999,
            left: -9999,
            width: 640,
            height: 480,
            pointerEvents: "none",
            opacity: 0,
          }}
        />
        <canvas
          ref={canvasRef}
          width={640}
          height={480}
          style={{
            position: "fixed",
            top: -9999,
            left: -9999,
            width: 640,
            height: 480,
            pointerEvents: "none",
            opacity: 0,
          }}
        />
      </div>
    );
  }
  if (stage === "INSTRUCTIONS") {
    const candInitials = candidate?.fullName
      ? candidate.fullName
          .split(" ")
          .filter(Boolean)
          .slice(0, 2)
          .map((n) => n[0])
          .join("")
          .toUpperCase()
      : "C";

    return (
      <div className="min-h-screen lg:h-screen lg:max-h-screen w-full bg-slate-100/70 flex items-center justify-center p-2.5 sm:p-3.5 lg:p-4 font-sans lg:overflow-hidden select-none">
        <div className="w-full max-w-6xl lg:h-[95vh] lg:max-h-[730px] bg-white border border-slate-200/90 rounded-2xl p-3.5 sm:p-4 lg:p-5 shadow-sm flex flex-col justify-between lg:overflow-hidden gap-2.5">
          {/* Institutional Top Header */}
          <div className="border-b border-slate-100 pb-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shrink-0">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-blue-700 text-white flex items-center justify-center shadow-xs font-bold text-base shrink-0">
                K
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center space-x-2">
                  <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 uppercase tracking-wider">
                    Official Admission Confirmed
                  </span>
                  <span className="text-[10px] text-slate-400 font-semibold hidden sm:inline">•</span>
                  <span className="text-[11px] font-semibold text-slate-500 hidden sm:inline">Pre-Sitting Desk</span>
                </div>
                <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight leading-tight">
                  {exam?.title || "Ph.D Research Eligibility & Entrance Examination"}
                </h1>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span className="inline-flex items-center text-slate-600 font-medium">
                    <Clock className="w-3.5 h-3.5 mr-1 text-slate-400" />
                    Duration: <strong className="ml-1 text-slate-800">{exam?.durationMinutes || 90} Minutes</strong>
                  </span>
                  <span>•</span>
                  <span>Total: <strong className="text-slate-800">50 Questions</strong></span>
                  <span>•</span>
                  <span>Total Marks: <strong className="text-slate-800">50.0</strong></span>
                  <span>•</span>
                  <span className="text-blue-700 font-semibold">Two-Part Examination</span>
                </div>
              </div>
            </div>

            {/* Candidate Identity Card */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 flex items-center space-x-3 self-start sm:self-auto shadow-2xs shrink-0">
              <div className="w-9 h-9 rounded-full bg-blue-700 text-white flex items-center justify-center font-bold text-xs shadow-2xs shrink-0">
                {candInitials}
              </div>
              <div className="text-left text-xs leading-tight">
                <span className="font-bold text-slate-900 block text-xs sm:text-sm truncate max-w-[180px]">
                  {candidate?.fullName}
                </span>
                <div className="flex items-center space-x-1.5 mt-0.5">
                  <span className="font-mono text-[10px] text-blue-700 font-bold bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                    {candidate?.applicationNumber || candidate?.rollNumber || "ID"}
                  </span>
                  <span className="text-[10px] font-bold text-slate-600 bg-slate-200/70 px-1.5 py-0.5 rounded">
                    Dept: {candidate?.department}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Two-Column Layout: Left (Instructions in Clear Basic English) + Right (Webcam & Pre-Flight) */}
          <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-3 items-stretch lg:overflow-hidden">
            {/* Left Column (7 cols): Comprehensive & Categorized Instructions */}
            <div className="lg:col-span-7 flex flex-col justify-between gap-2 min-h-0 lg:overflow-hidden">
              {/* Card 1: Question Paper Structure & Scoring */}
              <div className="bg-slate-50/80 border border-slate-200/90 rounded-xl p-3 space-y-2 shadow-2xs text-xs">
                <h3 className="font-bold text-slate-900 flex items-center text-xs sm:text-sm">
                  <BookOpen className="w-4 h-4 mr-1.5 text-blue-700" />
                  1. Question Paper Pattern &amp; Scoring Scheme
                </h3>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 rounded-lg bg-white border border-slate-200/80">
                    <span className="font-bold text-slate-800 block text-xs">Part A — General Aptitude (25 Qs)</span>
                    <span className="text-slate-600 text-[11px] leading-tight block mt-0.5">Research Methodology, Logical Reasoning &amp; Quantitative Skills (Common).</span>
                  </div>
                  <div className="p-2 rounded-lg bg-white border border-slate-200/80">
                    <span className="font-bold text-slate-800 block text-xs">Part B — Core Specialization (25 Qs)</span>
                    <span className="text-slate-600 text-[11px] leading-tight block mt-0.5">Advanced domain questions mapped to your major (<strong>{candidate?.department || "Department"}</strong>).</span>
                  </div>
                </div>
                <div className="space-y-1 text-xs text-slate-600 pt-0.5">
                  <div className="flex items-center space-x-1.5">
                    <span className="font-bold text-blue-700">•</span>
                    <span><strong>Marks per Question:</strong> You receive <strong>+1.0 Mark</strong> for every correct answer (Total: 50.0 Marks).</span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <span className="font-bold text-blue-700">•</span>
                    {exam?.enableNegativeMarking ? (
                      <span className="text-amber-800 font-semibold">⚠️ <strong>Negative Marking:</strong> 0.25 Mark deducted per incorrect answer. Unanswered questions incur zero penalty.</span>
                    ) : (
                      <span className="text-emerald-700 font-semibold">✅ <strong>No Negative Marking:</strong> Zero penalty for incorrect answers. You are encouraged to attempt all 50 questions!</span>
                    )}
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <span className="font-bold text-blue-700">•</span>
                    <span><strong>Free Navigation:</strong> You can move forward, backward, mark questions for review, and change your answers anytime before final submission.</span>
                  </div>
                </div>
              </div>

              {/* Card 2: Essential Examination Rules & Anti-Cheat Protocols */}
              <div className="bg-slate-50/80 border border-slate-200/90 rounded-xl p-3 space-y-2 shadow-2xs text-xs">
                <h3 className="font-bold text-slate-900 flex items-center text-xs sm:text-sm">
                  <ShieldCheck className="w-4 h-4 mr-1.5 text-blue-700" />
                  2. Essential Examination Rules &amp; Anti-Cheat Regulations
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs leading-snug">
                  <div className="flex items-start space-x-2 p-2 rounded-lg bg-white border border-slate-200/80">
                    <span className="text-emerald-600 font-bold text-sm shrink-0">✔</span>
                    <div>
                      <strong className="text-slate-800 block text-xs">Mandatory Fullscreen Mode</strong>
                      <span className="text-slate-600 text-[11px]">Do not press <code className="bg-slate-100 px-1 py-0.2 rounded text-[10px]">Alt+Tab</code>, switch tabs, or minimize the browser. Doing so records an infraction strike.</span>
                    </div>
                  </div>
                  <div className="flex items-start space-x-2 p-2 rounded-lg bg-white border border-slate-200/80">
                    <span className="text-emerald-600 font-bold text-sm shrink-0">✔</span>
                    <div>
                      <strong className="text-slate-800 block text-xs">Keep Face Centered in Camera</strong>
                      <span className="text-slate-600 text-[11px]">Sit upright in clear lighting. If your face leaves the camera frame for over 10 seconds, a security strike is recorded.</span>
                    </div>
                  </div>
                  <div className="flex items-start space-x-2 p-2 rounded-lg bg-white border border-slate-200/80">
                    <span className="text-red-600 font-bold text-sm shrink-0">✖</span>
                    <div>
                      <strong className="text-slate-800 block text-xs">Do Not Refresh or Exit</strong>
                      <span className="text-slate-600 text-[11px]">Do not press <code className="bg-slate-100 px-1 py-0.2 rounded text-[10px]">F5</code> or <code className="bg-slate-100 px-1 py-0.2 rounded text-[10px]">Ctrl+R</code>. Shortcut keys are locked to prevent loss of your exam session.</span>
                    </div>
                  </div>
                  <div className="flex items-start space-x-2 p-2 rounded-lg bg-white border border-slate-200/80">
                    <span className="text-red-600 font-bold text-sm shrink-0">✖</span>
                    <div>
                      <strong className="text-slate-800 block text-xs">Work Strictly Alone</strong>
                      <span className="text-slate-600 text-[11px]">Mobile phones, second monitors, smartwatches, external notes, and other persons in the room are prohibited.</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Card 3: Automatic Saving & Invigilator Help */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {/* Auto-Save & Network */}
                <div className="bg-slate-50/80 border border-slate-200/90 rounded-xl p-2.5 sm:p-3 space-y-1 shadow-2xs">
                  <h4 className="font-bold text-slate-900 flex items-center text-xs">
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                    Automatic Answer Saving
                  </h4>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Every answer is saved instantly. If your internet disconnects temporarily, your answers stay safe on your computer and sync as soon as you reconnect.
                  </p>
                </div>

                {/* Built-in Aids & Helpdesk */}
                <div className="bg-slate-50/80 border border-slate-200/90 rounded-xl p-2.5 sm:p-3 space-y-1 shadow-2xs">
                  <h4 className="font-bold text-slate-900 flex items-center text-xs">
                    <HelpCircle className="w-3.5 h-3.5 mr-1 text-blue-700" />
                    Invigilator Helpdesk
                  </h4>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    If you have any doubt or technical issue during the exam, click the <strong>Helpdesk</strong> button at the top right to message the invigilator in real time.
                  </p>
                </div>
              </div>

              {/* Examiner Specific Notes (if any configured) */}
              {exam?.instructions && (
                <div className="p-2.5 bg-blue-50/70 border border-blue-200/80 rounded-xl space-y-0.5 text-xs">
                  <span className="font-bold text-blue-950 flex items-center text-xs">
                    <Sparkles className="w-3.5 h-3.5 mr-1 text-blue-700" />
                    Special Guidelines from the Examination Committee:
                  </span>
                  <p className="text-slate-700 whitespace-pre-line text-[11px] leading-relaxed pl-4 line-clamp-2">
                    {exam.instructions}
                  </p>
                </div>
              )}
            </div>

            {/* Right Column (5 cols): Pre-Exam Live Webcam Diagnostics & Environment Checklist */}
            <div className="lg:col-span-5 flex flex-col justify-between gap-2 min-h-0 lg:overflow-hidden">
              {/* Webcam Calibration Card */}
              <div className="bg-slate-50 border border-slate-200/90 rounded-xl p-3 space-y-2.5 flex-1 flex flex-col justify-between min-h-0">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2 shrink-0">
                  <span className="text-xs sm:text-sm font-bold text-slate-900 flex items-center">
                    <Camera className="w-4 h-4 mr-1.5 text-blue-700" />
                    Webcam &amp; Diagnostics Check
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border flex items-center space-x-1.5 ${
                      isCameraActive
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : "bg-amber-50 text-amber-800 border-amber-200"
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        isCameraActive ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
                      }`}
                    />
                    <span>{isCameraActive ? "Camera Calibrated" : "Calibration Required"}</span>
                  </span>
                </div>

                {/* Live Video Preview Box */}
                <div className="relative rounded-xl overflow-hidden bg-slate-950 h-32 sm:h-36 border border-slate-200 shadow-inner flex items-center justify-center shrink-0">
                  <video
                    ref={instructionsVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className={`w-full h-full object-cover ${isCameraActive ? "block" : "hidden"}`}
                  />
                  {!isCameraActive && (
                    <div className="p-4 text-center text-slate-400 text-xs space-y-2">
                      <CameraOff className="w-6 h-6 mx-auto text-slate-500" />
                      <p className="text-[11px] text-slate-400 leading-tight">
                        {cameraError || "Requesting camera stream for proctoring verification..."}
                      </p>
                      <button
                        type="button"
                        onClick={initializeSecureCamera}
                        className="px-3 py-1.5 bg-blue-700 text-white rounded-lg text-xs font-bold hover:bg-blue-800 transition-colors cursor-pointer inline-flex items-center space-x-1"
                      >
                        <RefreshCw className="w-3 h-3 mr-1" />
                        <span>Grant Camera Permission</span>
                      </button>
                    </div>
                  )}

                  {isCameraActive && (
                    <div className="absolute top-2 left-2 px-2.5 py-0.5 rounded-full bg-slate-900/80 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold flex items-center space-x-1.5 backdrop-blur-xs">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span>LIVE FEED • 640x480</span>
                    </div>
                  )}
                </div>

                {/* Pre-Flight Checklist */}
                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-white border border-slate-200/80">
                    <span className="text-slate-600 font-medium">Video Capture Device:</span>
                    <span className="font-semibold text-slate-900 truncate max-w-[170px]">
                      {cameraDeviceLabel}
                    </span>
                  </div>

                  <div className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-white border border-slate-200/80">
                    <span className="text-slate-600 font-medium">Fullscreen Security:</span>
                    <span className="font-semibold text-blue-700">Enforced on Start</span>
                  </div>

                  <div className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-white border border-slate-200/80">
                    <span className="text-slate-600 font-medium">Network Connection:</span>
                    <span className="font-semibold text-emerald-700 flex items-center">
                      <Wifi className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                      Connected &amp; Synced
                    </span>
                  </div>
                </div>
              </div>

              {/* Sitting Environment Readiness Checklist */}
              <div className="bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 space-y-1.5 text-xs shadow-2xs shrink-0">
                <span className="font-bold text-slate-900 flex items-center text-xs">
                  <UserCheck className="w-4 h-4 mr-1.5 text-blue-700" />
                  Desk &amp; Room Checklist
                </span>
                <ul className="space-y-1 text-xs text-slate-600">
                  <li className="flex items-center space-x-2">
                    <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Sit in a quiet, private room with no background noise.</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Desk is cleared of books, papers, and mobile phones.</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Webcam is facing directly forward with clear lighting.</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Rules Agreement & Action Ribbon */}
          <div className="pt-2.5 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
            <label className="flex items-center space-x-2.5 cursor-pointer select-none flex-1 min-w-0">
              <input
                type="checkbox"
                checked={hasAgreedRules}
                onChange={(e) => setHasAgreedRules(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer shrink-0"
              />
              <span className="text-xs text-slate-700 font-medium leading-relaxed">
                I confirm that I am <strong>{candidate?.fullName}</strong> (Application ID: <strong>{candidate?.applicationNumber || candidate?.rollNumber}</strong>). I have read and agree to all instructions and regulations in basic English above, and promise to sit this examination honestly without any unauthorized assistance.
              </span>
            </label>

            <button
              type="button"
              disabled={!hasAgreedRules}
              onClick={handleBeginExamination}
              className="px-6 py-2.5 text-xs sm:text-sm font-bold text-white bg-blue-700 hover:bg-blue-800 active:scale-[0.99] rounded-xl shadow-xs transition-all flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
            >
              <Maximize2 className="w-4 h-4" />
              <span>Begin Examination Now</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Off-Screen Video and Canvas for Pre-Wired Snapshot Synthesis */}
        <video
          ref={videoRef}
          playsInline
          autoPlay
          muted
          style={{
            position: "fixed",
            top: -9999,
            left: -9999,
            width: 640,
            height: 480,
            pointerEvents: "none",
            opacity: 0,
          }}
        />
        <canvas
          ref={canvasRef}
          width={640}
          height={480}
          style={{
            position: "fixed",
            top: -9999,
            left: -9999,
            width: 640,
            height: 480,
            pointerEvents: "none",
            opacity: 0,
          }}
        />
      </div>
    );
  }

  // =========================================================================
  // STAGE 3: POST-SUBMISSION VERIFIED RECEIPT SCREEN
  // =========================================================================
  if (stage === "SUBMITTED") {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="w-full max-w-xl bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-8 shadow-sm space-y-6 print:shadow-none print:border-none print:p-0">
          {/* Institutional Top Crest in Receipt */}
          <div className="text-center space-y-2 border-b border-slate-100 pb-5">
            <div
              className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto border shadow-xs ${
                submissionReason.includes("EXPIRED") || submissionReason.includes("EXIT")
                  ? "bg-amber-50 text-amber-700 border-amber-200"
                  : "bg-emerald-50 text-emerald-700 border-emerald-200"
              }`}
            >
              {submissionReason.includes("EXPIRED") ? (
                <Clock className="w-8 h-8" />
              ) : (
                <CheckCircle2 className="w-8 h-8" />
              )}
            </div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              {submissionReason === "SCHEDULE_EXPIRED"
                ? "Examination Concluded (Schedule Ended)"
                : submissionReason === "DURATION_EXPIRED"
                ? "Examination Concluded (Duration Expired)"
                : submissionReason.includes("EXIT")
                ? "Examination Auto-Submitted (Window Exit)"
                : "Examination Successfully Submitted"}
            </h1>
            <p className="text-xs text-slate-500">
              Kalasalingam Academy of Research and Education • Online Examination Services
            </p>
          </div>

          {/* Watchdog Notice Banner if Auto-Concluded */}
          {submissionReason.includes("EXPIRED") && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-xs text-amber-900 flex items-start space-x-2.5">
              <Clock className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <span className="font-bold">Authoritative Schedule Concluded:</span> The allocated examination time window has elapsed. All questions attempted up to this point have been safely captured, evaluated, and permanently secured.
              </div>
            </div>
          )}
          {submissionReason.includes("EXIT") && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3.5 text-xs text-red-900 flex items-start space-x-2.5">
              <AlertTriangle className="w-4 h-4 text-red-700 shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <span className="font-bold">Exit Protection Triggered:</span> Browser window exit or navigation was detected. The examination engine automatically secured and submitted your responses.
              </div>
            </div>
          )}

          {/* Official Verification Receipt Card */}
          <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-5 text-left text-xs space-y-3 print:bg-white print:border-slate-300">
            <div className="flex justify-between items-center border-b border-slate-200/80 pb-2.5">
              <span className="text-slate-500 font-medium">Submission Reference</span>
              <span className="font-mono font-extrabold text-blue-800 text-sm">
                {submissionReceipt?.referenceCode || `KARE-SUB-${sessionId.slice(0, 8).toUpperCase()}`}
              </span>
            </div>
            <div className="flex justify-between items-center border-b border-slate-200/80 pb-2.5">
              <span className="text-slate-500 font-medium">Examination Title</span>
              <span className="font-bold text-slate-900 text-right max-w-[260px] truncate">
                {exam?.title}
              </span>
            </div>
            <div className="flex justify-between items-center border-b border-slate-200/80 pb-2.5">
              <span className="text-slate-500 font-medium">Candidate Name</span>
              <span className="font-bold text-slate-900">{candidate?.fullName}</span>
            </div>
            <div className="flex justify-between items-center border-b border-slate-200/80 pb-2.5">
              <span className="text-slate-500 font-medium">Application Number</span>
              <span className="font-mono font-bold text-slate-800">
                {candidate?.applicationNumber || candidate?.rollNumber}
              </span>
            </div>
            {candidate?.email && (
              <div className="flex justify-between items-center border-b border-slate-200/80 pb-2.5">
                <span className="text-slate-500 font-medium">Registered Email</span>
                <span className="text-slate-700 font-mono text-[11px]">{candidate.email}</span>
              </div>
            )}
            <div className="flex justify-between items-center border-b border-slate-200/80 pb-2.5">
              <span className="text-slate-500 font-medium">Department Specialization</span>
              <span className="font-bold text-slate-800">{candidate?.department}</span>
            </div>
            <div className="flex justify-between items-center border-b border-slate-200/80 pb-2.5">
              <span className="text-slate-500 font-medium">Submission Mode</span>
              <span className="font-bold text-slate-800">
                {submissionReason === "SCHEDULE_EXPIRED"
                  ? "Auto-Concluded (Schedule Window End)"
                  : submissionReason === "DURATION_EXPIRED"
                  ? "Auto-Concluded (Duration Expired)"
                  : submissionReason.includes("EXIT")
                  ? "Auto-Submitted (Forceful Exit Protection)"
                  : "Verified Candidate Submission"}
              </span>
            </div>
            <div className="flex justify-between items-center border-b border-slate-200/80 pb-2.5">
              <span className="text-slate-500 font-medium">Questions Attempted</span>
              <span className="font-bold text-emerald-700">
                {totalAnsweredCount} of {totalQuestionsCount} questions
              </span>
            </div>
            <div className="flex justify-between items-center pt-0.5">
              <span className="text-slate-500 font-medium">Final Submission Timestamp</span>
              <span className="font-medium text-slate-800 font-mono" suppressHydrationWarning>
                {submissionReceipt?.submittedAt
                  ? formatDateTime(submissionReceipt.submittedAt)
                  : formatDateTime(new Date())}
              </span>
            </div>
          </div>

          {/* Forensic Integrity Seal */}
          <div className="bg-blue-50/70 border border-blue-200/80 rounded-xl p-3 flex items-start space-x-2.5 text-[11px] text-blue-900">
            <ShieldCheck className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Cryptographically Sealed:</span> This candidate paper has been archived, scored against the departmental answer key, and permanently recorded in the institutional database.
            </div>
          </div>

          {/* Action Buttons (Hidden when printing) */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 print:hidden">
            <Link
              href="/"
              className="w-full sm:w-auto px-5 py-2.5 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-colors text-center"
            >
              Return to Home Page
            </Link>
            <button
              type="button"
              onClick={() => window.print()}
              className="w-full sm:w-auto px-5 py-2.5 text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 rounded-xl shadow-xs transition-colors flex items-center justify-center space-x-1.5 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 mr-1" />
              <span>Print Official Receipt</span>
            </button>
          </div>
        </div>

        {/* Off-Screen Video and Canvas for Pre-Wired Snapshot Synthesis */}
        <video
          ref={videoRef}
          playsInline
          autoPlay
          muted
          style={{
            position: "fixed",
            top: -9999,
            left: -9999,
            width: 640,
            height: 480,
            pointerEvents: "none",
            opacity: 0,
          }}
        />
        <canvas
          ref={canvasRef}
          width={640}
          height={480}
          style={{
            position: "fixed",
            top: -9999,
            left: -9999,
            width: 640,
            height: 480,
            pointerEvents: "none",
            opacity: 0,
          }}
        />
      </div>
    );
  }

  // =========================================================================
  // STAGE 4: ACTIVE EXAMINATION ENGINE
  // =========================================================================
  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans select-none">
      {/* Navigation Locked Warning Banner */}
      {navLockWarning && (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 max-w-xl w-[92%] px-3 animate-in fade-in slide-in-from-top-3 duration-200">
          <div className="bg-amber-50 border border-amber-300 text-amber-950 rounded-xl p-3 shadow-lg flex items-center space-x-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            <div className="text-xs font-semibold leading-relaxed">{navLockWarning}</div>
          </div>
        </div>
      )}

      {/* Auto-Conclude Finalizing Overlay */}
      {autoConcludeNotice && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 max-w-md w-full shadow-2xl text-center space-y-4 animate-in zoom-in-95">
            <div className="w-14 h-14 rounded-full bg-blue-50 text-blue-700 flex items-center justify-center mx-auto border border-blue-200">
              <Clock className="w-7 h-7 animate-spin" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-base font-bold text-slate-900">Finalizing Examination</h3>
              <p className="text-xs text-slate-600 leading-relaxed">{autoConcludeNotice}</p>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
              <div className="bg-blue-600 h-1.5 rounded-full animate-pulse w-full" />
            </div>
            <p className="text-[11px] font-medium text-slate-400">
              Please wait while your answers are secured and cryptographically sealed.
            </p>
          </div>
        </div>
      )}

      {/* 1. Compensatory Extra Time Granted Banner */}
      {extraTimeNotice && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-40 bg-emerald-600 text-white px-5 py-2.5 rounded-full shadow-lg flex items-center space-x-2 text-xs font-bold border border-emerald-500 animate-in slide-in-from-top-4">
          <Clock className="w-4 h-4 text-white animate-spin" />
          <span>{extraTimeNotice}</span>
        </div>
      )}

      {/* Realtime Proctor Announcement Toast */}
      {proctorAnnouncement && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-40 bg-blue-700 text-white px-5 py-2.5 rounded-full shadow-lg flex items-center space-x-2 text-xs font-bold border border-blue-600 animate-in slide-in-from-top-4">
          <BookOpen className="w-4 h-4 text-white" />
          <span>📢 {proctorAnnouncement}</span>
        </div>
      )}

      {/* Official Invigilator Direct Warning Modal */}
      {proctorWarningMessage && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white border-2 border-amber-500 rounded-2xl p-6 shadow-2xl text-center space-y-4 animate-in zoom-in-95">
            <div className="w-14 h-14 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mx-auto border border-amber-300 animate-bounce">
              <AlertTriangle className="w-7 h-7" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-base font-black text-slate-900 uppercase tracking-tight">
                Official Invigilator Warning
              </h2>
              <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-xl p-3 font-semibold leading-relaxed">
                {proctorWarningMessage}
              </p>
              <p className="text-[11px] text-slate-500 pt-1">
                Please heed this warning immediately. Continued infractions will result in an automated strike and workstation freeze.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setProctorWarningMessage(null)}
              className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              I Understand &amp; Acknowledge
            </button>
          </div>
        </div>
      )}

      {/* 2. Face Absence Grace Countdown Warning Toast */}
      {faceWarningCountdown !== null && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500 text-white px-4 py-2.5 shadow-lg flex items-center justify-between border-b border-amber-600 animate-pulse">
          <div className="flex items-center space-x-2.5 text-xs font-bold">
            <AlertOctagon className="w-4 h-4 shrink-0 text-white" />
            <span>
              ⚠️ Security Warning: Face Not Detected in Camera View! Please look directly at the screen.
            </span>
          </div>
          <div className="text-xs font-black font-mono bg-black/25 px-2.5 py-1 rounded border border-white/20">
            Infraction Strike in {faceWarningCountdown}s
          </div>
        </div>
      )}

      {/* 3. Mandatory Fullscreen Exited Alert Overlay */}
      {isFullscreenExited && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white border-2 border-red-500 rounded-3xl p-6 shadow-2xl text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto border-2 border-red-300 animate-bounce">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight">
                SECURITY ALERT: FULLSCREEN EXITED
              </h2>
              <p className="text-xs text-red-600 font-bold leading-relaxed">
                You have exited the mandatory fullscreen examination environment.
              </p>
              <p className="text-xs text-slate-600 leading-relaxed">
                The Safe Exam Watchdog requires fullscreen mode at all times. Return to fullscreen immediately to prevent an automatic infraction strike and workstation lock.
              </p>
            </div>

            <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center justify-between text-xs font-bold text-red-900">
              <span>Automatic Infraction Strike in:</span>
              <span className="font-mono text-base font-extrabold text-red-700">
                {fullscreenGraceCountdown}s
              </span>
            </div>

            <button
              type="button"
              onClick={enterFullscreen}
              className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-md transition-colors flex items-center justify-center space-x-2 cursor-pointer"
            >
              <Maximize2 className="w-4 h-4 mr-1" />
              <span>Return to Fullscreen Now</span>
            </button>
          </div>
        </div>
      )}

      {/* 4. High-Precision Exam Header Bar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 px-4 py-2.5 shadow-2xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          {/* Left: Branding & Candidate Profile */}
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-blue-700 text-white flex items-center justify-center font-bold text-sm shadow-2xs">
              K
            </div>
            <div>
              <h1 className="text-xs sm:text-sm font-bold text-slate-900 leading-tight truncate max-w-xs sm:max-w-md">
                {exam?.title}
              </h1>
              <div className="flex items-center space-x-2 text-[11px] text-slate-500">
                <span className="font-semibold text-slate-700">{candidate?.fullName}</span>
                <span>•</span>
                <span className="font-mono text-blue-800 font-semibold">
                  {candidate?.applicationNumber || candidate?.rollNumber}
                </span>
                <span>•</span>
                <span className="bg-purple-50 text-purple-700 px-1.5 py-0.2 rounded font-bold text-[10px] border border-purple-200">
                  {candidate?.department}
                </span>
              </div>
            </div>
          </div>

          {/* Right: Digital Timer, Sync Status & Submit Button */}
          <div className="flex items-center space-x-3 flex-shrink-0">
            {/* Sync Status Badge */}
            <div
              className={`hidden md:flex items-center space-x-1.5 px-2 py-1 rounded-md text-[10px] font-semibold border ${
                isOnline
                  ? "bg-slate-50 text-slate-600 border-slate-200"
                  : "bg-amber-50 text-amber-800 border-amber-200"
              }`}
            >
              {isOnline ? (
                <>
                  <Wifi className="w-3 h-3 text-emerald-600" />
                  <span>Synced ({lastSyncedTime})</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3 h-3 text-amber-600" />
                  <span>Buffering Offline</span>
                </>
              )}
            </div>

            {/* Proctor Camera Status */}
            <button
              type="button"
              onClick={() => setIsCameraPreviewOpen(true)}
              className="inline-flex items-center px-2 py-1 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 transition-colors cursor-pointer shadow-2xs"
              title="Click to verify proctor camera angle"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-600 mr-1.5 animate-pulse" />
              <Camera className="w-3.5 h-3.5 mr-1 text-emerald-700" />
              <span className="hidden sm:inline">Proctor Cam Active</span>
            </button>

            {/* Strikes Counter */}
            {strikes > 0 && (
              <div className="flex items-center space-x-1 px-2 py-1 rounded-md bg-red-50 text-red-800 border border-red-200 text-xs font-bold">
                <ShieldAlert className="w-3.5 h-3.5 text-red-600" />
                <span>
                  {strikes}/{exam?.maxStrikes || 3} Strikes
                </span>
              </div>
            )}

            {/* Indian Server Time (IST) Clock */}
            <div
              className="hidden sm:flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border bg-slate-50 text-slate-800 border-slate-200/90 font-mono text-xs font-bold shadow-2xs"
              title="Authoritative Indian Standard Time (IST, UTC+05:30) synchronized with examination server"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
              <span className="text-[10px] text-slate-500 font-sans uppercase font-bold tracking-wider">
                Server IST:
              </span>
              <span className="text-slate-900 font-extrabold">{currentServerIST}</span>
            </div>

            {/* Countdown Timer */}
            <div
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border font-mono text-xs font-extrabold shadow-2xs ${
                isTimeCritical
                  ? "bg-red-50 text-red-700 border-red-300 animate-pulse"
                  : "bg-slate-50 text-slate-900 border-slate-200"
              }`}
              title="Time remaining in examination window"
            >
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              <span>{timerDisplay} Remaining</span>
            </div>

            {/* Digital Aids Quick Toggles */}
            {exam?.calculatorMode && exam.calculatorMode !== "NONE" && (
              <button
                type="button"
                onClick={() => setIsCalculatorOpen(true)}
                className="p-1.5 text-slate-600 hover:text-blue-700 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors cursor-pointer"
                title={`Open Virtual Calculator (${exam.calculatorMode})`}
              >
                <Calculator className="w-4 h-4" />
              </button>
            )}

            {exam?.enableScratchpad !== false && (
              <button
                type="button"
                onClick={() => setIsScratchpadOpen(true)}
                className="p-1.5 text-slate-600 hover:text-blue-700 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors cursor-pointer"
                title="Open Digital Scratchpad (Rough Working Space)"
              >
                <FileEdit className="w-4 h-4" />
              </button>
            )}

            {/* Ask Invigilator / Doubt Button */}
            <button
              type="button"
              onClick={() => {
                setIsHelpdeskOpen(true);
                setUnreadProctorReplies(0);
                setHelpdeskQuestionNumber(activeQuestionIndex + 1);
              }}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg shadow-2xs transition-all cursor-pointer relative"
              title="Ask examination invigilator a question doubt or report issue"
            >
              <MessageSquare className="w-3.5 h-3.5 text-blue-700" />
              <span className="hidden sm:inline">Ask Invigilator</span>
              {unreadProctorReplies > 0 && (
                <span className="w-2 h-2 rounded-full bg-red-600 absolute -top-0.5 -right-0.5 ring-2 ring-white animate-pulse" />
              )}
            </button>

            {/* Final Submit Button */}
            <button
              type="button"
              onClick={() => setIsSubmitModalOpen(true)}
              className="px-3.5 py-1.5 text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 rounded-lg shadow-2xs transition-all cursor-pointer"
            >
              Finish &amp; Submit
            </button>
          </div>
        </div>
      </header>

      {/* 5. Main Sitting Workspace */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-4 grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column (8 cols): Active Question Surface */}
        <main className="lg:col-span-8 flex flex-col space-y-3">
          {/* Section Selector Ribbon */}
          <div className="bg-white border border-slate-200/90 rounded-xl p-2 shadow-2xs flex items-center space-x-2 overflow-x-auto">
            {(exam?.sections || []).map((sec) => {
              const isSelected = sec.id === activeSectionId;
              const secQuestions = (exam?.questions || []).filter((q) => q.sectionId === sec.id);
              const secAnsweredCount = secQuestions.filter((q) => answers[q.id]?.length > 0).length;

              return (
                <button
                  key={sec.id}
                  type="button"
                  onClick={() => {
                    setActiveSectionId(sec.id);
                    setActiveQuestionIndex(0);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center space-x-2 ${
                    isSelected
                      ? sec.is_common
                        ? "bg-blue-50 text-blue-900 border border-blue-200 shadow-2xs"
                        : "bg-purple-50 text-purple-900 border border-purple-200 shadow-2xs"
                      : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <span>{sec.title}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                      isSelected
                        ? "bg-white text-slate-800 border border-slate-200"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {secAnsweredCount}/{secQuestions.length}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Question Paper Card */}
          {activeQuestion ? (
            <div className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-xs flex-1 flex flex-col justify-between space-y-6">
              {/* Question Header */}
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center space-x-2">
                    <span className="w-7 h-7 rounded-lg bg-blue-700 text-white font-extrabold text-xs flex items-center justify-center">
                      Q{activeQuestionIndex + 1}
                    </span>
                    <span className="text-xs font-semibold text-slate-500">
                      of {currentSectionQuestions.length} in this section
                    </span>
                  </div>

                  <div className="flex items-center space-x-2">
                    <span className="text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                      1 Mark
                    </span>
                    {exam?.enableNegativeMarking && (
                      <span className="text-[11px] font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded border border-red-200">
                        -{activeQuestion.negativePoints || 0.25} Mark
                      </span>
                    )}
                    {exam?.enableQuestionFlagging !== false && (
                      <button
                        type="button"
                        onClick={() => toggleFlag(activeQuestion.id)}
                        className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer border ${
                          flaggedQuestions.has(activeQuestion.id)
                            ? "bg-amber-100 text-amber-800 border-amber-300"
                            : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        <Flag className="w-3.5 h-3.5 mr-1 text-amber-600 fill-current" />
                        <span>{flaggedQuestions.has(activeQuestion.id) ? "Marked" : "Review"}</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Prompt Text */}
                <div className="text-[15px] font-semibold text-slate-900 leading-relaxed space-y-3 py-1">
                  <MathText as="p" className="leading-relaxed" text={activeQuestion.prompt} />

                  {/* Code Snippet if applicable */}
                  {activeQuestion.codeSnippet && !isBogusDepartmentSnippet(activeQuestion.codeSnippet) && (
                    <div className="p-3.5 bg-slate-900 text-emerald-400 font-mono text-xs rounded-xl overflow-x-auto shadow-2xs">
                      <pre>{activeQuestion.codeSnippet}</pre>
                    </div>
                  )}
                </div>

                {/* Options List */}
                <div className="space-y-2.5 pt-2">
                  {activeQuestion.options.map((opt, optIdx) => {
                    const letters = ["A", "B", "C", "D", "E", "F"];
                    const letter = letters[optIdx] || String(optIdx + 1);
                    const isSelected = (answers[activeQuestion.id] || []).includes(opt.id);

                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() =>
                          handleSelectOption(
                            activeQuestion.id,
                            opt.id,
                            activeQuestion.questionType === "MCQ_MULTIPLE"
                          )
                        }
                        className={`w-full text-left p-3.5 min-h-[46px] rounded-xl border text-xs sm:text-[13px] font-medium transition-all flex items-center justify-between cursor-pointer ${
                          isSelected
                            ? "bg-blue-50/80 border-blue-600 text-blue-950 font-semibold ring-1 ring-blue-600/20"
                            : "bg-white border-slate-200 text-slate-800 hover:bg-slate-50 hover:border-slate-300"
                        }`}
                      >
                        <div className="flex items-center space-x-3 flex-1 min-w-0 pr-2">
                          <span
                            className={`w-6 h-6 rounded-md flex items-center justify-center font-bold text-xs flex-shrink-0 ${
                              isSelected
                                ? "bg-blue-700 text-white"
                                : "bg-slate-100 text-slate-600 border border-slate-200"
                            }`}
                          >
                            {letter}
                          </span>
                          <MathText as="span" className="leading-normal flex-1 text-slate-900" text={opt.text} />
                        </div>
                        {isSelected && (
                          <div className="w-5 h-5 rounded-full bg-blue-700 text-white flex items-center justify-center flex-shrink-0">
                            <Check className="w-3 h-3" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Section Boundary Transition Alert Banner */}
              {isLastQuestionInSection && hasNextSection && nextSection && (
                <div className="p-4 rounded-xl bg-gradient-to-r from-blue-50 via-indigo-50/70 to-blue-50 border border-blue-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-2 duration-200">
                  <div className="flex items-center space-x-3">
                    <div className="w-9 h-9 rounded-xl bg-blue-700 text-white flex items-center justify-center font-bold text-xs flex-shrink-0 shadow-2xs">
                      <Layers className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900 flex items-center space-x-1.5">
                        <span>End of {activeSection?.title || "Section"}</span>
                        <span className="text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.2 rounded font-mono font-extrabold">
                          {currentSectionQuestions.length}/{currentSectionQuestions.length} Qs
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-600 font-medium mt-0.5">
                        You have reached the end of this section. Proceed to{" "}
                        <strong className="text-blue-900 font-bold">{nextSection.title}</strong>{" "}
                        ({nextSectionQuestions.length} questions remaining).
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveSectionId(nextSection.id);
                      setActiveQuestionIndex(0);
                    }}
                    className="inline-flex items-center justify-center px-4 py-2 rounded-xl text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 shadow-xs transition-all cursor-pointer whitespace-nowrap self-stretch sm:self-auto"
                  >
                    <span>Proceed to {nextSection.is_common ? "Part A" : "Part B"}</span>
                    <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                  </button>
                </div>
              )}

              {/* Bottom Navigation Toolbar */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
                <button
                  type="button"
                  disabled={activeQuestionIndex === 0}
                  onClick={() => setActiveQuestionIndex((prev) => Math.max(0, prev - 1))}
                  className="inline-flex items-center px-4 py-2 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
                  <span>Previous</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleClearOption(activeQuestion.id)}
                  disabled={!answers[activeQuestion.id]?.length}
                  className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-red-600 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <RotateCcw className="w-3 h-3 mr-1" />
                  <span>Clear Response</span>
                </button>

                {isLastQuestionInSection ? (
                  hasNextSection && nextSection ? (
                    <button
                      type="button"
                      onClick={() => {
                        setActiveSectionId(nextSection.id);
                        setActiveQuestionIndex(0);
                      }}
                      className="inline-flex items-center px-4 py-2 text-xs font-bold text-white bg-gradient-to-r from-blue-700 to-indigo-700 hover:from-blue-800 hover:to-indigo-800 rounded-xl shadow-xs transition-all cursor-pointer ring-2 ring-blue-500/20"
                      title={`Proceed to next section: ${nextSection.title}`}
                    >
                      <span>Continue to Next Section</span>
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsSubmitModalOpen(true)}
                      className="inline-flex items-center px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition-all cursor-pointer"
                      title="Review answers and submit examination"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                      <span>Review &amp; Submit Paper</span>
                    </button>
                  )
                ) : (
                  <button
                    type="button"
                    onClick={() =>
                      setActiveQuestionIndex((prev) =>
                        Math.min(currentSectionQuestions.length - 1, prev + 1)
                      )
                    }
                    className="inline-flex items-center px-4 py-2 text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 rounded-xl shadow-2xs transition-all cursor-pointer"
                  >
                    <span>Next Question</span>
                    <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-400 text-xs">
              No questions found in this section.
            </div>
          )}
        </main>

        {/* Right Column (4 cols): Question Navigation Palette */}
        <aside className="lg:col-span-4 space-y-3">
          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs space-y-4">
            <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center">
                <Layers className="w-3.5 h-3.5 mr-1.5 text-blue-700" />
                Question Palette
              </h3>
              <span className="text-[11px] font-bold text-slate-600">
                {totalAnsweredCount}/{totalQuestionsCount} Answered
              </span>
            </div>

            {/* Status Legend */}
            <div className="grid grid-cols-2 gap-2 text-[10px] font-semibold text-slate-600">
              <div className="flex items-center space-x-1.5">
                <span className="w-3.5 h-3.5 rounded bg-emerald-600 text-white flex items-center justify-center text-[8px] font-bold">
                  ✓
                </span>
                <span>Answered ({totalAnsweredCount})</span>
              </div>
              {exam?.enableQuestionFlagging !== false && (
                <div className="flex items-center space-x-1.5">
                  <span className="w-3.5 h-3.5 rounded bg-amber-400 text-amber-950 flex items-center justify-center text-[8px] font-bold">
                    ★
                  </span>
                  <span>Marked ({totalFlaggedCount})</span>
                </div>
              )}
              <div className="flex items-center space-x-1.5">
                <span className="w-3.5 h-3.5 rounded bg-slate-100 border border-slate-300 text-slate-500" />
                <span>Unanswered ({totalUnansweredCount})</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="w-3.5 h-3.5 rounded bg-blue-700 text-white" />
                <span>Current Active</span>
              </div>
            </div>

            {/* Section Switcher Tabs inside Palette */}
            {(exam?.sections || []).length > 1 && (
              <div className="flex items-center gap-1.5 p-1 bg-slate-100/90 rounded-xl border border-slate-200">
                {(exam?.sections || []).map((sec) => {
                  const isSecActive = sec.id === (activeSection?.id || activeSectionId);
                  const sQuestions = (exam?.questions || []).filter((q) => q.sectionId === sec.id);
                  const sAnswered = sQuestions.filter((q) => (answers[q.id] || []).length > 0).length;
                  return (
                    <button
                      key={sec.id}
                      type="button"
                      onClick={() => {
                        setActiveSectionId(sec.id);
                        setActiveQuestionIndex(0);
                      }}
                      className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center justify-center space-x-1.5 ${
                        isSecActive
                          ? "bg-white text-blue-900 shadow-2xs border border-slate-200 font-extrabold"
                          : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
                      }`}
                      title={sec.title}
                    >
                      <span className="truncate">{sec.is_common ? "Part A (Common)" : "Part B (Dept)"}</span>
                      <span
                        className={`text-[10px] font-mono px-1.5 py-0.2 rounded-md ${
                          isSecActive
                            ? "bg-blue-50 text-blue-800 font-extrabold"
                            : "bg-slate-200 text-slate-600 font-bold"
                        }`}
                      >
                        {sAnswered}/{sQuestions.length}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Matrix of Questions in Active Section */}
            <div className="pt-1">
              <div className="flex items-center justify-between mb-2 pb-1 border-b border-slate-100">
                <span className="text-[11px] font-bold text-slate-800 truncate max-w-[200px]" title={activeSection?.title}>
                  {activeSection?.title || "Active Section"}
                </span>
                <span className="text-[10px] font-extrabold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                  {currentSectionQuestions.length} Questions
                </span>
              </div>
              <div className="grid grid-cols-5 gap-2 max-h-[440px] overflow-y-auto p-1 pr-1.5">
                {currentSectionQuestions.map((q, idx) => {
                  const isCurrent = idx === activeQuestionIndex;
                  const isAnswered = (answers[q.id] || []).length > 0;
                  const isFlagged = flaggedQuestions.has(q.id);

                  let colorClass = "bg-white text-slate-700 border-slate-200 hover:bg-slate-50";
                  if (isCurrent) {
                    colorClass = "bg-blue-700 text-white border-blue-700 font-extrabold shadow-2xs";
                  } else if (isFlagged) {
                    colorClass = "bg-amber-100 text-amber-900 border-amber-300 font-bold";
                  } else if (isAnswered) {
                    colorClass = "bg-emerald-600 text-white border-emerald-600 font-bold";
                  }

                  return (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => setActiveQuestionIndex(idx)}
                      className={`h-9 rounded-lg border text-xs flex items-center justify-center transition-all cursor-pointer ${colorClass}`}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* =====================================================================
          MODAL 1: SUBMISSION CONFIRMATION
         ===================================================================== */}
      {isSubmitModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-6 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-slate-900">
              Submit Examination Paper?
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Once submitted, your session will be locked and finalized. Please verify your progress before confirming:
            </p>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-600">Total Questions:</span>
                <span className="font-bold text-slate-900">{totalQuestionsCount}</span>
              </div>
              <div className="flex justify-between text-emerald-700 font-semibold">
                <span>Answered:</span>
                <span>{totalAnsweredCount}</span>
              </div>
              <div className="flex justify-between text-amber-700 font-semibold">
                <span>Marked for Review:</span>
                <span>{totalFlaggedCount}</span>
              </div>
              <div className="flex justify-between text-red-600 font-semibold">
                <span>Unanswered:</span>
                <span>{totalUnansweredCount}</span>
              </div>
            </div>

            {totalUnansweredCount > 0 && (
              <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-800 font-semibold flex items-center space-x-1.5">
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-amber-600" />
                <span>You have {totalUnansweredCount} unanswered questions remaining.</span>
              </div>
            )}

            <div className="pt-2 flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={() => setIsSubmitModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl cursor-pointer"
              >
                Return to Exam
              </button>
              <button
                type="button"
                onClick={() => submitFinalExam("NORMAL")}
                disabled={isSubmitting}
                className="inline-flex items-center px-4 py-2 text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    <span>Finalizing...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5 mr-1.5" />
                    <span>Confirm Final Submit</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 2: IN-EXAM VIRTUAL CALCULATOR
         ===================================================================== */}
      {isCalculatorOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-72 bg-white border border-slate-200 rounded-2xl p-4 shadow-2xl space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="text-xs font-bold text-slate-800 flex items-center">
                <Calculator className="w-3.5 h-3.5 mr-1.5 text-blue-700" />
                Digital Calculator
              </span>
              <button
                type="button"
                onClick={() => setIsCalculatorOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Screen */}
            <div className="p-3 bg-slate-100 rounded-xl text-right font-mono space-y-1">
              <div className="text-xs text-slate-500 overflow-x-auto">{calcInput || "0"}</div>
              <div className="text-lg font-bold text-slate-900 overflow-x-auto">{calcResult || "0"}</div>
            </div>

            {/* Buttons */}
            <div className="grid grid-cols-4 gap-1.5 text-xs font-bold">
              {["7", "8", "9", "/"].map((b) => (
                <button
                  key={b}
                  type="button"
                  onClick={() => setCalcInput((p) => p + b)}
                  className="p-2.5 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 cursor-pointer"
                >
                  {b}
                </button>
              ))}
              {["4", "5", "6", "*"].map((b) => (
                <button
                  key={b}
                  type="button"
                  onClick={() => setCalcInput((p) => p + b)}
                  className="p-2.5 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 cursor-pointer"
                >
                  {b}
                </button>
              ))}
              {["1", "2", "3", "-"].map((b) => (
                <button
                  key={b}
                  type="button"
                  onClick={() => setCalcInput((p) => p + b)}
                  className="p-2.5 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 cursor-pointer"
                >
                  {b}
                </button>
              ))}
              {["0", ".", "C", "+"].map((b) => (
                <button
                  key={b}
                  type="button"
                  onClick={() => (b === "C" ? (setCalcInput(""), setCalcResult("")) : setCalcInput((p) => p + b))}
                  className={`p-2.5 rounded-lg border cursor-pointer ${
                    b === "C"
                      ? "bg-red-50 text-red-700 border-red-200"
                      : "bg-slate-50 hover:bg-slate-100 border-slate-200"
                  }`}
                >
                  {b}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={evaluateCalc}
              className="w-full py-2 bg-blue-700 text-white rounded-xl text-xs font-bold shadow-2xs hover:bg-blue-800 cursor-pointer"
            >
              = (Calculate)
            </button>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 3: IN-EXAM DIGITAL SCRATCHPAD
         ===================================================================== */}
      {isScratchpadOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white border border-slate-200 rounded-2xl p-4 shadow-2xl space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="text-xs font-bold text-slate-800 flex items-center">
                <FileEdit className="w-3.5 h-3.5 mr-1.5 text-blue-700" />
                Candidate Digital Scratchpad
              </span>
              <button
                type="button"
                onClick={() => setIsScratchpadOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <textarea
              value={scratchpadText}
              onChange={(e) => setScratchpadText(e.target.value)}
              placeholder="Rough notes, calculations and working steps..."
              rows={10}
              className="w-full p-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono text-slate-800"
            />
            <div className="flex justify-between items-center text-[10px] text-slate-400">
              <span>Saved locally for the duration of this sitting.</span>
              <button
                type="button"
                onClick={() => setScratchpadText("")}
                className="text-red-600 hover:underline font-semibold cursor-pointer"
              >
                Clear Pad
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 4: WORKSTATION LOCKOUT OVERLAY (REMOTE PROCTOR OR STRIKES)
         ===================================================================== */}
      {isWorkstationLocked && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4 select-none">
          <div className="w-full max-w-md bg-white border border-red-300 rounded-3xl p-6 sm:p-7 shadow-2xl text-center space-y-4 animate-in fade-in zoom-in-95 duration-200">
            {/* Pulsing Lock Icon */}
            <div className="w-14 h-14 rounded-2xl bg-red-100 text-red-700 flex items-center justify-center mx-auto border-2 border-red-200 shadow-2xs animate-pulse">
              <ShieldAlert className="w-7 h-7" />
            </div>

            {/* Lockout Details */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-red-700 bg-red-50 border border-red-200 px-2.5 py-0.5 rounded-full">
                Security Interlock Active
              </span>
              <h2 className="text-base font-black text-slate-900 uppercase tracking-tight pt-1">
                Workstation Locked
              </h2>
              <p className="text-xs text-red-600 font-semibold leading-relaxed">
                {lockoutReason || "Examination sitting suspended due to security threshold or proctor command."}
              </p>
              <p className="text-[11px] text-slate-500 pt-1 leading-relaxed">
                Your answers are safely preserved in the database. You can chat directly with the examination invigilator below for assistance or an unlock review.
              </p>
            </div>

            {/* Realtime Unread Message Alert Banner */}
            {unreadProctorReplies > 0 && (
              <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between text-xs text-blue-900 font-bold animate-pulse text-left">
                <div className="flex items-center space-x-2 min-w-0 flex-1">
                  <MessageCircle className="w-4 h-4 text-blue-600 shrink-0" />
                  <span className="truncate">New reply from invigilator!</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsHelpdeskOpen(true);
                    setUnreadProctorReplies(0);
                  }}
                  className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[11px] font-bold shadow-2xs transition-all cursor-pointer shrink-0 ml-2"
                >
                  View Message
                </button>
              </div>
            )}

            {/* Action Buttons: Chat with Proctor & Quick Appeal */}
            <div className="pt-1 space-y-2">
              <button
                type="button"
                onClick={() => {
                  setIsHelpdeskOpen(true);
                  setUnreadProctorReplies(0);
                  setHelpdeskCategory("LOCKOUT_APPEAL");
                  if (!helpdeskMessage.trim()) {
                    setHelpdeskMessage(
                      "My workstation has been locked. I request invigilator review and assistance to unlock my exam."
                    );
                  }
                }}
                className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs rounded-xl shadow-xs hover:shadow-md transition-all flex items-center justify-center space-x-2 cursor-pointer active:scale-98"
              >
                <MessageSquare className="w-4 h-4 text-white" />
                <span>Chat with Invigilator / Appeal Unlock</span>
                {unreadProctorReplies > 0 && (
                  <span className="bg-red-500 text-white text-[10px] font-black px-1.5 py-0.2 rounded-full ml-1 animate-bounce">
                    {unreadProctorReplies}
                  </span>
                )}
              </button>

              <button
                type="button"
                disabled={isSendingLockoutAppeal || lockoutAppealSent}
                onClick={async () => {
                  if (isSendingLockoutAppeal || lockoutAppealSent || !token || !sessionId) return;
                  setIsSendingLockoutAppeal(true);
                  try {
                    const appealMsg = `⚠️ [URGENT LOCKOUT APPEAL] Candidate ${candidate?.fullName || "Candidate"} (${candidate?.applicationNumber || "ID"}) workstation is locked. Requesting immediate verification and screen unlock.`;
                    const res = await fetch("/api/exam/chat", {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                      },
                      body: JSON.stringify({
                        token,
                        sessionId,
                        message: appealMsg,
                        category: "LOCKOUT_APPEAL",
                      }),
                    });
                    if (res.ok) {
                      setLockoutAppealSent(true);
                      setHelpdeskMessages((prev) => [
                        ...prev,
                        {
                          id: `appeal_${Date.now()}`,
                          sender: "CANDIDATE",
                          message: appealMsg,
                          category: "LOCKOUT_APPEAL",
                          createdAt: new Date().toISOString(),
                        },
                      ]);
                    }
                  } catch (err) {
                    console.warn("Lockout appeal dispatch notice:", err);
                  } finally {
                    setIsSendingLockoutAppeal(false);
                  }
                }}
                className="w-full py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl border border-slate-200 transition-all flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {lockoutAppealSent ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 mr-1" />
                    <span className="text-emerald-700">Digital Hand Raised • Invigilator Alerted</span>
                  </>
                ) : isSendingLockoutAppeal ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-600 mr-1" />
                    <span>Alerting Invigilation Desk...</span>
                  </>
                ) : (
                  <>
                    <Bell className="w-3.5 h-3.5 text-amber-600 mr-1" />
                    <span>Raise Digital Hand (Instant Alert)</span>
                  </>
                )}
              </button>
            </div>

            {/* Session & Strike Audit Footer */}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-center space-x-2 text-[10px] text-slate-400 font-mono">
              <span>Session: {sessionId.slice(0, 8)}</span>
              <span>•</span>
              <span className="font-semibold text-red-500">
                Strikes: {strikes} / {exam?.maxStrikes || 3}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 5: CANDIDATE CAMERA ANGLE VERIFICATION
         ===================================================================== */}
      {isCameraPreviewOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white border border-slate-200 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center space-x-2">
                <Camera className="w-4 h-4 text-emerald-600" />
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-tight">
                  Proctor Camera Verification
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCameraPreviewOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="relative rounded-xl overflow-hidden bg-slate-900 aspect-video border border-slate-200 shadow-inner flex items-center justify-center">
              {isCameraActive ? (
                <video
                  ref={(el) => {
                    if (el && streamRef.current) el.srcObject = streamRef.current;
                  }}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="text-center text-slate-400 text-xs p-4">
                  <CameraOff className="w-6 h-6 mx-auto mb-1 text-slate-500" />
                  <span>Webcam feed initializing...</span>
                </div>
              )}
              <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-emerald-900/80 text-emerald-300 border border-emerald-500/40 text-[9px] font-bold flex items-center space-x-1 backdrop-blur-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>MONITORED • 640x480 @ 15fps</span>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 text-[11px] text-slate-600 space-y-1">
              <div className="flex justify-between font-medium">
                <span className="text-slate-500">Camera Device:</span>
                <span className="text-slate-800 font-semibold truncate max-w-[170px]">
                  {cameraDeviceLabel}
                </span>
              </div>
              <div className="flex justify-between font-medium">
                <span className="text-slate-500">Integrity Protocol:</span>
                <span className="text-emerald-700 font-bold">Continuous Watchdog</span>
              </div>
            </div>

            <p className="text-[10px] text-slate-400 leading-relaxed text-center">
              Your camera runs in the background. High-resolution evidentiary snapshots are recorded only if unauthorized activities or face departures occur.
            </p>

            <button
              type="button"
              onClick={() => setIsCameraPreviewOpen(false)}
              className="w-full py-2 bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              Return to Examination
            </button>
          </div>
        </div>
      )}

      {/* =====================================================================
          FLOATING CANDIDATE HELPDESK & DOUBT ACTION BUTTON
         ===================================================================== */}
      <div className="fixed bottom-5 right-5 z-40 print:hidden">
        <button
          type="button"
          onClick={() => {
            setIsHelpdeskOpen(true);
            setUnreadProctorReplies(0);
            setHelpdeskQuestionNumber(activeQuestionIndex + 1);
          }}
          className="px-4 py-2.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-lg hover:shadow-xl transition-all flex items-center space-x-2 border border-blue-500 cursor-pointer group active:scale-95"
          title="Open Contact Invigilator / Ask Doubt Panel"
        >
          <MessageCircle className="w-4 h-4 text-white group-hover:rotate-12 transition-transform" />
          <span>Contact Invigilator / Doubt</span>
          {unreadProctorReplies > 0 && (
            <span className="bg-red-500 text-white text-[10px] font-extrabold px-1.5 py-0.2 rounded-full animate-bounce">
              {unreadProctorReplies}
            </span>
          )}
        </button>
      </div>

      {/* =====================================================================
          PROCTOR REALTIME REPLY TOAST NOTIFICATION
         ===================================================================== */}
      {proctorReplyToast && !isHelpdeskOpen && (
        <div className="fixed bottom-20 right-5 z-40 max-w-sm w-[92%] bg-white border-2 border-blue-600 rounded-2xl p-3.5 shadow-2xl animate-in slide-in-from-bottom-3 duration-200">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center space-x-2">
              <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs flex-shrink-0">
                <MessageSquare className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-700 block">
                  Official Invigilator Response
                </span>
                <p className="text-xs font-semibold text-slate-800 line-clamp-2">
                  {proctorReplyToast.message}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setProctorReplyToast(null)}
              className="text-slate-400 hover:text-slate-600 text-xs p-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <button
            type="button"
            onClick={() => {
              setIsHelpdeskOpen(true);
              setUnreadProctorReplies(0);
              setProctorReplyToast(null);
            }}
            className="mt-2 text-[10px] font-bold text-blue-700 hover:underline block text-right cursor-pointer"
          >
            Open Conversation &rarr;
          </button>
        </div>
      )}

      {/* =====================================================================
          MODAL 6: CANDIDATE HELPDESK & DOUBT ASSISTANCE MODAL
         ===================================================================== */}
      {isHelpdeskOpen && (
        <div className="fixed inset-0 z-[70] bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-2xl bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-white via-slate-50 to-blue-50/30 flex-shrink-0">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs border border-blue-200">
                  <MessageSquare className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Contact Examination Invigilator / Live Chat
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Send a real-time message regarding workstation lock, question doubt, or technical assistance.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsHelpdeskOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
              {/* Alert Notice */}
              {inquiryNotice && (
                <div
                  className={`p-3 rounded-xl border text-xs font-semibold flex items-center space-x-2 ${
                    inquiryNotice.type === "success"
                      ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                      : "bg-red-50 text-red-800 border-red-200"
                  }`}
                >
                  {inquiryNotice.type === "success" ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />
                  )}
                  <span>{inquiryNotice.text}</span>
                </div>
              )}

              {/* Category Selector Chips */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                  Select Category:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {[
                    { id: "LOCKOUT_APPEAL", label: "🔓 Workstation Locked" },
                    { id: "QUESTION_DOUBT", label: "❓ Question Doubt" },
                    { id: "TECH_ISSUE", label: "⚙️ Technical Issue" },
                    { id: "SUBMISSION_ISSUE", label: "⏱️ Time / Timer" },
                    { id: "GENERAL_DOUBT", label: "💬 General Doubt" },
                  ].map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setHelpdeskCategory(cat.id as any)}
                      className={`p-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer text-center ${
                        helpdeskCategory === cat.id
                          ? "bg-blue-50 text-blue-900 border-blue-600 ring-2 ring-blue-600/20"
                          : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Question Number (if category is QUESTION_DOUBT) */}
              {helpdeskCategory === "QUESTION_DOUBT" && (
                <div className="flex items-center space-x-2 bg-slate-50 border border-slate-200 rounded-xl p-2.5">
                  <span className="text-xs font-bold text-slate-700 whitespace-nowrap">
                    Regarding Question #:
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={totalQuestionsCount || 100}
                    value={helpdeskQuestionNumber || ""}
                    onChange={(e) => setHelpdeskQuestionNumber(parseInt(e.target.value) || null)}
                    className="w-20 px-2 py-1 text-xs bg-white border border-slate-200 rounded-lg font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-600"
                    placeholder="Q#"
                  />
                  <span className="text-[11px] text-slate-400">
                    (Current question on screen: Question #{activeQuestionIndex + 1})
                  </span>
                </div>
              )}

              {/* Quick Template Chips */}
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Quick Query Suggestions:
                </span>
                <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 text-xs">
                  {[
                    "My workstation is locked. Please verify and unlock my screen.",
                    "Option choices seem ambiguous or unclear.",
                    "Mathematical formula / symbol not displaying properly.",
                    "Brief lag noticed when selecting an option.",
                    "Requesting hall invigilator to visit my workstation.",
                  ].map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setHelpdeskMessage(preset)}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-blue-50 hover:text-blue-700 border border-slate-200 text-slate-600 text-[11px] font-medium whitespace-nowrap cursor-pointer transition-colors"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* Message Composer Input */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                  Message Description:
                </label>
                <textarea
                  value={helpdeskMessage}
                  onChange={(e) => setHelpdeskMessage(e.target.value)}
                  placeholder="Explain your doubt or issue clearly to the invigilator..."
                  rows={3}
                  className="w-full p-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 font-medium text-slate-900 resize-none shadow-2xs"
                />
              </div>

              {/* Dispatch Action */}
              <div className="flex justify-end">
                <button
                  type="button"
                  disabled={isSendingInquiry || !helpdeskMessage.trim()}
                  onClick={handleSendCandidateInquiry}
                  className="px-5 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer flex items-center space-x-1.5 disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isSendingInquiry ? "Dispatching..." : "Send to Invigilator"}</span>
                </button>
              </div>

              {/* Live Conversation Stream with Invigilator */}
              <div className="pt-3 border-t border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Conversation History ({helpdeskMessages.length})
                  </h4>
                  <span className="text-[10px] text-slate-400">
                    Live updates stream in real time
                  </span>
                </div>

                {helpdeskMessages.length === 0 ? (
                  <div className="p-6 text-center text-slate-400 text-xs bg-slate-50 rounded-xl border border-slate-200/80">
                    No inquiries dispatched yet. Select a category and type your query above if you need assistance.
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                    {helpdeskMessages.map((item) => {
                      const isCandidate = item.sender === "CANDIDATE";

                      return (
                        <div
                          key={item.id}
                          className={`p-3 rounded-xl text-xs space-y-1 ${
                            isCandidate
                              ? "bg-slate-50 border border-slate-200 text-slate-800 ml-4"
                              : "bg-blue-50 border border-blue-200 text-blue-950 mr-4"
                          }`}
                        >
                          <div className="flex items-center justify-between text-[10px]">
                            <span className="font-bold">
                              {isCandidate ? "You (Candidate)" : "🛡️ Invigilator Desk"}
                            </span>
                            <span className="text-slate-400" suppressHydrationWarning>
                              {formatTime(item.createdAt, true)}
                            </span>
                          </div>
                          {item.questionNumber && (
                            <span className="inline-block text-[9px] font-extrabold bg-purple-100 text-purple-800 px-1.5 py-0.2 rounded border border-purple-200">
                              Regarding Q#{item.questionNumber}
                            </span>
                          )}
                          <p className="leading-relaxed font-medium">{item.message}</p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end flex-shrink-0">
              <button
                type="button"
                onClick={() => setIsHelpdeskOpen(false)}
                className="px-4 py-1.5 text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors cursor-pointer"
              >
                Close Support Desk
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Off-Screen Video and Canvas for Evidentiary Watermarked Snapshot Synthesis */}
      <video
        ref={videoRef}
        playsInline
        autoPlay
        muted
        style={{
          position: "fixed",
          top: -9999,
          left: -9999,
          width: 640,
          height: 480,
          pointerEvents: "none",
          opacity: 0,
        }}
      />
      <canvas
        ref={canvasRef}
        width={640}
        height={480}
        style={{
          position: "fixed",
          top: -9999,
          left: -9999,
          width: 640,
          height: 480,
          pointerEvents: "none",
          opacity: 0,
        }}
      />
    </div>
  );
}
