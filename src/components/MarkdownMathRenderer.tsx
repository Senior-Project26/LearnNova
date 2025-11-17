import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import 'katex/dist/katex.min.css';

interface MarkdownMathRendererProps {
  text: string;
}

const MarkdownMathRenderer: React.FC<MarkdownMathRendererProps> = ({ text }) => {
  // Some backends return Unicode characters as literal byte runs like
  // "<0xE2><0x82><0x99>" (UTF-8 for subscript n). Decode any such runs.
  const decodeHexByteRuns = (input: string): string => {
    if (!input) return "";
    const pattern = /(?:<0x([0-9A-Fa-f]{2})>)+/g;
    return input.replace(pattern, (match) => {
      const byteMatches = [...match.matchAll(/<0x([0-9A-Fa-f]{2})>/g)];
      const bytes = new Uint8Array(byteMatches.map((m) => parseInt(m[1], 16)));
      try {
        return new TextDecoder('utf-8').decode(bytes);
      } catch {
        return match; // fallback to original if decoding fails
      }
    });
  };

  const autoWrapSqrtOutsideMath = (input: string): string => {
    if (!input) return "";
    const parts = input.split(/(\${1,2}[\s\S]*?\1)/g);
    return parts
      .map((seg, i) => {
        // Preserve existing math spans as-is (odd indices after split by capturing group)
        if (i % 2 === 1) return seg;
        let s = seg;
        // Normalize sqrt forms in plain text and wrap with $...$
        s = s.replace(/\/\s*sqrt\s*\(([^()\n\r]{1,80})\)/gi, (_m, inner) => `$\\sqrt{${inner}}$`);
        s = s.replace(/(?<!\\)\bsqrt\s*\(([^()\n\r]{1,80})\)/g, (_m, inner) => `$\\sqrt{${inner}}$`);
        s = s.replace(/\\sqrt\s*\(([^()\n\r]{1,80})\)/g, (_m, inner) => `$\\sqrt{${inner}}$`);
        return s;
      })
      .join("");
  };

  // Wrap common bare LaTeX commands (e.g., \Theta(n^2)) that appear outside math into $...$
  const autoWrapBareMathCommands = (input: string): string => {
    if (!input) return "";
    const parts = input.split(/(\${1,2}[\s\S]*?\1)/g);
    return parts
      .map((seg, i) => {
        if (i % 2 === 1) return seg; // keep math spans unchanged
        let s = seg;
        // Conservative patterns: \\Word(args) or \\Word{args}
        // Limit arg lengths and avoid newlines to reduce false positives
        s = s.replace(/(\\[A-Za-z]+\s*\([^()\n\r]{1,80}\))/g, (_m, expr) => `$${expr}$`);
        s = s.replace(/(\\[A-Za-z]+\s*\{[^{}\n\r]{1,80}\})/g, (_m, expr) => `$${expr}$`);
        return s;
      })
      .join("");
  };

  const decoded = decodeHexByteRuns(text || "");
  const preprocessed = autoWrapBareMathCommands(autoWrapSqrtOutsideMath(decoded));
  // Convert single newlines into Markdown hard line breaks to preserve line wraps
  // Keep paragraph breaks (double newlines) as-is
  const withLineBreaks = preprocessed.replace(/([^\n])\n(?!\n)/g, "$1  \n");
  const fixMathArrows = (s: string) => {
    return s.replace(/(\${1,2})([\s\S]*?)\1/g, (_m, d: string, body: string) => {
      let b = body;
      // If preceded by \left, the intent is likely a bidirectional arrow
      b = b.replace(/\\left\s*\\?ightarrow\b/g, "\\leftrightarrow");
      b = b.replace(/\\?ightarrow\b/g, "\\rightarrow");
      b = b.replace(/(^|[^\\])rightarrow\b/g, (_m2, pre: string) => pre + "\\rightarrow");
      // Normalize square roots: /sqrt(...), sqrt(...), \\sqrt(...) -> \\sqrt{...}
      b = b.replace(/\/\s*sqrt\s*\(/gi, "\\sqrt{");
      b = b.replace(/(?<!\\)\bsqrt\s*\(/g, "\\sqrt{");
      b = b.replace(/\\sqrt\s*\(/g, "\\sqrt{");
      b = b.replace(/(\\sqrt\{[^}\n\r]*?)\)/g, "$1}");
      // Normalize malformed fractions: \frac(expr)2 -> \frac{expr}{2}
      b = b.replace(/\\frac\s*\(([^()\n\r]+)\)\s*([^\s{}]+)/g, "\\frac{$1}{$2}");
      // Also handle simple space-separated tokens: \frac a b -> \frac{a}{b}
      b = b.replace(/\\frac\s+([^\s{}]+)\s+([^\s{}]+)/g, "\\frac{$1}{$2}");
      return d + b + d;
    });
  };
  const normalized = fixMathArrows(withLineBreaks);
  return (
    <ReactMarkdown
      remarkPlugins={[remarkMath]}
      rehypePlugins={[rehypeRaw, rehypeKatex]}
      className="prose prose-invert prose-sm max-w-none"
      components={{
        // Customize rendering for specific elements if needed
        p: ({ children }) => <p className="mb-2">{children}</p>,
        h1: ({ children }) => <h1 className="text-2xl font-bold mb-3 mt-4">{children}</h1>,
        h2: ({ children }) => <h2 className="text-xl font-bold mb-2 mt-3">{children}</h2>,
        h3: ({ children }) => <h3 className="text-lg font-semibold mb-2 mt-2">{children}</h3>,
        ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>,
        code: ({ className, children, ...props }) => {
          const isInline = !className;
          return isInline ? (
            <code className="bg-[#852E4E]/40 border border-pink-700/40 text-pink-100 px-1 py-0.5 rounded text-sm" {...props}>
              {children}
            </code>
          ) : (
            <code className={`${className} block bg-[#4C1D3D]/60 border border-pink-700/40 text-pink-100 p-2 rounded text-sm overflow-x-auto`} {...props}>
              {children}
            </code>
          );
        },
      }}
    >
      {normalized}
    </ReactMarkdown>
  );
};

export default MarkdownMathRenderer;
