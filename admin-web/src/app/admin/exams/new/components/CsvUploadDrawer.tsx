"use client";

import React, { useState } from "react";
import { QuestionState } from "../types";
import {
  X,
  Upload,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ArrowRight,
  FileText,
} from "lucide-react";

interface CsvUploadDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  targetSectionTitle: string;
  targetSectionId: string;
  targetDepartment?: string | null;
  targetLimit: number;
  currentCount: number;
  existingQuestionsCount: number;
  onImport: (newQuestions: QuestionState[]) => void;
}

interface ParsedRow {
  departmentCode?: string;
  isDeptMismatch?: boolean;
  mismatchReason?: string;
  questionType: "MCQ_SINGLE" | "MCQ_MULTIPLE";
  prompt: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctOption: string;
  points: number;
  negativePoints: number;
}

export function CsvUploadDrawer({
  isOpen,
  onClose,
  targetSectionTitle,
  targetSectionId,
  targetDepartment = null,
  targetLimit,
  currentCount,
  existingQuestionsCount,
  onImport,
}: CsvUploadDrawerProps) {
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const availableSlots = Math.max(0, targetLimit - currentCount);

  // 1. Download Sample CSV Template
  function downloadSampleCsv() {
    const headers = [
      "Question Type",
      "Prompt",
      "Option A",
      "Option B",
      "Option C",
      "Option D",
      "Correct Option",
      "Points",
      "Negative Points",
    ].join(",");

    const rows = [
      headers,
      `"MCQ_SINGLE","Which research design is best suited to determine cause-and-effect relationships?","Experimental Research","Correlational Study","Observational Survey","Case Study","A",1.0,0.25`,
      `"MCQ_MULTIPLE","Select ALL characteristics of an authentic empirical hypothesis:","It must be testable","It must be unfalsifiable","It must be grounded in literature","It predicts an expected outcome","A,C,D",1.0,0.25`,
      `"MCQ_SINGLE","In modern operating systems, which scheduling algorithm guarantees zero starvation?","Round Robin","First-Come First-Served","Priority Scheduling without Aging","Shortest Job First","A",1.0,0.25`,
      `"MCQ_SINGLE","Which network layer protocol provides reliable, connection-oriented data transfer?","TCP","UDP","IP","ICMP","A",1.0,0.25`,
    ].join("\n");

    const blob = new Blob([rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `kare_exam_questions_template.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  // 2. Parse CSV Line with Quotes
  function parseCsvLine(line: string): string[] {
    const values: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === "," && !inQuotes) {
        values.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    values.push(current.trim());
    return values;
  }

  // 3. Handle File Upload
  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    setParseError(null);
    setParsedRows([]);
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter((l) => l.length > 0);

        if (lines.length < 2) {
          setParseError("CSV file must contain a header row and at least one question row.");
          return;
        }

        const dataRows = lines.slice(1);
        const parsed: ParsedRow[] = [];

        for (let i = 0; i < dataRows.length; i++) {
          const cols = parseCsvLine(dataRows[i]);
          if (cols.length < 7) {
            continue;
          }

          // Support either full template or standard template
          let rawDeptCode: string | null = null;
          let qTypeStr = cols[0];
          let prompt = cols[1];
          let optA = cols[2];
          let optB = cols[3];
          let optC = cols[4];
          let optD = cols[5];
          let correctStr = cols[6];
          let ptsStr = cols[7] || "1.0";
          let negStr = cols[8] || "0.25";

          // Fallback if user used legacy 12-column format
          if (cols.length >= 10 && (cols[0].toLowerCase().includes("part") || cols[1]?.toUpperCase() === "TRUE" || cols[1]?.toUpperCase() === "FALSE")) {
            qTypeStr = cols[3];
            prompt = cols[4];
            optA = cols[5];
            optB = cols[6];
            optC = cols[7];
            optD = cols[8];
            correctStr = cols[9];
            ptsStr = cols[10] || "1.0";
            negStr = cols[11] || "0.25";
          } else if (cols.length >= 11 && (cols[3]?.toUpperCase() === "MCQ_SINGLE" || cols[3]?.toUpperCase() === "MCQ_MULTIPLE")) {
            // Auto-detect Institutional Question Bank format (Department Code, Topic, Difficulty, Question Type, Question Prompt, Code Snippet, Option A, ...)
            rawDeptCode = cols[0]?.replace(/^"|"$/g, "").trim().toUpperCase() || null;
            qTypeStr = cols[3];
            prompt = cols[4];
            optA = cols[6];
            optB = cols[7];
            optC = cols[8];
            optD = cols[9];
            correctStr = cols[10];
            ptsStr = cols[11] || "1.0";
            negStr = cols[12] || "0.25";
          }

          // Strict Department Code Validation against target section / department track
          let isDeptMismatch = false;
          let mismatchReason = "";

          if (rawDeptCode) {
            const isCommonCode = rawDeptCode === "GENERAL" || rawDeptCode === "COMMON";
            if (!targetDepartment) {
              // Target is Common Core (Part A)
              if (!isCommonCode) {
                isDeptMismatch = true;
                mismatchReason = `Section is Common Core (GENERAL), but question belongs to '${rawDeptCode}'.`;
              }
            } else {
              // Target is a specific department track (e.g. MCA)
              const expectedDept = targetDepartment.trim().toUpperCase();
              if (isCommonCode) {
                isDeptMismatch = true;
                mismatchReason = `Track is strictly for '${expectedDept}' questions, but question is marked as '${rawDeptCode}'.`;
              } else if (rawDeptCode !== expectedDept) {
                isDeptMismatch = true;
                mismatchReason = `Department mismatch: question is tagged '${rawDeptCode}', but track is strictly '${expectedDept}'.`;
              }
            }
          }

          parsed.push({
            departmentCode: rawDeptCode || (targetDepartment ? targetDepartment : "GENERAL"),
            isDeptMismatch,
            mismatchReason,
            questionType: qTypeStr?.toUpperCase() === "MCQ_MULTIPLE" ? "MCQ_MULTIPLE" : "MCQ_SINGLE",
            prompt: prompt || `Imported Question ${i + 1}`,
            optionA: optA || "Option A",
            optionB: optB || "Option B",
            optionC: optC || "Option C",
            optionD: optD || "Option D",
            correctOption: (correctStr || "A").toUpperCase(),
            points: parseFloat(ptsStr) || 1.0,
            negativePoints: parseFloat(negStr) || 0.25,
          });
        }

        if (parsed.length === 0) {
          setParseError("Could not extract any valid questions from the uploaded CSV file.");
          return;
        }

        setParsedRows(parsed);
      } catch (err: any) {
        setParseError(`CSV Parsing Error: ${err.message}`);
      }
    };

    reader.readAsText(file);
  }

  // 4. Confirm Import into active section & track
  function handleConfirmImport() {
    const validRows = parsedRows.filter((r) => !r.isDeptMismatch);
    if (validRows.length === 0) return;

    // Limit to available slots
    const rowsToImport = validRows.slice(0, availableSlots);

    const converted: QuestionState[] = rowsToImport.map((row, idx) => {
      const correctLetters = row.correctOption
        .split(",")
        .map((l) => l.trim().toUpperCase());

      const rawOptions = [
        { letter: "A", text: row.optionA },
        { letter: "B", text: row.optionB },
        { letter: "C", text: row.optionC },
        { letter: "D", text: row.optionD },
      ].filter((o) => o.text && o.text.trim().length > 0);

      const options = rawOptions.map((o, optIdx) => ({
        id: `opt-csv-${Date.now()}-${idx}-${optIdx}`,
        text: o.text,
        isCorrect: correctLetters.includes(o.letter),
        orderIndex: optIdx + 1,
      }));

      if (!options.some((o) => o.isCorrect) && options.length > 0) {
        options[0].isCorrect = true;
      }

      return {
        id: `q-csv-${Date.now()}-${idx}`,
        sectionId: targetSectionId,
        targetDepartment: targetDepartment || null,
        questionType: row.questionType,
        prompt: row.prompt,
        points: row.points,
        negativePoints: row.negativePoints,
        orderIndex: existingQuestionsCount + idx + 1,
        options,
      };
    });

    onImport(converted);
    setParsedRows([]);
    setFileName(null);
    onClose();
  }

  if (!isOpen) return null;

  const validRows = parsedRows.filter((r) => !r.isDeptMismatch);
  const willTruncate = validRows.length > availableSlots;
  const countToImport = Math.min(validRows.length, availableSlots);
  const mismatchCount = parsedRows.filter((r) => r.isDeptMismatch).length;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/50 backdrop-blur-xs flex justify-end transition-opacity">
      <div className="w-full max-w-3xl bg-white h-full shadow-2xl flex flex-col border-l border-slate-200">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center border border-blue-200">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700">
                  Bulk CSV Importer
                </span>
                <span className="text-xs text-slate-300">•</span>
                <span className="text-xs text-slate-600 font-semibold truncate max-w-xs">
                  {targetSectionTitle}
                </span>
                {targetDepartment && (
                  <span className="px-2 py-0.2 rounded-full text-[10px] font-extrabold bg-purple-50 text-purple-700 border border-purple-200">
                    {targetDepartment}
                  </span>
                )}
              </div>
              <h2 className="text-base font-bold text-slate-900 mt-0.5">
                Import Questions from Spreadsheet
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quota & Instructions Sub-Bar */}
        <div className="p-3.5 sm:p-4 border-b border-slate-200 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="text-xs text-slate-600 flex items-center space-x-2">
            <span>
              Target Quota: <strong className="text-slate-900">{currentCount} / {targetLimit} Qs</strong>
            </span>
            <span className="text-slate-300">•</span>
            <span className={`font-bold ${availableSlots === 0 ? "text-amber-700" : "text-emerald-700"}`}>
              {availableSlots === 0 ? "Quota Full" : `${availableSlots} available slots`}
            </span>
          </div>

          <button
            type="button"
            onClick={downloadSampleCsv}
            className="inline-flex items-center px-3 py-1.5 text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 rounded-lg shadow-2xs transition-all cursor-pointer self-start sm:self-auto"
          >
            <Download className="w-3.5 h-3.5 mr-1.5" />
            Download Sample CSV
          </button>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 bg-slate-50/50">
          {/* Upload Drop Zone */}
          <div className="bg-white border-2 border-dashed border-slate-200 hover:border-blue-500 rounded-2xl p-6 text-center transition-all shadow-xs">
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center mx-auto mb-2.5 border border-blue-100 shadow-2xs">
              <Upload className="w-6 h-6" />
            </div>
            <h4 className="text-xs font-bold text-slate-900">Choose or Drop CSV File</h4>
            <p className="text-[11px] text-slate-500 mt-0.5 mb-3">
              Upload standard .csv exported from Excel or Google Sheets.
            </p>

            <label className="inline-flex items-center px-4 py-2 text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 rounded-lg shadow-2xs transition-all cursor-pointer">
              <FileSpreadsheet className="w-3.5 h-3.5 mr-1.5" />
              Browse CSV File
              <input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>

            {fileName && (
              <div className="mt-3 text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full inline-flex items-center space-x-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Loaded: {fileName}</span>
              </div>
            )}

            {parseError && (
              <div className="mt-3 p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 font-semibold max-w-md mx-auto flex items-center space-x-2 text-left">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{parseError}</span>
              </div>
            )}

            {mismatchCount > 0 && (
              <div className="mt-3 p-3 bg-red-50 border border-red-300 rounded-xl text-xs text-red-800 space-y-1 text-left max-w-lg mx-auto">
                <div className="flex items-center space-x-2 font-bold text-red-700">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>Department Code Mismatch ({mismatchCount} Question{mismatchCount === 1 ? "" : "s"})</span>
                </div>
                <p className="text-[11px] text-red-600 pl-6">
                  {targetDepartment ? (
                    <>
                      This track strictly requires <strong>{targetDepartment}</strong> domain questions.
                      The uploaded file contains {mismatchCount} question(s) marked for other departments or Common Core.
                      Mismatched rows are flagged in red below and will <strong>not</strong> be imported.
                    </>
                  ) : (
                    <>
                      This section is strictly for <strong>Common Core (GENERAL)</strong> questions.
                      The uploaded file contains {mismatchCount} department-specific question(s).
                      Mismatched rows are flagged in red below and will <strong>not</strong> be imported.
                    </>
                  )}
                </p>
              </div>
            )}
          </div>

          {/* Parsed Preview Table */}
          {parsedRows.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs space-y-3 p-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 flex items-center space-x-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                    <span>Parsed {parsedRows.length} Questions</span>
                  </h4>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    {mismatchCount > 0 && (
                      <span className="text-red-600 font-semibold mr-1">
                        [{mismatchCount} mismatch{mismatchCount === 1 ? "" : "es"} excluded]
                      </span>
                    )}
                    {willTruncate
                      ? `Target quota allows ${availableSlots} more question(s). First ${availableSlots} matching rows will be imported.`
                      : `All ${validRows.length} matching questions fit within the available quota.`}
                  </p>
                </div>

                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                  {countToImport} Ready to Import
                </span>
              </div>

              <div className="overflow-x-auto max-h-60 border border-slate-100 rounded-lg">
                <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                  <thead className="bg-slate-50 text-slate-700 font-bold uppercase tracking-wider text-[10px] sticky top-0">
                    <tr>
                      <th className="px-3 py-2">#</th>
                      <th className="px-3 py-2">Dept</th>
                      <th className="px-3 py-2">Type</th>
                      <th className="px-3 py-2">Prompt</th>
                      <th className="px-3 py-2">Options Preview</th>
                      <th className="px-3 py-2">Key</th>
                      <th className="px-3 py-2">Pts</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-800 text-[11px]">
                    {parsedRows.map((r, i) => (
                      <tr
                        key={i}
                        className={`transition-colors ${
                          r.isDeptMismatch
                            ? "bg-red-50/60 hover:bg-red-50 text-red-900"
                            : i >= availableSlots
                            ? "opacity-40 bg-slate-50/50"
                            : "hover:bg-slate-50"
                        }`}
                      >
                        <td className="px-3 py-2 font-bold text-slate-500">{i + 1}</td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {r.isDeptMismatch ? (
                            <span
                              className="px-1.5 py-0.5 rounded bg-red-100 text-red-700 border border-red-300 font-mono font-bold text-[10px]"
                              title={r.mismatchReason}
                            >
                              ❌ {r.departmentCode}
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 font-mono font-bold text-[10px]">
                              {r.departmentCode || (targetDepartment ? targetDepartment : "GENERAL")}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <span className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 border font-mono font-bold text-[10px]">
                            {r.questionType === "MCQ_SINGLE" ? "Single" : "Multi"}
                          </span>
                        </td>
                        <td className="px-3 py-2 font-semibold max-w-xs truncate" title={r.isDeptMismatch ? r.mismatchReason : undefined}>
                          {r.prompt}
                        </td>
                        <td className="px-3 py-2 text-slate-500 max-w-xs truncate">
                          A: {r.optionA} | B: {r.optionB}
                        </td>
                        <td className="px-3 py-2 font-mono font-bold text-emerald-700">{r.correctOption}</td>
                        <td className="px-3 py-2 font-bold">{r.points}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-3.5 sm:p-4 border-t border-slate-200 bg-white flex items-center justify-between">
          <div className="text-[11px] text-slate-600 font-medium">
            {parsedRows.length > 0 ? (
              <span>
                Ready to import <strong className="text-blue-700 font-bold">{countToImport}</strong> question{countToImport === 1 ? "" : "s"} into{" "}
                <span className="font-semibold text-slate-900">{targetSectionTitle}</span>
                {targetDepartment && (
                  <span className="ml-1 font-bold text-purple-700">({targetDepartment})</span>
                )}
              </span>
            ) : (
              <span>Upload a CSV file above to preview and import questions.</span>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmImport}
              disabled={parsedRows.length === 0 || countToImport === 0}
              className="inline-flex items-center px-4 py-1.5 text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 rounded-lg shadow-2xs transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Import Questions ({countToImport})
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

