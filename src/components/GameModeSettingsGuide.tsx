import Image from "next/image";

type Shot = {
  src: string;
  alt: string;
};

type Section = {
  title: string;
  blurb: string;
  shots: Shot[];
};

const SECTIONS: Section[] = [
  {
    title: "Game Mode",
    blurb: "Story Mode · Easy/Custom · Gen 4 (Pokémon from Gen 1–4 only).",
    shots: [
      {
        src: "/setup/game-mode/01-game-mode.png",
        alt: "Game Mode screen with Story Mode, Easy/Custom, and Gen 4 selected",
      },
    ],
  },
  {
    title: "Randomizer",
    blurb:
      "Randomizer on with random starters and wilds. Keep trainer/static Pokémon, types, moves, abilities, evolutions, items, and chaos off. Balance on tiers on; legendaries off.",
    shots: [
      {
        src: "/setup/game-mode/02-randomizer-main.png",
        alt: "Randomizer screen with randomizers enabled for starters and wild Pokémon",
      },
      {
        src: "/setup/game-mode/03-randomizer-type.png",
        alt: "Randomizer screen showing type and moves left off",
      },
      {
        src: "/setup/game-mode/04-randomizer-evo.png",
        alt: "Randomizer screen showing evolutions and effectiveness left off",
      },
      {
        src: "/setup/game-mode/05-randomizer-chaos.png",
        alt: "Randomizer screen with chaos mode off before Next",
      },
    ],
  },
  {
    title: "Nuzlocke",
    blurb:
      "Nuzlocke Normal with Dupes Clause, Shiny Clause, and Nicknames on. Fainting set to Cemetery.",
    shots: [
      {
        src: "/setup/game-mode/06-nuzlocke-main.png",
        alt: "Nuzlocke screen with Normal mode and clauses enabled",
      },
      {
        src: "/setup/game-mode/07-nuzlocke-clauses.png",
        alt: "Nuzlocke clauses screen before continuing to difficulty",
      },
    ],
  },
  {
    title: "Difficulty",
    blurb:
      "Match the pack defaults shown here (party limit off, level cap Normal, player items no, trainer items yes, and the IV/EV rows as pictured).",
    shots: [
      {
        src: "/setup/game-mode/08-difficulty-party.png",
        alt: "Difficulty screen with party limit, gym limit, level cap, and EXP multiplier",
      },
      {
        src: "/setup/game-mode/09-difficulty-ivs.png",
        alt: "Difficulty screen showing player and trainer IV settings",
      },
      {
        src: "/setup/game-mode/10-difficulty-next.png",
        alt: "Difficulty screen before continuing to challenges",
      },
    ],
  },
  {
    title: "Challenges",
    blurb:
      "Leave challenge modifiers off (evo limit, megas, monotype, metronome, stat equalizer, mirror). Save when it matches.",
    shots: [
      {
        src: "/setup/game-mode/11-challenges-evo.png",
        alt: "Challenges screen with evo limit and related modifiers off",
      },
      {
        src: "/setup/game-mode/12-challenges-save.png",
        alt: "Challenges screen ready to save choices and continue",
      },
    ],
  },
];

/** Screenshot walkthrough of the in-ROM Game Mode wizard for Get Started. */
export function GameModeSettingsGuide() {
  return (
    <div className="space-y-6">
      <p className="text-sm leading-relaxed text-muted">
        After the intro, work through the Game Mode menus and match the season
        defaults below. Use L / R in-game to move between screens, then Save on
        Challenges.
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
                    width={1024}
                    height={683}
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
