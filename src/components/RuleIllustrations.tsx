import Image from "next/image";
import { heldItemSpriteUrl } from "@/data/pokemon-index";
import { pokemonSpriteUrl, trainerSpriteUrl } from "@/lib/sprites";

export type RuleIllustrationKind =
  | "faint-dead"
  | "no-dup-items"
  | "revive-token"
  | "honor-system";

/** Map rule titles (seed or GM-edited close variants) to illustration kinds. */
export function ruleIllustrationKind(
  title: string | null | undefined,
): RuleIllustrationKind | null {
  const key = (title ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

  if (
    key.includes("fainted") ||
    key.includes("faint dead") ||
    key === "faint dead"
  ) {
    return "faint-dead";
  }
  if (key.includes("duplicate held") || key.includes("no duplicate")) {
    return "no-dup-items";
  }
  if (key.includes("revive")) {
    return "revive-token";
  }
  if (key.includes("honor")) {
    return "honor-system";
  }
  return null;
}

export function RuleIllustration({ kind }: { kind: RuleIllustrationKind }) {
  switch (kind) {
    case "faint-dead":
      return <FaintDeadIllustration />;
    case "no-dup-items":
      return <NoDupItemsIllustration />;
    case "revive-token":
      return <ReviveTokenIllustration />;
    case "honor-system":
      return <HonorSystemIllustration />;
  }
}

function FlowArrow() {
  return (
    <span
      className="px-1 text-lg font-bold text-muted sm:px-2 sm:text-xl"
      aria-hidden
    >
      →
    </span>
  );
}

function Sprite({
  src,
  alt,
  className = "",
  size = 72,
}: {
  src: string;
  alt: string;
  className?: string;
  size?: number;
}) {
  return (
    <Image
      src={src}
      alt={alt}
      width={size}
      height={size}
      className={`pixelated object-contain ${className}`}
      unoptimized
    />
  );
}

function FaintDeadIllustration() {
  const pikachu = pokemonSpriteUrl("Pikachu", { pokedexId: 25 });
  return (
    <div
      className="flex flex-wrap items-center justify-center gap-2 py-2 sm:gap-3"
      role="img"
      aria-label="Fainted Pikachu becomes a tombstone marked R.I.P."
    >
      <Sprite
        src={pikachu}
        alt=""
        className="h-16 w-16 opacity-55 grayscale sm:h-[72px] sm:w-[72px]"
      />
      <FlowArrow />
      <Tombstone />
    </div>
  );
}

function Tombstone() {
  return (
    <div
      className="relative flex h-[72px] w-14 flex-col items-center justify-end sm:w-16"
      aria-hidden
    >
      <div className="flex h-14 w-12 flex-col items-center justify-center rounded-t-[999px] border-2 border-frame bg-surface-2 shadow-sm sm:h-16 sm:w-14">
        <span className="font-display text-[10px] font-bold tracking-wide text-ink sm:text-xs">
          R.I.P.
        </span>
      </div>
      <div className="h-1.5 w-[52px] rounded-sm border border-frame bg-surface-2 sm:w-14" />
    </div>
  );
}

function NoDupItemsIllustration() {
  const pikachu = pokemonSpriteUrl("Pikachu", { pokedexId: 25 });
  const bulbasaur = pokemonSpriteUrl("Bulbasaur", { pokedexId: 1 });
  const blackBelt = heldItemSpriteUrl("black-belt");

  return (
    <div
      className="flex flex-wrap items-end justify-center gap-6 py-3 sm:gap-10"
      role="img"
      aria-label="Pikachu and Bulbasaur each with a Black Belt; Bulbasaur marked No for duplicate held items"
    >
      <MonWithItem sprite={pikachu} item={blackBelt} label="Pikachu" />
      <MonWithItem
        sprite={bulbasaur}
        item={blackBelt}
        label="Bulbasaur"
        banned
      />
    </div>
  );
}

function MonWithItem({
  sprite,
  item,
  label,
  banned = false,
}: {
  sprite: string;
  item: string;
  label: string;
  banned?: boolean;
}) {
  return (
    <div className="relative flex w-20 flex-col items-center sm:w-24">
      <div className="relative mb-1 flex h-8 items-center justify-center gap-1">
        <Sprite src={item} alt="" size={28} className="h-7 w-7" />
        {banned ? (
          <span className="text-sm font-bold tracking-wide text-danger">
            No
          </span>
        ) : null}
      </div>
      <Sprite
        src={sprite}
        alt=""
        className="h-16 w-16 sm:h-[72px] sm:w-[72px]"
      />
      <span className="mt-1 text-[11px] text-muted">{label}</span>
    </div>
  );
}

function ReviveTokenIllustration() {
  const pikachu = pokemonSpriteUrl("Pikachu", { pokedexId: 25 });
  const revive = heldItemSpriteUrl("revive");

  return (
    <div
      className="flex flex-wrap items-center justify-center gap-2 py-2 sm:gap-3"
      role="img"
      aria-label="Fainted Pikachu, Revive item, then a healthy Pikachu"
    >
      <Sprite
        src={pikachu}
        alt=""
        className="h-16 w-16 opacity-55 grayscale sm:h-[72px] sm:w-[72px]"
      />
      <FlowArrow />
      <Sprite src={revive} alt="" size={40} className="h-10 w-10" />
      <FlowArrow />
      <Sprite
        src={pikachu}
        alt=""
        className="h-16 w-16 sm:h-[72px] sm:w-[72px]"
      />
    </div>
  );
}

function HonorSystemIllustration() {
  const trainer = trainerSpriteUrl("red");
  return (
    <div
      className="flex flex-col items-center gap-2 py-2"
      role="img"
      aria-label="Pokémon trainer with a halo"
    >
      <div className="relative pt-5">
        <span
          className="absolute left-1/2 top-0 h-3 w-10 -translate-x-1/2 rounded-[100%] border-2 border-accent-2 bg-accent-2/30"
          aria-hidden
        />
        <Sprite
          src={trainer}
          alt=""
          size={80}
          className="h-20 w-20 sm:h-[88px] sm:w-[88px]"
        />
      </div>
    </div>
  );
}
