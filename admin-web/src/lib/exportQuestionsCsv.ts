import { DepartmentQuestion } from "@/types/database.types";

/**
 * Escapes a single CSV field value, wrapping in quotes if commas, quotes, or newlines exist.
 */
function escapeCsvValue(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return "";
  const str = String(val);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Detects if a question is in Tamil language or Tamil research methodology
 */
function isTamilQuestion(q: DepartmentQuestion): boolean {
  return Boolean(
    (q as any).language === "TA" ||
    (q.prompt && /[\u0B80-\u0BFF]/.test(q.prompt)) ||
    (q.topic && /tamil|தமிழ்/i.test(q.topic)) ||
    (q.department?.code === "TAM" || q.department?.code === "TAMIL")
  );
}

/**
 * Exports questions to a standardized KARE-SES CSV file with UTF-8 BOM
 * for seamless compatibility with Microsoft Excel, Google Sheets, and LibreOffice.
 */
export function exportQuestionsToCsv(
  questions: DepartmentQuestion[],
  defaultDeptCode: string = "GENERAL",
  filenamePrefix: string = "kare_questions_export"
) {
  if (!questions || questions.length === 0) return;

  const headers = [
    "Department Code",
    "Topic",
    "Difficulty",
    "Question Type",
    "Question Prompt",
    "Code Snippet",
    "Option A",
    "Option B",
    "Option C",
    "Option D",
    "Option E",
    "Option F",
    "Correct Option",
  ];

  const rows = questions.map((q) => {
    let deptCode = defaultDeptCode;
    if (q.department?.code) {
      deptCode = q.department.code;
    } else if (isTamilQuestion(q)) {
      deptCode = "GENERAL_TA";
    } else if (!q.department_id) {
      deptCode = "GENERAL";
    }

    const opts = q.options || [];
    const optA = opts[0]?.option_text || "";
    const optB = opts[1]?.option_text || "";
    const optC = opts[2]?.option_text || "";
    const optD = opts[3]?.option_text || "";
    const optE = opts[4]?.option_text || "";
    const optF = opts[5]?.option_text || "";

    const correctLetters: string[] = [];
    opts.forEach((opt, idx) => {
      if (opt.is_correct) {
        correctLetters.push(String.fromCharCode(65 + idx));
      }
    });

    const correctStr = correctLetters.join(",");

    return [
      escapeCsvValue(deptCode),
      escapeCsvValue(q.topic || "General"),
      escapeCsvValue(q.difficulty || "MEDIUM"),
      escapeCsvValue(q.question_type || "MCQ_SINGLE"),
      escapeCsvValue(q.prompt),
      escapeCsvValue(q.code_snippet || ""),
      escapeCsvValue(optA),
      escapeCsvValue(optB),
      escapeCsvValue(optC),
      escapeCsvValue(optD),
      escapeCsvValue(optE),
      escapeCsvValue(optF),
      escapeCsvValue(correctStr),
    ].join(",");
  });

  // UTF-8 BOM (\uFEFF) ensures Excel renders Tamil/Unicode correctly without font corruption
  const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\r\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);

  link.setAttribute("href", url);
  link.setAttribute("download", `${filenamePrefix}_${timestamp}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
