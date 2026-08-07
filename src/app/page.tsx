import Link from "next/link";
import { auth } from "@/auth";
import { SiteHeader, SITE_SHELL_MAX_CLASS } from "@/components/SiteHeader";
import {
  TrainerCarousel,
  type CarouselTrainer,
} from "@/components/TrainerCarousel";
import { getHomeCarouselChallenge, listSeasonIndex } from "@/lib/challenges";
import { CTA_PRIMARY_LG, CTA_SECONDARY_LG } from "@/lib/cta";
import { resolvePlayerSeasonEntryPath } from "@/lib/season-entry";
import { pokemonInSlot } from "@/lib/trainer-display";

export default async function HomePage() {
  const session = await auth();
  const seasons = await listSeasonIndex();
  const activeMeta = seasons.find((c) => c.status === "ACTIVE");
  const active = activeMeta
    ? await getHomeCarouselChallenge(activeMeta.slug)
    : null;

  const openLeagueHref = activeMeta
    ? await resolvePlayerSeasonEntryPath(activeMeta.slug, session?.user?.id)
    : null;

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
        avatarBackgroundKey: trainer.avatarBackgroundKey,
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
      <main
        className={`mx-auto flex w-full flex-1 flex-col items-start justify-center px-4 pb-16 pt-10 sm:px-6 ${SITE_SHELL_MAX_CLASS}`}
      >
        <h1 className="max-w-2xl text-4xl font-bold leading-[1.12] tracking-tight sm:text-5xl">
          <span className="block text-accent-deep">Trash Pack&apos;s</span>
          <span className="mt-1 block">Nuzlocke Challenge Manager</span>
        </h1>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-muted">
          Now open for testing!
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          {activeMeta && openLeagueHref ? (
            <Link href={openLeagueHref} className={CTA_PRIMARY_LG}>
              Open {activeMeta.year} League →
            </Link>
          ) : (
            // TEMP: Seasons index hidden while only one season exists
            <Link href="/about" className={CTA_PRIMARY_LG}>
              About →
            </Link>
          )}
          {!session?.user && (
            <Link href="/login" className={CTA_SECONDARY_LG}>
              Sign in
            </Link>
          )}
        </div>

        {activeMeta && carouselTrainers.length > 0 && (
          <TrainerCarousel
            challengeSlug={activeMeta.slug}
            trainers={carouselTrainers}
          />
        )}
      </main>
    </div>
  );
}
