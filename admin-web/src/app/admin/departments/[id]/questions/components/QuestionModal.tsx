"use client";

import React, { useState, useEffect } from "react";
import {
  createDepartmentQuestionAction,
  updateDepartmentQuestionAction,
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
  CheckCircle2,
  Check,
  CheckCheck
} from "lucide-react";
import { MathText } from "@/components/MathText";

interface QuestionModalProps {
  isOpen: boolean;
  onClose: () => void;
  departmentId: string;
  departmentCode: string;
  existingTopics?: string[];
  initialType?: "MCQ_SINGLE" | "MCQ_MULTIPLE";
  question?: {
    id: string;
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
  departmentId,
  departmentCode,
  existingTopics = [],
  initialType = "MCQ_SINGLE",
  question,
}: QuestionModalProps) {
  const [topic, setTopic] = useState("General");
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
      setTopic(question.topic || "General");
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
      setTopic("General");
      setDifficulty("MEDIUM");
      setQuestionType(initialType);
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
  }, [question, isOpen, initialType]);

  if (!isOpen) return null;

  function handleTypeChange(newType: "MCQ_SINGLE" | "MCQ_MULTIPLE") {
    setQuestionType(newType);
    if (newType === "MCQ_SINGLE") {
      const firstCorrectIdx = options.findIndex((o) => o.isCorrect);
      const targetIdx = firstCorrectIdx >= 0 ? firstCorrectIdx : 0;
      setOptions(
        options.map((opt, i) => ({
          ...opt,
          isCorrect: i === targetIdx,
        }))
      );
    }
  }

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
      const updated = options.map((opt, i) =>
        i === index ? { ...opt, isCorrect: !opt.isCorrect } : opt
      );
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
      topic: topic.trim() || "General",
      difficulty,
      questionType,
      prompt: prompt.trim(),
      codeSnippet: showCodeSnippet && codeSnippet.trim() ? codeSnippet.trim() : null,
      defaultPoints: 1.0,
      defaultNegativePoints: Number(defaultNegativePoints) || 0.0,
      options,
    };

    const res = question
      ? await updateDepartmentQuestionAction(question.id, departmentId, payload)
      : await createDepartmentQuestionAction(departmentId, payload);

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
                {question ? "Edit Repository Question" : `New ${departmentCode} Question`}
              </h2>
              <p className="text-[11px] text-slate-500">
                Stored in department question repository for recurring exam paper selection.
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

          {/* Row 1: Topic & Difficulty */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Topic / Subject Area
              </label>
              <input
                type="text"
                list="topic-suggestions"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. Data Structures"
                className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-700"
              />
              <datalist id="topic-suggestions">
                {existingTopics.map((t) => (
                  <option key={t} value={t} />
                ))}
                <option value="Algorithms" />
                <option value="Operating Systems" />
                <option value="Database Management" />
                <option value="Computer Networks" />
                <option value="Software Engineering" />
                <option value="Machine Learning" />
                <option value="Web Development" />
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
          </div>

          {/* Question Format Selector: Single Choice vs Multiple Choice (Multi-Select) */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                Question Format <span className="text-red-500">*</span>
              </label>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                questionType === "MCQ_MULTIPLE"
                  ? "bg-amber-100 text-amber-800 border-amber-300"
                  : "bg-blue-100 text-blue-800 border-blue-200"
              }`}>
                {questionType === "MCQ_MULTIPLE" ? "Multi-Select (Checkboxes)" : "Single Choice (Radio)"}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => handleTypeChange("MCQ_SINGLE")}
                className={`flex items-start space-x-3 p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  questionType === "MCQ_SINGLE"
                    ? "bg-white border-blue-600 ring-2 ring-blue-600/20 shadow-xs"
                    : "bg-white/70 border-slate-200 hover:bg-white text-slate-600 hover:border-slate-300"
                }`}
              >
                <div className={`w-5 h-5 rounded-full flex items-center justify-center mt-0.5 flex-shrink-0 ${
                  questionType === "MCQ_SINGLE"
                    ? "bg-blue-600 text-white"
                    : "border-2 border-slate-300 bg-white"
                }`}>
                  {questionType === "MCQ_SINGLE" && <div className="w-2 h-2 rounded-full bg-white" />}
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900">Single Choice (Radio)</div>
                  <div className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                    Standard MCQ with 1 correct answer. Selecting one clears the others.
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleTypeChange("MCQ_MULTIPLE")}
                className={`flex items-start space-x-3 p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  questionType === "MCQ_MULTIPLE"
                    ? "bg-amber-50/50 border-amber-600 ring-2 ring-amber-500/20 shadow-xs"
                    : "bg-white/70 border-slate-200 hover:bg-white text-slate-600 hover:border-slate-300"
                }`}
              >
                <div className={`w-5 h-5 rounded-md flex items-center justify-center mt-0.5 flex-shrink-0 ${
                  questionType === "MCQ_MULTIPLE"
                    ? "bg-amber-600 text-white"
                    : "border-2 border-slate-300 bg-white"
                }`}>
                  {questionType === "MCQ_MULTIPLE" && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900 flex items-center space-x-1.5">
                    <span>Select Multiple (Multi-Select)</span>
                    <span className="text-[9px] font-extrabold uppercase bg-amber-200 text-amber-900 px-1.5 py-0.2 rounded">Multi</span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                    Multi-select MCQ. Check multiple options as correct answers (checkboxes).
                  </div>
                </div>
              </button>
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
              placeholder="State the technical question clearly..."
              className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-700 resize-y"
            />
            {Boolean(prompt && (/[²³⁴⁰¹⁵⁶⁷⁸⁹πδρṁ√∮∫∞±×÷^$]/.test(prompt) || (prompt.includes("=") && /[a-zA-Z]/.test(prompt)))) && (
              <div className="mt-2 p-2.5 bg-blue-50/70 border border-blue-200 rounded-xl text-xs text-blue-950 flex items-start space-x-2 animate-in fade-in duration-150">
                <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider flex-shrink-0 mt-0.5">
                  Formula Preview:
                </span>
                <div className="flex-1 font-medium leading-relaxed">
                  <MathText text={prompt} />
                </div>
              </div>
            )}
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
                  placeholder="Paste C, Java, Python, or SQL code snippet here..."
                  className="w-full p-3 font-mono text-xs bg-slate-900 text-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}
          </div>

          {/* Scoring & Penalty */}
          <div className="grid grid-cols-2 gap-4 p-3 bg-slate-50 rounded-xl border border-slate-200">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Question Marks
              </label>
              <div className="flex items-center space-x-2 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-900 text-xs font-bold">
                <span className="text-blue-700">1.0 Mark</span>
                <span className="text-[10px] text-slate-400 font-normal">(Standardized)</span>
              </div>
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
              <div>
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Answer Options ({questionType === "MCQ_MULTIPLE" ? "Check All Correct Choices" : "Select Single Correct Answer"})
                </label>
                <span className="text-[11px] text-slate-500">
                  {questionType === "MCQ_SINGLE"
                    ? "Click the circular radio button to designate the single correct answer."
                    : "Click square checkbox buttons to designate all valid correct answers."}
                </span>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                questionType === "MCQ_MULTIPLE"
                  ? "bg-amber-100 text-amber-800 border-amber-300"
                  : "bg-emerald-100 text-emerald-800 border-emerald-200"
              }`}>
                {questionType === "MCQ_MULTIPLE"
                  ? `${options.filter(o => o.isCorrect).length} Correct Selected`
                  : "1 Correct Selected"}
              </span>
            </div>

            {questionType === "MCQ_MULTIPLE" && (
              <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start space-x-2.5">
                <CheckCheck className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="leading-snug">
                  <span className="font-bold">Multi-Select Mode Active:</span> Multiple options can be marked as correct. Candidates will need to select all correct answers on their exam paper to earn credit.
                </div>
              </div>
            )}

            <div className="space-y-2">
              {options.map((opt, idx) => {
                const letter = String.fromCharCode(65 + idx);
                const isSingle = questionType === "MCQ_SINGLE";
                return (
                  <div
                    key={idx}
                    className={`flex items-center space-x-2.5 p-2 rounded-xl border transition-all ${
                      opt.isCorrect
                        ? isSingle
                          ? "bg-emerald-50/70 border-emerald-300 shadow-2xs"
                          : "bg-amber-50/60 border-amber-300 shadow-2xs"
                        : "bg-white border-slate-200"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => handleOptionCorrectToggle(idx)}
                      className={`w-7 h-7 flex items-center justify-center font-bold text-xs transition-all cursor-pointer flex-shrink-0 ${
                        isSingle ? "rounded-full" : "rounded-lg"
                      } ${
                        opt.isCorrect
                          ? isSingle
                            ? "bg-emerald-600 text-white shadow-2xs"
                            : "bg-amber-600 text-white shadow-2xs"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200"
                      }`}
                      title={
                        opt.isCorrect
                          ? `${isSingle ? "Single" : "Multi"} correct option (click to toggle)`
                          : `Click to mark ${letter} as correct`
                      }
                    >
                      {opt.isCorrect ? (
                        isSingle ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : <CheckCheck className="w-3.5 h-3.5 stroke-[3]" />
                      ) : (
                        letter
                      )}
                    </button>

                    <input
                      type="text"
                      required
                      placeholder={`Option ${letter} text...`}
                      value={opt.optionText}
                      onChange={(e) => handleOptionTextChange(idx, e.target.value)}
                      className="flex-1 px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-700"
                    />

                    {/* Option Formula Live Preview */}
                    {Boolean(opt.optionText && (/[²³⁴⁰¹⁵⁶⁷⁸⁹πδρṁ√∮∫∞±×÷^$]/.test(opt.optionText) || (opt.optionText.includes("=") && /[a-zA-Z]/.test(opt.optionText)))) && (
                      <span className="px-2 py-0.5 bg-blue-50 border border-blue-200 text-blue-900 rounded-md text-xs font-serif font-medium flex-shrink-0" title="Rendered equation preview">
                        <MathText text={opt.optionText} />
                      </span>
                    )}

                    {opt.isCorrect && (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border flex-shrink-0 ${
                        isSingle
                          ? "text-emerald-700 bg-emerald-100/70 border-emerald-300"
                          : "text-amber-800 bg-amber-100/70 border-amber-300"
                      }`}>
                        ✓ Correct Answer
                      </span>
                    )}

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

