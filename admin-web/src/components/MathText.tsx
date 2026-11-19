"use client";

import React, { memo, useMemo } from "react";
import katex from "katex";

interface MathTextProps {
  text?: string | null;
  className?: string;
  as?: "span" | "div" | "p";
  displayMode?: boolean;
}

interface ParsedToken {
  type: "text" | "math";
  content: string;
  isDisplay?: boolean;
}

/**
 * Converts Unicode mathematical symbols, superscripts, subscripts,
 * and notation patterns (like Pcr = π²EI/L², √(W/S), T = ṁ(Ve − V∞), etc.) into valid LaTeX syntax.
 */
function unicodeToLatex(str: string): string {
  let s = str.trim();

  // Normalize Unicode dashes (en-dash, em-dash, minus)
  s = s.replace(/[\u2013\u2014\u2212]/g, " - ");

  // Greek letters mapping
  const greekMap: Record<string, string> = {
    "π": "\\pi ",
    "δ": "\\delta ",
    "ρ": "\\rho ",
    "ṁ": "\\dot{m}",
    "θ": "\\theta ",
    "λ": "\\lambda ",
    "μ": "\\mu ",
    "σ": "\\sigma ",
    "τ": "\\tau ",
    "ω": "\\omega ",
    "Ω": "\\Omega ",
    "Δ": "\\Delta ",
    "α": "\\alpha ",
    "β": "\\beta ",
    "γ": "\\gamma ",
    "ε": "\\epsilon ",
    "ϕ": "\\phi ",
    "ψ": "\\psi ",
    "η": "\\eta ",
    "φ": "\\phi ",
  };
  for (const [char, replacement] of Object.entries(greekMap)) {
    s = s.split(char).join(replacement);
  }

  // Operators and special mathematical symbols
  const symbolMap: Record<string, string> = {
    "∞": "\\infty ",
    "×": " \\times ",
    "±": " \\pm ",
    "≠": " \\neq ",
    "≤": " \\leq ",
    "≥": " \\geq ",
    "≈": " \\approx ",
    "∮": "\\oint ",
    "∫": "\\int ",
    "∑": "\\sum ",
    "∂": "\\partial ",
    "→": " \\to ",
    "∈": " \\in ",
    "·": " \\cdot ",
    "•": " \\cdot ",
  };
  for (const [char, replacement] of Object.entries(symbolMap)) {
    s = s.split(char).join(replacement);
  }

  // Multi-character superscripts like ⁻³, ⁻², ⁺¹, ², ³, etc.
  s = s.replace(/([⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻ⁿ]+)/g, (match) => {
    const charMap: Record<string, string> = {
      "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4",
      "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9",
      "⁺": "+", "⁻": "-", "ⁿ": "n",
    };
    const mapped = match.split("").map((c) => charMap[c] || c).join("");
    return `^{${mapped}}`;
  });

  // Multi-character subscripts like ₀, ₁, ₂, ₓ, etc.
  s = s.replace(/([₀₁₂₃₄₅₆₇₈₉₊₋ₓ]+)/g, (match) => {
    const charMap: Record<string, string> = {
      "₀": "0", "₁": "1", "₂": "2", "₃": "3", "₄": "4",
      "₅": "5", "₆": "6", "₇": "7", "₈": "8", "₉": "9",
      "₊": "+", "₋": "-", "ₓ": "x",
    };
    const mapped = match.split("").map((c) => charMap[c] || c).join("");
    return `_{${mapped}}`;
  });

  // Square roots: √(expr) -> \sqrt{expr} and √x, √2, √8 -> \sqrt{x}, \sqrt{2}
  s = s.replace(/√\(([^)]+)\)/g, (_, expr) => `\\sqrt{${expr}}`);
  s = s.replace(/√([0-9a-zA-Z\\]+)/g, (_, expr) => `\\sqrt{${expr}}`);

  // Domain-specific acronym subscripts commonly found in engineering/mechanics
  s = s.replace(/\bPcr\b/g, "P_{cr}");
  s = s.replace(/\bVe\b/g, "V_e");
  s = s.replace(/\bV_e\s*-\s*V\\infty/g, "V_e - V_{\\infty}");
  s = s.replace(/\bV\\infty\b/g, "V_{\\infty}");
  s = s.replace(/V_\\infty/g, "V_{\\infty}");
  s = s.replace(/\bδt\b/g, "\\delta_t");
  s = s.replace(/\bIsp\b/g, "I_{sp}");

  // Exponential functions e^(at) -> e^{at}
  s = s.replace(/e\^\(([^)]+)\)/g, (_, expr) => `e^{${expr}}`);

  // Handle trailing scientific units like " J", " m/s", " eV"
  s = s.replace(/\s+([A-Za-z]+)$/, (_, unit) => ` \\text{ ${unit}}`);

  return s;
}

/**
 * Intelligent parser that splits text into plain text chunks and KaTeX math chunks.
 * Handles both standard LaTeX delimiters ($...$, $$...$$) and plain Unicode formulas.
 */
function parseTextToTokens(text: string): ParsedToken[] {
  if (!text) return [];

  // 1. Explicit LaTeX syntax: $inline$ or $$display$$
  if (text.includes("$")) {
    const tokens: ParsedToken[] = [];
    const regex = /\$\$([\s\S]+?)\$\$|\$([^\$]+?)\$/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        tokens.push({ type: "text", content: text.slice(lastIndex, match.index) });
      }
      const mathContent = match[1] || match[2];
      const isDisplay = Boolean(match[1]);
      tokens.push({ type: "math", content: mathContent.trim(), isDisplay });
      lastIndex = regex.lastIndex;
    }

    if (lastIndex < text.length) {
      tokens.push({ type: "text", content: text.slice(lastIndex) });
    }

    return tokens;
  }

  const trimmed = text.trim();

  // 2. Pure Formula string (e.g. MCQ options like "Pcr = π²EI/L²" or "1/(s − a)")
  const isPureFormula =
    // Pattern like "Var = Formula"
    /^[A-Za-z][A-Za-z0-9_]*\s*=\s*.+/.test(trimmed) ||
    // Fraction expressions like "1/(s + a)" or "pr/2t"
    /^[a-zA-Z0-9_\^\\{}\s]+\/[a-zA-Z0-9_\^\\{}()+\-\s]+$/.test(trimmed) ||
    // Short mathematical terms without English prose words
    (!trimmed.split(/\s+/).some((w) => /^[a-zA-Z]{4,}$/.test(w)) &&
      /[²³⁴⁰¹⁵⁶⁷⁸⁹⁺⁻ⁿ₀₁₂₃₄₅₆₇₈₉πδρṁ√∮∫∞±×÷^]/.test(trimmed));

  if (isPureFormula) {
    return [{ type: "math", content: unicodeToLatex(trimmed), isDisplay: false }];
  }

  // 3. Mixed prose with embedded formulas (e.g. "Proportional to √(W/S)")
  const embeddedMathRegex =
    /(?:[A-Za-z]\([a-z]\)\s*=\s*[^\s,;]+|√\([^)]+\)|√[0-9a-zA-Zπδρ]+|∮_[a-zA-Z0-9]\s*\([^)]+\)\s*dz|V∞|V_{\\infty}|δt|[a-zA-Z0-9_\^]+\/[a-zA-Z0-9_\^()+\-]+|[0-9]*[πδρ][a-zA-Z0-9²³⁴]*|[a-zA-Z0-9]+[²³⁴⁰¹⁵⁶⁷⁸⁹]+)/g;

  if (embeddedMathRegex.test(text)) {
    embeddedMathRegex.lastIndex = 0;
    const tokens: ParsedToken[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = embeddedMathRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        tokens.push({ type: "text", content: text.slice(lastIndex, match.index) });
      }
      tokens.push({ type: "math", content: unicodeToLatex(match[0]), isDisplay: false });
      lastIndex = embeddedMathRegex.lastIndex;
    }

    if (lastIndex < text.length) {
      tokens.push({ type: "text", content: text.slice(lastIndex) });
    }

    return tokens;
  }

  // 4. Default: plain text
  return [{ type: "text", content: text }];
}

function RenderMathChunk({ content, isDisplay }: { content: string; isDisplay?: boolean }) {
  const html = useMemo(() => {
    try {
      return katex.renderToString(content, {
        displayMode: Boolean(isDisplay),
        throwOnError: true,
        output: "htmlAndMathml",
      });
    } catch {
      // Return null so we can render clean academic text fallback without red error boxes
      return null;
    }
  }, [content, isDisplay]);

  if (!html) {
    return (
      <span className="font-serif italic font-semibold text-slate-900 tracking-wide">
        {content}
      </span>
    );
  }

  return (
    <span
      className={isDisplay ? "block my-2 text-center overflow-x-auto py-1" : "inline-block mx-0.5 align-baseline"}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

export const MathText = memo(function MathText({
  text,
  className = "",
  as = "span",
  displayMode = false,
}: MathTextProps) {
  const tokens = useMemo(() => parseTextToTokens(text || ""), [text]);

  if (!text) return null;

  const Component = as;

  return (
    <Component className={className}>
      {tokens.map((token, index) => {
        if (token.type === "math") {
          return (
            <RenderMathChunk
              key={index}
              content={token.content}
              isDisplay={token.isDisplay || displayMode}
            />
          );
        }
        return <span key={index}>{token.content}</span>;
      })}
    </Component>
  );
});

export default MathText;
