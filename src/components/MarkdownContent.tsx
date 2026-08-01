import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";

type MarkdownContentProps = {
  className?: string;
  content: string;
  toolsHref?: string;
};

export function MarkdownContent({
  className = "",
  content,
  toolsHref,
}: MarkdownContentProps) {
  const markdown = toolsHref
    ? content.replace(/\[Tools\](?!\()/g, `[Tools](${toolsHref})`)
    : content;

  return (
    <div className={`markdown-content${className ? ` ${className}` : ""}`}>
      <ReactMarkdown
        components={{
          a({ children, href }) {
            return href?.startsWith("/") ? (
              <Link href={href}>{children}</Link>
            ) : (
              <a href={href}>{children}</a>
            );
          },
        }}
        remarkPlugins={[remarkBreaks, remarkGfm]}
        skipHtml
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
