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

  const decoded = decodeHexByteRuns(text || "");
  // Convert single newlines into Markdown hard line breaks to preserve line wraps
  // Keep paragraph breaks (double newlines) as-is
  const withLineBreaks = decoded.replace(/([^\n])\n(?!\n)/g, "$1  \n");
  const fixMathArrows = (s: string) => {
    return s.replace(/(\${1,2})([\s\S]*?)\1/g, (_m, d: string, body: string) => {
      let b = body;
      // If preceded by \left, the intent is likely a bidirectional arrow
      b = b.replace(/\\left\s*\\?ightarrow\b/g, "\\leftrightarrow");
      b = b.replace(/\\?ightarrow\b/g, "\\rightarrow");
      b = b.replace(/(^|[^\\])rightarrow\b/g, (_m2, pre: string) => pre + "\\rightarrow");
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
