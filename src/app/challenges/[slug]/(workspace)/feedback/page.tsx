import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { FeedbackForm } from "@/components/FeedbackForm";
import { Frame } from "@/components/Frame";
import { MarkdownContent } from "@/components/MarkdownContent";
import { getPlayerFeedbackPage } from "@/lib/feedback";
import {
  feedbackCategoryLabel,
  feedbackStatusClass,
  feedbackStatusLabel,
  formatFeedbackDate,
} from "@/lib/feedback-types";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export const metadata: Metadata = {
  title: "Feedback",
};

export default async function FeedbackPage({ params }: PageProps) {
  const session = await auth();
  const { slug } = await params;
  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=/challenges/${slug}/feedback`);
  }

  const page = await getPlayerFeedbackPage(slug);
  if (!page) notFound();

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-accent-deep">
          Player support
        </p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">Send feedback</h1>
        <p className="mt-2 max-w-2xl leading-relaxed text-muted">
          Report a bug, request a feature, or ask the {page.challenge.name} GMs
          for help. Your name is attached so they can follow up.
        </p>
      </div>

      <Frame title="New request">
        <FeedbackForm challengeId={page.challenge.id} />
      </Frame>

      <Frame title="Your requests">
        {page.submissions.length === 0 ? (
          <p className="text-sm text-muted">
            You have not sent any feedback for this season yet.
          </p>
        ) : (
          <ol className="space-y-3">
            {page.submissions.map((submission) => (
              <li
                className="rounded-xl border border-frame bg-surface-2/55 p-4"
                key={submission.id}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                      {feedbackCategoryLabel(submission.category)} ·{" "}
                      {formatFeedbackDate(submission.createdAt)}
                    </p>
                    <h2 className="mt-1 font-bold tracking-tight">
                      {submission.subject}
                    </h2>
                  </div>
                  <span
                    className={`rounded-lg border px-2 py-1 text-xs font-bold ${feedbackStatusClass(submission.status)}`}
                  >
                    {feedbackStatusLabel(submission.status)}
                  </span>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted">
                  {submission.message}
                </p>
                {submission.gmNote ? (
                  <div
                    className="mt-3 rounded-lg border border-accent/25 bg-accent/8 px-3 py-2.5"
                    data-testid={`feedback-gm-note-${submission.id}`}
                  >
                    <p className="text-xs font-semibold uppercase tracking-wide text-accent-deep">
                      GM note
                    </p>
                    <MarkdownContent
                      className="mt-1 text-sm leading-relaxed"
                      content={submission.gmNote}
                    />
                  </div>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </Frame>
    </div>
  );
}
