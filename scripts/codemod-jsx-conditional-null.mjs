/**
 * Surgical codemod: JSX `{cond ? <Jsx/> : null}` → `{cond && <Jsx/>}`
 * (and related safe variants). Rewrites by source offsets to preserve formatting.
 *
 * Critical implementation details:
 * - Babel JSX does NOT wrap `( <Jsx/> )` as ParenthesizedExpression — the parens
 *   live in the gaps around consequent. We preserve them by slicing test→alternate.
 * - Nested ternaries overlap in source ranges; editing both in one pass breaks
 *   offsets. We only rewrite leaves each pass and iterate to a fixpoint.
 *
 * Safety:
 * - Skips ternaries with a real else branch
 * - Wraps `||` tests in parens so precedence does not change
 * - Rewrites risky `.length` / numeric-ish tests to `> 0` instead of bare `&&`
 * - Flips `{cond ? null : <Jsx/>}` → `{!cond && <Jsx/>}`
 *
 * Usage: node scripts/codemod-jsx-conditional-null.mjs [--dry]
 */
import fs from "node:fs";
import path from "node:path";
import parser from "@babel/parser";
import _traverse from "@babel/traverse";
import t from "@babel/types";

const traverse = _traverse.default;
const DRY = process.argv.includes("--dry");
const MAX_PASSES = 20;

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (["node_modules", ".next", ".git"].includes(ent.name)) continue;
      walk(p, out);
    } else if (/\.(tsx|jsx)$/.test(ent.name)) out.push(p);
  }
  return out;
}

function looksNumericRisky(node) {
  if (!node) return false;
  if (t.isNumericLiteral(node)) return true;
  if (t.isIdentifier(node)) {
    return /^(count|index|size|length|level|amount|total|qty|n|i|idx|num|number|offset|page|pages)$/i.test(
      node.name,
    );
  }
  if (
    t.isMemberExpression(node) &&
    !node.computed &&
    t.isIdentifier(node.property) &&
    node.property.name === "length"
  ) {
    return true;
  }
  if (t.isLogicalExpression(node)) {
    return looksNumericRisky(node.left) || looksNumericRisky(node.right);
  }
  if (t.isUnaryExpression(node) && node.operator === "+") return true;
  return false;
}

function isBooleanishTest(node) {
  if (t.isBooleanLiteral(node)) return true;
  if (t.isUnaryExpression(node) && node.operator === "!") return true;
  if (
    t.isBinaryExpression(node) &&
    ["===", "!==", "==", "!=", ">", ">=", "<", "<="].includes(node.operator)
  ) {
    return true;
  }
  if (
    t.isCallExpression(node) &&
    t.isIdentifier(node.callee) &&
    node.callee.name === "Boolean"
  ) {
    return true;
  }
  if (
    t.isLogicalExpression(node) &&
    (node.operator === "&&" || node.operator === "||")
  ) {
    return isBooleanishTest(node.left) || isBooleanishTest(node.right);
  }
  return false;
}

function isJsxish(node) {
  if (t.isJSXElement(node) || t.isJSXFragment(node)) return true;
  if (t.isParenthesizedExpression(node)) return isJsxish(node.expression);
  return false;
}

function isStringish(node) {
  return t.isStringLiteral(node) || t.isTemplateLiteral(node);
}

function isRenderableConsequent(node) {
  return isJsxish(node) || isStringish(node);
}

function slice(code, node) {
  return code.slice(node.start, node.end);
}

function needsParenForAndLeft(test) {
  if (t.isLogicalExpression(test) && test.operator === "||") return true;
  if (t.isConditionalExpression(test)) return true;
  if (t.isAssignmentExpression(test)) return true;
  if (t.isSequenceExpression(test)) return true;
  return false;
}

function wrapTest(code, test) {
  const src = slice(code, test);
  if (needsParenForAndLeft(test)) return `(${src})`;
  return src;
}

function lengthGtZero(code, test) {
  if (
    t.isMemberExpression(test) &&
    !test.computed &&
    t.isIdentifier(test.property) &&
    test.property.name === "length"
  ) {
    return `${slice(code, test)} > 0`;
  }
  return `Boolean(${slice(code, test)})`;
}

/**
 * Source between `test` and `alternate` looks like:
 *   ` ? <Jsx/> : `
 *   ` ? ( <Jsx/> ) : `
 *   `) ? ( <Jsx/> ) : `   ← grouping parens around an `||` test are OUTSIDE the
 *                           test node but inside the ConditionalExpression
 *
 * Returns the consequent slice (including its optional parens), discarding any
 * trailing `)` that closed a grouping paren around the test.
 */
function consequentSource(code, test, alternate) {
  const between = code.slice(test.end, alternate.start);
  const m = between.match(/^\s*\)?\s*\?([\s\S]*):\s*$/);
  if (!m) {
    throw new Error(
      `unable to split conditional around L${test.loc?.start.line}: ${JSON.stringify(between.slice(0, 80))}`,
    );
  }
  return m[1];
}

/** For `cond ? null : <Jsx/>`, keep optional parens through the end of the conditional. */
function invertedAlternateSource(code, node, consequent) {
  const afterNull = code.slice(consequent.end, node.end);
  const m = afterNull.match(/^\s*:([\s\S]*)$/);
  if (!m) {
    throw new Error(
      `unable to split inverted conditional around L${node.loc?.start.line}`,
    );
  }
  return m[1];
}

function containsNestedConditional(path) {
  let found = false;
  path.traverse({
    ConditionalExpression(inner) {
      if (inner === path) return;
      if (!inner.parentPath.isJSXExpressionContainer()) return;
      if (inner.parentPath.parentPath?.isJSXAttribute()) return;
      const { consequent, alternate } = inner.node;
      const convertible =
        (t.isNullLiteral(alternate) && isRenderableConsequent(consequent)) ||
        (t.isNullLiteral(consequent) && isJsxish(alternate));
      if (convertible) {
        found = true;
        inner.stop();
      }
    },
  });
  return found;
}

function transformOnce(code) {
  const ast = parser.parse(code, {
    sourceType: "module",
    plugins: ["typescript", "jsx"],
    ranges: true,
  });

  /** @type {{start: number, end: number, text: string, line: number, kind: string}[]} */
  const edits = [];
  /** @type {{line: number, reason: string}[]} */
  const skipped = [];

  traverse(ast, {
    ConditionalExpression(path) {
      if (!path.parentPath.isJSXExpressionContainer()) return;
      // Attribute values often type as `T | null`; `&&` widens to `false | T` and
      // causes assignability errors. Only rewrite JSX children.
      if (path.parentPath.parentPath?.isJSXAttribute()) return;

      const { test, consequent, alternate } = path.node;
      const line = path.node.loc?.start.line ?? 0;

      // Nested convertible ternaries: leave for a later pass (leaf-only).
      if (containsNestedConditional(path)) {
        skipped.push({ line, reason: "nested-deferred" });
        return;
      }

      // Inverted: cond ? null : jsx
      if (t.isNullLiteral(consequent) && isJsxish(alternate)) {
        let left;
        let kind = "inverted-null-jsx";
        if (t.isUnaryExpression(test) && test.operator === "!") {
          left = wrapTest(code, test.argument);
          kind = "inverted-null-jsx-simplify-not";
        } else if (
          t.isIdentifier(test) ||
          t.isMemberExpression(test) ||
          t.isBooleanLiteral(test)
        ) {
          left = `!${slice(code, test)}`;
        } else {
          left = `!(${slice(code, test)})`;
        }
        const right = invertedAlternateSource(code, path.node, consequent);
        edits.push({
          start: path.node.start,
          end: path.node.end,
          text: `${left} &&${right}`,
          line,
          kind,
        });
        return;
      }

      if (!t.isNullLiteral(alternate)) return;

      if (!isRenderableConsequent(consequent)) {
        skipped.push({ line, reason: "non-jsx-consequent" });
        return;
      }

      let left = wrapTest(code, test);
      let kind = isJsxish(consequent) ? "tern-null-jsx" : "tern-null-string";

      if (looksNumericRisky(test) && !isBooleanishTest(test)) {
        left = lengthGtZero(code, test);
        kind += "-numeric-guard";
      }

      const right = consequentSource(code, test, alternate);
      edits.push({
        start: path.node.start,
        end: path.node.end,
        text: `${left} &&${right}`,
        line,
        kind,
      });
    },
  });

  if (edits.length === 0) {
    return { code, edits, skipped, changed: false };
  }

  // Non-overlapping leaves only — safe to apply end→start
  edits.sort((a, b) => b.start - a.start);
  let next = code;
  for (const edit of edits) {
    next = next.slice(0, edit.start) + edit.text + next.slice(edit.end);
  }

  return { code: next, edits, skipped, changed: true };
}

function transformFile(code) {
  let current = code;
  /** @type {{line: number, kind: string}[]} */
  const allEdits = [];
  /** @type {{line: number, reason: string}[]} */
  const lastSkipped = [];

  for (let pass = 0; pass < MAX_PASSES; pass++) {
    const result = transformOnce(current);
    lastSkipped.length = 0;
    lastSkipped.push(...result.skipped);
    if (!result.changed) break;
    for (const e of result.edits) {
      allEdits.push({ line: e.line, kind: e.kind });
    }
    current = result.code;
    // Validate after each pass so we fail fast on a bad rewrite
    parser.parse(current, {
      sourceType: "module",
      plugins: ["typescript", "jsx"],
    });
  }

  return { code: current, edits: allEdits, skipped: lastSkipped };
}

/** @type {{file: string, line: number, kind: string}[]} */
const changes = [];
/** @type {{file: string, line: number, reason: string}[]} */
const skipped = [];
let filesTouched = 0;

for (const file of walk("src")) {
  const original = fs.readFileSync(file, "utf8");
  let result;
  try {
    result = transformFile(original);
  } catch (e) {
    console.error("FAIL", file, e.message);
    process.exitCode = 1;
    continue;
  }

  if (result.edits.length === 0) {
    for (const s of result.skipped) {
      skipped.push({ file, line: s.line, reason: s.reason });
    }
    continue;
  }

  filesTouched++;
  for (const e of result.edits) {
    changes.push({ file, line: e.line, kind: e.kind });
  }
  for (const s of result.skipped) {
    skipped.push({ file, line: s.line, reason: s.reason });
  }

  if (!DRY) fs.writeFileSync(file, result.code);
}

const byKind = {};
for (const c of changes) byKind[c.kind] = (byKind[c.kind] || 0) + 1;
const skipReasons = {};
for (const s of skipped)
  skipReasons[s.reason] = (skipReasons[s.reason] || 0) + 1;

console.log(DRY ? "DRY RUN" : "APPLIED");
console.log("changes:", changes.length);
console.log("by kind:", byKind);
console.log("skipped:", skipped.length, skipReasons);
console.log("files touched:", filesTouched);
