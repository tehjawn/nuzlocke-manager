import "dotenv/config";
import { trashPack2026 } from "../src/data/trash-pack-2026";
import { getPrisma, isDatabaseConfigured } from "../src/lib/db";

async function main() {
  if (!isDatabaseConfigured()) {
    throw new Error("Set DATABASE_URL before seeding");
  }

  const prisma = getPrisma();
  const seed = trashPack2026;

  console.log(`Seeding challenge ${seed.slug}…`);

  await prisma.challenge.deleteMany({ where: { slug: seed.slug } });

  const challenge = await prisma.challenge.create({
    data: {
      slug: seed.slug,
      name: seed.name,
      year: seed.year,
      game: seed.game,
      description: seed.description,
      status: seed.status,
      visibility: seed.visibility,
      playerInviteCode: seed.playerInviteCode ?? "TRASHPACK2026",
      gmInviteCode: seed.gmInviteCode ?? "TRASHPACK-GM",
      badges: {
        create: seed.badges.map((b) => ({
          key: b.key,
          label: b.label,
          category: b.category,
          sortOrder: b.sortOrder,
          leaderName: b.leaderName ?? null,
        })),
      },
      rules: {
        create: seed.rules.map((r) => ({
          sortOrder: r.sortOrder,
          title: r.title,
          body: r.body,
          isCore: r.isCore,
        })),
      },
      faqs: {
        create: seed.faqs.map((f) => ({
          sortOrder: f.sortOrder,
          question: f.question,
          answer: f.answer,
        })),
      },
    },
    include: { badges: true },
  });

  const badgeByKey = new Map(challenge.badges.map((b) => [b.key, b.id]));

  for (const trainer of seed.trainers) {
    const created = await prisma.trainerProfile.create({
      data: {
        challengeId: challenge.id,
        handle: trainer.handle,
        realName: trainer.realName,
        avatarSpriteKey: trainer.avatarSpriteKey,
        statusText: trainer.statusText,
        reviveUsed: trainer.reviveUsed,
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
            causeOfDeath: p.causeOfDeath,
          })),
        },
      },
    });

    for (const key of trainer.earnedBadgeKeys) {
      const badgeId = badgeByKey.get(key);
      if (!badgeId) continue;
      await prisma.badgeProgress.create({
        data: {
          trainerId: created.id,
          badgeId,
          earned: true,
          earnedAt: new Date(),
        },
      });
    }
  }

  await prisma.activityEvent.create({
    data: {
      challengeId: challenge.id,
      type: "NOTE",
      message: "Trash Pack 2026 season seeded into the clubhouse.",
    },
  });

  console.log("Seed complete.");
  console.log(`  Player invite: ${challenge.playerInviteCode}`);
  console.log(`  GM invite:     ${challenge.gmInviteCode}`);
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
