"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  askAnswerToText,
  type AskAnswer,
  type AskAnswerWire,
} from "@/features/search/ask-types";

/**
 * Client half of Ask (#184 / #300).
 *
 * Canned answers never hit the network. Remote asks post a season snapshot to
 * `/api/ai/jump` and accept structured cards when the server returns them.
 */

export type AssistState =
  | { status: "idle" }
  | { status: "loading"; question: string }
  | {
      status: "answered";
      question: string;
      answer: AskAnswer;
      /** Flat text for Jump-to salvage matching. */
      text: string;
    }
  | { status: "error"; question: string; error: string; signIn?: boolean };

type AssistResponse = {
  ok?: boolean;
  text?: string;
  answer?: AskAnswer;
  error?: string;
  code?: string;
};

/**
 * Session-lifetime kill switch for *remote* Ask. Canned orientation still
 * works when Gemini is unset or the visitor is signed out.
 */
let assistUnavailable = false;

const sessionAnswerCache = new Map<string, AskAnswerWire>();
const SESSION_CACHE_MAX = 24;

export function isAssistUnavailable(): boolean {
  return assistUnavailable;
}

const GENERIC_ERROR = "Ask couldn’t reach the assistant. Try again.";

function snapshotDigest(snapshot: string | null): string {
  if (!snapshot) return "";
  let hash = 2166136261;
  for (let i = 0; i < snapshot.length; i++) {
    hash ^= snapshot.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `${snapshot.length.toString(36)}:${(hash >>> 0).toString(36)}`;
}

function cacheKey(
  question: string,
  snapshot: string | null,
  preferRanking: boolean,
): string {
  return `${question.toLowerCase().replace(/\s+/g, " ")}\n${snapshotDigest(snapshot)}\n${preferRanking ? "rank" : "prose"}`;
}

function normalizeWire(
  text: string | undefined,
  answer: AskAnswer | undefined,
): AskAnswerWire | null {
  if (answer && typeof answer === "object" && "kind" in answer) {
    return {
      text: text?.trim() || askAnswerToText(answer),
      answer,
    };
  }
  if (text?.trim()) {
    return {
      text: text.trim(),
      answer: { kind: "prose", markdown: text.trim() },
    };
  }
  return null;
}

export function useJumpAssist() {
  const [state, setState] = useState<AssistState>({ status: "idle" });
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setState({ status: "idle" });
  }, []);

  const answerLocal = useCallback((question: string, answer: AskAnswer) => {
    abortRef.current?.abort();
    abortRef.current = null;
    const trimmed = question.trim();
    setState({
      status: "answered",
      question: trimmed,
      answer,
      text: askAnswerToText(answer),
    });
  }, []);

  const fail = useCallback(
    (question: string, error: string, signIn?: boolean) => {
      abortRef.current?.abort();
      abortRef.current = null;
      setState({
        status: "error",
        question: question.trim(),
        error,
        signIn,
      });
    },
    [],
  );

  const askRemote = useCallback(
    async (
      question: string,
      snapshot: string | null,
      opts?: { preferRanking?: boolean },
    ) => {
      const trimmed = question.trim();
      if (!trimmed) return;

      const preferRanking = Boolean(opts?.preferRanking);
      const key = cacheKey(trimmed, snapshot, preferRanking);
      const cached = sessionAnswerCache.get(key);
      if (cached) {
        setState({
          status: "answered",
          question: trimmed,
          answer: cached.answer,
          text: cached.text,
        });
        return;
      }

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setState({ status: "loading", question: trimmed });

      try {
        const res = await fetch("/api/ai/jump", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question: trimmed,
            snapshot,
            preferRanking: preferRanking || undefined,
          }),
          signal: controller.signal,
        });

        let payload: AssistResponse = {};
        try {
          payload = (await res.json()) as AssistResponse;
        } catch {
          // Non-JSON error page — fall through.
        }

        if (controller.signal.aborted) return;

        if (res.status === 401) {
          assistUnavailable = true;
          setState({
            status: "error",
            question: trimmed,
            error: "Sign in with Discord to use Ask.",
            signIn: true,
          });
          return;
        }

        if (res.status === 501) {
          assistUnavailable = true;
          setState({
            status: "error",
            question: trimmed,
            error: "Ask isn’t enabled on this deployment.",
          });
          return;
        }

        const wire = normalizeWire(payload.text, payload.answer);
        if (!res.ok || !payload.ok || !wire) {
          setState({
            status: "error",
            question: trimmed,
            error: payload.error?.trim() || GENERIC_ERROR,
          });
          return;
        }

        if (sessionAnswerCache.size >= SESSION_CACHE_MAX) {
          const oldest = sessionAnswerCache.keys().next().value;
          if (oldest) sessionAnswerCache.delete(oldest);
        }
        sessionAnswerCache.set(key, wire);

        setState({
          status: "answered",
          question: trimmed,
          answer: wire.answer,
          text: wire.text,
        });
      } catch (error) {
        if (controller.signal.aborted) return;
        console.error("[useJumpAssist]", error);
        setState({ status: "error", question: trimmed, error: GENERIC_ERROR });
      }
    },
    [],
  );

  /** Legacy Jump-modal entrypoint — prose path, no ranking cards. */
  const ask = useCallback(
    (question: string, snapshot: string | null) =>
      askRemote(question, snapshot, { preferRanking: false }),
    [askRemote],
  );

  return { state, reset, answerLocal, askRemote, ask, fail };
}
