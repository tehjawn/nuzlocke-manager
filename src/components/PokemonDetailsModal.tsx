"use client";

import type { ReactNode } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { AvatarPortrait } from "@/components/AvatarPortrait";
import { BondHeart, TrainingTierCaption } from "@/components/BondHeart";
import { CatchTierCaption } from "@/components/CatchTierIcon";
import { EvolutionPath } from "@/components/EvolutionPath";
import { GodPrismRays } from "@/components/GodPrismRays";
import { HeldItemLabel } from "@/components/HeldItemLabel";
import { InfoTip } from "@/components/InfoTip";
import { Modal } from "@/components/Modal";
import { MoveLabel } from "@/components/MoveLabel";
import { PlaystyleChips } from "@/components/PlaystyleChips";
import { PokemonSpriteImage } from "@/components/PokemonSpriteImage";
import { StatGrid, type StatRankChip } from "@/components/StatGrid";
import { SurvivalPollSection } from "@/components/SurvivalPollSection";
import {
  SurvivalSentimentCaption,
  SurvivalSentimentIcon,
} from "@/components/SurvivalPollChip";
import { TombstoneIcon } from "@/components/TombstoneIcon";
import { TypeBadge } from "@/components/TypeBadge";
import { itemDexSlug } from "@/data/item-links";
import { abilityDescription } from "@/data/pokemon-lookups";
import type { PokemonEntry, TrainerProfile } from "@/lib/challenge-types";
import { trainerBoardPath } from "@/lib/team-export";
import {
  catchTierHasChrome,
  summarizeBattleStats,
  summarizeEvs,
  summarizeIvs,
} from "@/lib/iv-quality";
import { keyStatsForSpecies, recommendPlaystyle } from "@/lib/playstyle";
import {
  resolveCatchTier,
  resolveTrainingTier,
} from "@/lib/pokemon-grades";
import {
  baseStatRanksFor,
  statRankHint,
  statRankToneClass,
} from "@/lib/species-ranks";
import {
  baseStatsForSpecies,
  bstOf,
  calcBattleStats,
  calcMaxBattleStats,
  isEmptySpread,
  natureEffectDescription,
  STAT_KEYS,
  STAT_LABELS,
} from "@/lib/stats";
import { toolsHref } from "@/lib/tools-routes";

const ModernEmeraldLearnset = dynamic(
  () =>
    import("@/components/ModernEmeraldLearnset").then(
      (module) => module.ModernEmeraldLearnset,
    ),
  {
    loading: () => (
      <p className="text-[10px] text-muted">Loading Modern Emerald learnset…</p>
    ),
  },
);

/** Owner chip under held item — sprite + handle linking to their board. */
export type PokemonDetailsTrainer = Pick<
  TrainerProfile,
  "id" | "handle" | "avatarSpriteKey" | "avatarBackgroundKey"
>;

type PokemonDetailsModalProps = {
  open: boolean;
  pokemon: PokemonEntry | null;
  onClose: () => void;
  /** Challenge slug — enables the species → Pokédex link (#236). */
  slug?: string;
  /** Own-board: switch into the edit form. */
  onEdit?: () => void;
  /**
   * When false, hide nature / ability / battle stats / IVs / EVs / moves
   * (public viewers and league peek for other trainers).
   */
  showCompetitiveDetails?: boolean;
  /** Survive/Die polls — omit section when challenge flag is off. */
  survivalMarketsEnabled?: boolean;
  /** Highlight the viewer on the resolved callers roster. */
  viewerUserId?: string | null;
  /** Trainer who owns this mon — shown under held item when slug is set. */
  trainer?: PokemonDetailsTrainer | null;
};

function MetaChip({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0 rounded-lg border border-frame/40 bg-surface-2 px-2.5 py-1.5">
      <p className="text-[10px] font-semibold tracking-tight text-muted">
        {label}
      </p>
      <div className="text-sm font-semibold leading-tight">
        {typeof value === "string" ? (
          <p className="truncate">{value}</p>
        ) : (
          value
        )}
      </div>
    </div>
  );
}

export function PokemonDetailsModal({
  open,
  pokemon,
  onClose,
  slug,
  onEdit,
  showCompetitiveDetails = true,
  survivalMarketsEnabled = true,
  viewerUserId = null,
  trainer = null,
}: PokemonDetailsModalProps) {
  if (!open || !pokemon) return null;

  const nickname = pokemon.nickname?.trim() ?? "";
  const showSpeciesInSubtitle = Boolean(nickname);
  const pokedexHref =
    slug && pokemon.pokedexId != null
      ? toolsHref(slug, "pokedex", { id: pokemon.pokedexId })
      : null;
  // Free-typed held items that aren't in the ROM catalog stay unlinked.
  const heldItemSlug = itemDexSlug(pokemon.heldItem);
  const heldItemDexHref =
    slug && heldItemSlug
      ? toolsHref(slug, "itemdex", { item: heldItemSlug })
      : null;
  const speciesLabel = pokedexHref ? (
    <Link
      href={pokedexHref}
      className="text-accent-deep underline-offset-2 hover:underline"
      onClick={onClose}
    >
      {pokemon.species}
    </Link>
  ) : (
    pokemon.species
  );
  // Nickname stays plain text; species is the Pokédex link (title or subtitle).
  const title = nickname || speciesLabel;
  const battle = showCompetitiveDetails
    ? calcBattleStats({
        pokedexId: pokemon.pokedexId,
        level: pokemon.level,
        ivs: pokemon.ivs,
        evs: pokemon.evs,
        nature: pokemon.nature,
      })
    : null;
  const battleMax = showCompetitiveDetails
    ? calcMaxBattleStats({
        pokedexId: pokemon.pokedexId,
        level: pokemon.level,
      })
    : null;
  const moves = showCompetitiveDetails
    ? pokemon.moves.map((m) => m.trim()).filter(Boolean)
    : [];
  const ivs = showCompetitiveDetails ? pokemon.ivs : null;
  const evs = showCompetitiveDetails ? pokemon.evs : null;
  const showIvs = !isEmptySpread(ivs);
  const showEvs = !isEmptySpread(evs);
  const playstyle = showCompetitiveDetails
    ? recommendPlaystyle({
        pokedexId: pokemon.pokedexId,
        nature: pokemon.nature,
        ability: pokemon.ability,
        ivs: showIvs ? ivs : null,
      })
    : null;
  const ivSummary = showIvs
    ? summarizeIvs(ivs, {
        keyStats: keyStatsForSpecies(pokemon.pokedexId),
      })
    : null;
  const evSummary = showEvs ? summarizeEvs(evs) : null;
  const battleSummary =
    battle && battleMax ? summarizeBattleStats(battle, battleMax) : null;
  // Tier chrome is public — it rides on the entry (stamped at redaction) and
  // not on `showCompetitiveDetails`, which gates the spreads themselves.
  const catchTier = resolveCatchTier(pokemon);
  const trainingTier = resolveTrainingTier(pokemon);
  const hasCatchChrome = catchTier !== null && catchTierHasChrome(catchTier);

  // Species-level ranks (Pokédex) — separate from specimen CatchTier under the sprite.
  const baseStats = baseStatsForSpecies(pokemon.pokedexId);
  const bst = baseStats ? bstOf(baseStats) : null;
  const ranks = baseStatRanksFor(pokemon.pokedexId);
  let statRankChips: Partial<
    Record<(typeof STAT_KEYS)[number], StatRankChip>
  > | null = null;
  if (ranks) {
    statRankChips = {};
    for (const key of STAT_KEYS) {
      const result = ranks.perStat[key];
      statRankChips[key] = {
        letter: result.rank,
        toneClass: statRankToneClass(result.rank),
        hint: statRankHint(STAT_LABELS[key], result, ranks.peerCount),
      };
    }
  }

  const levelText =
    pokemon.level != null
      ? showSpeciesInSubtitle
        ? ` · Lv ${pokemon.level}`
        : `Lv ${pokemon.level}`
      : null;
  const hasSubtitleMeta = showSpeciesInSubtitle || levelText != null;
  const hasSubtitle = hasSubtitleMeta || pokemon.isShiny;

  const subtitle = (
    <>
      {showSpeciesInSubtitle ? speciesLabel : null}
      {levelText}
      {pokemon.isShiny ? (
        <span
          className={
            hasSubtitleMeta
              ? "ml-1.5 font-semibold text-accent-2"
              : "font-semibold text-accent-2"
          }
        >
          Shiny ✦
        </span>
      ) : null}
    </>
  );

  const meta = [
    showCompetitiveDetails && pokemon.nature
      ? {
          label: "Nature",
          value: (
            <InfoTip tip={natureEffectDescription(pokemon.nature)}>
              {pokemon.nature}
            </InfoTip>
          ),
        }
      : null,
    showCompetitiveDetails && pokemon.ability
      ? {
          label: "Ability",
          value: (
            <InfoTip tip={abilityDescription(pokemon.ability) ?? ""}>
              {pokemon.ability}
            </InfoTip>
          ),
        }
      : null,
    pokemon.catchRoute ? { label: "Route", value: pokemon.catchRoute } : null,
    pokemon.heldItem
      ? {
          label: "Item",
          value: (
            <HeldItemLabel
              name={pokemon.heldItem}
              href={heldItemDexHref}
              iconSize={18}
            />
          ),
        }
      : null,
    slug && trainer
      ? {
          label: "Trainer",
          value: (
            <Link
              href={trainerBoardPath(slug, trainer.id)}
              className="inline-flex max-w-full items-center gap-1.5 text-accent-deep underline-offset-2 hover:underline"
              onClick={onClose}
              aria-label={`${trainer.handle}'s board`}
            >
              <AvatarPortrait
                avatarSpriteKey={trainer.avatarSpriteKey}
                backgroundKey={trainer.avatarBackgroundKey}
                sizeClass="h-6 w-6"
                width={24}
                height={24}
                alt=""
              />
              <span className="truncate">{trainer.handle}</span>
            </Link>
          ),
        }
      : null,
  ].filter(Boolean) as Array<{ label: string; value: ReactNode }>;

  return (
    <Modal
      open
      title={title}
      subtitle={hasSubtitle ? subtitle : undefined}
      onClose={onClose}
      size="md"
      headerActions={
        onEdit ? (
          <button
            type="button"
            className="pressable border-frame bg-surface px-2.5 py-1 text-xs font-semibold text-ink"
            onClick={onEdit}
          >
            Edit
          </button>
        ) : null
      }
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-[9.5rem_minmax(0,1fr)] sm:items-start">
          {/* Identity rail — fills the old empty left column */}
          <div className="flex flex-col items-center gap-2 sm:items-stretch">
            <div
              className={
                hasCatchChrome
                  ? `pokemon-catch-ring pokemon-catch-ring--emphasis pokemon-catch-ring--${catchTier} w-full max-w-[9.5rem] sm:max-w-none`
                  : undefined
              }
            >
              <div
                className={`relative mx-auto flex h-36 w-36 items-center justify-center rounded-lg border sm:mx-0 sm:h-auto sm:w-full sm:aspect-square ${
                  hasCatchChrome
                    ? `pokemon-catch-sprite pokemon-catch-sprite--emphasis pokemon-catch-sprite--${catchTier}`
                    : "border-frame bg-surface-2"
                }`}
              >
                {catchTier === "god" ? <GodPrismRays /> : null}
                <PokemonSpriteImage
                  alt=""
                  className="pixelated h-28 w-28 object-contain sm:h-[85%] sm:w-[85%]"
                  height={144}
                  pokedexId={pokemon.pokedexId}
                  shiny={pokemon.isShiny}
                  species={pokemon.species}
                  width={144}
                />
                {pokemon.survivalPoll && pokemon.survivalPoll.total > 0 ? (
                  <SurvivalSentimentIcon
                    className="pokemon-survival-sentiment--corner h-4 w-4"
                    poll={pokemon.survivalPoll}
                  />
                ) : null}
                {trainingTier !== null ? (
                  <BondHeart
                    className="pokemon-bond-heart--corner h-4 w-4"
                    tier={trainingTier}
                  />
                ) : null}
              </div>
            </div>
            {(catchTier !== null ||
              (pokemon.survivalPoll && pokemon.survivalPoll.total > 0) ||
              trainingTier !== null) && (
              <div className="flex w-full flex-col gap-1">
                {catchTier !== null ? (
                  <CatchTierCaption tier={catchTier} variant="chip" />
                ) : null}
                {pokemon.survivalPoll && pokemon.survivalPoll.total > 0 ? (
                  <SurvivalSentimentCaption
                    poll={pokemon.survivalPoll}
                    variant="chip"
                  />
                ) : null}
                {trainingTier !== null ? (
                  <TrainingTierCaption tier={trainingTier} variant="chip" />
                ) : null}
              </div>
            )}
            {pokemon.types.length > 0 ? (
              <div className="flex flex-wrap justify-center gap-1 sm:justify-start">
                {pokemon.types.map((t) => (
                  <TypeBadge key={t} type={t} />
                ))}
              </div>
            ) : null}
            {meta.length > 0 ? (
              <dl className="hidden w-full space-y-1.5 sm:block">
                {meta.map((row) => (
                  <div key={row.label} className="min-w-0">
                    <dt className="text-[10px] font-semibold tracking-tight text-muted">
                      {row.label}
                    </dt>
                    <dd className="text-sm font-semibold leading-tight">
                      {typeof row.value === "string" ? (
                        <p className="truncate">{row.value}</p>
                      ) : (
                        row.value
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </div>

          <div className="min-w-0 space-y-4">
            {/* Mobile meta — desktop lives under the sprite */}
            {meta.length > 0 ? (
              <div className="grid grid-cols-2 gap-1.5 sm:hidden">
                {meta.map((row) => (
                  <MetaChip
                    key={row.label}
                    label={row.label}
                    value={row.value}
                  />
                ))}
              </div>
            ) : null}

            {playstyle ? (
              <div>
                <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-xs font-semibold tracking-tight text-muted">
                    Playstyle
                  </p>
                  {pokemon.nature ? (
                    <p
                      className={`text-[10px] font-semibold tracking-tight ${
                        playstyle.natureAlignment === "helps"
                          ? "text-accent-deep"
                          : playstyle.natureAlignment === "fights"
                            ? "text-danger"
                            : "text-muted"
                      }`}
                    >
                      {playstyle.natureAlignmentLabel}
                    </p>
                  ) : null}
                </div>
                <PlaystyleChips
                  primary={playstyle.primary}
                  secondary={playstyle.secondary}
                />
                <p className="mt-1.5 text-[11px] leading-snug text-muted">
                  {playstyle.tip}
                </p>
              </div>
            ) : null}

            {baseStats ? (
              <div>
                <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-xs font-semibold tracking-tight text-muted">
                    Species base stats
                  </p>
                  {bst != null ? (
                    <p className="flex items-baseline gap-1.5 text-[11px] font-semibold tabular-nums text-muted">
                      BST {bst}
                      {ranks ? (
                        <span
                          className={`inline-flex items-center rounded border px-1 text-[10px] font-bold leading-tight ${statRankToneClass(ranks.bst.rank)}`}
                          title={statRankHint(
                            "BST",
                            ranks.bst,
                            ranks.peerCount,
                          )}
                        >
                          {ranks.bst.rank}
                        </span>
                      ) : null}
                    </p>
                  ) : null}
                </div>
                <StatGrid compact ranks={statRankChips} spread={baseStats} />
                {ranks ? (
                  <>
                    <p className="mt-1.5 text-[11px] leading-snug text-muted">
                      {ranks.headline}
                    </p>
                    <p className="mt-1 text-[10px] leading-snug text-muted">
                      Letters rank each base stat F→S against the{" "}
                      {ranks.peerCount} Modern Emerald species.
                    </p>
                  </>
                ) : null}
              </div>
            ) : null}

            {battle ? (
              <div>
                <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-xs font-semibold tracking-tight text-muted">
                    Battle stats
                  </p>
                  {battleSummary?.headline ? (
                    <p
                      className={`text-[10px] font-semibold tracking-tight ${
                        battleSummary.cracked
                          ? "text-accent-2"
                          : "text-muted"
                      }`}
                    >
                      {battleSummary.headline}
                    </p>
                  ) : (
                    <p className="text-[10px] text-muted">vs max at this level</p>
                  )}
                </div>
                <StatGrid
                  spread={battle}
                  maxSpread={battleMax}
                  showMax
                  compact
                />
              </div>
            ) : null}

            {showIvs || showEvs ? (
              <div
                className={`grid gap-3 ${
                  showIvs && showEvs ? "sm:grid-cols-2" : ""
                }`}
              >
                {showIvs && ivs ? (
                  <div>
                    <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2">
                      <p className="text-xs font-semibold tracking-tight text-muted">
                        IVs
                      </p>
                      {ivSummary?.headline ? (
                        <p
                          className={`text-[10px] font-semibold tracking-tight ${
                            ivSummary.god
                              ? "pokemon-catch-label--god"
                              : ivSummary.cracked
                                ? "pokemon-catch-label--cracked"
                                : "text-muted"
                          }`}
                        >
                          {ivSummary.headline}
                        </p>
                      ) : null}
                    </div>
                    <StatGrid spread={ivs} tone="iv" compact />
                  </div>
                ) : null}
                {showEvs && evs ? (
                  <div>
                    <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2">
                      <p className="text-xs font-semibold tracking-tight text-muted">
                        EVs
                      </p>
                      {evSummary?.headline ? (
                        <p
                          className={`text-[10px] font-semibold tracking-tight ${
                            evSummary.cracked
                              ? "text-accent-2"
                              : "text-muted"
                          }`}
                        >
                          {evSummary.headline}
                        </p>
                      ) : null}
                    </div>
                    <StatGrid spread={evs} tone="ev" compact />
                  </div>
                ) : null}
              </div>
            ) : null}

            {moves.length > 0 ? (
              <div>
                <p className="mb-1.5 text-xs font-semibold tracking-tight text-muted">
                  Moves
                </p>
                <ul className="grid grid-cols-2 gap-1.5">
                  {moves.map((move, index) => (
                    <li
                      key={`${index}-${move}`}
                      className="rounded-lg border border-frame/40 bg-info px-2 py-1.5 text-sm text-info-ink"
                    >
                      <MoveLabel move={move} />
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {pokemon.pokedexId != null && (
              <ModernEmeraldLearnset pokedexId={pokemon.pokedexId} />
            )}

            {pokemon.pokedexId != null ? (
              <EvolutionPath
                pokedexId={pokemon.pokedexId}
                species={pokemon.species}
                level={pokemon.level}
                heldItem={pokemon.heldItem}
                moves={showCompetitiveDetails ? pokemon.moves : null}
                shiny={pokemon.isShiny}
                slug={slug}
              />
            ) : null}
          </div>
        </div>

        <SurvivalPollSection
          key={pokemon.id}
          pokemonId={pokemon.id}
          enabled={survivalMarketsEnabled}
          viewerUserId={viewerUserId}
        />

        {pokemon.causeOfDeath ? (
          <div className="border-t border-frame/20 pt-3">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
              <TombstoneIcon className="h-3.5 w-3.5 shrink-0" />
              Cause of death
            </p>
            <p className="mt-1 text-sm leading-relaxed text-muted italic">
              {pokemon.causeOfDeath}
            </p>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
