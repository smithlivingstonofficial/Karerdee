"use client";

import React, { useState, useRef } from "react";
import { bulkImportStudentsAction } from "../actions";
import { FileSpreadsheet, Upload, Download, X, AlertCircle, CheckCircle2, AlertTriangle } from "lucide-react";

interface BulkStudentCsvModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ParsedStudentRow {
  applicationNumber: string;
  fullName: string;
  email: string;
  departmentCode: string;
  isValid: boolean;
  errorReason?: string;
}

export function BulkStudentCsvModal({ isOpen, onClose }: BulkStudentCsvModalProps) {
  const [rows, setRows] = useState<ParsedStudentRow[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successCount, setSuccessCount] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  function handleDownloadSample() {
    const csvContent =
      "Application Number,Student Name,Email,Department Code\n" +
      "9921004001,Aravind Swamy,aravind.s@klu.ac.in,MCA\n" +
      "9921004002,Bhavani Ramesh,bhavani.r@klu.ac.in,CSE\n" +
      "9921004003,Chandran Kumar,chandran.k@klu.ac.in,ECE\n" +
      "9921004004,Divya Priya,divya.p@klu.ac.in,MECH\n";

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "KARE_SES_Candidate_Import_Template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function parseCSV(text: string) {
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) {
      setError("The uploaded CSV must contain a header row and at least one student record.");
      return;
    }

    // Header check
    const headerLine = lines[0].toLowerCase();
    const parsed: ParsedStudentRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Basic CSV token parser handling quotes
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

      const appNum = (values[0] || "").replace(/^"|"$/g, "").trim().toUpperCase();
      const name = (values[1] || "").replace(/^"|"$/g, "").trim();
      const email = (values[2] || "").replace(/^"|"$/g, "").trim().toLowerCase();
      const deptCode = (values[3] || "").replace(/^"|"$/g, "").trim().toUpperCase();

      const isValid = appNum.length > 0 && name.length > 0 && email.length > 0;
      let errorReason = "";
      if (!appNum) errorReason = "Missing Application Number (Password). ";
      if (!name) errorReason += "Missing Name. ";
      if (!email) errorReason += "Missing Institutional Email (Username).";

      parsed.push({
        applicationNumber: appNum,
        fullName: name,
        email: email,
        departmentCode: deptCode,
        isValid,
        errorReason: errorReason.trim(),
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
        setError("Failed to parse CSV file: " + (err.message || "Invalid formatting"));
      }
    };
    reader.readAsText(file);
  }

  async function handleImport() {
    const validRows = rows.filter((r) => r.isValid);
    if (validRows.length === 0) {
      setError("No valid candidate rows found to import.");
      return;
    }

    setLoading(true);
    setError(null);

    const payload = validRows.map((r) => ({
      applicationNumber: r.applicationNumber,
      fullName: r.fullName,
      email: r.email,
      departmentCode: r.departmentCode,
    }));

    const res = await bulkImportStudentsAction(payload);
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
      <div className="w-full max-w-2xl bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center font-bold text-xs border border-blue-100">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Bulk Import Candidates (CSV)
              </h2>
              <p className="text-[11px] text-slate-500">
                Upload institutional student cohorts with Application Numbers & Department codes.
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
              <span>Successfully imported and synchronized {successCount} candidate records!</span>
            </div>
          )}

          {/* Download Sample & Upload Area */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
            <div>
              <span className="text-xs font-bold text-slate-800 block">
                Standard Template Format
              </span>
              <span className="text-[11px] text-slate-500">
                Columns: Application Number, Student Name, Email, Department Code
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

          {/* Upload Dropzone */}
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
              {fileName ? fileName : "Click to select or drag and drop your candidate CSV"}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              UTF-8 encoded .csv files up to 10MB
            </p>
          </div>

          {/* Preview Parsed Rows */}
          {rows.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">
                  Detected Candidates ({rows.length})
                </span>
                <div className="flex items-center space-x-2 text-[11px]">
                  <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-semibold border border-emerald-200">
                    {validCount} Ready
                  </span>
                  {invalidCount > 0 && (
                    <span className="text-red-700 bg-red-50 px-2 py-0.5 rounded font-semibold border border-red-200">
                      {invalidCount} Invalid
                    </span>
                  )}
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-2 px-3">Application No</th>
                      <th className="py-2 px-3">Name</th>
                      <th className="py-2 px-3">Dept</th>
                      <th className="py-2 px-3">Email</th>
                      <th className="py-2 px-3 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.slice(0, 50).map((r, idx) => (
                      <tr key={idx} className={r.isValid ? "hover:bg-slate-50/50" : "bg-red-50/40"}>
                        <td className="py-1.5 px-3 font-mono font-bold text-slate-800">
                          {r.applicationNumber || "—"}
                        </td>
                        <td className="py-1.5 px-3 text-slate-700">{r.fullName || "—"}</td>
                        <td className="py-1.5 px-3">
                          <span className="font-mono text-[10px] font-semibold bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">
                            {r.departmentCode || "—"}
                          </span>
                        </td>
                        <td className="py-1.5 px-3 text-slate-500 truncate max-w-[140px]">
                          {r.email || "—"}
                        </td>
                        <td className="py-1.5 px-3 text-right">
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
              {rows.length > 50 && (
                <p className="text-[10px] text-slate-400 text-center">
                  Showing first 50 of {rows.length} rows...
                </p>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
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
            {loading ? "Importing Candidates..." : `Import ${validCount} Candidates`}
          </button>
        </div>
      </div>
    </div>
  );
}
