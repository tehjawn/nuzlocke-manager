import Image from "next/image";

type Shot = {
  src: string;
  alt: string;
  width: number;
  height: number;
};

type Section = {
  title: string;
  blurb: string;
  shots: Shot[];
};

const SECTIONS: Section[] = [
  {
    title: "Adventure difficulty",
    blurb: "Choose Normal when asked how the adventure is going to be.",
    shots: [
      {
        src: "/setup/game-mode/01-difficulty.png",
        alt: "Adventure difficulty prompt with Normal selected",
        width: 1600,
        height: 893,
      },
    ],
  },
  {
    title: "Gamemode",
    blurb:
      "Pokémon Emerald Modern: Gamemode Modern (Encounters New, Type Chart Improved, Pokémon Stats Modern, Fairy Type Modern). Legendary Abilities, Nature Mints, Reusable TMs, and Survive Poison on — then Next.",
    shots: [
      {
        src: "/setup/game-mode/02-gamemode-modern.png",
        alt: "Gamemode screen with Modern preset selected",
        width: 1600,
        height: 988,
      },
      {
        src: "/setup/game-mode/03-gamemode-features.png",
        alt: "Gamemode screen showing Legendary Abilities, Nature Mints, Reusable TMs, and Survive Poison on",
        width: 1600,
        height: 1065,
      },
    ],
  },
  {
    title: "Features",
    blurb:
      "Clock Type RTC · Shiny Chance 8192 · Shiny Colors off · Item Drop off · Unlimited MT off · Easier Feebas off · Frontier Bans Ban — then Next.",
    shots: [
      {
        src: "/setup/game-mode/04-features-clock.png",
        alt: "Features screen with RTC, shiny chance 8192, and related toggles",
        width: 1600,
        height: 1065,
      },
      {
        src: "/setup/game-mode/05-features-next.png",
        alt: "Features screen with Easier Feebas off and Frontier Bans set to Ban before Next",
        width: 1600,
        height: 1068,
      },
    ],
  },
  {
    title: "Randomizer",
    blurb:
      "Randomizer on with starters, wilds, and static Pokémon random. Trainer off. Balancing on; legendaries, type, moves, abilities, evolutions, evo lines, effectiveness, items, and chaos off.",
    shots: [
      {
        src: "/setup/game-mode/06-randomizer-main.png",
        alt: "Randomizer screen with starters, wilds, and static Pokémon randomized",
        width: 1600,
        height: 1070,
      },
      {
        src: "/setup/game-mode/07-randomizer-balance.png",
        alt: "Randomizer screen with balancing on and type, moves, and abilities left off",
        width: 1600,
        height: 1067,
      },
      {
        src: "/setup/game-mode/08-randomizer-evo.png",
        alt: "Randomizer screen with evolutions, items, and chaos mode left off",
        width: 1600,
        height: 1070,
      },
    ],
  },
  {
    title: "Nuzlocke",
    blurb:
      "Nuzlocke Normal with Dupes Clause, Shiny Clause, and Nicknames on. Fainting set to Cemetery.",
    shots: [
      {
        src: "/setup/game-mode/09-nuzlocke.png",
        alt: "Nuzlocke screen with Normal mode, clauses enabled, and fainting set to Cemetery",
        width: 1600,
        height: 1061,
      },
    ],
  },
  {
    title: "Difficulty",
    blurb:
      "Lock Difficulty on · Party Limit off · Level Cap off · Exp. Multiplier ×2.0 · Hard Mode Exp. Default · Catch Rate Default · Player Items yes · Trainer Items yes · Player IVs yes · Player EVs yes · Trainer EVs off · Less Escapes off · Esc. Rope / Dig yes.",
    shots: [
      {
        src: "/setup/game-mode/10-difficulty-caps.png",
        alt: "Difficulty screen with lock on, party limit off, level cap off, and exp multiplier ×2.0",
        width: 1600,
        height: 1068,
      },
      {
        src: "/setup/game-mode/11-difficulty-items.png",
        alt: "Difficulty screen showing catch rate, player and trainer items, and player IVs",
        width: 1600,
        height: 1068,
      },
      {
        src: "/setup/game-mode/12-difficulty-evs.png",
        alt: "Difficulty screen showing player EVs, trainer EVs, and Escape Rope / Dig before Next",
        width: 1600,
        height: 1073,
      },
    ],
  },
  {
    title: "Challenges",
    blurb:
      "Pokécenter and PC Heals yes. Ultra Expensive, Evo Limit, One Type Only, BST Equalizer, Mirror Mode, and Mirror Thief off. Save when it matches.",
    shots: [
      {
        src: "/setup/game-mode/13-challenges.png",
        alt: "Challenges screen with Pokécenter and PC heals on and challenge modifiers off",
        width: 1600,
        height: 1066,
      },
      {
        src: "/setup/game-mode/14-challenges-save.png",
        alt: "Challenges screen ready to save choices and continue",
        width: 1600,
        height: 1062,
      },
    ],
  },
];

/** Screenshot walkthrough of the in-ROM Game Mode wizard for Get Started. */
export function GameModeSettingsGuide() {
  return (
    <div className="space-y-6">
      <p className="text-sm leading-relaxed text-muted">
        Season defaults for Pokémon Emerald Modern. Use L / R in-game to move
        between screens, then Save on Challenges.
      </p>

      <div className="space-y-8">
        {SECTIONS.map((section) => (
          <section key={section.title} className="space-y-3">
            <div>
              <h3 className="text-sm font-bold tracking-tight text-ink">
                {section.title}
              </h3>
              <p className="mt-1 text-sm leading-relaxed text-muted">
                {section.blurb}
              </p>
            </div>
            <div
              className={`grid gap-3 ${
                section.shots.length > 1 ? "sm:grid-cols-2" : "max-w-xl"
              }`}
            >
              {section.shots.map((shot) => (
                <figure
                  key={shot.src}
                  className="overflow-hidden rounded-lg border border-frame bg-surface-2"
                >
                  <Image
                    src={shot.src}
                    alt={shot.alt}
                    width={shot.width}
                    height={shot.height}
                    className="h-auto w-full"
                    sizes="(max-width: 640px) 100vw, 28rem"
                  />
                </figure>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
