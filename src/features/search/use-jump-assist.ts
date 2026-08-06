"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Client half of Jump's Ask mode (#184).
 *
 * Never blocks fuzzy search: nothing here runs until the user explicitly picks
 * the Ask row. The palette stays usable while a request is in flight, and
 * closing the palette aborts it.
 */

export type AssistState =
  | { status: "idle" }
  | { status: "loading"; question: string }
  | { status: "answered"; question: string; answer: string }
  | { status: "error"; question: string; error: string; signIn?: boolean };

type AssistResponse = {
  ok?: boolean;
  text?: string;
  error?: string;
  code?: string;
};

/**
 * Session-lifetime kill switch. A deployment without the API key (501) or a
 * signed-out visitor (401) shouldn't keep being offered a feature that can't
 * work, so the palette stops rendering the Ask row after the first such answer.
 */
let assistUnavailable = false;

export function isAssistUnavailable(): boolean {
  return assistUnavailable;
}

const GENERIC_ERROR = "Ask couldn’t reach the assistant. Try again.";

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

  const ask = useCallback(async (question: string, snapshot: string | null) => {
    const trimmed = question.trim();
    if (!trimmed) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setState({ status: "loading", question: trimmed });

    try {
      const res = await fetch("/api/ai/jump", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed, snapshot }),
        signal: controller.signal,
      });

      let payload: AssistResponse = {};
      try {
        payload = (await res.json()) as AssistResponse;
      } catch {
        // Non-JSON error page — fall through to the generic message.
      }

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

      if (!res.ok || !payload.ok || !payload.text) {
        setState({
          status: "error",
          question: trimmed,
          error: payload.error?.trim() || GENERIC_ERROR,
        });
        return;
      }

      setState({ status: "answered", question: trimmed, answer: payload.text });
    } catch (error) {
      if (controller.signal.aborted) return;
      console.error("[useJumpAssist]", error);
      setState({ status: "error", question: trimmed, error: GENERIC_ERROR });
    }
  }, []);

  return { state, ask, reset };
}
