import type { ReactNode } from "react";

interface MarkdownTextProps {
  content: string;
}

type MarkdownBlock =
  | { type: "paragraph"; text: string }
  | { type: "heading"; level: 2 | 3 | 4; text: string }
  | { type: "quote"; text: string }
  | { type: "code"; language: string; text: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] };

export function MarkdownText({ content }: MarkdownTextProps): JSX.Element {
  const blocks = parseMarkdownBlocks(content.trim() ? content : "正在组织语言...");

  return (
    <div className="message-content markdown-text">
      {blocks.map((block, index) => renderBlock(block, `markdown-block-${index}`))}
    </div>
  );
}

function parseMarkdownBlocks(content: string): MarkdownBlock[] {
  const lines = content.replace(/\r\n?/g, "\n").split("\n");
  const blocks: MarkdownBlock[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index] ?? "";
    const trimmed = line.trim();

    if (!trimmed) {
      index += 1;
      continue;
    }

    const fenceMatch = trimmed.match(/^```([\w-]*)/);
    if (fenceMatch) {
      const language = fenceMatch[1] ?? "";
      const codeLines: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index]?.trim().startsWith("```")) {
        codeLines.push(lines[index] ?? "");
        index += 1;
      }
      if (index < lines.length) {
        index += 1;
      }
      blocks.push({ type: "code", language, text: codeLines.join("\n") });
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      const level = Math.min(headingMatch[1].length + 1, 4) as 2 | 3 | 4;
      blocks.push({ type: "heading", level, text: headingMatch[2] });
      index += 1;
      continue;
    }

    if (trimmed.startsWith(">")) {
      const quoteLines: string[] = [];
      while (index < lines.length && lines[index]?.trim().startsWith(">")) {
        quoteLines.push((lines[index] ?? "").trim().replace(/^>\s?/, ""));
        index += 1;
      }
      blocks.push({ type: "quote", text: quoteLines.join("\n") });
      continue;
    }

    const unorderedMatch = trimmed.match(/^[-*+]\s+(.+)$/);
    if (unorderedMatch) {
      const items: string[] = [];
      while (index < lines.length) {
        const itemMatch = lines[index]?.trim().match(/^[-*+]\s+(.+)$/);
        if (!itemMatch) {
          break;
        }
        items.push(itemMatch[1]);
        index += 1;
      }
      blocks.push({ type: "ul", items });
      continue;
    }

    const orderedMatch = trimmed.match(/^\d+[.)]\s+(.+)$/);
    if (orderedMatch) {
      const items: string[] = [];
      while (index < lines.length) {
        const itemMatch = lines[index]?.trim().match(/^\d+[.)]\s+(.+)$/);
        if (!itemMatch) {
          break;
        }
        items.push(itemMatch[1]);
        index += 1;
      }
      blocks.push({ type: "ol", items });
      continue;
    }

    const paragraphLines: string[] = [];
    while (index < lines.length && !isBlockBoundary(lines[index] ?? "")) {
      paragraphLines.push(lines[index] ?? "");
      index += 1;
    }
    blocks.push({ type: "paragraph", text: paragraphLines.join("\n").trim() });
  }

  return blocks.length > 0 ? blocks : [{ type: "paragraph", text: content }];
}

function isBlockBoundary(line: string): boolean {
  const trimmed = line.trim();
  return (
    !trimmed ||
    trimmed.startsWith("```") ||
    /^#{1,3}\s+/.test(trimmed) ||
    trimmed.startsWith(">") ||
    /^[-*+]\s+/.test(trimmed) ||
    /^\d+[.)]\s+/.test(trimmed)
  );
}

function renderBlock(block: MarkdownBlock, key: string): ReactNode {
  if (block.type === "heading") {
    const HeadingTag = `h${block.level}` as const;
    return <HeadingTag key={key}>{renderInline(block.text, key)}</HeadingTag>;
  }

  if (block.type === "quote") {
    return <blockquote key={key}>{renderInlineWithBreaks(block.text, key)}</blockquote>;
  }

  if (block.type === "code") {
    return (
      <pre key={key}>
        <code>{block.text}</code>
      </pre>
    );
  }

  if (block.type === "ul") {
    return (
      <ul key={key}>
        {block.items.map((item, index) => (
          <li key={`${key}-item-${index}`}>{renderInlineWithBreaks(item, `${key}-item-${index}`)}</li>
        ))}
      </ul>
    );
  }

  if (block.type === "ol") {
    return (
      <ol key={key}>
        {block.items.map((item, index) => (
          <li key={`${key}-item-${index}`}>{renderInlineWithBreaks(item, `${key}-item-${index}`)}</li>
        ))}
      </ol>
    );
  }

  return <p key={key}>{renderInlineWithBreaks(block.text, key)}</p>;
}

function renderInlineWithBreaks(text: string, keyPrefix: string): ReactNode[] {
  return text.split("\n").flatMap((line, index) => {
    const nodes = renderInline(line, `${keyPrefix}-line-${index}`);
    return index === 0 ? nodes : [<br key={`${keyPrefix}-br-${index}`} />, ...nodes];
  });
}

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let plain = "";
  let index = 0;

  const flushPlain = () => {
    if (plain) {
      nodes.push(plain);
      plain = "";
    }
  };

  while (index < text.length) {
    if (text[index] === "`") {
      const end = text.indexOf("`", index + 1);
      if (end > index + 1) {
        flushPlain();
        nodes.push(<code key={`${keyPrefix}-code-${index}`}>{text.slice(index + 1, end)}</code>);
        index = end + 1;
        continue;
      }
    }

    if (text[index] === "[" && text.includes("](", index)) {
      const labelEnd = text.indexOf("](", index);
      const urlEnd = labelEnd >= 0 ? text.indexOf(")", labelEnd + 2) : -1;
      if (labelEnd > index && urlEnd > labelEnd) {
        const label = text.slice(index + 1, labelEnd);
        const href = text.slice(labelEnd + 2, urlEnd);
        if (/^https?:\/\//.test(href)) {
          flushPlain();
          nodes.push(
            <a key={`${keyPrefix}-link-${index}`} href={href} target="_blank" rel="noreferrer">
              {renderInline(label, `${keyPrefix}-link-label-${index}`)}
            </a>,
          );
          index = urlEnd + 1;
          continue;
        }
      }
    }

    if (text.startsWith("**", index)) {
      const end = text.indexOf("**", index + 2);
      if (end > index + 2) {
        flushPlain();
        nodes.push(<strong key={`${keyPrefix}-bold-${index}`}>{renderInline(text.slice(index + 2, end), `${keyPrefix}-bold-inner-${index}`)}</strong>);
        index = end + 2;
        continue;
      }
    }

    if (text.startsWith("__", index)) {
      const end = text.indexOf("__", index + 2);
      if (end > index + 2) {
        flushPlain();
        nodes.push(<strong key={`${keyPrefix}-strong-${index}`}>{renderInline(text.slice(index + 2, end), `${keyPrefix}-strong-inner-${index}`)}</strong>);
        index = end + 2;
        continue;
      }
    }

    if (text[index] === "*" && text[index + 1] && text[index + 1] !== " " && text[index + 1] !== "*") {
      const end = text.indexOf("*", index + 1);
      if (end > index + 1) {
        flushPlain();
        nodes.push(<em key={`${keyPrefix}-em-${index}`}>{renderInline(text.slice(index + 1, end), `${keyPrefix}-em-inner-${index}`)}</em>);
        index = end + 1;
        continue;
      }
    }

    plain += text[index];
    index += 1;
  }

  flushPlain();
  return nodes;
}
