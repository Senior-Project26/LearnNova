import React from "react";
import { renderInlineMathSafe } from "@/lib/math";

export function MathText({ text }: { text: string }) {
  const html = renderInlineMathSafe(text ?? "");
  return (
    <span
      className="whitespace-pre-wrap break-words"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
