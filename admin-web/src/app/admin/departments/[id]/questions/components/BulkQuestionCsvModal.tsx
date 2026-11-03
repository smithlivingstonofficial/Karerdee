"use client";

import React, { useState, useRef } from "react";
import { bulkImportDepartmentQuestionsAction, BulkQuestionCsvRow } from "../actions";
import { FileSpreadsheet, Upload, Download, X, AlertCircle, CheckCircle2 } from "lucide-react";

interface BulkQuestionCsvModalProps {
  isOpen: boolean;
  onClose: () => void;
  departmentId: string;
  departmentCode: string;
}

interface ParsedQuestionRow extends BulkQuestionCsvRow {
  isValid: boolean;
  errorReason?: string;
  isDeptMismatch?: boolean;
}

export function BulkQuestionCsvModal({
  isOpen,
  onClose,
  departmentId,
  departmentCode,
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
      "Department Code,Topic,Difficulty,Question Type,Question Prompt,Code Snippet,Option A,Option B,Option C,Option D,Correct Option,Points,Negative Points\n" +
      `${departmentCode},Data Structures,MEDIUM,MCQ_SINGLE,"What is the worst-case time complexity of QuickSort?",,O(n),O(n log n),O(n^2),O(log n),C,1,0.25\n` +
      `${departmentCode},Algorithms,HARD,MCQ_SINGLE,"Which data structure is primarily used in Dijkstra's Shortest Path Algorithm?",,Min-Heap,Stack,Queue,Binary Search Tree,A,2,0.5\n` +
      `${departmentCode},Database Systems,EASY,MCQ_SINGLE,"Which SQL clause is used to filter records resulting from a GROUP BY clause?",,WHERE,HAVING,ORDER BY,DISTINCT,B,1,0\n` +
      `${departmentCode},Operating Systems,MEDIUM,MCQ_MULTIPLE,"Which of the following are valid conditions for deadlock to occur?",,Mutual Exclusion,Hold and Wait,Preemption,Circular Wait,"A,B,D",2,0.5\n`;

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `KARE_${departmentCode}_Question_Bank_Template.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function parseCSV(text: string) {
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) {
      setError("CSV must contain a header row and at least one question record.");
      return;
    }

    const headerLine = lines[0].toLowerCase();
    const hasDeptHeader =
      headerLine.startsWith("department code") ||
      headerLine.startsWith('"department code"') ||
      headerLine.startsWith("dept code") ||
      headerLine.startsWith('"dept code"');

    const parsed: ParsedQuestionRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const values: string[] = [];
      let currentVal = "";
      let inQuotes = false;

      for (let c = 0; c < line.length; c++) {
        const char = line[c];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === "," && !inQuotes) {
          values.push(currentVal.trim());
          currentVal = "";
        } else {
          currentVal += char;
        }
      }
      values.push(currentVal.trim());

      const clean = (val: string) => (val || "").replace(/^"|"$/g, "").trim();

      // Support 13-column format (Department Code, Topic, ...) and 12-column format (Topic, ...)
      let colOffset = 0;
      let rowDeptCode = "";

      if (hasDeptHeader || values.length >= 13) {
        colOffset = 1;
        rowDeptCode = clean(values[0]).toUpperCase();
      } else if (
        clean(values[0]).length <= 6 &&
        ["EASY", "MEDIUM", "HARD"].includes(clean(values[2]).toUpperCase())
      ) {
        // Fallback detection if header was missing or custom
        colOffset = 1;
        rowDeptCode = clean(values[0]).toUpperCase();
      }

      const topic = clean(values[colOffset + 0]) || "General";
      const difficulty = clean(values[colOffset + 1]).toUpperCase() as any;
      const questionType = clean(values[colOffset + 2]).toUpperCase() === "MCQ_MULTIPLE" ? "MCQ_MULTIPLE" : "MCQ_SINGLE";
      const prompt = clean(values[colOffset + 3]);
      const codeSnippet = clean(values[colOffset + 4]);
      const optionA = clean(values[colOffset + 5]);
      const optionB = clean(values[colOffset + 6]);
      const optionC = clean(values[colOffset + 7]);
      const optionD = clean(values[colOffset + 8]);
      const correctAnswers = clean(values[colOffset + 9]).toUpperCase() || "A";
      const points = parseFloat(clean(values[colOffset + 10])) || 1.0;
      const negativePoints = parseFloat(clean(values[colOffset + 11])) || 0.0;

      // Strict Department Code check
      const expectedCode = departmentCode.toUpperCase().trim();
      let isDeptMismatch = false;
      let errorReason = "";

      if (rowDeptCode && rowDeptCode !== expectedCode) {
        isDeptMismatch = true;
        errorReason = `Department mismatch: question is tagged '${rowDeptCode}', but you are importing into '${expectedCode}'. `;
      }

      if (!prompt) errorReason += "Missing prompt. ";
      if (!optionA || !optionB) errorReason += "Need at least Option A & B. ";

      const isValid = !isDeptMismatch && prompt.length > 0 && optionA.length > 0 && optionB.length > 0;

      parsed.push({
        departmentCode: rowDeptCode || expectedCode,
        topic,
        difficulty: ["EASY", "MEDIUM", "HARD"].includes(difficulty) ? difficulty : "MEDIUM",
        questionType,
        prompt,
        codeSnippet,
        optionA,
        optionB,
        optionC,
        optionD,
        correctAnswers,
        points,
        negativePoints,
        isValid,
        errorReason: errorReason.trim(),
        isDeptMismatch,
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

    const res = await bulkImportDepartmentQuestionsAction(departmentId, validRows);
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
      <div className="w-full max-w-3xl bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center font-bold text-xs border border-blue-100">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Bulk Import {departmentCode} Questions (CSV)
              </h2>
              <p className="text-[11px] text-slate-500">
                Batch import MCQs, options, and point schemes into the department repository.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
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
              <span>Successfully imported {successCount} questions into {departmentCode} repository!</span>
            </div>
          )}

          {/* Template Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
            <div>
              <span className="text-xs font-bold text-slate-800 block">
                Standard {departmentCode} Question Bank Format
              </span>
              <span className="text-[11px] text-slate-500">
                Columns: Department Code ({departmentCode}), Topic, Difficulty, Question Type, Prompt, Code, Option A-D, Correct, Points
              </span>
            </div>
            <button
              type="button"
              onClick={handleDownloadSample}
              className="inline-flex items-center justify-center px-3 py-1.5 text-xs font-semibold text-blue-700 bg-white border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors cursor-pointer shadow-2xs"
            >
              <Download className="w-3.5 h-3.5 mr-1.5" />
              Download Template
            </button>
          </div>

          {/* Department Code Mismatch Alert */}
          {rows.some((r) => r.isDeptMismatch) && (
            <div className="p-3.5 bg-red-50 border border-red-300 rounded-xl text-xs text-red-800 space-y-1">
              <div className="flex items-center space-x-2 font-bold text-red-700">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>Department Code Mismatch Detected</span>
              </div>
              <p className="text-[11px] text-red-600 pl-6">
                This repository is exclusively reserved for <strong>{departmentCode}</strong> questions.
                The uploaded file contains question rows tagged with other department codes. Those rows are blocked to prevent misfiling.
              </p>
            </div>
          )}

          {/* Dropzone */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-300 hover:border-blue-500 bg-white hover:bg-blue-50/20 rounded-xl p-6 text-center cursor-pointer transition-all"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="hidden"
            />
            <div className="w-10 h-10 mx-auto rounded-full bg-blue-50 text-blue-700 flex items-center justify-center mb-2">
              <Upload className="w-5 h-5" />
            </div>
            <p className="text-xs font-bold text-slate-800">
              {fileName ? fileName : `Click or drag your ${departmentCode} questions CSV here`}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              UTF-8 encoded .csv up to 10MB
            </p>
          </div>

          {/* Parsed Preview */}
          {rows.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">
                  Detected Questions ({rows.length})
                </span>
                <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[11px] font-semibold border border-emerald-200">
                  {validCount} Ready to Import
                </span>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-2 px-3">Dept Code</th>
                      <th className="py-2 px-3">Topic</th>
                      <th className="py-2 px-3">Prompt</th>
                      <th className="py-2 px-3">Answer</th>
                      <th className="py-2 px-3 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.map((r, idx) => (
                      <tr key={idx} className={r.isValid ? "hover:bg-slate-50/50" : "bg-red-50/40"}>
                        <td className="py-1.5 px-3 whitespace-nowrap">
                          {r.isDeptMismatch ? (
                            <span className="text-[10px] font-bold bg-red-100 text-red-700 border border-red-300 px-1.5 py-0.5 rounded font-mono" title="Mismatched Department">
                              ❌ {r.departmentCode || "N/A"}
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded font-mono">
                              {r.departmentCode || departmentCode}
                            </span>
                          )}
                        </td>
                        <td className="py-1.5 px-3 whitespace-nowrap">
                          <span className="text-[10px] font-bold bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">
                            {r.topic}
                          </span>
                        </td>
                        <td className="py-1.5 px-3 text-slate-800 font-medium truncate max-w-xs">
                          {r.prompt}
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
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-100 flex items-center justify-end space-x-2.5 flex-shrink-0 bg-slate-50/50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleImport}
            disabled={loading || validCount === 0}
            className="px-4 py-2 text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
          >
            {loading ? "Importing..." : `Import ${validCount} Questions`}
          </button>
        </div>
      </div>
    </div>
  );
}

