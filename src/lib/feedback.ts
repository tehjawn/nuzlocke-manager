import "server-only";

import { getPrisma } from "@/lib/db";
import {
  feedbackCategoryLabel,
  feedbackNoteActionKey,
  feedbackReviewActionKey,
  feedbackStatusActionKey,
  feedbackStatusLabel,
  type FeedbackSubmissionItem,
} from "@/lib/feedback-types";
import type {
  SubmitFeedbackInput,
  UpdateFeedbackStatusInput,
} from "@/lib/feedback-validation";
import { getAccessForChallenge, requireGm, requireUserId } from "@/lib/permissions";

const MAX_FEEDBACK_PER_HOUR = 5;

type FeedbackRow = {
  category: FeedbackSubmissionItem["category"];
  createdAt: Date;
  gmNote: string | null;
  id: string;
  message: string;
  status: FeedbackSubmissionItem["status"];
  subject: string;
  updatedAt: Date;
  user: {
    displayName: string | null;
    name: string | null;
  };
};

function toFeedbackItem(row: FeedbackRow): FeedbackSubmissionItem {
  return {
    category: row.category,
    createdAt: row.createdAt.toISOString(),
    gmNote: row.gmNote,
    id: row.id,
    message: row.message,
    requesterName: row.user.displayName ?? row.user.name ?? "Player",
    status: row.status,
    subject: row.subject,
    updatedAt: row.updatedAt.toISOString(),
  };
}

const feedbackSelect = {
  category: true,
  createdAt: true,
  gmNote: true,
  id: true,
  message: true,
  status: true,
  subject: true,
  updatedAt: true,
  user: {
    select: {
      displayName: true,
      name: true,
    },
  },
} as const;

export async function getPlayerFeedbackPage(slug: string) {
  const userId = await requireUserId();
  const prisma = getPrisma();
  const challenge = await prisma.challenge.findUnique({
    where: { slug },
    select: { id: true, name: true, slug: true, year: true },
  });
  if (!challenge) return null;

  const access = await getAccessForChallenge(challenge.id);
  if (!access?.isPlayer) {
    throw new Error("Player access required");
  }

  const rows = await prisma.feedbackSubmission.findMany({
    where: { challengeId: challenge.id, userId },
    orderBy: { createdAt: "desc" },
    select: feedbackSelect,
    take: 20,
  });

  return {
    challenge,
    submissions: rows.map(toFeedbackItem),
  };
}

export async function listFeedbackForGm(
  challengeId: string,
): Promise<FeedbackSubmissionItem[]> {
  await requireGm(challengeId);
  const rows = await getPrisma().feedbackSubmission.findMany({
    where: { challengeId },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    select: feedbackSelect,
    take: 200,
  });
  return rows.map(toFeedbackItem);
}

export async function createFeedbackSubmission(input: SubmitFeedbackInput) {
  const userId = await requireUserId();
  const access = await getAccessForChallenge(input.challengeId);
  if (!access?.isPlayer) {
    throw new Error("Player access required");
  }

  const prisma = getPrisma();
  const [challenge, requester, recentCount] = await Promise.all([
    prisma.challenge.findUnique({
      where: { id: input.challengeId },
      select: {
        memberships: {
          where: { role: "GAME_MASTER" },
          select: { userId: true },
        },
        slug: true,
      },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { displayName: true, name: true },
    }),
    prisma.feedbackSubmission.count({
      where: {
        createdAt: { gte: new Date(Date.now() - 60 * 60 * 1_000) },
        userId,
      },
    }),
  ]);
  if (!challenge) throw new Error("Season not found");
  if (recentCount >= MAX_FEEDBACK_PER_HOUR) {
    throw new Error("Too many recent submissions — try again in an hour");
  }

  const requesterName = requester?.displayName ?? requester?.name ?? "A player";
  return prisma.$transaction(async (tx) => {
    const submission = await tx.feedbackSubmission.create({
      data: {
        category: input.category,
        challengeId: input.challengeId,
        message: input.message,
        subject: input.subject,
        userId,
      },
      select: { id: true },
    });
    if (challenge.memberships.length > 0) {
      await tx.notification.createMany({
        data: challenge.memberships.map(({ userId: gmUserId }) => ({
          actionKey: feedbackReviewActionKey(challenge.slug, submission.id),
          body: `${input.subject} · from ${requesterName}`,
          title: `New ${feedbackCategoryLabel(input.category).toLowerCase()}`,
          type: "FEEDBACK",
          userId: gmUserId,
        })),
      });
    }
    return { id: submission.id, slug: challenge.slug };
  });
}

export async function updateFeedbackStatus(input: UpdateFeedbackStatusInput) {
  await requireGm(input.challengeId);
  const prisma = getPrisma();
  const gmNote = input.gmNote.trim() || null;
  const submission = await prisma.feedbackSubmission.findFirst({
    where: { challengeId: input.challengeId, id: input.submissionId },
    select: {
      challenge: { select: { slug: true } },
      gmNote: true,
      status: true,
      subject: true,
      userId: true,
    },
  });
  if (!submission) throw new Error("Feedback submission not found");

  const statusChanged = submission.status !== input.status;
  const noteChanged = (submission.gmNote ?? null) !== gmNote;
  if (!statusChanged && !noteChanged) {
    return { changed: false, slug: submission.challenge.slug };
  }

  const slug = submission.challenge.slug;

  await prisma.$transaction(async (tx) => {
    await tx.feedbackSubmission.update({
      where: { id: input.submissionId },
      data: {
        ...(statusChanged ? { status: input.status } : {}),
        ...(noteChanged ? { gmNote } : {}),
      },
    });

    if (statusChanged) {
      await tx.notification.upsert({
        where: {
          userId_type_actionKey: {
            actionKey: feedbackStatusActionKey(
              slug,
              input.submissionId,
              input.status,
            ),
            type: "FEEDBACK_STATUS",
            userId: submission.userId,
          },
        },
        create: {
          actionKey: feedbackStatusActionKey(
            slug,
            input.submissionId,
            input.status,
          ),
          body: submission.subject,
          title: `Feedback marked ${feedbackStatusLabel(input.status).toLowerCase()}`,
          type: "FEEDBACK_STATUS",
          userId: submission.userId,
        },
        update: {
          body: submission.subject,
          createdAt: new Date(),
          readAt: null,
          title: `Feedback marked ${feedbackStatusLabel(input.status).toLowerCase()}`,
        },
      });
      return;
    }

    if (noteChanged && gmNote) {
      // Note-only updates notify when a non-empty shared reply is saved/edited.
      await tx.notification.upsert({
        where: {
          userId_type_actionKey: {
            actionKey: feedbackNoteActionKey(slug, input.submissionId),
            type: "FEEDBACK_NOTE",
            userId: submission.userId,
          },
        },
        create: {
          actionKey: feedbackNoteActionKey(slug, input.submissionId),
          body: submission.subject,
          title: "GM left a note on your feedback",
          type: "FEEDBACK_NOTE",
          userId: submission.userId,
        },
        update: {
          body: submission.subject,
          createdAt: new Date(),
          readAt: null,
          title: "GM left a note on your feedback",
        },
      });
    }
  });

  return { changed: true, slug };
}
