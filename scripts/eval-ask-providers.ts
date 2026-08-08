/**
 * Ask provider eval (#395) — canned / Phase 0 deterministic / Gemini.
 *
 * Run: `npm run eval:ask`
 *
 * Requires `GOOGLE_GENERATIVE_AI_API_KEY` in `.env.local` for the Gemini column.
 * Avoids importing `server-only` modules — calls the AI SDK with the shared
 * Ask prompt instead of `answerJumpQuestion`.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { config as loadEnv } from "dotenv";
import { google } from "@ai-sdk/google";
import { generateText } from "ai";
import { matchCannedAskIntent } from "../src/features/search/ask-canned";
import { matchDeterministicAsk } from "../src/features/search/ask-deterministic";
import {
  ASK_SYSTEM_PROMPT,
  buildAskUserPrompt,
} from "../src/features/search/ask-prompt";
import { askAnswerToText } from "../src/features/search/ask-types";
import {
  buildSeasonDigestFromPlan,
  detectAskPlan,
} from "../src/features/search/search-digest";
import { buildEvalSeason } from "../fixtures/ask/eval-season";
import { GEMINI_MODEL } from "../src/lib/ai/gemini-model";

loadEnv({ path: resolve(process.cwd(), ".env.local") });
loadEnv();

type ExpectRoute = "canned" | "deterministic" | "generative";

type GoldRow = {
  id: string;
  question: string;
  expectRoute: ExpectRoute;
  mustInclude?: string[];
};

type LocalRoute = "canned" | "deterministic" | "none";

function loadGold(): GoldRow[] {
  const path = resolve(process.cwd(), "fixtures/ask/gold-questions.json");
  return JSON.parse(readFileSync(path, "utf8")) as GoldRow[];
}

function resolveLocalRoute(
  question: string,
  season: ReturnType<typeof buildEvalSeason>,
): { route: LocalRoute; text: string } {
  const canned = matchCannedAskIntent(question, season);
  if (canned) {
    return { route: "canned", text: askAnswerToText(canned) };
  }
  const deterministic = matchDeterministicAsk(question, season);
  if (deterministic) {
    return { route: "deterministic", text: askAnswerToText(deterministic) };
  }
  return { route: "none", text: "" };
}

function routeMatch(expect: ExpectRoute, local: LocalRoute): boolean {
  if (expect === "generative") return local === "none";
  return expect === local;
}

function includesAll(text: string, needles?: string[]): boolean {
  if (!needles?.length) return true;
  const hay = text.toLowerCase();
  return needles.every((n) => hay.includes(n.toLowerCase()));
}

function clip(text: string, max = 90): string {
  const one = text.replace(/\s+/g, " ").trim();
  if (one.length <= max) return one;
  return `${one.slice(0, max - 1)}…`;
}

function isGeminiConfigured(): boolean {
  return Boolean(process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim());
}

const GEMINI_TIMEOUT_MS = 30_000;

async function askGeminiEval(
  question: string,
  snapshot: string | null,
): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  try {
    const result = await generateText({
      model: google(GEMINI_MODEL),
      system: ASK_SYSTEM_PROMPT,
      prompt: buildAskUserPrompt(question, snapshot),
      maxOutputTokens: 400,
      maxRetries: 1,
      abortSignal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
    });
    const text = result.text.trim();
    if (!text) return { ok: false, error: "empty response" };
    return { ok: true, text };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function main() {
  const gold = loadGold();
  if (!gold.length) {
    throw new Error("fixtures/ask/gold-questions.json is empty");
  }
  const season = buildEvalSeason();
  const geminiOn = isGeminiConfigured();

  console.log(`# Ask eval (#395)\n`);
  console.log(`Gold questions: ${gold.length}`);
  console.log(`Gemini: ${geminiOn ? "configured" : "skipped (no API key)"}\n`);

  let localOk = 0;
  let mustOk = 0;
  let mustTotal = 0;
  let geminiOk = 0;
  let geminiTotal = 0;

  console.log(
    "| id | expect | local | match | mustInclude | gemini ms | gemini snippet |",
  );
  console.log("| --- | --- | --- | --- | --- | --- | --- |");

  for (const row of gold) {
    const local = resolveLocalRoute(row.question, season);
    const matched = routeMatch(row.expectRoute, local.route);
    if (matched) localOk += 1;

    let must = "—";
    if (row.mustInclude?.length && local.route !== "none") {
      mustTotal += 1;
      const pass = includesAll(local.text, row.mustInclude);
      if (pass) mustOk += 1;
      must = pass ? "ok" : `fail(${row.mustInclude.join(", ")})`;
    } else if (row.mustInclude?.length && row.expectRoute === "generative") {
      must = "n/a-local";
    }

    let geminiMs = "—";
    let geminiSnippet = "—";

    if (geminiOn && row.expectRoute === "generative") {
      geminiTotal += 1;
      const plan = detectAskPlan(row.question, season);
      const snapshot = buildSeasonDigestFromPlan(season, plan);
      const started = Date.now();
      const result = await askGeminiEval(row.question, snapshot);
      geminiMs = String(Date.now() - started);
      if (result.ok) {
        geminiOk += 1;
        geminiSnippet = clip(result.text);
        if (row.mustInclude?.length) {
          mustTotal += 1;
          const pass = includesAll(result.text, row.mustInclude);
          if (pass) mustOk += 1;
          must = pass ? "ok" : `fail(${row.mustInclude.join(", ")})`;
        }
      } else {
        geminiSnippet = clip(result.error);
      }
    } else if (geminiOn && local.route !== "none") {
      geminiSnippet = "(skipped — local route)";
    }

    console.log(
      `| ${row.id} | ${row.expectRoute} | ${local.route} | ${matched ? "✓" : "✗"} | ${must} | ${geminiMs} | ${geminiSnippet.replace(/\|/g, "/")} |`,
    );
  }

  console.log("");
  console.log("## Summary");
  console.log(
    `- Local route accuracy: ${localOk}/${gold.length} (${((localOk / gold.length) * 100).toFixed(0)}%)`,
  );
  if (mustTotal) {
    console.log(
      `- mustInclude checks: ${mustOk}/${mustTotal} (${((mustOk / mustTotal) * 100).toFixed(0)}%)`,
    );
  }
  if (geminiOn) {
    console.log(`- Gemini generative success: ${geminiOk}/${geminiTotal}`);
  } else {
    console.log(
      "- Gemini generative success: skipped (set GOOGLE_GENERATIVE_AI_API_KEY)",
    );
  }

  console.log(`
## Notes

- Phase 0 (Local) owns rankings, roster/fallen lists, standings, counts, wipes.
- Generative rows are Gemini-only for rules / meta / open-ended chat.
`);

  if (localOk < gold.length || mustOk < mustTotal) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
