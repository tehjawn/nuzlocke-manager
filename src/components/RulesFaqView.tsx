"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Frame } from "@/components/Frame";
import { MarkdownContent } from "@/components/MarkdownContent";
import { ModeTabs } from "@/components/ModeTabs";
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
      <header>
        <h2 className="text-2xl font-bold tracking-tight">Rules / FAQ</h2>
        <p className="mt-2 text-muted">
          {tab === "faq"
            ? `Common questions for ${challengeName}.`
            : `How ${challengeName} works. Core Nuzlocke rules first, house rules after.`}
        </p>
      </header>

      <ModeTabs
        aria-label="Rules and FAQ"
        idPrefix="rules-faq"
        value={tab}
        tabs={[
          { id: "rules", label: "Rules", href: rulesHref },
          { id: "faq", label: "FAQ", href: faqHref },
        ]}
        linkReplace={pathname.endsWith("/rules")}
        linkScroll={false}
      >
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
                    {illustration && <RuleIllustration kind={illustration} />}
                    {showBody && (
                      <MarkdownContent
                        className={illustration ? "mt-3" : ""}
                        content={rule.body}
                        toolsHref={toolsHref}
                      />
                    )}
                  </Frame>
                </li>
              );
            })}
          </ol>
        ) : (
          <div className="space-y-4">
            {faqs.map((faq) => (
              <Frame key={faq.id} title={faq.question}>
                <MarkdownContent content={faq.answer} toolsHref={toolsHref} />
              </Frame>
            ))}
          </div>
        )}
      </ModeTabs>
    </div>
  );
}
