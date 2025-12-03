import katex from "katex";

/**
 * Safely render inline math using KaTeX.
 * Falls back to returning the original text escaped if KaTeX throws.
 */
export function renderInlineMathSafe(text: string): string {
  if (!text) return "";

  // If there are no inline math delimiters, either render obvious LaTeX as
  // a whole or just escape and return plain text.
  if (!text.includes("$") && !text.includes("\\(")) {
    // Heuristic: treat strings containing common LaTeX commands as math.
    const looksLikeLatex = /\\(begin\{|frac\b|sqrt\b|sum\b|int\b|pi\b|alpha\b|beta\b|gamma\b|delta\b)/.test(text);
    if (looksLikeLatex) {
      try {
        return katex.renderToString(text, {
          throwOnError: false,
          output: "html",
          displayMode: false,
        });
      } catch {
        // Fall through to escaped plain text if KaTeX fails.
      }
    }

    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  // Very small parser for $...$ inline math segments.
  // Example: "Score is $x^2$ points" -> plain + rendered math + plain.
  let result = "";
  let i = 0;
  while (i < text.length) {
    const start = text.indexOf("$", i);
    if (start === -1) {
      // No more math delimiters; append the rest as escaped text.
      const tail = text.slice(i)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
      result += tail;
      break;
    }

    // Append plain text before the math segment.
    const before = text.slice(i, start)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    result += before;

    const end = text.indexOf("$", start + 1);
    if (end === -1) {
      // Unmatched $, treat the rest as plain text.
      const tail = text.slice(start)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
      result += tail;
      break;
    }

    const mathSrc = text.slice(start + 1, end).trim();
    if (!mathSrc) {
      i = end + 1;
      continue;
    }

    try {
      const rendered = katex.renderToString(mathSrc, {
        throwOnError: false,
        output: "html",
        displayMode: false,
      });
      result += rendered;
    } catch {
      // On error, fall back to the original delimited text, escaped.
      const fallback = text.slice(start, end + 1)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
      result += fallback;
    }

    i = end + 1;
  }

  return result;
}
