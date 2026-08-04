import "dotenv/config";
import { trashPack2026 } from "../src/data/trash-pack-2026";
import { getPrisma, isDatabaseConfigured } from "../src/lib/db";

/**
 * Upserts season content and replaces *unclaimed* demo trainers only.
 * Trainers linked to real Discord users (userId set) are preserved.
 */
async function main() {
  if (!isDatabaseConfigured()) {
    throw new Error("Set DATABASE_URL before seeding");
  }

  const prisma = getPrisma();
  const seed = trashPack2026;

  console.log(`Seeding challenge ${seed.slug}…`);

  const challenge = await prisma.challenge.upsert({
    where: { slug: seed.slug },
    create: {
      slug: seed.slug,
      name: seed.name,
      year: seed.year,
      game: seed.game,
      description: seed.description,
      status: seed.status,
      visibility: seed.visibility,
      playerInviteCode: seed.playerInviteCode,
      gmInviteCode: seed.gmInviteCode ?? "TRASHPACK-GM",
    },
    update: {
      name: seed.name,
      year: seed.year,
      game: seed.game,
      description: seed.description,
      status: seed.status,
      visibility: seed.visibility,
      playerInviteCode: seed.playerInviteCode,
      gmInviteCode: seed.gmInviteCode ?? "TRASHPACK-GM",
    },
  });

  // Refresh rules / faqs / badges (idempotent-ish: clear & recreate season meta)
  await prisma.challengeRule.deleteMany({ where: { challengeId: challenge.id } });
  await prisma.faqEntry.deleteMany({ where: { challengeId: challenge.id } });

  await prisma.challengeRule.createMany({
    data: seed.rules.map((r) => ({
      challengeId: challenge.id,
      sortOrder: r.sortOrder,
      title: r.title,
      body: r.body,
      isCore: r.isCore,
    })),
  });
  await prisma.faqEntry.createMany({
    data: seed.faqs.map((f) => ({
      challengeId: challenge.id,
      sortOrder: f.sortOrder,
      question: f.question,
      answer: f.answer,
    })),
  });

  for (const badge of seed.badges) {
    await prisma.badgeDefinition.upsert({
      where: {
        challengeId_key: { challengeId: challenge.id, key: badge.key },
      },
      create: {
        challengeId: challenge.id,
        key: badge.key,
        label: badge.label,
        category: badge.category,
        sortOrder: badge.sortOrder,
        leaderName: badge.leaderName ?? null,
      },
      update: {
        label: badge.label,
        category: badge.category,
        sortOrder: badge.sortOrder,
        leaderName: badge.leaderName ?? null,
      },
    });
  }

  const badges = await prisma.badgeDefinition.findMany({
    where: { challengeId: challenge.id },
  });

  // Remove demo / unclaimed trainers only — keep real players
  const removed = await prisma.trainerProfile.deleteMany({
    where: { challengeId: challenge.id, userId: null },
  });
  console.log(`  Removed ${removed.count} unclaimed demo trainer(s)`);

  for (const trainer of seed.trainers) {
    const created = await prisma.trainerProfile.create({
      data: {
        challengeId: challenge.id,
        handle: trainer.handle,
        realName: trainer.realName,
        avatarSpriteKey: trainer.avatarSpriteKey,
        statusText: trainer.statusText,
        statusEmoji: trainer.statusEmoji,
        reviveUsed: trainer.reviveUsed,
        wipeCount: trainer.wipeCount ?? 0,
        mainSquadLocked: trainer.mainSquadLocked,
        sortOrder: trainer.sortOrder,
        pokemon: {
          create: trainer.pokemon.map((p) => ({
            slot: p.slot,
            partyIndex: p.partyIndex,
            nickname: p.nickname,
            species: p.species,
            pokedexId: p.pokedexId,
            isShiny: p.isShiny,
            types: p.types,
            nature: p.nature,
            level: p.level,
            ability: p.ability,
            catchRoute: p.catchRoute,
            heldItem: p.heldItem,
            moves: p.moves,
            ivs: p.ivs ?? undefined,
            evs: p.evs ?? undefined,
            causeOfDeath: p.causeOfDeath,
            diedOnRun: p.diedOnRun ?? null,
          })),
        },
      },
    });

    const { createInitialActiveRunInTx } = await import("../src/lib/trainer-runs");
    const activeRun = await createInitialActiveRunInTx(prisma, created.id, {
      wipeCount: trainer.wipeCount ?? 0,
      reviveUsed: trainer.reviveUsed,
    });
    // Seed showcase graves are run 1 losses; living board sits on the active run.
    await prisma.pokemonEntry.updateMany({
      where: { trainerId: created.id, slot: "GRAVEYARD" },
      data: { runId: activeRun.id },
    });
    await prisma.pokemonEntry.updateMany({
      where: {
        trainerId: created.id,
        slot: { in: ["MAIN", "RESERVE", "ENCOUNTERED"] },
      },
      data: { runId: activeRun.id },
    });

    const earned = new Set(trainer.earnedBadgeKeys);
    for (const badge of badges) {
      await prisma.badgeProgress.create({
        data: {
          trainerId: created.id,
          badgeId: badge.id,
          earned: earned.has(badge.key),
          earnedAt: earned.has(badge.key) ? new Date() : null,
        },
      });
    }
  }

  await prisma.activityEvent.create({
    data: {
      challengeId: challenge.id,
      type: "NOTE",
      message:
        "Season refreshed: rules, FAQ, and badges. Discord login auto-provisions player trainers.",
    },
  });

  const kept = await prisma.trainerProfile.count({
    where: { challengeId: challenge.id, userId: { not: null } },
  });
  const demo = await prisma.trainerProfile.count({
    where: { challengeId: challenge.id, userId: null },
  });

  console.log("Seed complete.");
  console.log(`  Kept ${kept} player-linked trainer(s)`);
  console.log(`  Demo / unclaimed trainer(s): ${demo}`);
  console.log(`  GM invite: ${challenge.gmInviteCode}`);
  console.log(`  Player invite: ${challenge.playerInviteCode ?? "(none — public auto-join)"}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    try {
      await getPrisma().$disconnect();
    } catch {
      // ignore
    }
  });
