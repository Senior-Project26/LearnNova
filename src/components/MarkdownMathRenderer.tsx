import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

interface MarkdownMathRendererProps {
  text: string;
}

const MarkdownMathRenderer: React.FC<MarkdownMathRendererProps> = ({ text }) => {
  // Convert single newlines into Markdown hard line breaks to preserve line wraps
  // Keep paragraph breaks (double newlines) as-is
  const withLineBreaks = (text || "").replace(/([^\n])\n(?!\n)/g, "$1  \n");
  return (
    <ReactMarkdown
      remarkPlugins={[remarkMath]}
      rehypePlugins={[rehypeKatex]}
      className="prose prose-sm max-w-none"
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
            <code className="bg-gray-200 px-1 py-0.5 rounded text-sm" {...props}>
              {children}
            </code>
          ) : (
            <code className={`${className} block bg-gray-100 p-2 rounded text-sm overflow-x-auto`} {...props}>
              {children}
            </code>
          );
        },
      }}
    >
      {withLineBreaks}
    </ReactMarkdown>
  );
};

export default MarkdownMathRenderer;
