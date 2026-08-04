export type JumpCategory =
  | "navigate"
  | "trainer"
  | "pokemon"
  | "badge"
  | "rules"
  | "guide"
  | "action";

export type JumpResult = {
  id: string;
  title: string;
  subtitle: string;
  href?: string;
  category: JumpCategory;
  /** Extra tokens for fuzzy matching (handles, species, routes, etc.). */
  tags: string[];
  /** Optional left icon URL (trainer avatar / Pokémon sprite). */
  imageUrl?: string;
  /** Pokémon image data resolved against the player's sprite preference. */
  pokemonSprite?: {
    pokedexId: number | null;
    shiny: boolean;
    species: string;
  };
  /** Non-navigation command key (e.g. theme toggle). */
  action?: "toggle-theme";
};

export type JumpSeasonContext = {
  slug: string;
  name: string;
  year: number;
  status: string;
  showGm: boolean;
  myTrainerId: string | null;
  /** First-run funnel (#183): limit Jump to Setup + My Trainer. */
  firstRun?: boolean;
  trainers: Array<{
    id: string;
    handle: string;
    realName: string | null;
    discordUsername: string | null;
    discordDisplayName: string | null;
    avatarSpriteKey: string;
    earnedBadgeKeys: string[];
    statusText: string | null;
    pokemon: Array<{
      id: string;
      slot: string;
      nickname: string | null;
      species: string;
      pokedexId: number | null;
      isShiny: boolean;
      catchRoute: string | null;
      level: number | null;
    }>;
  }>;
  badges: Array<{
    key: string;
    label: string;
    category: string;
    leaderName?: string | null;
  }>;
  rules: Array<{ id: string; title: string | null; body: string }>;
  faqs: Array<{ id: string; question: string; answer: string }>;
};

export type JumpFuseHit = {
  item: JumpResult;
  matches?: ReadonlyArray<{
    key?: string;
    indices: ReadonlyArray<readonly [number, number]>;
  }>;
};
