"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { formatTime, formatDateTime } from "@/lib/date";
import { supabaseClient } from "@/lib/supabase/client";
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
} from "lucide-react";

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

  // Lifecycle States
  const [stage, setStage] = useState<"AUTH_GATE" | "INSTRUCTIONS" | "ACTIVE_EXAM" | "SUBMITTED">("AUTH_GATE");
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

  // Submission Flow
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionReceipt, setSubmissionReceipt] = useState<any>(null);

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

  // Webcam & Security Watchdog States (Zero-Lag Background Camera + Watermark Engine)
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const instructionsVideoRef = useRef<HTMLVideoElement | null>(null);
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
    setIsCameraActive(false);
  }

  // Pre-initialize camera during INSTRUCTIONS to avoid focus loss during ACTIVE_EXAM
  useEffect(() => {
    if (stage === "INSTRUCTIONS") {
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

  // Keep instructions preview video wired when stream changes
  useEffect(() => {
    if (stage === "INSTRUCTIONS" && instructionsVideoRef.current && streamRef.current) {
      instructionsVideoRef.current.srcObject = streamRef.current;
      instructionsVideoRef.current.play().catch(() => {});
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

  // Transition from INSTRUCTIONS to ACTIVE_EXAM with mandatory Fullscreen
  async function handleBeginExamination() {
    await enterFullscreen();
    setStage("ACTIVE_EXAM");
  }

  // Generate Evidentiary Watermarked JPEG Frame (Canvas 2D)
  function captureWatermarkedSnapshot(violationType: string): string | null {
    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < 2) return null;

      const ctx = canvas.getContext("2d");
      if (!ctx) return null;

      canvas.width = 640;
      canvas.height = 480;

      // 1. Draw raw camera frame
      ctx.drawImage(video, 0, 0, 640, 480);

      // 2. Draw Forensic Watermark Overlay at bottom 76px
      const barHeight = 76;
      const barY = 480 - barHeight;

      // Semi-transparent deep slate banner
      ctx.fillStyle = "rgba(15, 23, 42, 0.92)";
      ctx.fillRect(0, barY, 640, barHeight);

      // Crimson security accent line
      ctx.fillStyle = "#DC2626";
      ctx.fillRect(0, barY, 640, 3);

      // Row 1: Header / Watchdog Label
      ctx.font = "bold 10px monospace, sans-serif";
      ctx.fillStyle = "#38BDF8"; // Sky-400
      ctx.fillText(
        "KARE-SES SECURE EXAM INTEGRITY WATCHDOG • FORENSIC AUDIT EVIDENCE",
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

      // Row 3: Infraction Type & Strike Counter (Prominent Red)
      ctx.font = "bold 11px monospace, sans-serif";
      ctx.fillStyle = "#F87171"; // Red-400
      const strikeNum = (strikes || 0) + 1;
      const maxStrk = exam?.maxStrikes || 3;
      ctx.fillText(
        `INFRACTION: ${violationType}  [Strike #${strikeNum} of ${maxStrk}]`,
        14,
        barY + 54
      );

      // Row 4: Hardware Fingerprint & IST Server Timestamp (Slate-400)
      ctx.font = "9px monospace, sans-serif";
      ctx.fillStyle = "#94A3B8"; // Slate-400
      const istTimeStr = formatDateTime(new Date(), true, true);
      const hwStr = `HW: ${sessionId ? sessionId.slice(0, 16) : "BROWSER-SIM"}`;
      ctx.fillText(`TIME: ${istTimeStr}  •  ${hwStr}`, 14, barY + 68);

      return canvas.toDataURL("image/jpeg", 0.75);
    } catch (err) {
      console.warn("Watermarked frame grabber exception:", err);
      return null;
    }
  }

  // Report Security Violation to Telemetry Backend (/api/telemetry/violation)
  async function reportSecurityViolation(violationType: string, reason?: string) {
    if (!token || !sessionId) return;

    // 3-second cooldown to prevent event flood cascades
    const now = Date.now();
    if (now - lastViolationTimeRef.current < 3000) return;
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
          },
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (typeof data.currentStrikes === "number") {
          setStrikes(data.currentStrikes);
        }
        if (data.isLocked) {
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

  // Strict Browser Security & Interceptors (DevTools, Reload, Clipboard, Shortcuts, Focus)
  useEffect(() => {
    if (stage !== "ACTIVE_EXAM") return;

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
      e.preventDefault();
      e.returnValue = "";
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
    if (stage !== "ACTIVE_EXAM" || !sessionId) return;

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
      .subscribe();

    return () => {
      supabaseClient.removeChannel(channel);
    };
  }, [stage, sessionId, exam]);

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
    examData: ExamData
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

    setStage("INSTRUCTIONS");
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

  // Server-Authoritative Countdown Timer
  useEffect(() => {
    if (stage !== "ACTIVE_EXAM") return;

    const timer = setInterval(() => {
      if (examEndTime) {
        const currentServerTime = Date.now() + clockSkewMs;
        const remaining = Math.max(
          0,
          Math.floor((new Date(examEndTime).getTime() - currentServerTime) / 1000)
        );
        setSecondsRemaining(remaining);
        if (remaining <= 0) {
          clearInterval(timer);
          handleAutoSubmit();
        }
      } else {
        setSecondsRemaining((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            handleAutoSubmit();
            return 0;
          }
          return prev - 1;
        });
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [stage, examEndTime, clockSkewMs]);

  // Periodic Unified Telemetry Heartbeat (Single 10-Second Interval)
  useEffect(() => {
    if (stage !== "ACTIVE_EXAM" || !token || !sessionId) return;

    let isHeartbeatRunning = false;

    async function sendUnifiedHeartbeat() {
      if (isHeartbeatRunning || !isOnline || !token || !sessionId) return;
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

  // Auto-submit when time expires
  function handleAutoSubmit() {
    alert("Examination time has expired. Your responses are being automatically finalized.");
    submitFinalExam();
  }

  // Final Submit Handler
  async function submitFinalExam() {
    if (!token || !sessionId) return;
    setIsSubmitting(true);

    try {
      const payloadAnswers = Object.entries(answers).map(([qId, opts]) => ({
        questionId: qId,
        selectedOptionIds: opts,
      }));

      const res = await fetch("/api/exam/submit", {
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

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to submit examination.");
        setIsSubmitting(false);
        return;
      }

      setSubmissionReceipt(data);
      setStage("SUBMITTED");
      setIsSubmitModalOpen(false);

      // Clean local cache
      localStorage.removeItem(`exam_answers_${sessionId}`);

      // Exit fullscreen mode cleanly upon submission
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }

      // Notify C# Host Client if running in WebView2
      if ((window as any).chrome?.webview) {
        (window as any).chrome.webview.postMessage({
          type: "EXAM_SUBMITTED",
          referenceCode: data.referenceCode,
        });
      }
    } catch (err: any) {
      alert(err.message || "Network error submitting examination.");
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

  // Filter questions for active section
  const currentSectionQuestions = (exam?.questions || []).filter(
    (q) => q.sectionId === activeSectionId
  );
  const activeQuestion = currentSectionQuestions[activeQuestionIndex];

  // Global question counts
  const totalQuestionsCount = (exam?.questions || []).length;
  const totalAnsweredCount = Object.keys(answers).length;
  const totalFlaggedCount = flaggedQuestions.size;
  const totalUnansweredCount = totalQuestionsCount - totalAnsweredCount;

  // =========================================================================
  // STAGE 1: AUTHENTICATION GATE (CANDIDATE ENTRANCE)
  // =========================================================================
  if (stage === "AUTH_GATE") {
    if (isAuthenticating && (searchParams.get("token") || searchParams.get("ticket"))) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white border border-slate-200/90 rounded-2xl p-8 shadow-sm text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-700 text-white flex items-center justify-center mx-auto shadow-xs font-bold text-lg">
              K
            </div>
            <h1 className="text-base font-bold text-slate-900 tracking-tight">
              Loading Secure Examination Environment...
            </h1>
            <p className="text-xs text-slate-500">
              Verifying candidate credentials and loading curriculum papers...
            </p>
            <div className="flex justify-center pt-2">
              <Loader2 className="w-6 h-6 animate-spin text-blue-700" />
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="w-full max-w-lg bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
          {/* Institution Crest */}
          <div className="text-center space-y-1.5">
            <div className="w-12 h-12 rounded-2xl bg-blue-700 text-white flex items-center justify-center mx-auto shadow-xs font-bold text-lg">
              K
            </div>
            <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight pt-1">
              KARE-SES Candidate Exam Portal
            </h1>
            <p className="text-xs text-slate-500">
              Kalasalingam Academy of Research and Education • Online Examination Engine
            </p>
          </div>

          {/* Guidance Banner */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 text-xs text-slate-600 flex items-start space-x-2.5">
            <ShieldCheck className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
            <div className="text-[11px] leading-relaxed">
              <span className="font-bold text-slate-800">Secure Candidate Entrance:</span> Enter your registered email ID, your official Application ID (as password), and the exam security passcode.
            </div>
          </div>

          {/* Institutional Indian Server Time (IST) Clock */}
          <div className="bg-slate-50 border border-slate-200/90 rounded-xl px-3.5 py-2.5 flex items-center justify-between text-xs">
            <div className="flex items-center space-x-2 text-slate-700">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-bold text-slate-800 text-xs">Server Time (IST):</span>
            </div>
            <div className="font-mono font-bold text-blue-700 text-xs">
              {liveEntranceIST || "Synchronizing IST..."}
            </div>
          </div>

          {lateEntryNotice && (
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-300 text-xs text-amber-900 space-y-2.5 shadow-2xs">
              <div className="flex items-start space-x-2.5">
                <Clock className="w-4 h-4 flex-shrink-0 text-amber-700 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-bold text-amber-950 text-xs">
                    Late Arrival Gatekeeping Active (+{lateEntryNotice.delayMinutes} mins late)
                  </div>
                  <div className="text-[11px] text-amber-800 leading-relaxed">
                    The scheduled entry grace period expired at {formatTime(lateEntryNotice.graceCutoff, false, true)}. Your arrival has been submitted to the Chief Proctor. Once an invigilator grants an exception, click below to enter.
                  </div>
                </div>
              </div>
              <button
                type="button"
                disabled={isAuthenticating}
                onClick={handleAuthenticate}
                className="w-full py-2 px-3 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-xs transition-colors flex items-center justify-center space-x-1.5 shadow-2xs cursor-pointer disabled:opacity-50"
              >
                <RotateCcw className="w-3.5 h-3.5 mr-1" />
                <span>Check Proctor Approval &amp; Retry</span>
              </button>
            </div>
          )}

          {authError && !lateEntryNotice && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800 font-semibold flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-600" />
              <span>{authError}</span>
            </div>
          )}

          <form onSubmit={handleAuthenticate} className="space-y-4">
            {/* Field 1: Candidate Email ID */}
            <div>
              <label className="text-xs font-bold text-slate-700 flex items-center justify-between mb-1.5">
                <span className="flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-blue-700" />
                  Institutional / Registered Email ID
                </span>
                <span className="text-[10px] text-slate-400 font-normal">Candidate Account</span>
              </label>
              <input
                type="email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="e.g. scholar@klu.ac.in or candidate@gmail.com"
                className="w-full px-3.5 py-2.5 text-xs bg-slate-50/70 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 text-slate-900 font-medium transition-all"
                required
              />
            </div>

            {/* Field 2: Application ID as Password */}
            <div>
              <label className="text-xs font-bold text-slate-700 flex items-center justify-between mb-1.5">
                <span className="flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-blue-700" />
                  Application ID (Password)
                </span>
                <span className="text-[10px] bg-blue-50 text-blue-700 font-semibold px-2 py-0.5 rounded border border-blue-200">
                  Acts as Password
                </span>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="e.g. 2026PHD001 or KARE2026MCA"
                  className="w-full pl-3.5 pr-10 py-2.5 text-xs bg-slate-50/70 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 font-mono font-bold text-slate-900 uppercase transition-all tracking-wider"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                  tabIndex={-1}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Your official Application Number acts as your secret password for this sitting.
              </p>
            </div>

            {/* Field 3: Examination Security Passcode */}
            <div>
              <label className="text-xs font-bold text-slate-700 flex items-center justify-between mb-1.5">
                <span className="flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-blue-700" />
                  Examination Security Passcode
                </span>
                <span className="text-[10px] text-slate-400 font-normal">From Hall Ticket</span>
              </label>
              <input
                type="text"
                value={loginPasscode}
                onChange={(e) => setLoginPasscode(e.target.value)}
                placeholder="Enter 6-8 digit passcode printed on slip"
                className="w-full px-3.5 py-2.5 text-xs bg-slate-50/70 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 font-mono text-slate-900 font-bold tracking-widest transition-all"
                required
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Security code issued on your exam slip or invigilator announcement.
              </p>
            </div>

            <button
              type="submit"
              disabled={isAuthenticating}
              className="w-full py-2.5 text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 rounded-xl shadow-xs transition-colors flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50 mt-1"
            >
              {isAuthenticating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-1" />
                  <span>Verifying Credentials...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4 mr-1" />
                  <span>Authenticate &amp; Enter Examination</span>
                </>
              )}
            </button>
          </form>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
            <span className="flex items-center gap-1.5 text-emerald-700 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              Secure Web Lockdown Active
            </span>
            <span>Continuous Telemetry &amp; Anti-Tamper Protected</span>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // STAGE 2: INSTRUCTIONS & PRE-FLIGHT SYSTEM DIAGNOSTICS SCREEN
  // =========================================================================
  if (stage === "INSTRUCTIONS") {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-3 sm:p-6 font-sans">
        <div className="w-full max-w-5xl bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
          {/* Institutional Top Header */}
          <div className="border-b border-slate-100 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 uppercase tracking-wider">
                CANDIDATE ADMISSION CONFIRMED
              </span>
              <h1 className="text-lg sm:text-xl font-bold text-slate-900 pt-0.5">
                {exam?.title}
              </h1>
              <p className="text-xs text-slate-500">
                Duration: {exam?.durationMinutes} Minutes • Two-Part Department Examination
              </p>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-right text-xs space-y-0.5">
              <span className="font-bold text-slate-900 block">{candidate?.fullName}</span>
              <span className="text-slate-600 font-mono text-[11px] block">
                {candidate?.applicationNumber || candidate?.rollNumber}
              </span>
              <span className="text-blue-700 font-semibold text-[10px] block">
                Department: {candidate?.department}
              </span>
            </div>
          </div>

          {/* Two-Column Layout: Left (Rules & Curriculum) + Right (Webcam Diagnostics) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column (7 cols): Exam Rules & Curriculum Guidelines */}
            <div className="lg:col-span-7 space-y-4">
              <div className="space-y-3 text-xs text-slate-700 leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-200/80">
                <h3 className="font-bold text-slate-900 flex items-center">
                  <ShieldCheck className="w-4 h-4 mr-1.5 text-blue-700" />
                  Online Examination Integrity &amp; Sitting Rules
                </h3>
                <ul className="space-y-2 list-disc pl-5 text-slate-600 text-[11px]">
                  <li>
                    <strong>Part A &amp; Part B Structure:</strong> The question paper comprises <strong>Part A (Common Core Research Aptitude)</strong> and <strong>Part B (Department Core Specialization)</strong>. You may freely navigate between sections.
                  </li>
                  <li>
                    <strong>Mandatory Fullscreen Mode:</strong> The examination runs strictly in Fullscreen. Exiting fullscreen, pressing <code>Alt+Tab</code>, switching browser tabs, or launching other windows immediately registers an official infraction strike.
                  </li>
                  <li>
                    <strong>Continuous Webcam Proctoring:</strong> Your webcam stays active throughout the session. If your face leaves the camera viewport for more than 10 seconds, a security strike is recorded.
                  </li>
                  <li>
                    <strong>Tamper-Proof Keystroke Shield:</strong> Developer Tools (<code>F12</code>), browser reload (<code>F5</code>), printing (<code>Ctrl+P</code>), and clipboard copy/paste shortcuts are strictly disabled.
                  </li>
                  <li>
                    <strong>Real-Time Persistence:</strong> Every answer you select is immediately preserved locally and synchronized to the examination servers every 15 seconds.
                  </li>
                  <li>
                    <strong>Marking Policy:</strong>{" "}
                    {exam?.enableNegativeMarking
                      ? "Negative marking is ENABLED for this examination."
                      : "Negative marking is DISABLED (no deduction for incorrect attempts)."}
                  </li>
                  <li>
                    <strong>Permitted Digital Tools:</strong> Virtual Calculator:{" "}
                    <span className="font-bold">
                      {exam?.calculatorMode && exam.calculatorMode !== "NONE"
                        ? `Enabled (${exam.calculatorMode})`
                        : "Disabled"}
                    </span>
                    {" • "}Scratchpad:{" "}
                    <span className="font-bold">
                      {exam?.enableScratchpad !== false ? "Enabled" : "Disabled"}
                    </span>
                    {" • "}Review Flagging:{" "}
                    <span className="font-bold">
                      {exam?.enableQuestionFlagging !== false ? "Enabled" : "Disabled"}
                    </span>
                  </li>
                </ul>

                {exam?.instructions && (
                  <div className="mt-3 pt-3 border-t border-slate-200/60">
                    <span className="font-bold text-slate-800 block mb-1">
                      Paper-Specific Guidelines:
                    </span>
                    <p className="text-slate-600 whitespace-pre-line text-[11px] leading-relaxed">
                      {exam.instructions}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column (5 cols): Pre-Exam Live Webcam Diagnostics */}
            <div className="lg:col-span-5 space-y-4">
              <div className="bg-slate-50 border border-slate-200/90 rounded-xl p-4 space-y-3.5">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <span className="text-xs font-bold text-slate-900 flex items-center">
                    <Camera className="w-4 h-4 mr-1.5 text-blue-700" />
                    Webcam &amp; Diagnostics Check
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center space-x-1 ${
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
                <div className="relative rounded-xl overflow-hidden bg-slate-950 aspect-video border border-slate-200 shadow-inner flex items-center justify-center">
                  <video
                    ref={instructionsVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className={`w-full h-full object-cover ${isCameraActive ? "block" : "hidden"}`}
                  />
                  {!isCameraActive && (
                    <div className="p-4 text-center text-slate-400 text-xs space-y-2">
                      <CameraOff className="w-7 h-7 mx-auto text-slate-500" />
                      <p className="text-[11px] text-slate-400">
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
                    <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-slate-900/80 text-emerald-300 border border-emerald-500/40 text-[9px] font-bold flex items-center space-x-1 backdrop-blur-xs">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span>LIVE FEED • 640x480</span>
                    </div>
                  )}
                </div>

                {/* Pre-Flight Checklist */}
                <div className="space-y-2 pt-1 text-[11px]">
                  <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200/80">
                    <span className="text-slate-600 font-medium">Video Capture Device:</span>
                    <span className="font-semibold text-slate-900 truncate max-w-[170px]">
                      {cameraDeviceLabel}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200/80">
                    <span className="text-slate-600 font-medium">Fullscreen Security:</span>
                    <span className="font-semibold text-blue-700">Enforced on Start</span>
                  </div>

                  <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200/80">
                    <span className="text-slate-600 font-medium">Network Connection:</span>
                    <span className="font-semibold text-emerald-700 flex items-center">
                      <Wifi className="w-3 h-3 mr-1 text-emerald-600" />
                      Connected &amp; Synced
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Rules Agreement & Action Ribbon */}
          <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <label className="flex items-start space-x-3 cursor-pointer select-none max-w-xl">
              <input
                type="checkbox"
                checked={hasAgreedRules}
                onChange={(e) => setHasAgreedRules(e.target.checked)}
                className="mt-0.5 w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
              />
              <span className="text-xs text-slate-700 font-medium leading-relaxed">
                I certify that I am <strong>{candidate?.fullName}</strong>, verify that I am sitting for the <strong>{candidate?.department}</strong> department examination, and agree to adhere strictly to all anti-cheat protocols.
              </span>
            </label>

            <button
              type="button"
              disabled={!hasAgreedRules}
              onClick={handleBeginExamination}
              className="px-6 py-3 text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 rounded-xl shadow-xs transition-all flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
            >
              <Maximize2 className="w-4 h-4 mr-1" />
              <span>Begin Examination Now</span>
              <ArrowRight className="w-4 h-4 ml-1" />
            </button>
          </div>
        </div>
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
            <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto border border-emerald-200 shadow-xs">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Examination Successfully Submitted
            </h1>
            <p className="text-xs text-slate-500">
              Kalasalingam Academy of Research and Education • Online Examination Services
            </p>
          </div>

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
      </div>
    );
  }

  // =========================================================================
  // STAGE 4: ACTIVE EXAMINATION ENGINE
  // =========================================================================
  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans select-none">
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
                    <span className="text-[11px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                      +{activeQuestion.points} pt
                    </span>
                    {exam?.enableNegativeMarking && (
                      <span className="text-[11px] font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded border border-red-200">
                        -{activeQuestion.negativePoints} pt
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
                <div className="text-sm font-semibold text-slate-900 leading-relaxed space-y-3">
                  <p>{activeQuestion.prompt}</p>

                  {/* Code Snippet if applicable */}
                  {activeQuestion.codeSnippet && (
                    <div className="p-3 bg-slate-900 text-emerald-400 font-mono text-xs rounded-xl overflow-x-auto shadow-2xs">
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
                        className={`w-full text-left p-3.5 rounded-xl border text-xs font-medium transition-all flex items-center justify-between cursor-pointer ${
                          isSelected
                            ? "bg-blue-50/80 border-blue-600 text-blue-950 font-semibold ring-1 ring-blue-600/20"
                            : "bg-white border-slate-200 text-slate-800 hover:bg-slate-50 hover:border-slate-300"
                        }`}
                      >
                        <div className="flex items-center space-x-3">
                          <span
                            className={`w-6 h-6 rounded-md flex items-center justify-center font-bold text-xs flex-shrink-0 ${
                              isSelected
                                ? "bg-blue-700 text-white"
                                : "bg-slate-100 text-slate-600 border border-slate-200"
                            }`}
                          >
                            {letter}
                          </span>
                          <span className="leading-snug">{opt.text}</span>
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

                <button
                  type="button"
                  disabled={activeQuestionIndex === currentSectionQuestions.length - 1}
                  onClick={() =>
                    setActiveQuestionIndex((prev) =>
                      Math.min(currentSectionQuestions.length - 1, prev + 1)
                    )
                  }
                  className="inline-flex items-center px-4 py-2 text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 rounded-xl shadow-2xs transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <span>Next Question</span>
                  <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                </button>
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

            {/* Matrix of Questions in Active Section */}
            <div className="pt-2">
              <span className="text-[10px] font-bold uppercase text-slate-400 block mb-2">
                Questions in Active Section
              </span>
              <div className="grid grid-cols-5 gap-2 max-h-64 overflow-y-auto p-1">
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
                onClick={submitFinalExam}
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
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white border border-red-300 rounded-3xl p-6 shadow-2xl text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-red-100 text-red-700 flex items-center justify-center mx-auto border-2 border-red-200 animate-pulse">
              <ShieldAlert className="w-7 h-7" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-base font-black text-slate-900 uppercase tracking-tight">
                Workstation Locked
              </h2>
              <p className="text-xs text-red-600 font-semibold leading-relaxed">
                {lockoutReason || "Examination sitting suspended due to security threshold or proctor command."}
              </p>
              <p className="text-[11px] text-slate-500 pt-2">
                Your answers are safely preserved in the database. Please raise your hand and wait for the hall invigilator to verify your workstation.
              </p>
            </div>
            <div className="pt-2 border-t border-slate-100 flex items-center justify-center space-x-2 text-[10px] text-slate-400 font-mono">
              <span>Session: {sessionId.slice(0, 8)}</span>
              <span>•</span>
              <span>Strikes: {strikes} / {exam?.maxStrikes || 3}</span>
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

      {/* Hidden Video and Off-Screen Canvas for Evidentiary Watermarked Snapshot Synthesis */}
      <video ref={videoRef} playsInline autoPlay muted className="hidden" />
      <canvas ref={canvasRef} width={640} height={480} className="hidden" />
    </div>
  );
}
