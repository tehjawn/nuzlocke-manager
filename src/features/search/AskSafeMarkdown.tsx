"use client";

import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";

/**
 * Strict markdown subset for Ask answers (#300).
 * No raw HTML, no remote images, no model-supplied navigation.
 * remark-gfm omitted — tables/task-lists aren't useful in Ask cards.
 */

export function AskSafeMarkdown({
  content,
  className = "",
}: {
  content: string;
  className?: string;
}) {
  return (
    <div
      className={`ask-markdown text-sm leading-relaxed text-ink${className ? ` ${className}` : ""}`}
    >
      <ReactMarkdown
        remarkPlugins={[remarkBreaks]}
        skipHtml
        components={{
          a({ children }) {
            return <span className="font-medium">{children}</span>;
          },
          img() {
            return null;
          },
          h1: "p",
          h2: "p",
          h3: "p",
          h4: "p",
          h5: "p",
          h6: "p",
          pre({ children }) {
            return (
              <pre className="overflow-x-auto rounded-md border border-frame/60 bg-surface px-2 py-1.5 font-mono text-xs">
                {children}
              </pre>
            );
          },
          code({ children, className: codeClass }) {
            if (codeClass) return <code>{children}</code>;
            return (
              <code className="rounded bg-surface px-1 py-0.5 font-mono text-[0.85em]">
                {children}
              </code>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
