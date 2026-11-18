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
  ShieldCheck,
  Globe,
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
              if (!isCommonCode) {
                isDeptMismatch = true;
                mismatchReason = `Section is Common Core (GENERAL), but question belongs to '${rawDeptCode}'.`;
              }
            } else {
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
            points: 1.0, // Standardized 1 mark
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
        points: 1.0, // Standardized 1 mark
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
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/60 backdrop-blur-xs flex justify-end transition-opacity duration-300 animate-in fade-in">
      <div className="w-full max-w-4xl bg-white h-full shadow-2xl flex flex-col border-l border-slate-200">
        
        {/* 1. Header Bar */}
        <div className="px-6 py-4 border-b border-slate-200 bg-white flex items-center justify-between">
          <div className="flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-800 flex items-center justify-center border border-emerald-200 shadow-2xs">
              <FileSpreadsheet className="w-5 h-5 text-emerald-700" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[11px] font-black uppercase tracking-wider text-emerald-700">
                  Bulk CSV Importer
                </span>
                <span className="text-xs text-slate-300">•</span>
                <span className="text-xs text-slate-600 font-semibold truncate max-w-xs">
                  {targetSectionTitle}
                </span>
                {targetDepartment && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-purple-100 text-purple-800 border border-purple-200">
                    {targetDepartment} Track
                  </span>
                )}
              </div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight mt-0.5">
                Import Questions from Spreadsheet (.CSV)
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            aria-label="Close CSV importer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 2. Executive Track Integrity & Isolation Banner */}
        {targetDepartment ? (
          <div className="px-6 py-3.5 bg-gradient-to-r from-purple-50 via-indigo-50/40 to-white border-b border-purple-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start sm:items-center space-x-3 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center border border-purple-200 flex-shrink-0 mt-0.5 sm:mt-0">
                <ShieldCheck className="w-4 h-4 text-purple-700" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center space-x-2 flex-wrap">
                  <span className="text-xs font-black text-purple-950">
                    Specialization Track: {targetDepartment}
                  </span>
                  <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 bg-purple-200/90 text-purple-900 rounded-full tracking-wider">
                    Strict Department Filter
                  </span>
                </div>
                <p className="text-[11px] text-purple-900/80 font-medium leading-relaxed mt-0.5">
                  Spreadsheet rows are verified against the {targetDepartment} syllabus. Mismatched department rows will be rejected automatically.
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2 flex-shrink-0 self-end sm:self-center bg-white px-3 py-1.5 rounded-xl border border-purple-200 shadow-2xs">
              <span className="text-[11px] font-bold text-slate-600">Track Quota:</span>
              <span className="text-xs font-black text-purple-950 font-mono">
                {currentCount} / {targetLimit} Qs
              </span>
              <span className="text-slate-300">•</span>
              <span className="text-[11px] font-black text-emerald-700">
                {availableSlots} slots left
              </span>
            </div>
          </div>
        ) : (
          <div className="px-6 py-3.5 bg-gradient-to-r from-blue-50 via-sky-50/40 to-white border-b border-blue-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start sm:items-center space-x-3 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center border border-blue-200 flex-shrink-0 mt-0.5 sm:mt-0">
                <Globe className="w-4 h-4 text-blue-700" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center space-x-2 flex-wrap">
                  <span className="text-xs font-black text-blue-950">
                    Universal Common Core Section
                  </span>
                  <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 bg-blue-200/90 text-blue-900 rounded-full tracking-wider">
                    General Aptitude
                  </span>
                </div>
                <p className="text-[11px] text-blue-900/80 font-medium leading-relaxed mt-0.5">
                  Questions are ingested into Part A and administered universally across all candidates.
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2 flex-shrink-0 self-end sm:self-center bg-white px-3 py-1.5 rounded-xl border border-blue-200 shadow-2xs">
              <span className="text-[11px] font-bold text-slate-600">Core Quota:</span>
              <span className="text-xs font-black text-blue-950 font-mono">
                {currentCount} / {targetLimit} Qs
              </span>
              <span className="text-slate-300">•</span>
              <span className="text-[11px] font-black text-emerald-700">
                {availableSlots} slots left
              </span>
            </div>
          </div>
        )}

        {/* 3. Sub-bar: Instructions & Download Sample */}
        <div className="px-6 py-3 border-b border-slate-200 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="text-xs text-slate-600 flex items-center space-x-2">
            <span>Standard columns: Question Type, Prompt, Options A-D, Answer Key, Points</span>
          </div>

          <button
            type="button"
            onClick={downloadSampleCsv}
            className="inline-flex items-center px-3.5 py-1.5 text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 rounded-xl shadow-2xs transition-all cursor-pointer self-start sm:self-auto"
          >
            <Download className="w-3.5 h-3.5 mr-1.5" />
            Download Sample CSV Template
          </button>
        </div>

        {/* 4. Body Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/70">
          {/* Upload Drop Zone */}
          <div className="bg-white border-2 border-dashed border-slate-200 hover:border-blue-500 rounded-3xl p-8 text-center transition-all shadow-xs">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-800 flex items-center justify-center mx-auto mb-3 border border-emerald-100 shadow-2xs">
              <Upload className="w-7 h-7 text-emerald-700" />
            </div>
            <h4 className="text-sm font-black text-slate-900">Upload Examination Question Spreadsheet</h4>
            <p className="text-xs text-slate-500 mt-1 mb-4 max-w-sm mx-auto">
              Select or drag and drop a standard .csv sheet exported from Microsoft Excel, Google Sheets, or institutional authoring tools.
            </p>

            <label className="inline-flex items-center px-5 py-2.5 text-xs font-black text-white bg-blue-700 hover:bg-blue-800 rounded-xl shadow-sm transition-all cursor-pointer">
              <FileSpreadsheet className="w-4 h-4 mr-2" />
              Browse CSV File
              <input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>

            {fileName && (
              <div className="mt-4 text-xs font-bold text-emerald-900 bg-emerald-50 border border-emerald-200 px-4 py-1.5 rounded-full inline-flex items-center space-x-2 shadow-2xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Loaded Spreadsheet: {fileName}</span>
              </div>
            )}

            {parseError && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-semibold max-w-md mx-auto flex items-center space-x-2 text-left">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{parseError}</span>
              </div>
            )}

            {mismatchCount > 0 && (
              <div className="mt-4 p-4 bg-red-50 border border-red-300 rounded-2xl text-xs text-red-900 space-y-1.5 text-left max-w-xl mx-auto shadow-2xs">
                <div className="flex items-center space-x-2 font-black text-red-800">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>Academic Integrity Shield: {mismatchCount} Department Mismatch{mismatchCount === 1 ? "" : "es"} Detected</span>
                </div>
                <p className="text-[11px] text-red-700 pl-6 leading-relaxed">
                  {targetDepartment ? (
                    <>
                      This track is strictly locked to <strong>{targetDepartment}</strong> syllabus questions.
                      The uploaded file contains {mismatchCount} item(s) tagged for other departments or Common Core.
                      Mismatched rows are flagged with ❌ and will be safely excluded from importation.
                    </>
                  ) : (
                    <>
                      This section is strictly reserved for <strong>Common Core (GENERAL)</strong> aptitude.
                      The uploaded file contains {mismatchCount} department-specific question(s).
                      Mismatched rows are flagged with ❌ and will be safely excluded from importation.
                    </>
                  )}
                </p>
              </div>
            )}
          </div>

          {/* Parsed Preview Table */}
          {parsedRows.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs space-y-3 p-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h4 className="text-xs font-black text-slate-900 flex items-center space-x-1.5">
                    <Sparkles className="w-4 h-4 text-amber-600" />
                    <span>Parsed {parsedRows.length} Questions</span>
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {mismatchCount > 0 && (
                      <span className="text-red-600 font-bold mr-1">
                        [{mismatchCount} invalid rows excluded]
                      </span>
                    )}
                    {willTruncate
                      ? `Target quota allows ${availableSlots} more question(s). The first ${availableSlots} valid rows will be imported.`
                      : `All ${validRows.length} valid questions fit within the available quota.`}
                  </p>
                </div>

                <span className="text-[11px] font-black px-3 py-1 rounded-full bg-blue-50 text-blue-800 border border-blue-200">
                  {countToImport} Ready to Import
                </span>
              </div>

              <div className="overflow-x-auto max-h-64 border border-slate-100 rounded-xl">
                <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                  <thead className="bg-slate-50 text-slate-700 font-bold uppercase tracking-wider text-[10px] sticky top-0">
                    <tr>
                      <th className="px-3.5 py-2.5">#</th>
                      <th className="px-3.5 py-2.5">Dept</th>
                      <th className="px-3.5 py-2.5">Type</th>
                      <th className="px-3.5 py-2.5">Prompt</th>
                      <th className="px-3.5 py-2.5">Options Preview</th>
                      <th className="px-3.5 py-2.5">Key</th>
                      <th className="px-3.5 py-2.5">Marks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-800 text-[11px]">
                    {parsedRows.map((r, i) => (
                      <tr
                        key={i}
                        className={`transition-colors ${
                          r.isDeptMismatch
                            ? "bg-red-50/70 hover:bg-red-50 text-red-950"
                            : i >= availableSlots
                            ? "opacity-40 bg-slate-50/50"
                            : "hover:bg-slate-50"
                        }`}
                      >
                        <td className="px-3.5 py-2.5 font-bold text-slate-500">{i + 1}</td>
                        <td className="px-3.5 py-2.5 whitespace-nowrap">
                          {r.isDeptMismatch ? (
                            <span
                              className="px-2 py-0.5 rounded-md bg-red-100 text-red-800 border border-red-300 font-mono font-bold text-[10px]"
                              title={r.mismatchReason}
                            >
                              ❌ {r.departmentCode}
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-800 border border-blue-200 font-mono font-bold text-[10px]">
                              {r.departmentCode || (targetDepartment ? targetDepartment : "GENERAL")}
                            </span>
                          )}
                        </td>
                        <td className="px-3.5 py-2.5 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border font-mono font-bold text-[10px]">
                            {r.questionType === "MCQ_SINGLE" ? "Single" : "Multi"}
                          </span>
                        </td>
                        <td className="px-3.5 py-2.5 font-semibold max-w-xs truncate" title={r.isDeptMismatch ? r.mismatchReason : undefined}>
                          {r.prompt}
                        </td>
                        <td className="px-3.5 py-2.5 text-slate-500 max-w-xs truncate">
                          A: {r.optionA} | B: {r.optionB}
                        </td>
                        <td className="px-3.5 py-2.5 font-mono font-bold text-emerald-700">{r.correctOption}</td>
                        <td className="px-3.5 py-2.5 font-bold">1.0</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* 5. Sticky Action Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-white/95 backdrop-blur-md flex items-center justify-between shadow-lg">
          <div className="text-xs text-slate-600 font-medium">
            {parsedRows.length > 0 ? (
              <span>
                Ready to import <strong className="text-blue-700 font-black text-sm">{countToImport}</strong> valid question{countToImport === 1 ? "" : "s"} into{" "}
                <span className="font-bold text-slate-900">{targetSectionTitle}</span>
                {targetDepartment && (
                  <span className="ml-1 font-black text-purple-700">({targetDepartment} Track)</span>
                )}
              </span>
            ) : (
              <span>Upload a CSV file above to preview and import questions into this track.</span>
            )}
          </div>

          <div className="flex items-center space-x-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmImport}
              disabled={parsedRows.length === 0 || countToImport === 0}
              className="inline-flex items-center px-5 py-2 text-xs font-black text-white bg-blue-700 hover:bg-blue-800 rounded-xl shadow-sm transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <span>Import Questions ({countToImport})</span>
              <ArrowRight className="w-4 h-4 ml-1.5" />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
