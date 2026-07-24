import Link from "next/link";
import { auth } from "@/auth";
import { SiteHeader } from "@/components/SiteHeader";
import {
  TrainerCarousel,
  type CarouselTrainer,
} from "@/components/TrainerCarousel";
import { listChallenges } from "@/lib/challenges";
import { pokemonInSlot } from "@/lib/trainer-display";

export default async function HomePage() {
  const session = await auth();
  const challenges = await listChallenges();
  const active = challenges.find((c) => c.status === "ACTIVE");

  const carouselTrainers: CarouselTrainer[] = (active?.trainers ?? [])
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((trainer) => {
      const lead = pokemonInSlot(trainer, "MAIN")[0] ?? null;
      return {
        id: trainer.id,
        handle: trainer.handle,
        realName: trainer.realName,
        avatarSpriteKey: trainer.avatarSpriteKey,
        badgeCount: trainer.earnedBadgeKeys.length,
        leadPokemon: lead
          ? {
              species: lead.species,
              nickname: lead.nickname,
              pokedexId: lead.pokedexId,
              isShiny: lead.isShiny,
            }
          : null,
      };
    });

  return (
    <div className="flex flex-1 flex-col overflow-x-hidden">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-start justify-center px-4 pb-16 pt-10 sm:px-6">
        <h1 className="font-pixel max-w-2xl text-4xl font-semibold leading-[1.15] sm:text-5xl">
          <span className="block text-accent-deep">Trash Pack&apos;s</span>
          <span className="mt-1 block">Nuzlocke Challenge Manager</span>
        </h1>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          {active ? (
            <Link
              href={`/challenges/${active.slug}`}
              className="pressable rounded-sm bg-accent px-5 py-3 font-display text-sm font-bold tracking-wide text-white uppercase"
            >
              Open {active.year} League →
            </Link>
          ) : (
            <Link
              href="/challenges"
              className="pressable rounded-sm bg-accent px-5 py-3 font-display text-sm font-bold tracking-wide text-white uppercase"
            >
              Browse seasons →
            </Link>
          )}
          {!session?.user ? (
            <Link
              href="/login"
              className="pressable rounded-sm bg-surface px-5 py-3 font-display text-sm font-bold tracking-wide uppercase"
            >
              Sign in
            </Link>
          ) : null}
        </div>

        {active && carouselTrainers.length > 0 ? (
          <TrainerCarousel
            challengeSlug={active.slug}
            trainers={carouselTrainers}
          />
        ) : null}
      </main>
    </div>
  );
}
