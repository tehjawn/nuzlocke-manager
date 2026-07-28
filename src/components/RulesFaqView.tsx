"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Frame } from "@/components/Frame";
import {
  RuleIllustration,
  ruleIllustrationKind,
} from "@/components/RuleIllustrations";
import type { ChallengeRule, FaqEntry } from "@/lib/challenge-types";

type RulesFaqViewProps = {
  slug: string;
  challengeName: string;
  rules: ChallengeRule[];
  faqs: FaqEntry[];
  initialTab?: "rules" | "faq";
};

export function RulesFaqView({
  slug,
  challengeName,
  rules,
  faqs,
  initialTab = "rules",
}: RulesFaqViewProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const tab =
    tabParam === "faq" || tabParam === "rules" ? tabParam : initialTab;

  const rulesHref = `/challenges/${slug}/rules`;
  const faqHref = `/challenges/${slug}/rules?tab=faq`;
  const toolsHref = `/challenges/${slug}/tools`;

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Rules / FAQ</h2>
          <p className="mt-2 text-muted">
            {tab === "faq"
              ? `Common questions for ${challengeName}.`
              : `How ${challengeName} works. Core Nuzlocke rules first, house rules after.`}
          </p>
        </div>
        <div
          role="tablist"
          aria-label="Rules and FAQ"
          className="gba-inset inline-flex gap-1 bg-surface-2/80 p-1"
        >
          <SubTab href={rulesHref} active={tab === "rules"} pathname={pathname}>
            Rules
          </SubTab>
          <SubTab href={faqHref} active={tab === "faq"} pathname={pathname}>
            FAQ
          </SubTab>
        </div>
      </header>

      {tab === "rules" ? (
        <ol className="space-y-4">
          {rules.map((rule) => {
            const illustration = ruleIllustrationKind(rule.title);
            const showBody = rule.body.trim().length > 0;

            return (
              <li key={rule.id}>
                <Frame
                  title={`${rule.sortOrder}. ${rule.title ?? "Rule"}`}
                  actions={
                    <span className="info-chip text-[11px] font-semibold tracking-tight">
                      {rule.isCore ? "Core" : "House"}
                    </span>
                  }
                >
                  {illustration ? (
                    <RuleIllustration kind={illustration} />
                  ) : null}
                  {showBody ? (
                    <p
                      className={`text-sm leading-relaxed whitespace-pre-wrap ${
                        illustration ? "mt-3" : ""
                      }`}
                    >
                      {rule.body}
                    </p>
                  ) : null}
                </Frame>
              </li>
            );
          })}
        </ol>
      ) : (
        <div className="space-y-4">
          {faqs.map((faq) => (
            <Frame key={faq.id} title={faq.question}>
              <FaqAnswer answer={faq.answer} toolsHref={toolsHref} />
            </Frame>
          ))}
        </div>
      )}
    </div>
  );
}

function FaqAnswer({
  answer,
  toolsHref,
}: {
  answer: string;
  toolsHref: string;
}) {
  const parts = answer.split(/(\[Tools\])/g);
  if (parts.length === 1) {
    return (
      <p className="text-sm leading-relaxed whitespace-pre-wrap">{answer}</p>
    );
  }

  return (
    <p className="text-sm leading-relaxed whitespace-pre-wrap">
      {parts.map((part, i) =>
        part === "[Tools]" ? (
          <Link
            key={`tools-${i}`}
            href={toolsHref}
            className="font-semibold text-interactive underline decoration-interactive/40 underline-offset-2 hover:decoration-interactive"
          >
            Tools
          </Link>
        ) : (
          <span key={`t-${i}`}>{part}</span>
        ),
      )}
    </p>
  );
}

function SubTab({
  href,
  active,
  pathname,
  children,
}: {
  href: string;
  active: boolean;
  pathname: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      role="tab"
      aria-selected={active}
      prefetch
      className={`rounded-[calc(var(--radius-sm)-2px)] border px-3.5 py-1.5 text-sm font-semibold transition-colors ${
        active
          ? "border-interactive/40 bg-interactive-soft text-ink shadow-sm"
          : "border-transparent text-ink hover:bg-surface"
      }`}
      // Keep soft-nav within the season workspace when already on /rules
      replace={pathname.endsWith("/rules")}
      scroll={false}
    >
      {children}
    </Link>
  );
}
