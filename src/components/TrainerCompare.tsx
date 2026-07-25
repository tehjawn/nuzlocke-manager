"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { BadgeCase } from "@/components/BadgeCase";
import { Frame } from "@/components/Frame";
import type {
  BadgeDefinition,
  TrainerProfile,
} from "@/lib/challenge-types";
import { avatarImageUrl, pokemonSpriteUrl } from "@/lib/sprites";
import { pokemonInSlot } from "@/lib/trainer-display";

type TrainerCompareProps = {
  slug: string;
  trainers: TrainerProfile[];
  badges: BadgeDefinition[];
  initialA?: string | null;
  initialB?: string | null;
};

export function TrainerCompare({
  slug,
  trainers,
  badges,
  initialA = null,
  initialB = null,
}: TrainerCompareProps) {
  const router = useRouter();
  const sorted = useMemo(
    () => [...trainers].sort((a, b) => a.sortOrder - b.sortOrder),
    [trainers],
  );
  const [aId, setAId] = useState(initialA ?? sorted[0]?.id ?? "");
  const [bId, setBId] = useState(
    initialB ?? sorted.find((t) => t.id !== (initialA ?? sorted[0]?.id))?.id ?? "",
  );

  const trainerA = sorted.find((t) => t.id === aId) ?? null;
  const trainerB = sorted.find((t) => t.id === bId) ?? null;

  function updateQuery(nextA: string, nextB: string) {
    setAId(nextA);
    setBId(nextB);
    const params = new URLSearchParams();
    if (nextA) params.set("a", nextA);
    if (nextB) params.set("b", nextB);
    const qs = params.toString();
    router.replace(
      qs ? `/challenges/${slug}/tools?${qs}` : `/challenges/${slug}/tools`,
      { scroll: false },
    );
  }

  if (sorted.length < 2) {
    return (
      <Frame title="Need more trainers">
        <p className="text-sm text-muted">
          Side-by-side compare unlocks once at least two trainers have joined.
        </p>
      </Frame>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          <span className="mb-1 block font-bold text-muted">Trainer A</span>
          <select
            className="w-full rounded-lg border border-frame bg-surface px-3 py-2"
            value={aId}
            onChange={(e) => updateQuery(e.target.value, bId)}
          >
            {sorted.map((t) => (
              <option key={t.id} value={t.id}>
                {t.handle}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-bold text-muted">Trainer B</span>
          <select
            className="w-full rounded-lg border border-frame bg-surface px-3 py-2"
            value={bId}
            onChange={(e) => updateQuery(aId, e.target.value)}
          >
            {sorted.map((t) => (
              <option key={t.id} value={t.id}>
                {t.handle}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {trainerA ? (
          <CompareColumn slug={slug} trainer={trainerA} badges={badges} />
        ) : null}
        {trainerB ? (
          <CompareColumn slug={slug} trainer={trainerB} badges={badges} />
        ) : null}
      </div>
    </div>
  );
}

function CompareColumn({
  slug,
  trainer,
  badges,
}: {
  slug: string;
  trainer: TrainerProfile;
  badges: BadgeDefinition[];
}) {
  const main = pokemonInSlot(trainer, "MAIN");
  const graves = pokemonInSlot(trainer, "GRAVEYARD");

  return (
    <Frame
      title={trainer.handle}
      actions={
        <Link
          href={`/challenges/${slug}/trainers/${trainer.id}`}
          className="text-xs font-semibold text-white/85 hover:text-white"
        >
          Open board →
        </Link>
      }
    >
      <div className="mb-4 flex items-center gap-3">
        <Image
          src={avatarImageUrl(trainer.avatarSpriteKey)}
          alt=""
          width={56}
          height={56}
          className="pixelated h-14 w-14 object-contain"
          unoptimized
        />
        <div className="min-w-0">
          <p className="truncate font-semibold">
            {trainer.realName ?? trainer.handle}
          </p>
          <p className="text-xs text-muted">
            {trainer.earnedBadgeKeys.length} badge
            {trainer.earnedBadgeKeys.length === 1 ? "" : "s"} · {graves.length}{" "}
            fallen
          </p>
          {trainer.statusEmoji || trainer.statusText ? (
            <p className="mt-1 line-clamp-2 text-xs text-muted">
              {trainer.statusEmoji ? (
                <span className="mr-1" aria-hidden>
                  {trainer.statusEmoji}
                </span>
              ) : null}
              {trainer.statusText}
            </p>
          ) : null}
        </div>
      </div>

      <p className="mb-2 text-xs font-bold tracking-tight text-muted">
        Main squad
      </p>
      <ul className="mb-4 grid grid-cols-3 gap-2">
        {Array.from({ length: 6 }, (_, i) => {
          const mon = main.find((m) => m.partyIndex === i) ?? null;
          return (
            <li
              key={i}
              className="flex flex-col items-center rounded-lg border border-frame bg-surface-2 px-1 py-2"
            >
              {mon ? (
                <>
                  <Image
                    src={pokemonSpriteUrl(mon.species, {
                      pokedexId: mon.pokedexId,
                      shiny: mon.isShiny,
                    })}
                    alt=""
                    width={40}
                    height={40}
                    className="pixelated h-10 w-10 object-contain"
                    unoptimized
                  />
                  <span className="mt-1 w-full truncate text-center text-[10px] font-semibold">
                    {mon.nickname?.trim() || mon.species}
                  </span>
                  {mon.level != null ? (
                    <span className="text-[10px] text-muted">Lv {mon.level}</span>
                  ) : null}
                </>
              ) : (
                <span className="text-xs text-muted">—</span>
              )}
            </li>
          );
        })}
      </ul>

      <BadgeCase
        badges={badges}
        earnedKeys={trainer.earnedBadgeKeys}
        layout="column"
      />
    </Frame>
  );
}
