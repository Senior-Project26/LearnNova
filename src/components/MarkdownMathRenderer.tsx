import React, { useEffect, useMemo, useState } from "react";

// Minimal Markdown + KaTeX renderer without extra npm deps
// - Supports headings (#, ##, ###, ####), bold ** **, italic * *
// - Supports unordered (-, *) and ordered lists (1. 2. ...), horizontal rule (---)
// - Preserves <sup>/<sub> and fixes common truncations
// - Renders LaTeX inside $...$ (inline) and $$...$$ (block) via KaTeX CDN (like MathRenderer)

type Props = { text: string };

declare global {
  interface Window {
    katex?: { renderToString: (tex: string, opts?: any) => string };
  }
}

function ensureKatexLoaded(): Promise<void> {
  return new Promise((resolve) => {
    const done = () => resolve();
    const loadMhchem = () => {
      const existingMh = document.querySelector<HTMLScriptElement>("script[data-katex-mhchem]");
      if (existingMh) { existingMh.addEventListener("load", done); setTimeout(done, 50); return; }
      const mh = document.createElement("script");
      mh.src = "https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/contrib/mhchem.min.js";
      mh.async = true;
      mh.setAttribute("data-katex-mhchem", "true");
      mh.onload = done;
      mh.onerror = done;
      document.body.appendChild(mh);
    };

    if (window.katex?.renderToString) { loadMhchem(); return; }
    const existing = document.querySelector<HTMLScriptElement>("script[data-katex]");
    if (existing) { existing.addEventListener("load", loadMhchem); setTimeout(loadMhchem, 50); return; }

    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css";
    document.head.appendChild(link);

    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js";
    script.async = true;
    script.setAttribute("data-katex", "true");
    script.onload = loadMhchem;
    script.onerror = loadMhchem;
    document.body.appendChild(script);
  });
}

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function replaceAllStr(haystack: string, find: string, replacement: string) {
  return haystack.split(find).join(replacement);
}

function sanitizeKeepSupSub(html: string) {
  // Escape then unescape a small allowed set
  let out = esc(html);
  const allow = [
    // basic structure
    "p","br","hr","strong","em","ul","ol","li","h1","h2","h3","h4","blockquote",
    // math output spans/divs from KaTeX
    "span","div","table","thead","tbody","tr","td","th","pre","code","small","sup","sub","a"
  ];
  // allow tags with no attributes (kept simple)
  allow.forEach(tag => {
    out = replaceAllStr(out, `&lt;${tag}&gt;`, `<${tag}>`);
    out = replaceAllStr(out, `&lt;/${tag}&gt;`, `</${tag}>`);
  });
  // basic line breaks
  out = replaceAllStr(out, "&lt;br/&gt;", "<br/>");
  out = replaceAllStr(out, "&lt;br&gt;", "<br>");
  // self-closing hr
  out = replaceAllStr(out, "&lt;hr/&gt;", "<hr/>");
  // Fix common truncated sup/sub
  out = out.replace(/&lt;\/(sup|sub)\b([^>]*)$/gim, "</$1>");
  out = out.replace(/&lt;sup&gt;([^<]*)&lt;\/sup(?!&gt;)/gim, "<sup>$1</sup>");
  out = out.replace(/&lt;sub&gt;([^<]*)&lt;\/sub(?!&gt;)/gim, "<sub>$1</sub>");
  // Remove any stray closing hr that slipped through
  out = out.replace(/&lt;\/hr&gt;/gim, "");
  // Turn basic links [text](url) that slipped through
  out = out.replace(/\[([^\]]+)\]\((https?:[^\)]+)\)/g, (_m, t, u) => `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(t)}</a>`);
  return out;
}

function mdToHtml(md: string): string {
  const lines = (md || "").replace(/\r\n?/g, "\n").split("\n");
  const out: string[] = [];
  let inUL = false;
  let inOL = false;

  const flushLists = () => {
    if (inUL) { out.push("</ul>"); inUL = false; }
    if (inOL) { out.push("</ol>"); inOL = false; }
  };

  for (let raw of lines) {
    // Clean up bad closing tags sometimes produced by LLMs
    if (raw.includes("</hr>")) raw = raw.split("</hr>").join("");
    const line = raw.trimEnd();
    if (/^\s*$/.test(line)) { flushLists(); continue; }

    // Horizontal rule
    if (/^\s*-{3,}\s*$/.test(line)) { flushLists(); out.push("<hr/>"); continue; }

    // Headings
    if (/^####\s+/.test(line)) { flushLists(); out.push(`<h4>${inlineMd(line.replace(/^####\s+/, ""))}</h4>`); continue; }
    if (/^###\s+/.test(line)) { flushLists(); out.push(`<h3>${inlineMd(line.replace(/^###\s+/, ""))}</h3>`); continue; }
    if (/^##\s+/.test(line))  { flushLists(); out.push(`<h2>${inlineMd(line.replace(/^##\s+/, ""))}</h2>`); continue; }
    if (/^#\s+/.test(line))   { flushLists(); out.push(`<h1>${inlineMd(line.replace(/^#\s+/, ""))}</h1>`);  continue; }

    // Ordered list: 1. 2. ...
    if (/^\d+\.\s+/.test(line)) {
      if (!inOL) { flushLists(); out.push("<ol>"); inOL = true; }
      const content = line.replace(/^\d+\.\s+/, "");
      out.push(`<li>${inlineMd(content)}</li>`);
      continue;
    }

    // Unordered list: - or *
    if (/^(?:-|\*)\s+/.test(line)) {
      if (!inUL) { flushLists(); out.push("<ul>"); inUL = true; }
      const content = line.replace(/^(?:-|\*)\s+/, "");
      out.push(`<li>${inlineMd(content)}</li>`);
      continue;
    }

    // Paragraph
    flushLists();
    out.push(`<p>${inlineMd(line)}</p>`);
  }
  flushLists();
  return out.join("\n");
}

function inlineMd(s: string): string {
  // Bold **text** and italic *text*
  let t = esc(s);
  // Bold (asterisks or underscores)
  t = t.replace(/\*\*([^\n]+?)\*\*/g, "<strong>$1</strong>");
  t = t.replace(/__([^\n]+?)__/g, "<strong>$1</strong>");
  // Italic (avoid interfering with already converted strong)
  t = t.replace(/(^|[^*])\*([^\n*]+)\*(?!\*)/g, "$1<em>$2</em>");
  t = t.replace(/(^|[^_])_([^\n_]+)_(?!_)/g, "$1<em>$2</em>");
  // Sup/sub preserved if already present after sanitize step later
  // Simple inline code `code`
  t = t.replace(/`([^`]+)`/g, "<code>$1</code>");
  return t;
}

export default function MarkdownMathRenderer({ text }: Props) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let mounted = true;
    ensureKatexLoaded().then(() => { if (mounted) setReady(true); });
    return () => { mounted = false; };
  }, []);

  const html = useMemo(() => {
    const src = text || "";
    if (!src) return "";
    // Normalize a few common artifacts before parsing markdown
    const normalized = src
      .replace(/\r\n?/g, "\n")
      .split("\n")
      .map((ln) => {
        const t = ln.trim();
        if (t === "<hr/>" || t === "<hr>") return "---"; // normalize literal hr tags to markdown rule
        return ln;
      })
      .join("\n");

    // First, convert markdown to basic HTML (escaped), then allow a small set
    let html1 = mdToHtml(normalized);
    let html2 = sanitizeKeepSupSub(html1);

    // Render math: $$...$$ blocks and $...$ inline, and also \[...\] (block) and \(...\) (inline)
    const renderBlock = /\$\$([\s\S]*?)\$\$/g;
    const renderInline = /\$([^\n$][^$]*?)\$/g;
    const renderBlockBracket = /\\\[([\s\S]*?)\\\]/g; // \\[ ... \\]
    const renderInlineParen = /\\\(([\s\S]*?)\\\)/g;  // \\( ... \\)

    const sanitizeLatexExpr = (expr: string) => {
      // Escape common special characters that are invalid unescaped in LaTeX text
      // e.g. "#", "%", "&" frequently appear in natural language
      // Avoid double-escaping by only escaping when not already escaped
      return expr
        .replace(/(?<!\\)#/g, "\\#")
        .replace(/(?<!\\)%/g, "\\%")
        .replace(/(?<!\\)&/g, "\\&");
    };

    if (ready && window.katex?.renderToString) {
      html2 = html2.replace(renderBlock, (_m, expr) => {
        try {
          const cleaned = sanitizeLatexExpr(String(expr).trim());
          return window.katex!.renderToString(cleaned, { displayMode: true, throwOnError: false, strict: "ignore" });
        }
        catch { return esc(_m); }
      });
      html2 = html2.replace(renderBlockBracket, (_m, expr) => {
        try {
          const cleaned = sanitizeLatexExpr(String(expr).trim());
          return window.katex!.renderToString(cleaned, { displayMode: true, throwOnError: false, strict: "ignore" });
        }
        catch { return esc(_m); }
      });
      html2 = html2.replace(renderInline, (_m, expr) => {
        try {
          const cleaned = sanitizeLatexExpr(String(expr).trim());
          return window.katex!.renderToString(cleaned, { displayMode: false, throwOnError: false, strict: "ignore" });
        }
        catch { return esc(_m); }
      });
      html2 = html2.replace(renderInlineParen, (_m, expr) => {
        try {
          const cleaned = sanitizeLatexExpr(String(expr).trim());
          return window.katex!.renderToString(cleaned, { displayMode: false, throwOnError: false, strict: "ignore" });
        }
        catch { return esc(_m); }
      });
    }

    return html2;
  }, [text, ready]);

  return (
    <div className="prose max-w-none" style={{ whiteSpace: "pre-wrap" }} dangerouslySetInnerHTML={{ __html: html }} />
  );
}
