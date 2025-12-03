import katex from "katex";

/**
 * Safely render inline math using KaTeX.
 * Falls back to returning the original text escaped if KaTeX throws.
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function applyInlineFormatting(html: string): string {
  // Bold: **text**
  let out = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  // Headers: ### -> h2, ## -> h3, # -> h1
  out = out.replace(/^###\s*(.+)$/gm, "<h2>$1</h2>");
  out = out.replace(/^##\s*(.+)$/gm, "<h3>$1</h3>");
  out = out.replace(/^#\s*(.+)$/gm, "<h1>$1</h1>");
  return out;
}

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

    return applyInlineFormatting(escapeHtml(text));
  }

  // Very small parser for $...$ inline math segments.
  // Example: "Score is $x^2$ points" -> plain + rendered math + plain.
  let result = "";
  let i = 0;
  while (i < text.length) {
    const start = text.indexOf("$", i);
    if (start === -1) {
      // No more math delimiters; append the rest as escaped + formatted text.
      const tail = applyInlineFormatting(escapeHtml(text.slice(i)));
      result += tail;
      break;
    }

    // Append plain text before the math segment, with formatting.
    const before = applyInlineFormatting(escapeHtml(text.slice(i, start)));
    result += before;

    const end = text.indexOf("$", start + 1);
    if (end === -1) {
      // Unmatched $, treat the rest as plain text with formatting.
      const tail = applyInlineFormatting(escapeHtml(text.slice(start)));
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
      const fallback = escapeHtml(text.slice(start, end + 1));
      result += fallback;
    }

    i = end + 1;
  }

  return result;
}
