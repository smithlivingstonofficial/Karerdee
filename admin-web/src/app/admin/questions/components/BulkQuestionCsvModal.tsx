"use client";

import React, { useState, useRef } from "react";
import { bulkImportQuestionsAction, BulkQuestionCsvRow } from "../actions";
import {
  FileSpreadsheet,
  Upload,
  Download,
  X,
  AlertCircle,
  CheckCircle2,
  Check,
  Building2,
  Globe,
  Sparkles,
} from "lucide-react";

interface BulkQuestionCsvModalProps {
  isOpen: boolean;
  onClose: () => void;
  validDepartmentCodes?: string[];
}

interface ParsedQuestionRow extends BulkQuestionCsvRow {
  isValid: boolean;
  errorReason?: string;
  isDeptInvalid?: boolean;
}

export function BulkQuestionCsvModal({
  isOpen,
  onClose,
  validDepartmentCodes = [],
}: BulkQuestionCsvModalProps) {
  const [rows, setRows] = useState<ParsedQuestionRow[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successCount, setSuccessCount] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  function handleDownloadSample() {
    const csvContent =
      "Department Code,Question Prompt,Option A,Option B,Option C,Option D,Correct Option\n" +
      `GENERAL,"Which research design is most appropriate for testing cause-and-effect hypotheses?",Exploratory research,Experimental research,Descriptive study,Historical review,B\n` +
      `GENERAL_T,"அறிவியல் ஆராய்ச்சியில் 'கருதுகோள்' (Hypothesis) என்பது யாது?","முன்கூட்டியே கணிக்கப்பட்ட சோதனைக்குரிய கூற்று","மாற்ற முடியாத பொதுவான விதி","ஆய்வு நூலின் இறுதி முடிவுரை","தத்துவார்த்தக் கருத்து",A\n` +
      `AERO,"The critical Mach number of an airfoil is the freestream Mach number at which:","Sonic conditions first appear on the airfoil","The flow is supersonic everywhere","Shock waves detach completely","Lift coefficient reaches zero",A\n` +
      `TAM,"தொல்காப்பியத்தில் காணப்படும் மொத்த அதிகாரங்களின் எண்ணிக்கை எத்தனை?",3,4,5,6,A\n`;

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "KARE_SES_Question_Bank_Template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // Tokenize CSV line respecting double quotes
  function parseCsvLine(line: string): string[] {
    const values: string[] = [];
    let currentVal = "";
    let inQuotes = false;

    for (let c = 0; c < line.length; c++) {
      const char = line[c];
      if (char === '"') {
        if (inQuotes && line[c + 1] === '"') {
          currentVal += '"';
          c++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === "," && !inQuotes) {
        values.push(currentVal.trim());
        currentVal = "";
      } else {
        currentVal += char;
      }
    }
    values.push(currentVal.trim());
    return values;
  }

  function parseCSV(text: string) {
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length < 2) {
      setError("CSV must contain a header row and at least one question record.");
      return;
    }

    const rawHeaders = parseCsvLine(lines[0]);
    const cleanHeader = (h: string) => h.toLowerCase().replace(/[^a-z0-9]/g, "");
    const headers = rawHeaders.map(cleanHeader);

    // Dynamic Header Detection: Match column aliases
    const findIndex = (aliases: string[]) => {
      return headers.findIndex((h) => aliases.some((a) => h === a || h.includes(a)));
    };

    let deptIdx = findIndex(["departmentcode", "deptcode", "department", "dept", "scope"]);
    let promptIdx = findIndex(["questionprompt", "prompt", "question", "questiontext", "text"]);
    let optAIdx = findIndex(["optiona", "opta"]);
    let optBIdx = findIndex(["optionb", "optb"]);
    let optCIdx = findIndex(["optionc", "optc"]);
    let optDIdx = findIndex(["optiond", "optd"]);
    let correctIdx = findIndex(["correctoption", "correctanswer", "correctkey", "correct", "answer", "key", "answerkey"]);

    // Optional columns
    let topicIdx = findIndex(["topic", "module", "subject", "category"]);
    let diffIdx = findIndex(["difficulty", "diff", "level"]);
    let typeIdx = findIndex(["questiontype", "type", "qtype"]);
    let codeIdx = findIndex(["codesnippet", "code", "snippet"]);
    let negIdx = findIndex(["negativepoints", "negativemarks", "penalty"]);

    // Fallback: If headers were not recognized by name, check column count
    if (promptIdx === -1 && rawHeaders.length >= 7) {
      // Standard 7-column positional format:
      // 0: Dept, 1: Prompt, 2: Opt A, 3: Opt B, 4: Opt C, 5: Opt D, 6: Correct Key
      deptIdx = 0;
      promptIdx = 1;
      optAIdx = 2;
      optBIdx = 3;
      optCIdx = 4;
      optDIdx = 5;
      correctIdx = 6;
    } else if (promptIdx === -1 && rawHeaders.length >= 11) {
      // Legacy 11-13 column format
      deptIdx = 0;
      topicIdx = 1;
      diffIdx = 2;
      typeIdx = 3;
      promptIdx = 4;
      codeIdx = 5;
      optAIdx = 6;
      optBIdx = 7;
      optCIdx = 8;
      optDIdx = 9;
      correctIdx = 10;
    }

    const clean = (val: string | undefined) => (val || "").replace(/^"|"$/g, "").trim();
    const normalizedValidCodes = validDepartmentCodes.map((c) => c.toUpperCase().trim());
    const parsed: ParsedQuestionRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const values = parseCsvLine(line);

      const rawDeptCode = clean(values[deptIdx !== -1 ? deptIdx : 0]).toUpperCase();
      const prompt = clean(values[promptIdx !== -1 ? promptIdx : 1]);
      const optionA = clean(values[optAIdx !== -1 ? optAIdx : 2]);
      const optionB = clean(values[optBIdx !== -1 ? optBIdx : 3]);
      const optionC = clean(values[optCIdx !== -1 ? optCIdx : 4]);
      const optionD = clean(values[optDIdx !== -1 ? optDIdx : 5]);
      const correctAnswers = clean(values[correctIdx !== -1 ? correctIdx : 6]).toUpperCase() || "A";

      // Optional values with intelligent defaults
      const rawTopic = topicIdx !== -1 ? clean(values[topicIdx]) : "";
      const rawDiff = diffIdx !== -1 ? clean(values[diffIdx]).toUpperCase() : "";
      const difficulty = ["EASY", "MEDIUM", "HARD"].includes(rawDiff)
        ? (rawDiff as "EASY" | "MEDIUM" | "HARD")
        : "MEDIUM";

      const rawType = typeIdx !== -1 ? clean(values[typeIdx]).toUpperCase() : "";
      const questionType = rawType === "MCQ_MULTIPLE" ? "MCQ_MULTIPLE" : "MCQ_SINGLE";

      const codeSnippet = codeIdx !== -1 ? clean(values[codeIdx]) : "";
      const negativePoints = negIdx !== -1 ? parseFloat(clean(values[negIdx])) || 0.0 : 0.0;

      // Handle Department Code mapping and aliases
      let departmentCode = rawDeptCode || "GENERAL";
      if (departmentCode === "TAMIL" && normalizedValidCodes.includes("TAM")) {
        departmentCode = "TAM";
      }

      const isGeneral =
        departmentCode === "GENERAL" ||
        departmentCode === "COMMON" ||
        departmentCode === "GENERAL_T" ||
        departmentCode === "GENERAL_TAMIL" ||
        departmentCode === "GENERAL_TA";

      // Derive topic if omitted
      let topic = rawTopic;
      if (!topic) {
        if (departmentCode === "GENERAL_T" || departmentCode === "GENERAL_TAMIL") {
          topic = "ஆராய்ச்சி முறைமை (Tamil)";
        } else if (departmentCode === "GENERAL" || departmentCode === "COMMON") {
          topic = "Research Methodology";
        } else {
          topic = `${departmentCode} Specialization`;
        }
      }

      // Department validity check
      let isDeptInvalid = false;
      let errorReason = "";

      if (!isGeneral && normalizedValidCodes.length > 0) {
        if (!normalizedValidCodes.includes(departmentCode)) {
          isDeptInvalid = true;
          errorReason += `Unregistered Department Code: '${departmentCode}'. `;
        }
      }

      // Validate exactly the 7 Required Fields:
      if (!departmentCode) errorReason += "Missing Department Code. ";
      if (!prompt) errorReason += "Missing Question Prompt. ";
      if (!optionA) errorReason += "Missing Option A. ";
      if (!optionB) errorReason += "Missing Option B. ";
      if (!optionC) errorReason += "Missing Option C. ";
      if (!optionD) errorReason += "Missing Option D. ";
      if (!correctAnswers) errorReason += "Missing Correct Option. ";

      const isValid =
        !isDeptInvalid &&
        prompt.length > 0 &&
        optionA.length > 0 &&
        optionB.length > 0 &&
        optionC.length > 0 &&
        optionD.length > 0 &&
        correctAnswers.length > 0;

      parsed.push({
        departmentCode,
        topic,
        difficulty,
        questionType,
        prompt,
        codeSnippet,
        optionA,
        optionB,
        optionC,
        optionD,
        correctAnswers,
        points: 1.0, // Standardized 1 mark
        negativePoints,
        isValid,
        errorReason: errorReason.trim(),
        isDeptInvalid,
      });
    }

    setRows(parsed);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setError(null);
    setSuccessCount(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        parseCSV(event.target?.result as string);
      } catch (err: any) {
        setError("Failed to parse CSV: " + (err.message || "Invalid formatting"));
      }
    };
    reader.readAsText(file);
  }

  async function handleImport() {
    const validRows = rows.filter((r) => r.isValid);
    if (validRows.length === 0) {
      setError("No valid question rows found to import.");
      return;
    }

    setLoading(true);
    setError(null);

    const res = await bulkImportQuestionsAction(validRows);
    setLoading(false);

    if (res.error) {
      setError(res.error);
    } else {
      setSuccessCount(res.count || validRows.length);
      setTimeout(() => {
        onClose();
      }, 1400);
    }
  }

  const validCount = rows.filter((r) => r.isValid).length;
  const invalidCount = rows.filter((r) => !r.isValid).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
      <div className="w-full max-w-4xl bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center font-bold text-xs border border-blue-200 shadow-2xs">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900">
                Bulk Import Institutional Questions (CSV)
              </h2>
              <p className="text-[11px] text-slate-500">
                Upload General Common Core questions and department specialization MCQs in one batch.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-semibold flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successCount !== null && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700 font-semibold flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>Successfully imported and synchronized {successCount} questions into the Master Question Bank!</span>
            </div>
          )}

          {/* Standard Required Format Ribbon */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-black text-slate-900 block">
                  Required Format (7 Columns Only)
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.2 bg-emerald-100 text-emerald-800 rounded border border-emerald-200">
                  Strict Standard
                </span>
              </div>
              <p className="text-[11px] text-slate-600 font-mono mt-0.5 font-medium">
                Department Code, Question Prompt, Option A, Option B, Option C, Option D, Correct Option
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">
                All other fields (Topic, Difficulty, Question Type, Code Snippet) are optional and automatically defaulted.
              </p>
            </div>
            <button
              type="button"
              onClick={handleDownloadSample}
              className="inline-flex items-center justify-center px-3.5 py-2 text-xs font-bold text-blue-700 bg-white border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors cursor-pointer shadow-2xs flex-shrink-0"
            >
              <Download className="w-3.5 h-3.5 mr-1.5" />
              Download Template
            </button>
          </div>

          {/* Upload Dropzone */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-300 hover:border-blue-500 bg-white hover:bg-blue-50/20 rounded-2xl p-6 text-center cursor-pointer transition-all shadow-2xs"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="hidden"
            />
            <div className="w-10 h-10 mx-auto rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center mb-2 border border-blue-100">
              <Upload className="w-5 h-5" />
            </div>
            <p className="text-xs font-bold text-slate-800">
              {fileName ? fileName : "Click or drag your questions CSV here"}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              UTF-8 encoded .csv up to 10MB
            </p>
          </div>

          {/* Parsed Preview */}
          {rows.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">
                  Detected Questions ({rows.length})
                </span>
                <div className="flex items-center space-x-2 text-[11px]">
                  <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-bold border border-emerald-200">
                    {validCount} Ready to Import
                  </span>
                  {invalidCount > 0 && (
                    <span className="text-red-700 bg-red-50 px-2 py-0.5 rounded font-bold border border-red-200">
                      {invalidCount} Invalid
                    </span>
                  )}
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden max-h-56 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 sticky top-0 text-[11px]">
                    <tr>
                      <th className="py-2 px-3">#</th>
                      <th className="py-2 px-3">Dept</th>
                      <th className="py-2 px-3">Prompt</th>
                      <th className="py-2 px-3">Option A</th>
                      <th className="py-2 px-3">Option B</th>
                      <th className="py-2 px-3">Option C</th>
                      <th className="py-2 px-3">Option D</th>
                      <th className="py-2 px-3">Key</th>
                      <th className="py-2 px-3 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-[11px]">
                    {rows.map((r, idx) => {
                      const isGeneral =
                        !r.departmentCode ||
                        r.departmentCode === "GENERAL" ||
                        r.departmentCode === "COMMON";
                      const isTamilCommon =
                        r.departmentCode === "GENERAL_T" ||
                        r.departmentCode === "GENERAL_TAMIL" ||
                        r.departmentCode === "GENERAL_TA";

                      return (
                        <tr key={idx} className={r.isValid ? "hover:bg-slate-50/50" : "bg-red-50/40"}>
                          <td className="py-1.5 px-3 font-mono text-slate-500 font-bold">{idx + 1}</td>
                          <td className="py-1.5 px-3 whitespace-nowrap">
                            {r.isDeptInvalid ? (
                              <span
                                className="text-[10px] font-bold bg-red-100 text-red-700 border border-red-300 px-1.5 py-0.5 rounded font-mono"
                                title={r.errorReason}
                              >
                                ❌ {r.departmentCode}
                              </span>
                            ) : isTamilCommon ? (
                              <span className="text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 px-1.5 py-0.5 rounded">
                                🇮🇳 Common (Tamil)
                              </span>
                            ) : isGeneral ? (
                              <span className="text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200 px-1.5 py-0.5 rounded">
                                ⭐ General
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded font-mono">
                                🏢 {r.departmentCode}
                              </span>
                            )}
                          </td>
                          <td className="py-1.5 px-3 text-slate-900 font-semibold truncate max-w-[200px]" title={r.prompt}>
                            {r.prompt}
                          </td>
                          <td className="py-1.5 px-3 text-slate-600 truncate max-w-[100px]" title={r.optionA}>
                            {r.optionA}
                          </td>
                          <td className="py-1.5 px-3 text-slate-600 truncate max-w-[100px]" title={r.optionB}>
                            {r.optionB}
                          </td>
                          <td className="py-1.5 px-3 text-slate-600 truncate max-w-[100px]" title={r.optionC}>
                            {r.optionC}
                          </td>
                          <td className="py-1.5 px-3 text-slate-600 truncate max-w-[100px]" title={r.optionD}>
                            {r.optionD}
                          </td>
                          <td className="py-1.5 px-3">
                            <span className="font-mono text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                              {r.correctAnswers}
                            </span>
                          </td>
                          <td className="py-1.5 px-3 text-right whitespace-nowrap">
                            {r.isValid ? (
                              <span className="text-[10px] font-bold text-emerald-700">Valid</span>
                            ) : (
                              <span className="text-[10px] font-bold text-red-600" title={r.errorReason}>
                                Invalid
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between flex-shrink-0 bg-slate-50/50">
          <div className="text-xs text-slate-500 font-medium">
            {rows.length > 0 && (
              <span>
                Ready to import <strong className="text-blue-700 font-bold">{validCount}</strong> valid question{validCount === 1 ? "" : "s"}
              </span>
            )}
          </div>
          <div className="flex items-center space-x-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleImport}
              disabled={loading || validCount === 0}
              className="px-4 py-2 text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              {loading ? "Importing Questions..." : `Import ${validCount} Questions`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
