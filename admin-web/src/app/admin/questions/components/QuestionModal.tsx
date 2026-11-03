"use client";

import React, { useState, useEffect } from "react";
import {
  createQuestionAction,
  updateQuestionAction,
  QuestionInput,
  OptionInput,
} from "../actions";
import {
  HelpCircle,
  X,
  AlertCircle,
  Plus,
  Trash2,
  Code,
  Building2,
  Sparkles,
  Check
} from "lucide-react";

interface DepartmentOption {
  id: string;
  name: string;
  code: string;
}

interface QuestionModalProps {
  isOpen: boolean;
  onClose: () => void;
  departments: DepartmentOption[];
  existingTopics?: string[];
  question?: {
    id: string;
    department_id?: string | null;
    topic: string;
    difficulty: "EASY" | "MEDIUM" | "HARD";
    question_type: "MCQ_SINGLE" | "MCQ_MULTIPLE";
    prompt: string;
    code_snippet?: string | null;
    default_points: number;
    default_negative_points: number;
    options?: { id?: string; option_text: string; is_correct: boolean }[];
  } | null;
}

export function QuestionModal({
  isOpen,
  onClose,
  departments,
  existingTopics = [],
  question,
}: QuestionModalProps) {
  const [departmentId, setDepartmentId] = useState<string>("");
  const [topic, setTopic] = useState("General Aptitude");
  const [difficulty, setDifficulty] = useState<"EASY" | "MEDIUM" | "HARD">("MEDIUM");
  const [questionType, setQuestionType] = useState<"MCQ_SINGLE" | "MCQ_MULTIPLE">("MCQ_SINGLE");
  const [prompt, setPrompt] = useState("");
  const [showCodeSnippet, setShowCodeSnippet] = useState(false);
  const [codeSnippet, setCodeSnippet] = useState("");
  const [defaultPoints, setDefaultPoints] = useState(1.0);
  const [defaultNegativePoints, setDefaultNegativePoints] = useState(0.0);
  const [options, setOptions] = useState<OptionInput[]>([
    { optionText: "", isCorrect: true },
    { optionText: "", isCorrect: false },
    { optionText: "", isCorrect: false },
    { optionText: "", isCorrect: false },
  ]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (question) {
      setDepartmentId(question.department_id || "");
      setTopic(question.topic || "General Aptitude");
      setDifficulty(question.difficulty || "MEDIUM");
      setQuestionType(question.question_type || "MCQ_SINGLE");
      setPrompt(question.prompt || "");
      setCodeSnippet(question.code_snippet || "");
      setShowCodeSnippet(!!question.code_snippet);
      setDefaultPoints(question.default_points || 1.0);
      setDefaultNegativePoints(question.default_negative_points || 0.0);
      if (question.options && question.options.length > 0) {
        setOptions(
          question.options.map((o) => ({
            optionText: o.option_text,
            isCorrect: o.is_correct,
          }))
        );
      } else {
        setOptions([
          { optionText: "", isCorrect: true },
          { optionText: "", isCorrect: false },
        ]);
      }
    } else {
      setDepartmentId("");
      setTopic("General Aptitude");
      setDifficulty("MEDIUM");
      setQuestionType("MCQ_SINGLE");
      setPrompt("");
      setCodeSnippet("");
      setShowCodeSnippet(false);
      setDefaultPoints(1.0);
      setDefaultNegativePoints(0.0);
      setOptions([
        { optionText: "", isCorrect: true },
        { optionText: "", isCorrect: false },
        { optionText: "", isCorrect: false },
        { optionText: "", isCorrect: false },
      ]);
    }
    setError(null);
  }, [question, isOpen]);

  if (!isOpen) return null;

  function handleOptionTextChange(index: number, val: string) {
    const updated = [...options];
    updated[index].optionText = val;
    setOptions(updated);
  }

  function handleOptionCorrectToggle(index: number) {
    if (questionType === "MCQ_SINGLE") {
      const updated = options.map((opt, i) => ({
        ...opt,
        isCorrect: i === index,
      }));
      setOptions(updated);
    } else {
      const updated = [...options];
      updated[index].isCorrect = !updated[index].isCorrect;
      setOptions(updated);
    }
  }

  function handleAddOption() {
    if (options.length >= 6) return;
    setOptions([...options, { optionText: "", isCorrect: false }]);
  }

  function handleRemoveOption(index: number) {
    if (options.length <= 2) return;
    const updated = options.filter((_, i) => i !== index);
    if (!updated.some((o) => o.isCorrect)) {
      updated[0].isCorrect = true;
    }
    setOptions(updated);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!prompt.trim()) {
      setError("Question prompt cannot be empty.");
      return;
    }

    const emptyOptions = options.some((o) => !o.optionText.trim());
    if (emptyOptions) {
      setError("Please fill out text for all option choices.");
      return;
    }

    const hasCorrect = options.some((o) => o.isCorrect);
    if (!hasCorrect) {
      setError("Please select at least one correct answer option.");
      return;
    }

    setLoading(true);

    const payload: QuestionInput = {
      departmentId: departmentId ? departmentId.trim() : null,
      topic: topic.trim() || "General",
      difficulty,
      questionType,
      prompt: prompt.trim(),
      codeSnippet: showCodeSnippet && codeSnippet.trim() ? codeSnippet.trim() : null,
      defaultPoints: Number(defaultPoints) || 1.0,
      defaultNegativePoints: Number(defaultNegativePoints) || 0.0,
      options,
    };

    const res = question
      ? await updateQuestionAction(question.id, payload)
      : await createQuestionAction(payload);

    setLoading(false);

    if (res.error) {
      setError(res.error);
    } else {
      onClose();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
      <div className="w-full max-w-2xl bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center font-bold text-xs border border-blue-100">
              <HelpCircle className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                {question ? "Edit Repository Question" : "Author New Question"}
              </h2>
              <p className="text-[11px] text-slate-500">
                Add to institutional master question repository for Common or Department exam papers.
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

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-semibold flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Department Scope Selector */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
              Question Scope / Faculty <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <select
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
                className="w-full px-3.5 py-2 text-xs font-semibold bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-700 cursor-pointer appearance-none"
              >
                <option value="">
                  ⭐ General / Common Core (Applies to all departments & Ph.D entrance)
                </option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    [{d.code}] {d.name}
                  </option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
                {departmentId ? <Building2 className="w-4 h-4" /> : <Sparkles className="w-4 h-4 text-purple-600" />}
              </div>
            </div>
            <p className="text-[11px] text-slate-500">
              {departmentId
                ? "This question will be stored specifically for this department."
                : "General questions can be included in Common Core sections (Research Methodology, General Aptitude) for all students."}
            </p>
          </div>

          {/* Row 1: Topic & Difficulty & Type */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Topic / Subject Area
              </label>
              <input
                type="text"
                list="general-topic-suggestions"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. Research Methodology"
                className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-700"
              />
              <datalist id="general-topic-suggestions">
                <option value="Research Methodology" />
                <option value="General Aptitude" />
                <option value="Logical Reasoning" />
                <option value="Quantitative Ability" />
                <option value="Data Interpretation" />
                <option value="Verbal Comprehension" />
                <option value="Algorithms & Data Structures" />
                <option value="Database Systems" />
                <option value="Operating Systems" />
                <option value="Computer Networks" />
                <option value="Software Engineering" />
                <option value="Machine Learning" />
                {existingTopics.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Difficulty Level
              </label>
              <div className="grid grid-cols-3 gap-1 p-0.5 bg-slate-100 rounded-xl border border-slate-200">
                {(["EASY", "MEDIUM", "HARD"] as const).map((diff) => (
                  <button
                    key={diff}
                    type="button"
                    onClick={() => setDifficulty(diff)}
                    className={`py-1 text-[11px] font-bold rounded-lg transition-all ${
                      difficulty === diff
                        ? diff === "EASY"
                          ? "bg-white text-emerald-700 shadow-2xs font-extrabold"
                          : diff === "MEDIUM"
                          ? "bg-white text-blue-700 shadow-2xs font-extrabold"
                          : "bg-white text-red-700 shadow-2xs font-extrabold"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    {diff}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Question Type
              </label>
              <select
                value={questionType}
                onChange={(e) => setQuestionType(e.target.value as any)}
                className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-700 cursor-pointer"
              >
                <option value="MCQ_SINGLE">Single Choice (1 Correct)</option>
                <option value="MCQ_MULTIPLE">Multiple Choice (Checkboxes)</option>
              </select>
            </div>
          </div>

          {/* Row 2: Prompt */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Question Prompt <span className="text-red-500">*</span>
            </label>
            <textarea
              required
              rows={3}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="State the academic question clearly..."
              className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-700 resize-y"
            />
          </div>

          {/* Code Snippet Toggle */}
          <div>
            <button
              type="button"
              onClick={() => setShowCodeSnippet(!showCodeSnippet)}
              className="inline-flex items-center text-xs font-bold text-blue-700 hover:text-blue-800 transition-colors"
            >
              <Code className="w-3.5 h-3.5 mr-1" />
              {showCodeSnippet ? "Remove Code Snippet" : "+ Attach Code Snippet (Optional)"}
            </button>

            {showCodeSnippet && (
              <div className="mt-2">
                <textarea
                  rows={4}
                  value={codeSnippet}
                  onChange={(e) => setCodeSnippet(e.target.value)}
                  placeholder="Paste Python, C, Java, or SQL code snippet here..."
                  className="w-full p-3 font-mono text-xs bg-slate-900 text-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}
          </div>

          {/* Points & Negative Points */}
          <div className="grid grid-cols-2 gap-4 p-3 bg-slate-50 rounded-xl border border-slate-200">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Default Points
              </label>
              <input
                type="number"
                step="0.5"
                min="0.5"
                value={defaultPoints}
                onChange={(e) => setDefaultPoints(parseFloat(e.target.value) || 1)}
                className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-700"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Default Negative Points
              </label>
              <input
                type="number"
                step="0.25"
                min="0"
                value={defaultNegativePoints}
                onChange={(e) => setDefaultNegativePoints(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-700"
              />
            </div>
          </div>

          {/* Options Section */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                Answer Options (Mark Correct Answer)
              </label>
              <span className="text-[11px] text-slate-500">
                {questionType === "MCQ_SINGLE" ? "Select 1 radio button" : "Check all correct options"}
              </span>
            </div>

            <div className="space-y-2">
              {options.map((opt, idx) => {
                const letter = String.fromCharCode(65 + idx);
                return (
                  <div
                    key={idx}
                    className={`flex items-center space-x-2 p-2 rounded-xl border transition-all ${
                      opt.isCorrect
                        ? "bg-emerald-50/60 border-emerald-300 shadow-2xs"
                        : "bg-white border-slate-200"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => handleOptionCorrectToggle(idx)}
                      className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs transition-colors cursor-pointer ${
                        opt.isCorrect
                          ? "bg-emerald-600 text-white shadow-2xs"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                      title={opt.isCorrect ? "Correct Option" : "Click to mark as correct"}
                    >
                      {opt.isCorrect ? <Check className="w-4 h-4 stroke-[3]" /> : letter}
                    </button>

                    <input
                      type="text"
                      required
                      placeholder={`Option ${letter} text...`}
                      value={opt.optionText}
                      onChange={(e) => handleOptionTextChange(idx, e.target.value)}
                      className="flex-1 px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-700"
                    />

                    {options.length > 2 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveOption(idx)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                        title="Remove option"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {options.length < 6 && (
              <button
                type="button"
                onClick={handleAddOption}
                className="inline-flex items-center text-xs font-bold text-blue-700 hover:text-blue-800 transition-colors mt-1"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Add Another Option
              </button>
            )}
          </div>
        </form>

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
            onClick={handleSubmit}
            disabled={loading}
            className="px-4 py-2 text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
          >
            {loading ? "Saving..." : question ? "Update Question" : "Save to Repository"}
          </button>
        </div>
      </div>
    </div>
  );
}

