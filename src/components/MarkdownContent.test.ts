import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MarkdownContent } from "@/components/MarkdownContent";

test("renders GitHub-flavored Markdown and the legacy Tools link", () => {
  const content = [
    "## Strategy",
    "",
    "Use **held items** and ~~fainted Pokémon~~.",
    "",
    "- Review the [type chart](https://example.com/chart)",
    "- Open [Tools]",
  ].join("\n");
  const html = renderToStaticMarkup(
    createElement(MarkdownContent, {
      content,
      toolsHref: "/challenges/trash-pack/tools",
    }),
  );

  assert.match(html, /<h2>Strategy<\/h2>/);
  assert.match(html, /<strong>held items<\/strong>/);
  assert.match(html, /<del>fainted Pokémon<\/del>/);
  assert.match(html, /<ul>/);
  assert.match(html, /href="https:\/\/example\.com\/chart"/);
  assert.match(html, /href="\/challenges\/trash-pack\/tools"/);
});

test("does not render embedded HTML or unsafe link protocols", () => {
  const html = renderToStaticMarkup(
    createElement(MarkdownContent, {
      content: '<script>alert("nope")</script>\n\n[bad](javascript:alert(1))',
    }),
  );

  assert.doesNotMatch(html, /<script/);
  assert.doesNotMatch(html, /javascript:/);
  assert.match(html, />bad<\/a>/);
});

test("preserves line breaks from existing plain-text content", () => {
  const html = renderToStaticMarkup(
    createElement(MarkdownContent, {
      content: "First line\nSecond line",
    }),
  );

  assert.match(html, /First line<br\/>\nSecond line/);
});
